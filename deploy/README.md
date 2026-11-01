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
docker compose up -d --wait
```

Compose starts `db`, then runs `migrate` once. `api` starts only when `migrate` exited successfully: a failed migration leaves the running version in place. On an upgrade, change `IMAGE` in `.env` and run the same command.

`api` listens on `127.0.0.1:8080` (`HTTP_BIND`, `HTTP_PORT`). HTTPS in front of it is not set up yet (#146). The database has no published port, and its data is in the `db` volume.
