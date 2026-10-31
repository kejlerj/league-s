# Admin webapp — design

Date: 2026-10-10

## Goal

A web back-office to run amateur leagues. An admin must be able to run a whole season without touching the database: teams, players, squads, fixtures, scores.

Two roles:

- **Superadmin**: sees every league, creates and deletes them, invites and removes league admins.
- **Admin**: sees only the leagues returned by `GET /me` and manages everything else in them.

## Decisions made

| Topic | Decision |
|---|---|
| Stack | Vite, React 19, TypeScript, Tailwind, React Router, TanStack Query |
| Delivery | Static build embedded in the Go binary with `go:embed`, served under `/admin/` |
| Origin | Same origin as the API. No CORS in production |
| Session | `httpOnly` `session` cookie set by the API. The webapp stores no token |
| Roles | Admin per league, global superadmin |
| v1 scope | Everything, including inviting admins |
| New admins | Invitation by single-use link, valid for 7 days |
| Language | French interface |

## API

The API is at the root of the repository. Every path starts with `/api/v1`.

Conventions: snake_case JSON, UUID identifiers, date-times in UTC (RFC 3339), plain dates `YYYY-MM-DD`.

### Auth (existing)

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/auth/login` | `{email, password}` | 200 `{id, email, name, is_superadmin}` + `session` cookie; 401 if the credentials are wrong |
| `POST` | `/auth/logout` | — | 204 |
| `GET` | `/me` | — | 200 `{id, email, name, is_superadmin, leagues: [{id, name}]}`; 401 |
| `PUT` | `/me/password` | `{current_password, new_password}` | 204; 403 wrong current password; 422 password rule |
| `POST` | `/auth/password-reset` | `{email}` | 204 in every case |
| `POST` | `/auth/password-reset/confirm` | `{token, password}` | 204; 400 invalid link; 422 password rule |

Password rule: 10 characters minimum, 72 bytes maximum. Sign-in is limited to 10 requests per minute per IP.

### Authorization

- Reads (`GET`) are public.
- Writes under `/leagues/{leagueID}/...`: admin of that league or superadmin. Otherwise 401 (not signed in) or 403.
- `POST /leagues` and `DELETE /leagues/{leagueID}`: superadmin.

### Errors

Two shapes: `{"error": "message"}`, and for field validation (422) `{"errors": {"<field>": "<message>"}}`, with a French message to show under the field (see `docs/api/endpoints.md` › Validation errors). Unreadable JSON: 400. Body too large: 413. The API refuses unknown fields.

`PATCH`: a missing field isn't changed. Clearing an optional field isn't possible in v1.

### Existing resources

- **League**: `{id, name, logo}`. Create: `{name, logo?}`.
- **Team**: `{id, league_id, name, logo}`. Create: `{name, logo?}`.
- **Player**: `{id, league_id, firstname, lastname, icon}`. Create: `{firstname, lastname, icon?}`.
- **Season**: `{id, league_id, name, start_on, end_on, match_win_pts, match_draw_pts, match_loss_pts, tie_breakers}`. `tie_breakers` among `goal_difference`, `goals_scored`, `head_to_head`, `fair_play`, `random`.
- **A season's teams**: `GET .../seasons/{seasonID}/teams`, `POST` and `DELETE .../teams/{teamID}`.
- **Squad**: member `{membership_id, player_id, firstname, lastname, icon, number, joined_on, left_on}`. Join `{player_id, number?, joined_on}`, number `{number}`, leave `{left_on}`, transfer `{player_id, from_team_id, to_team_id, number?, on}`. Dates in `YYYY-MM-DD` format.
- **Match**: `{id, season_id, home_team, away_team, matchday, kickoff_at, status, home_score, away_score, venue, referee, convocation_at, video_url}`. Schedule `{home_team_id, away_team_id, matchday, kickoff_at?, venue?}`. Actions: `start`, `score` (`{home, away}`), `finish`, `postpone` (`{kickoff_at?}`), `cancel`.
- **Standings**: rows `{rank, team_id, team_name, played, won, drawn, lost, goals_for, goals_against, goal_difference, points}`.

### Endpoints added for the webapp (implemented and checked on 2026-10-10)

| Method | Path | Access | Body | Response |
|---|---|---|---|---|
| `GET` | `/leagues/{leagueID}/admins` | admin | — | 200 list of `{id, email, name}` |
| `DELETE` | `/leagues/{leagueID}/admins/{userID}` | superadmin | — | 204 |
| `POST` | `/leagues/{leagueID}/invitations` | superadmin | `{email}` | 201 `{id, email, expires_at, link}`; 409 already admin of the league. Inviting again replaces the previous invitation |
| `GET` | `/leagues/{leagueID}/invitations` | superadmin | — | 200 list of pending invitations `{id, email, expires_at}` |
| `DELETE` | `/leagues/{leagueID}/invitations/{invitationID}` | superadmin | — | 204 |
| `POST` | `/invitations/lookup` | public | `{token}` | 200 `{email, league: {id, name}, account_exists}`; 400 invalid, expired or already used link |
| `POST` | `/invitations/accept` | public | `{token, name, password}` for a new account, `{token}` otherwise | 204; 400 invalid link; 422 missing name or password, or password rule |
| `PATCH` | `/leagues/{leagueID}` | admin | `{name?, logo?}` | 200 League |
| `PATCH` | `/leagues/{leagueID}/teams/{teamID}` | admin | `{name?, logo?}` | 200 Team |
| `DELETE` | `/leagues/{leagueID}/teams/{teamID}` | admin | — | 204; 409 if it has a history |
| `GET` | `/leagues/{leagueID}/players?q=` | public | — | 200 list of Player |
| `PATCH` | `/leagues/{leagueID}/players/{playerID}` | admin | `{firstname?, lastname?, icon?}` | 200 Player |
| `DELETE` | `/leagues/{leagueID}/players/{playerID}` | admin | — | 204; 409 if it has a history |
| `PATCH` | `/leagues/{leagueID}/seasons/{seasonID}` | admin | Season fields, all optional | 200 Season |
| `DELETE` | `/leagues/{leagueID}/seasons/{seasonID}` | admin | — | 204; 409 if it has matches |

Invitation: the superadmin invites an address to a league. The link `{ADMIN_URL}/invitation?token=...` is single-use and valid for 7 days. The token goes in a query parameter and then in request bodies, never in a path, so it doesn't end up in logs. The API returns the link in `link`, only once, on creation. The API sends no invitation email: the webapp shows the link with a « Copier le lien » button and a prefilled `mailto:` link. The person chooses their name and password. If the address already has an account, accepting attaches the league to that account, without being signed in. Removing an admin removes the right on the league, not the account. There is no `POST /users`.

`PATCH /leagues/{leagueID}` is open to the league's admin. A `tie_breakers` that is sent must contain at least one value. Deleting a season without matches also deletes its registrations and squads.

## Architecture

### Location

Sources in `admin/`, with its own `package.json`. `go:embed` requires `dist` to be inside the Go module, hence this choice.

Go side: `admin/embed.go` with `//go:embed all:dist`, and a `GET /admin/*` route that serves the files and falls back to `index.html` for the SPA's routes.

