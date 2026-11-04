# Deploying to Dokploy

`docker-compose.dokploy.yml` runs the production stack from the root `Dockerfile`. It uses an existing MariaDB and external S3-compatible storage (R2 or AWS S3).

| Service   | What it does                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| `migrate` | Applies migrations and refreshes the rights register and reference visuals, then exits. Runs on every deploy. |
| `api`     | NestJS API on port 4000. Starts only after `migrate` succeeds and ClamAV is healthy.                          |
| `web`     | Next.js standalone server on port 3000.                                                                       |
| `clamav`  | Scans every upload. The first start takes a few minutes while signatures load.                                |

## 1. Prepare the outside services (once)

1. **Database.** Create an empty database and a user with full rights on it. The containers must be able to reach `DB_HOST`. For a database running on the Dokploy host itself, use the host's private IP or its Docker network name, not `localhost`.
2. **Bucket.** Create a private bucket. The API key must be allowed to read, write and delete objects and to set the bucket's CORS rules, because the API sets CORS from `WEB_ORIGINS` on every start. The API refuses to start if the bucket allows anonymous reads.
3. **Mail.** Create a ZeptoMail sender. The API won't start in production without `ZEPTOMAIL_TOKEN` and `ZEPTOMAIL_FROM`.

## 2. Create the app in Dokploy

1. Create a **Compose** service from this repository. Set the compose path to `docker-compose.dokploy.yml`.
2. In **Environment**, paste `infra/dokploy/.env.example` and fill it in. Compose stops with a "set …" message if a required value is missing.
3. In **Domains**, add two domains with HTTPS:
   - the web domain, service `web`, port `3000`
   - the API domain, service `api`, port `4000`
4. Set `WEB_ORIGINS` to the web URL and `NEXT_PUBLIC_API_URL` to the API URL, both with `https://`.
5. Deploy.

## 3. Changing configuration

- `NEXT_PUBLIC_*` values are baked into the web build. After changing one, redeploy so the image is rebuilt; restarting isn't enough.
- Every other value applies on the next restart.
- Every deploy re-runs `migrate`. If it fails, the API doesn't start. Check its logs in Dokploy.

## 4. Checking a deploy

- `https://<api domain>/health` answers `{"status":"ok"}`.
- The web home page loads, and taking a photo reaches the confirmation step. This proves storage, CORS and ClamAV are all working.
