#!/usr/bin/env bash
# Run interactively as root on the new dedicated control VM, from infra/.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[[ -t 0 ]] || { echo 'Interactive terminal required for the Coder password prompt' >&2; exit 1; }
[[ $# -eq 2 ]] || { echo 'Usage: bootstrap-control-private.sh ADMIN_USERNAME ADMIN_EMAIL' >&2; exit 1; }
[[ -f .env ]] || { echo 'Create root-owned mode 0600 .env first' >&2; exit 1; }
[[ ! -e .admin-created ]] || { echo 'Admin bootstrap already recorded; inspect Coder privately' >&2; exit 1; }
[[ "$(stat -c '%a' .env)" = 600 ]] || { echo '.env must have mode 0600' >&2; exit 1; }
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml pull postgres coder
# Explicit service selection keeps Caddy and all public ports stopped.
docker compose -f compose.yaml up -d postgres
docker compose -f compose.yaml run --rm --no-deps --entrypoint coder coder \
  server create-admin-user --username "$1" --email "$2"
install -m 0600 /dev/null .admin-created
docker compose -f compose.yaml -f compose.private.yaml up -d coder
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1:7080/api/v2/buildinfo >/dev/null; then
    echo 'Coder responds on control-host loopback 127.0.0.1:7080.'
    echo 'Verify the administrator through an SSH tunnel before opening ports 80/443.'
    exit 0
  fi
  sleep 2
done
echo 'Coder did not become healthy on loopback; inspect docker compose logs coder' >&2
exit 1
