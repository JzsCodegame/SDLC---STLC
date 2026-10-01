#!/usr/bin/env bash
set -euo pipefail
exec > >(tee -a /var/log/quiz-lab-bootstrap.log) 2>&1
source /etc/quiz-lab.env

# The block volume is the only student home. Refuse to start on ephemeral root disk.
for attempt in $(seq 1 30); do
  if blkid -L quiz-home >/dev/null 2>&1; then break; fi
  sleep 2
done
blkid -L quiz-home >/dev/null
install -d -m 0755 /home/coder
if ! grep -q '^LABEL=quiz-home ' /etc/fstab; then
  printf 'LABEL=quiz-home /home/coder ext4 defaults 0 2\n' >>/etc/fstab
fi
mountpoint -q /home/coder || mount /home/coder
id coder >/dev/null 2>&1 || useradd --home-dir /home/coder --shell /bin/bash --uid 1001 coder
chown coder:coder /home/coder

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl git xz-utils chromium xvfb fluxbox x11vnc \
  novnc websockify nftables libicu72 libssl3 libatomic1 \
  libgtk-3-0 libgbm1 libnss3 libasound2 libxss1 libxtst6 libatk-bridge2.0-0

# A student's processes cannot query the Droplet metadata service.
cat >/etc/nftables.conf <<'NFT'
#!/usr/sbin/nft -f
flush ruleset
table inet quiz_lab {
  chain output {
    type filter hook output priority 0; policy accept;
    meta skuid 1001 ip daddr 169.254.169.254 drop
  }
}
NFT
systemctl enable --now nftables

download_verified() {
  local url="$1" hash="$2" output="$3"
  curl --fail --location --retry 3 --silent --show-error "$url" -o "$output"
  printf '%s  %s\n' "$hash" "$output" | sha256sum --check --status
}

node_archive=/tmp/node-v24.21.0-linux-x64.tar.xz
download_verified \
  https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz \
  fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6 \
  "$node_archive"
mkdir -p /opt/node
tar -xJf "$node_archive" -C /opt/node --strip-components=1
ln -sfn /opt/node/bin/node /usr/local/bin/node
ln -sfn /opt/node/bin/npm /usr/local/bin/npm
ln -sfn /opt/node/bin/npx /usr/local/bin/npx

pwsh_archive=/tmp/powershell-7.6.6-linux-x64.tar.gz
download_verified \
  https://github.com/PowerShell/PowerShell/releases/download/v7.6.6/powershell-7.6.6-linux-x64.tar.gz \
  ddbc4a2d113bbd46d283cfedcbcd117a70caefd7673f41f2b4e0000badf103bc \
  "$pwsh_archive"
mkdir -p /opt/powershell/7.6.6
tar -xzf "$pwsh_archive" -C /opt/powershell/7.6.6
chmod +x /opt/powershell/7.6.6/pwsh
ln -sfn /opt/powershell/7.6.6/pwsh /usr/local/bin/pwsh

code_archive=/tmp/code-server-4.139.1-linux-amd64.tar.gz
download_verified \
  https://github.com/coder/code-server/releases/download/v4.139.1/code-server-4.139.1-linux-amd64.tar.gz \
  "$CODE_SERVER_SHA256" "$code_archive"
mkdir -p /opt/code-server
tar -xzf "$code_archive" -C /opt/code-server --strip-components=1

cat >/etc/systemd/system/quiz-coder-agent.service <<'UNIT'
[Unit]
Description=Coder agent for Mini Quiz lab
After=network-online.target
Wants=network-online.target
RequiresMountsFor=/home/coder
[Service]
Type=simple
User=coder
EnvironmentFile=/etc/coder-agent.env
Environment=DISPLAY=:99
Environment=CYPRESS_BROWSER=chromium
WorkingDirectory=/home/coder
ExecStartPre=/usr/bin/mountpoint -q /home/coder
ExecStart=/bin/bash /usr/local/lib/coder-agent-init
Restart=always
RestartSec=10
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
UNIT

cat >/etc/systemd/system/quiz-ide.service <<'UNIT'
[Unit]
Description=Mini Quiz browser IDE
After=network-online.target
RequiresMountsFor=/home/coder
[Service]
User=coder
WorkingDirectory=/home/coder
Environment=DISPLAY=:99
Environment=CYPRESS_BROWSER=chromium
ExecStartPre=/usr/bin/mountpoint -q /home/coder
ExecStart=/opt/code-server/bin/code-server --auth none --bind-addr 127.0.0.1:13337 /home/coder
Restart=always
RestartSec=5
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
UNIT

