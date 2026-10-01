# Dedicated control VM pilot

The one-student pilot uses a dedicated Debian 13 `s-2vcpu-4gb` control VM. `control-cloud-init.yaml` installs Docker Engine 29.8.2, containerd 2.3.6, Buildx 0.37.1, and Compose 5.5.1 from Docker's signed Debian 13 repository. Its SHA256 is `DD7730317F52DDC4DBA6D0AC618F49567827E56DE2F9ABA90A88F1F04A976A13`. It installs no token, application, DNS record, or public lab listener. On the fresh VM, check `cloud-init status --wait`, `docker version`, and `docker compose version` before uploading the reviewed infra files. A Docker package or cloud-init failure must be diagnosed from `cloud-init status --long` and `/var/log/cloud-init-output.log`; do not open web ingress as a workaround.

## Private administrator bootstrap

Copy only the reviewed deployable infra files to `/opt/mini-quiz-lab/infra`, omitting `evidence/private/`, `tools/`, `.terraform/`, and local secrets. Prepare a root-owned mode-0600 `.env` containing `LAB_DOMAIN`, `POSTGRES_PASSWORD`, and `DIGITALOCEAN_TOKEN`. The control plane needs the token for student resource provisioning. Use an interactive root terminal:

```bash
cd /opt/mini-quiz-lab/infra
docker compose -f compose.yaml -f compose.private.yaml config --quiet
bash scripts/bootstrap-control-private.sh ADMIN_USERNAME ADMIN_EMAIL
ss -lntp | grep -E ':7080|:80|:443'
```

Only `127.0.0.1:7080` should listen for Coder; 80/443 must still be closed. The script starts Postgres, invokes Coder's documented `server create-admin-user` with an interactive password prompt, then starts Coder on loopback. An alternate first-user API bootstrap is acceptable only over the same private SSH tunnel, followed by login and Owner-role readback before ingress opens. From the operator machine, use `ssh -L 7080:127.0.0.1:7080 root@CONTROL_IP` and inspect `http://127.0.0.1:7080` through that tunnel. Never send the admin password on a shell command line or in cloud-init.

## Public TLS after the private gate

The default `Caddyfile` uses a manually installed wildcard certificate. For the delegated DigitalOcean DNS zone, `compose.autotls.yaml` builds Caddy 2.10.2 with the `caddy-dns/digitalocean` module pinned to commit `04bde2867106aa1b44c2f9da41a285fa02e629c5`. It uses `Caddyfile.autotls` and the DigitalOcean token inside trusted Caddy only. Caddy `/data` and `/config` are named persistent volumes so ACME state survives container recreation. Verify the `lab.kfk-786.com` NS delegation, A and wildcard A records, controller firewall, and admin login before running:

```bash
cd /opt/mini-quiz-lab/infra
docker compose -f compose.yaml -f compose.autotls.yaml -f compose.public.yaml config --quiet
docker compose -f compose.yaml -f compose.autotls.yaml -f compose.public.yaml up -d --build caddy
docker compose -f compose.yaml -f compose.autotls.yaml -f compose.public.yaml ps
curl --fail --silent --show-error https://lab.kfk-786.com/api/v2/buildinfo
```

Only `compose.public.yaml` publishes 80/443. A successful `docker compose config --quiet` proves configuration parsing, not TLS issuance. Inspect Caddy logs and verify the presented certificate for both the base and wildcard names. Do not print `docker compose config` without `--quiet`: its expanded environment includes the control-plane token. The optional DNS plugin image has been statically configured and Compose-parsed locally; the live controller build and certificate must be reported separately.

## Student pilot and isolation limit

The student template uses Debian 13, a root-owned apt package manifest, and pinned, SHA256-checked Node, PowerShell, and code-server downloads. No command from the student-writable Git checkout runs as root. The Coder agent starts before lengthy `npm ci`, browser installation, and build steps so the authenticated operator can inspect startup while app health checks still show not-ready. Student services require the retained `/home/coder` volume; no worker inbound rule is opened.

Coder OSS rejected the Enterprise-only `max_port_share_level=owner` setting. The pilot therefore disables workspace sharing in Coder, defines each app with `share = "owner"`, disables default GitHub signups, and blocks public POST/PATCH/PUT mutations to workspace `port-share` and `acl` endpoints at Caddy. This is a pilot ingress control, not proof that every possible sharing path is unavailable. Before student invitations, verify denial from a second account for app URLs, workspace SSH, and sharing mutations. The live pilot does not establish 10- or 50-student readiness.

Sources: [Coder Docker minimum and image](https://coder.com/docs/install/docker), [Coder administrator CLI](https://coder.com/docs/reference/cli/server_create-admin-user), [Docker Debian install](https://docs.docker.com/engine/install/debian/), [Docker Debian 13 package index](https://download.docker.com/linux/debian/dists/trixie/pool/stable/amd64/), [Caddy DigitalOcean DNS module](https://github.com/caddy-dns/digitalocean), [pinned module commit](https://github.com/caddy-dns/digitalocean/commit/04bde2867106aa1b44c2f9da41a285fa02e629c5).

The Live Browser app URL must be the noVNC origin (http://127.0.0.1:6080), not a filename. Coder joins incoming paths onto that URL. Both Caddy configurations redirect only the browser app landing path to /vnc.html?autoconnect=1&resize=remote; the owner-only Coder authentication gate still handles the application and WebSocket requests. Validate the actual browser view, not only an HTTP 200.
