# Anubis gateway for the Vercel app

Anubis is an HTTP reverse proxy, so it runs outside the Next.js process. This setup places Caddy (HTTPS) → Anubis → Caddy (origin header) → Vercel in front of the app. The second Caddy instance adds a private header; `src/proxy.ts` rejects requests that reach Vercel without it once `ANUBIS_ORIGIN_SECRET` is set there.

## Configure

1. Use a server with Docker Compose and public ports 80 and 443. In `deploy/anubis`, copy `example.env` to `.env`.
2. Set `PUBLIC_DOMAIN` to the hostname visitors will use. Point its DNS A/AAAA record to the gateway server. Keep this hostname off Vercel's domain list; Caddy must receive its traffic.
3. Set `VERCEL_ORIGIN` to the app's HTTPS `*.vercel.app` URL. Keep this deployment URL available to the gateway. Do not set it to `PUBLIC_DOMAIN`, which would create a proxy loop.
4. Generate **two different** secrets with `openssl rand -hex 32`. Put one in `ANUBIS_SIGNING_KEY` and the other in `ANUBIS_ORIGIN_SECRET` in the gateway `.env` file. Keep this file private.
5. Start the gateway with `docker compose --env-file .env up -d` from `deploy/anubis`. Wait for Caddy to obtain its TLS certificate, then visit `https://PUBLIC_DOMAIN/` and complete the Anubis challenge. The public site must work before enabling the origin check.
6. In Vercel, set `APP_URL=https://PUBLIC_DOMAIN` and register `https://PUBLIC_DOMAIN/api/auth/callback` with the Google OAuth client. Set `ANUBIS_ORIGIN_SECRET` to exactly the same secret as the gateway, then redeploy the app. Afterward, the public hostname should work and the direct `*.vercel.app` URL should return HTTP 403.

The `ANUBIS_ORIGIN_SECRET` check is optional until its environment variable is set. When enabled, it protects pages and API routes. It is a shared secret, so rotate it if exposed. Rotate by updating the gateway and Vercel values together; during a mismatch, users will receive 403 responses.

Anubis uses its upstream default bot policy here. Tune it only after observing real traffic; overly strict policies can block search engines and other legitimate clients. Its challenge needs browser JavaScript and cookies. Keep the gateway's Docker images updated deliberately, and back up the Caddy data volume if you want to retain its TLS certificates across host replacement.

## Check

```sh
cd deploy/anubis
docker compose --env-file .env config
docker compose --env-file .env up -d
curl -I https://PUBLIC_DOMAIN/
curl -I https://your-project.vercel.app/
```

The public request may show an Anubis challenge until a browser solves it. The direct Vercel request should show 403 after the origin secret is deployed. The gateway is the only intended public entry point; do not publish ports 8923 or 8080 from the internal containers.

Anubis documentation: [installation](https://github.com/TecharoHQ/anubis/blob/main/docs/docs/admin/installation.mdx), [Docker Compose](https://github.com/TecharoHQ/anubis/blob/main/docs/docs/admin/environments/docker-compose.mdx), [policy definitions](https://github.com/TecharoHQ/anubis/blob/main/docs/docs/admin/policies.mdx).