### Dev and production

- **Dev**: Vite server on `localhost:5173`, `base: '/admin/'`, proxy from `/api` to `localhost:8080`. The cookie goes through the proxy, so same origin in dev too.
- **Production**: `npm run build` produces `admin/dist`, embedded in the binary.
- `ADMIN_URL` on the API side must be `http://localhost:5173/admin` in dev and `https://<host>/admin` in production, so that the reset link points to `/admin/reset-password?token=`.

### Structure

```
admin/
  src/
    api/         fetch client, types, one file per resource
    auth/        current session, route guards
    features/    one folder per resource: pages and forms
    ui/          table, field, modal, button, error banner
    routes.tsx
    main.tsx
```

Each unit has one role:

- `api/client.ts`: `fetch` with `credentials: 'same-origin'`, encoding of URL segments, conversion of non-2xx responses into `ApiError {status, message}`.
- `api/<resource>.ts`: typed functions, stateless.
- `auth/`: loads `GET /me`, exposes the user and `canWrite(leagueId)`, `isSuperadmin`.
- `features/`: pages that combine TanStack Query requests and `ui/` components.
- `ui/`: presentation components with no network call.

## Routes

All under `/admin`.

| Route | Screen | Access |
|---|---|---|
| `/login` | Sign in | public |
| `/forgot-password` | Ask for a link | public |
| `/reset-password?token=` | New password | public |
| `/` | List of leagues | signed in |
| `/account` | Change one's password | signed in |
| `/invitation?token=` | Accept an invitation | public |
| `/leagues/:leagueId` | League: teams, players, seasons, admins | league admin |
| `/leagues/:leagueId/seasons/:seasonId` | Season: registered teams, matches, standings | league admin |
| `/leagues/:leagueId/seasons/:seasonId/teams/:teamId` | Squad | league admin |

