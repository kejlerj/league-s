# league-s checklist

## ✅ Done

- [x] **Infrastructure**: Postgres in Docker, `pgxpool`, goose (`make migrate-*`), sqlc (with `time.Time` through `overrides`), gotestsum
- [x] **Schema**: 7 tables, multi-tenant per league, composite keys, indexes, enum `match_status`
- [x] **Domains**: `league`, `team`, `player`, `season` (with `season_team`), each with its handler, its store, its validation and the translation of its errors
- [x] **Test seeder**: `testdb.New(t, pool)` (emptied database + seeder), default league, options (`WithName`, `InLeague`…), no hard-coded ID left in the domain tests
- [x] **Tests**: 94 integration tests, the `testdb` and `testhttp` helpers, the `integration` tag, `make test` and `make itest`
- [x] **Config**: package `internal/config` (reads and validates the environment, escaped DSN), `database.New(ctx, dsn)`, `server.NewServer(port, db)`, 13 unit tests
- [x] **Lint**: golangci-lint v2 (`.golangci.yml`, `make lint`, `make fmt`, CI job), imports grouped with `gci` and `goimports`
- [x] **CI**: `.github/workflows/ci.yml` (checked with actionlint, not pushed yet)
- [x] **README**: schema, design notes, endpoints
- [x] **Local stack and demo data**: `make dev-up` (Postgres, migrations, API) and `make seed` (`cmd/seed`, package `internal/demo`): one demo league, 10 teams of 8 players, two home-and-away seasons, fixed IDs for the E2E tests

## 🔜 Before the next commit

- [x] **Recreate the local database**: migrations renumbered, move to Postgres 18 and to UUID v7
  - `docker compose down -v`, `make docker-run`, then `make migrate-up`
- [ ] **Commit and push**, then check that both CI jobs pass on GitHub
  - first real test of testcontainers on the GitHub runners
- [x] **Add a `.env.example`** with the expected variables, without real secrets
- [x] **Fix an inconsistency**: the database default for `tie_breakers` is `{goal_difference,goals_for}`, but the validator only accepts `goals_scored`
  - pick a single name, otherwise a season created with the defaults can no longer be sent back as is to the API

## 🧹 Technical debt

- [x] **Only one season at a time per league** (see `spec.md`): non-overlap constraint on `season`
  - `EXCLUDE USING gist (league_id WITH =, daterange(start_on, end_on, '[]') WITH &&)`, with `btree_gist` (decision 008)
  - translate it to 409 in `season.CreateError` and `season.UpdateError`
- [x] **A season's default points**: if the client omits `match_win_pts`…, the season is created with 0/0/0 instead of 3/1/0
  - pointers in the DTO, or defaults applied in the handler
- [x] **Readable validation messages**: `httpx.Decode` still returns the raw tag (`"required"`, `"url"`)
- [x] **Dates in `2025-08-01` format** in the season DTOs, instead of a full `time.Time`
  - `string` with `validate:"datetime=2006-01-02"`, then `time.Parse(time.DateOnly, …)`
- [x] **HTTP status codes**: 201 for registering a team, 204 for unregistering it
  - update the tests at the same time
- [ ] **The missing list endpoints**: a league's seasons (`GetByLeague` already exists), a league's teams and players
  - think about pagination from the start (`limit`, `offset`, or cursor-based)
- [x] **Update and delete** (`PATCH` / `DELETE`) for `league`, `team`, `player` and `season`
  - set `updated_at = now()` in every `UPDATE`
  - `RESTRICT` returns a foreign key violation if the resource has a history: translate it to 409
- [ ] **A helper for Postgres errors** (`database.ConstraintName(err)`), as soon as it is repeated in `squadmembership`

## ⚽ Squad

- [x] **Create the package `internal/app/squadmembership`**: types, errors per operation, SQL queries and store (`Join`, `Leave`, `Active`, `List`, `WithTx`)
  - `SquadPlayer` and `GetByTeamAndSeason` removed from `player`, replaced by `squadmembership.Member` and `List`
- [x] **The routes** under `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}/squad`, and `/transfers` under the season
  - add a player, make them leave (`left_on`), list the squad (active by default, option for the full history)
- [x] **Always insert `league_id`**, taken from the URL: the composite keys need it
- [x] **IDs in the body** (`player_id`…): a `string` field with `validate:"required,uuid"`, then `uuid.Parse`
  - no `uuid.UUID` field directly in the DTO: JSON decoding would accept non-standard formats (`urn:uuid:`, braces, no dashes)
