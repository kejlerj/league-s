# Production deployment

One VPS runs docker compose (decision #13). The image holds two binaries:

- `/app/api`: the API, which also serves the admin under `/admin` (the entrypoint),
- `/app/migrate`: applies the migrations embedded in the binary (`migrations/*.sql`), then exits.

## Build the image

From the repository root:

```bash
docker build -t league-s:<version> .
```

## Configure

On the server, next to `compose.yaml`:

```bash
cp .env.example .env
```

Fill in `.env`. `DB_PASSWORD` must be a strong password, and `.env` never goes into git. `DB_HOST` and `DB_PORT` are set by `compose.yaml`. `IMAGE` picks the image tag to run.

## Deploy or upgrade

```bash
sh deploy.sh league-s:<version>
```

`deploy.sh` runs `docker compose up -d --wait` with that image. Compose starts `db`, then runs `migrate` once. `api` starts only when `migrate` exited successfully, so a failed migration leaves the running version in place. The script then checks `/health` inside the `api` container. Only after that does it write the tag to `IMAGE` in `.env`, so a plain `docker compose up -d` (after a reboot, for example) runs the last good version. It keeps the two previous `league-s` images for a rollback (`sh deploy.sh league-s:<previous>`) and removes older ones.

## Automatic deployment

`.github/workflows/deploy.yml` deploys every push to `main` once CI is green. It can also be run by hand (Actions › Deploy › Run workflow). It builds the image on the runner, sends it over SSH (`docker save | ssh docker load`, no registry), copies `compose.yaml` and `deploy.sh`, runs `deploy.sh`, then smoke-tests `/health` inside the `api` container. That works over plain HTTP, before HTTPS exists (#146). If any step fails, it opens a `bug` issue with the run link.

The job is skipped until `DEPLOY_HOST` is set.

### Server setup, once

1. Install Docker with the compose plugin.
2. Create a deploy user in the `docker` group, with an SSH key that only GitHub Actions uses.
3. Create the deploy folder (for example `/srv/league-s`), owned by that user, and put `.env` in it (see Configure).

### Repository settings

Settings › Secrets and variables › Actions. Nothing here goes into the repository.

| Name | Kind | Value |
|---|---|---|
| `DEPLOY_HOST` | variable | The VPS host name or IP |
| `DEPLOY_USER` | variable | The deploy user |
| `DEPLOY_PATH` | variable | The deploy folder, for example `/srv/league-s` |
| `DEPLOY_SSH_KEY` | secret | The deploy user's private key |
| `DEPLOY_KNOWN_HOSTS` | secret | The output of `ssh-keyscan <host>`, checked against the server's real host key. The job refuses unknown host keys. |

The application secrets (`DB_PASSWORD`, `SMTP_PASSWORD`, `SENTRY_DSN`…) stay in `.env` on the server, never in GitHub.

`api` listens on `127.0.0.1:8080` (`HTTP_BIND`, `HTTP_PORT`). HTTPS in front of it is not set up yet (#146). The database has no published port, and its data is in the `db` volume.