## Behaviour

### Auth

- On startup, `GET /me`. A 401 redirects to `/login`, keeping the requested page to come back to it after signing in.
- A 401 on any call clears the session and sends back to sign-in.
- A 403 shows « accès refusé » without signing out.
- A `/leagues/:leagueId` route for a league the user doesn't administer shows « accès refusé ».
- An admin with a single league is redirected from `/` to that league.

### Leagues

- Superadmin: full list (`GET /leagues`), create, delete with confirmation. A 409 on delete shows « cette ligue a un historique ».
- Admin: list from `GET /me`.

### Inside a league

- **Teams** and **players**: list, create, edit, delete.
- **Seasons**: list, create (dates, points scale, tie-breakers), edit, delete.
- **Admins**: list visible to every admin of the league. The superadmin invites an email address, sees and cancels pending invitations, and removes an admin.

### Inside a season

- **Registered teams**: register, unregister.
- **Squad**: add a player, change the number, make them leave, transfer to another registered team.
- **Matches**: list filterable by matchday and status. Schedule, edit, delete. Actions depending on the status:
  - `scheduled`: start, postpone, cancel, edit, delete.
  - `live`: enter the score, finish.
  - `finished`, `postponed`, `cancelled`: the actions the API accepts, to read in `internal/app/match/service.go` when writing the plan.
- **Standings**: read-only, refreshed after each action on a match.

### Accepting an invitation

- The page calls `POST /invitations/lookup` and shows the league and the invited address.
- New account: name + password form, then redirect to sign-in.
- Existing account: a « rejoindre la ligue » button, then redirect to sign-in.
- Invalid or expired link: clear message, no form.

## Errors

- 400, 409, 422: the API's message shown in the form.
- 403: « accès refusé ».
- 404: « introuvable » page.
- 5xx and network failure: generic banner with a « réessayer » button.
- During a write, the button is disabled to avoid a double submit.

## Tests

- Vitest + Testing Library, API mocked with MSW.
- `api/client`: building URLs, converting errors.
- `auth`: redirect on 401, superadmin guard, per-league guard.
- One test per page for the normal path and one error case.
- Matches: the actions shown for each status.
- End to end: Playwright in `admin/e2e/`, against the real API and the demo data (`make e2e`, « Admin E2E » job in CI): sign-in, creating a season, scheduling a match, starting it, score, finish.

## Final check

Once the webapp is finished and the API up to date:

1. Create a real data set through the webapp: a league, a season, teams, players, squads, matches with scores.
2. Check that the mobile app shows this data correctly: following, standings, team, match.

## Out of v1 scope

- File uploads for logos (the API expects a URL).
- Pagination (the API has none).
- Audit log, multiple languages.

## Open points

None.

Settled: the user confirmed embedding and writing in `admin/`. `admin/dist` is not versioned, except a `.gitkeep`. `ADMIN_URL` accepts a path, so `http://localhost:5173/admin` gives a link to `/admin/reset-password`.