- [x] **Translate errors by constraint name** (in the store, HTTP status codes chosen in the handler)
  - `squad_membership_active_number` → number already taken (409)
  - `squad_membership_active_player` → player already active in a team this season (409)
  - `squad_membership_player_fkey` → unknown player or player of another league (404)
  - `squad_membership_season_team_fkey` → team not registered for the season (404 or 422)
- [x] **The transfer** = leaving followed by joining, in one transaction
  - `Service.Transfer` goes through `store.InTx`, and applies the same rules as `Join` and `Leave`
- [x] **Validate the dates**: `joined_on` and `left_on` during the season (`SquadRules.CheckJoin` and `CheckLeave`, called by the service)
- [x] **The maximum squad size**: `Service.Join` locks `season_team`, counts the active members, then decides (`ErrJoinSquadFull`)
  - `left_on` after `joined_on`: already enforced by the constraint `squad_membership_left_after_joined`, translated to `ErrLeaveBeforeJoining`
- [x] **Direct store tests** for transfers, where the API alone is tedious to set up
- [x] Optional: the current club in `GET /players/{playerID}` (query with `LEFT JOIN`, not `LATERAL`)

## 🥅 Match

- [x] **The entity with its rules**: `match.New`, `Start`, `SetScore`, `Finish`, `Postpone`, `Reschedule`, `Cancel`, `Winner`
  - unit tests without a tag
- [x] **A service** for the "load → apply the rule → save" cycle
- [x] **Translate the enum** `db.MatchStatus` to `match.Status` in the store
- [x] **The routes** under `/leagues/{leagueID}/seasons/{seasonID}/matches`
  - the fixtures: filters `matchday`, `team`, `from` and `to`, with `sqlc.narg`
- [x] **⚠️ Filtering by league**: `match` has no `league_id`
  - every read joins `season` and filters on `season.league_id`
  - tested: a match can't be found from another league's URL
- [x] **Errors**: `match_home_team_fkey` or `match_away_team_fkey` → team not registered (422)
- [x] **Fixture rules in the service**: a single match per team and per matchday, kickoff during the season

## 📊 Standings

- [x] **`standing.Compute(teams, matches, rules)`**: a pure function that reuses `Match.Winner()`
- [x] **Table-driven unit tests**
- [x] **Tie-breakers in the order set by the season**: goal difference, goals scored, head-to-head
  - head-to-head is the trickiest case, with several tied teams
  - `fair_play` and `random` are still to be decided: they are ignored for now
- [x] **The endpoint** `GET /leagues/{leagueID}/seasons/{seasonID}/standings`, which counts only `finished` matches

## 🧪 Scenario tests

- [x] **The package `internal/scenario`**, on the real router (`server.NewServer`), signed in as the league's admin
- [x] **3 to 5 journeys**: a full season up to the standings, a mid-season transfer, a match postponed then rescheduled
- [x] **Extend the seeder** (`internal/testdb/seed.go`) with each new domain: `s.CreateSquadMember(...)` with `squad`, `s.CreateMatch(...)` with options (kickoff, status, score) with `match`, `MaxSquadSize` on the season

## 🔐 Authentication and roles

- [x] **The tables** `app_user` (with `is_superadmin`), `league_admin (user_id, league_id)` and `session`
- [x] **Password hashing** with bcrypt, never in clear (10 characters minimum)
- [x] **Sessions rather than JWT**: a random token, of which only the hash is in the database. `HttpOnly` cookie for the web, `Authorization: Bearer` header for mobile
- [x] **An authentication middleware**, which puts the user in the `context`
- [x] **An authorization middleware**, which reads `{leagueID}` in the URL and checks the role
  - `GET` requests stay public, only writes are protected
  - creating and deleting a league: superadmin only
