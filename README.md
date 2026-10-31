# Project league-s

One Paragraph of project description goes here

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Local stack

Docker and the [goose](https://github.com/pressly/goose) CLI must be installed.

```bash
cp .env.example .env
make dev-up
```

`make dev-up` starts Postgres, waits until it is healthy, runs the migrations and starts the API on `PORT` (8080 by default). In another terminal:

```bash
make seed
```

`make seed` replaces the demo league and everything in it, and leaves other leagues alone. Run it again at any time to reset the demo data.

For the mobile app, copy `mobile/.env.example` to `mobile/.env`. `EXPO_PUBLIC_API_URL` points the app at the local API.

### Mobile builds

`mobile/app.config.ts` reads two variables when Expo builds or starts the app:

| `APP_ENV` | `EXPO_PUBLIC_API_URL` | iOS local networking (`NSAllowsLocalNetworking`) |
|---|---|---|
| `development` (default) | optional, `http://localhost:8080/api/v1` when unset | allowed |
| `preview` | required, `https://` only | not allowed |
| `production` | required, `https://` only | not allowed |

A preview or production build without an `https` API address fails. Check the result with `APP_ENV=production EXPO_PUBLIC_API_URL=https://… npx expo config --type public` in `mobile/`.

### Demo data

One league, "District Five Demo", with 10 teams of 8 players and two seasons. Each season is a home and away round robin: 18 matchdays of 5 matches, on Saturdays from 14:00 Paris time.

- 2025-2026 is over: every match is finished, except the last match of matchdays 6, 12 and 18, which is postponed.
- 2026-2027 depends on when you seed: matches before now are finished, the first match after now is live (kicked off 25 minutes ago, 1-0), the rest are scheduled.

IDs are fixed, so E2E tests can use them. The league ID is fixed; the mobile app lists the leagues and asks which one on first launch. Other IDs follow `01a10d58-8ae3-7c66-80KK-NNNNNNNNNNNN`, with `KK` the kind and `N` the number in hex, starting at 1:

| Kind | `KK` | Examples |
|---|---|---|
| League | | `01a10d58-8ae3-7c66-ac38-c7cac896cc65` |
| Season | `01` | 2025-2026 is `…-8001-000000000001`, 2026-2027 is `…-8001-000000000002` |
| Team | `02` | AS Belleville is `…-8002-000000000001`, Athletic Goncourt is `…-8002-00000000000a` |
| Player | `03` | 8 per team, in team order |
| Squad membership | `04` | 2025-2026 first, then 2026-2027 |
| Match | `05` | 2025-2026 first, then 2026-2027, by matchday and kickoff |

`make seed` prints the league, season and team IDs.

## Database schema

The app is multi-tenant: each league is an independent space run by its own
organizers. Teams and players belong to exactly one league (someone playing in
two leagues has two player records). Their participation in a season or a squad
is a dated relation, so past seasons stay consultable.

```mermaid
erDiagram
    LEAGUE ||--o{ SEASON : has
    LEAGUE ||--o{ TEAM : has
    LEAGUE ||--o{ PLAYER : has
    SEASON ||--o{ SEASON_TEAM : includes
    TEAM ||--o{ SEASON_TEAM : "takes part in"
    SEASON ||--o{ MATCH : schedules
    SEASON_TEAM ||--o{ MATCH : "plays home"
    SEASON_TEAM ||--o{ MATCH : "plays away"
    SEASON_TEAM ||--o{ SQUAD_MEMBERSHIP : "has squad"
    PLAYER ||--o{ SQUAD_MEMBERSHIP : "plays for"

    LEAGUE {
        UUID id PK "uuidv7()"
        TEXT name
        TEXT logo "nullable"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    SEASON {
        UUID id PK "uuidv7()"
        UUID league_id FK
        TEXT name "e.g. 2025-2026, unique per league"
        DATE start_on
        DATE end_on "after start_on"
        INT match_win_pts "default 3"
        INT match_draw_pts "default 1"
        INT match_loss_pts "default 0"
        TEXT tie_breakers "TEXT array, ordered: goal_difference then goals_scored"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    TEAM {
        UUID id PK "uuidv7()"
        UUID league_id FK
        TEXT name "unique per league"
        TEXT logo "nullable"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    SEASON_TEAM {
        UUID season_id PK "with league_id, references season"
        UUID team_id PK "with league_id, references team"
        UUID league_id "shared by both FKs: same league"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    PLAYER {
        UUID id PK "uuidv7()"
        UUID league_id FK
        TEXT firstname
        TEXT lastname
        TEXT icon "nullable"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    SQUAD_MEMBERSHIP {
        UUID id PK "uuidv7()"
        UUID player_id FK "with league_id, references player"
        UUID season_id FK "with team_id and league_id, references season_team"
        UUID team_id FK "with season_id and league_id, references season_team"
        UUID league_id "shared by both FKs: same league"
        INT number "nullable, 1 to 99, unique among active members"
        DATE joined_on
        DATE left_on "nullable, NULL = still in squad"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    MATCH {
        UUID id PK "uuidv7()"
        UUID season_id FK
        UUID home_team_id FK "with season_id, references season_team"
        UUID away_team_id FK "with season_id, references season_team"
        INT matchday "round number"
        TIMESTAMPTZ kickoff_at "nullable, e.g. postponed with no new date"
        match_status status "scheduled, live, finished, postponed, cancelled"
        INT home_score "nullable"
        INT away_score "nullable"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
```

Design notes:

- **Leagues never mix, enforced twice.** Every query is filtered by the `leagueID` of the URL, so a resource of another league is simply not found (404). Underneath, composite foreign keys on `(id, league_id)` make the database refuse a team, a season or a player of another league, even if the code has a bug.
- **Rules live on the season, not the league.** Changing a competition's rules must not rewrite past standings.
- **Standings are not stored.** They are computed from finished matches with the season's rules, so there is a single source of truth.
- **Composite foreign keys** on `(season_id, team_id)` guarantee in the database that a match or a squad only involves teams registered for that season.
- **A player can leave and come back.** Each stint at a club is one `squad_membership` row, so a mid-season transfer or a return after a season away is just another row. The shirt number belongs to the stint, not to the player.
- **History is protected.** Deleting a league, a team or a player that has history is refused (`ON DELETE RESTRICT`).

## API

Every resource belongs to a league, so it lives under `/api/v1/leagues/{leagueID}`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/leagues` | Create a league |
| `GET` | `/api/v1/leagues` | List the leagues |
| `GET` | `/api/v1/leagues/{leagueID}` | Get a league |
| `DELETE` | `/api/v1/leagues/{leagueID}` | Delete a league (refused if it has history) |
| `POST` | `/api/v1/leagues/{leagueID}/teams` | Create a team |
| `GET` | `/api/v1/leagues/{leagueID}/teams` | List the teams of a league |
| `GET` | `/api/v1/leagues/{leagueID}/teams/{teamID}` | Get a team |
| `POST` | `/api/v1/leagues/{leagueID}/players` | Create a player |
| `GET` | `/api/v1/leagues/{leagueID}/players/{playerID}` | Get a player |
| `POST` | `/api/v1/leagues/{leagueID}/seasons` | Create a season |
| `GET` | `/api/v1/leagues/{leagueID}/seasons/{seasonID}` | Get a season |
| `GET` | `/api/v1/leagues/{leagueID}/seasons/{seasonID}/teams` | List the teams registered in a season |
| `POST` | `/api/v1/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}` | Register a team in a season |
| `DELETE` | `/api/v1/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}` | Unregister a team (refused if it has matches) |

## MakeFile

Run build make command with tests
```bash
make all
```

Build the application
```bash
make build
```

Run the application
```bash
make run
```
Create DB container
```bash
make docker-run
```

Shutdown DB Container
```bash
make docker-down
```

Live reload the application:
```bash
make watch
```

Run the unit tests (no Docker needed):
```bash
make test
```

Run the integration tests (test files tagged `//go:build integration`, needs Docker):
```bash
make itest
```

Run the linters (needs [golangci-lint](https://golangci-lint.run/docs/welcome/install/)):
```bash
make lint
```

Format the code and group the imports:
```bash
make fmt
```

Clean up binary from the last build:
```bash
make clean
```