cat >/etc/systemd/system/quiz-display.service <<'UNIT'
[Unit]
Description=Private lab X display
RequiresMountsFor=/home/coder
[Service]
User=coder
ExecStartPre=/usr/bin/mountpoint -q /home/coder
ExecStart=/usr/bin/Xvfb :99 -screen 0 1280x800x24 -nolisten tcp
Restart=always
[Install]
WantedBy=multi-user.target
UNIT

cat >/etc/systemd/system/quiz-window-manager.service <<'UNIT'
[Unit]
Description=Private lab window manager
After=quiz-display.service
Requires=quiz-display.service
RequiresMountsFor=/home/coder
[Service]
User=coder
Environment=DISPLAY=:99
ExecStartPre=/usr/bin/mountpoint -q /home/coder
ExecStart=/usr/bin/fluxbox
Restart=always
[Install]
WantedBy=multi-user.target
UNIT

cat >/etc/systemd/system/quiz-vnc.service <<'UNIT'
[Unit]
Description=Loopback VNC bridge
After=quiz-display.service
Requires=quiz-display.service
RequiresMountsFor=/home/coder
[Service]
User=coder
ExecStartPre=/usr/bin/mountpoint -q /home/coder
ExecStart=/usr/bin/x11vnc -display :99 -localhost -forever -shared -rfbport 5900 -nopw
Restart=always
[Install]
WantedBy=multi-user.target
UNIT

cat >/etc/systemd/system/quiz-novnc.service <<'UNIT'
[Unit]
Description=Loopback browser view bridge
After=quiz-vnc.service
Requires=quiz-vnc.service
RequiresMountsFor=/home/coder
[Service]
User=coder
ExecStartPre=/usr/bin/mountpoint -q /home/coder
ExecStart=/usr/bin/websockify --web=/usr/share/novnc 127.0.0.1:6080 127.0.0.1:5900
Restart=always
[Install]
WantedBy=multi-user.target
UNIT

cat >/etc/systemd/system/quiz-chromium.service <<'UNIT'
[Unit]
Description=Private interactive Chromium
After=quiz-window-manager.service
Requires=quiz-window-manager.service
RequiresMountsFor=/home/coder
[Service]
User=coder
Environment=DISPLAY=:99
WorkingDirectory=/home/coder
ExecStartPre=/usr/bin/mountpoint -q /home/coder
ExecStart=/usr/bin/chromium --no-first-run --no-default-browser-check --user-data-dir=/home/coder/.config/chromium about:blank
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT

repo=/home/coder/academy
if [ ! -d "$repo/.git" ]; then
  runuser -u coder -- git clone --no-checkout "$APP_GIT_URL" "$repo"
  runuser -u coder -- git -C "$repo" checkout --detach "$APP_GIT_COMMIT"
  printf '%s\n' "$APP_GIT_COMMIT" >/home/coder/.quiz-seed-commit
  chown coder:coder /home/coder/.quiz-seed-commit
fi
# Existing volume is student-owned: do not reset or checkout on VM recreation.
app="$repo/automation-lab/practice-app"
test -f "$app/package-lock.json"
cd "$app"
runuser -u coder -- npm ci
npx playwright install-deps chromium
runuser -u coder -- npm run build
runuser -u coder -- npx playwright install chromium
runuser -u coder -- npx cypress install
runuser -u coder -- npx cypress verify
install -d -o coder -g coder /home/coder/data
install -d -o coder -g coder /home/coder/.local/share/code-server/User
cat >/home/coder/.local/share/code-server/User/settings.json <<'JSON'
{
  "terminal.integrated.profiles.linux": {
    "PowerShell": { "path": "/usr/local/bin/pwsh" }
  },
  "terminal.integrated.defaultProfile.linux": "PowerShell"
}
JSON
chown coder:coder /home/coder/.local/share/code-server/User/settings.json

cat >/etc/systemd/system/quiz-preview.service <<'UNIT'
[Unit]
Description=Mini Quiz practice app preview
After=network-online.target
Wants=network-online.target
RequiresMountsFor=/home/coder
[Service]
User=coder
WorkingDirectory=/home/coder/academy/automation-lab/practice-app
Environment=HOST=127.0.0.1
Environment=PORT=4173
Environment=DATA_DIR=/home/coder/data
Environment=LAB_MODE=true
Environment=DISPLAY=:99
Environment=CYPRESS_BROWSER=chromium
ExecStartPre=/usr/bin/mountpoint -q /home/coder
ExecStart=/usr/local/bin/npm run start
Restart=always
RestartSec=5
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now quiz-coder-agent quiz-ide quiz-display quiz-window-manager quiz-vnc quiz-novnc quiz-chromium quiz-preview
printf 'Mini Quiz lab bootstrap complete: node=%s pwsh=%s git=%s\n' "$(node --version)" "$(pwsh --version)" "$(git --version)"