- [x] **Tests** 401 (not signed in), 403 (admin of another league) and 201 (right admin, superadmin)
- [x] **The first superadmin**: created at startup from `SUPERADMIN_EMAIL`, without a password, with a setup link sent by email (SMTP, Mailpit locally on http://localhost:8025)
- [x] **Forgotten password and password change**: single-use reset link sent by email (`auth.EmailNotifier`, SMTP). Without `SMTP_HOST`, no email is sent and the link is written nowhere
- [x] **Invitations**: the superadmin invites an admin to a league through a single-use link, valid for 7 days
  - table `invitation` (league, email, token hash, expiry, acceptance date)
  - accepting the link creates the account, or attaches the league to an existing account
  - list and remove a league's admins
- [x] **Clean up expired sessions** (a periodic query, or on sign-in)
  - `auth.Cleaner` runs at startup, then every `CLEANUP_INTERVAL` (1 hour by default): it deletes expired sessions, password reset links that are expired or used, and invitations that expired without being accepted. Accepted invitations are kept

## 🔒 Security

- [x] **Tighten CORS**: `AllowedOrigins: https://*` with `AllowCredentials: true` accepts any site
  - read the list of allowed origins from the config (`CORS_ORIGINS`)
  - to do before authentication, otherwise any site could call the API with an admin's session
- [x] **Limit body size** in `httpx.Decode`: `http.MaxBytesReader` (for example 1 MB), otherwise a client can send a huge body
- [x] **Refuse unknown fields** in `httpx.Decode`: `DisallowUnknownFields()`
  - a `"league_id"` sent in the body returns 400 instead of being silently ignored
- [x] **Security headers** through a middleware, for every response (`httpx.SecurityHeaders`, `/admin` sets its own CSP with `httpx.ContentSecurityPolicy`):
  - `X-Content-Type-Options: nosniff`
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (a JSON API has nothing to load nor to show in an iframe)
  - `Referrer-Policy: no-referrer`
  - `Cache-Control: no-store` on authenticated responses: every request that carries a session (cookie or `Bearer`), and `/auth` and `/invitations`, which create one
  - `Strict-Transport-Security` only if the app handles TLS itself, otherwise the reverse proxy adds it. The app doesn't handle TLS: no HSTS in the app
- [x] **Secure `/health`**: it is public, answers 200 even when the database is down, and returns the raw pgx error and the pool stats
  - in public: just `{"status":"up"}` or `"down"`, with a 503 when it's down
  - the detailed error goes to the logs (and to Sentry), not to the response
- [x] **Rate limiting**, at least on sign-in once auth is in place (`github.com/go-chi/httprate`)
- [x] **Pin the Postgres version** (`postgres:18`): `postgres:latest` in `docker-compose.yml`, `testdb` and `database_test.go`
  - otherwise a new major version can arrive without warning, locally and in CI
- [x] **Run `govulncheck`** in CI (`make vuln`, job `Vulnerabilities`): it reports dependencies that have a known vulnerability *and* whose vulnerable code is actually called
- [x] **Move IDs to UUID v7** (decision 006), before `squad`, `match` and `app_user`
  - migrations: `UUID PRIMARY KEY DEFAULT uuidv7()`, and every foreign key as `UUID`, including `league_id`
  - `sqlc.yaml`: `override` from `uuid` to `github.com/google/uuid.UUID`, then `sqlc generate`
  - Go: `int64` → `uuid.UUID` in the domain types, the stores and the DTOs. `httpx.IDParam` with `uuid.Parse`
  - tests: a `uuid.New()` instead of `999` for unknown IDs, `%s` instead of `%d`
  - recreate the local database

## 📡 Observability

- [x] **Integrate Sentry** (`github.com/getsentry/sentry-go`, `internal/logging/sentry.go`)
  - `SENTRY_DSN` in the config, optional: no DSN locally or in tests, so nothing is sent
  - `Environment` from `APP_ENV`. `Release`: the one the SDK finds (variable `SENTRY_RELEASE`, otherwise the git commit when the binary runs in a repository)
  - the `sentryhttp` middleware (with `Repanic`) after `middleware.Recoverer`: it reports panics, then the `Recoverer` answers 500 as before
  - every `slog.ErrorContext` that carries an error is sent to Sentry, with the line's message and attributes: handler 500s are reported without touching the handlers
  - what is sent: no body, no cookies, no query string, only the `Accept`, `Content-Type` and `User-Agent` headers
  - reset and invitation links are never sent: `BeforeSend` replaces any `token=` value with `[Filtered]`, and the attributes `token`, `password`, `secret`… are masked
  - `sentry.Flush` on shutdown, otherwise the last errors are lost
- [x] **`slog` logs in JSON** and a request ID (`internal/logging`, `LOG_FORMAT`, `LOG_LEVEL`)
  - the request ID goes into Sentry events (`log` context), to link an error to its logs

## 🚀 Later

- [x] **OpenAPI documentation** of the API (`docs/openapi.yaml`, checked against the router by `internal/server/openapi_test.go`)
  - TypeScript types generated from it for the admin and the mobile app: #66
- [x] **Deployment**: Docker image of the app, migrations at startup or in a separate job (`Dockerfile`, `cmd/migrate`, `deploy/compose.yaml`; the deployment workflow is #43, HTTPS is #146)
