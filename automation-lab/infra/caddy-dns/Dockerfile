FROM caddy:2.10.2-builder AS builder
RUN xcaddy build v2.10.2 --with github.com/caddy-dns/digitalocean@04bde2867106aa1b44c2f9da41a285fa02e629c5

FROM caddy:2.10.2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
