# league-s endpoints

Every path starts with `/api/v1`.

The request and response shapes are in `docs/openapi.yaml`. A new or changed route updates both files; `internal/server/openapi_test.go` fails when a router route is missing from the OpenAPI file.

**Legend**
- Status: ✅ done, 🔜 planned
- Access (once authentication is in place): **public** (not signed in), **admin** (admin of the league in the URL, or superadmin), **superadmin**

## Validation errors

A body that fails validation gets a 422 with one readable French message per field: `{"errors": {"<field>": "<message>"}}`. The key is the JSON field name (`tie_breakers[0]` for an item of a list).

| Rule | Message |
|---|---|
| `required` | `obligatoire` |
| `min` / `max` on text | `<n> caractères minimum` / `<n> caractères maximum` |
| `min` / `max` on a number | `doit être au moins <n>` / `doit être au plus <n>` |
| `http_url` | `doit être une URL http ou https` |
| `email` | `doit être une adresse e-mail valide` |
| `uuid` | `doit être un identifiant valide` |
| `datetime=2006-01-02` | `doit être une date au format AAAA-MM-JJ` |
| `gtfield` | `doit être après <other field>` |
| `nefield` | `doit être différent de <other field>` |
| `oneof` | `doit valoir <a>, <b> ou <c>` |
| any other rule | `invalide` |

## Health

| Status | Method | Path | Access | Description |
|---|---|---|---|---|
| ✅ | `GET` | `/health` (outside `/api/v1`) | public | Database state: `{"status":"up"}` (200) or `{"status":"down"}` (503) |

## Leagues

| Status | Method | Path | Access | Description |
|---|---|---|---|---|
| ✅ | `POST` | `/leagues` | superadmin | Create a league |
| ✅ | `GET` | `/leagues` | public | List the leagues, sorted by name |
| ✅ | `GET` | `/leagues/{leagueID}` | public | Read a league |
| ✅ | `PATCH` | `/leagues/{leagueID}` | admin | Change the name or the logo |
| ✅ | `DELETE` | `/leagues/{leagueID}` | superadmin | Delete a league (refused if it has a history: 409) |

## League admins

| Status | Method | Path | Access | Description |
|---|---|---|---|---|
| ✅ | `GET` | `/leagues/{leagueID}/admins` | admin | List the league's admins |
| ✅ | `POST` | `/leagues/{leagueID}/invitations` | superadmin | Appoint an admin: goes through an invitation (see Authentication) |
| ✅ | `DELETE` | `/leagues/{leagueID}/admins/{userID}` | superadmin | Remove an admin |

## Teams

| Status | Method | Path | Access | Description |
|---|---|---|---|---|
| ✅ | `POST` | `/leagues/{leagueID}/teams` | admin | Create a team |
| ✅ | `GET` | `/leagues/{leagueID}/teams` | public | List the league's teams, sorted by name. Unknown league → 404 |
| ✅ | `GET` | `/leagues/{leagueID}/teams/{teamID}` | public | Read a team |
| ✅ | `PATCH` | `/leagues/{leagueID}/teams/{teamID}` | admin | Change the name or the logo |
| ✅ | `DELETE` | `/leagues/{leagueID}/teams/{teamID}` | admin | Delete (refused if it has a history) |
| ✅ | `GET` | `/leagues/{leagueID}/teams/{teamID}/seasons` | public | Seasons the team is registered for, most recent first. Unknown team or team of another league → 404 |

## Players

| Status | Method | Path | Access | Description |
|---|---|---|---|---|
| ✅ | `POST` | `/leagues/{leagueID}/players` | admin | Create a player |
| ✅ | `GET` | `/leagues/{leagueID}/players` | public | List the league's players, sorted by last name then first name. `q` searches "first last" and "last first", case-insensitive. Unknown league → 404 |
| ✅ | `GET` | `/leagues/{leagueID}/players/{playerID}` | public | Read a player, with their current club (`current_team`: the team of their ongoing membership in the most recent season, otherwise `null`) |
| ✅ | `PATCH` | `/leagues/{leagueID}/players/{playerID}` | admin | Change the name or the icon |
| ✅ | `DELETE` | `/leagues/{leagueID}/players/{playerID}` | admin | Delete (refused if they have a history) |
| ✅ | `GET` | `/leagues/{leagueID}/players/{playerID}/career` | public | All their club memberships (season, team, number, dates), most recent first. Unknown player or player of another league → 404 |

## Seasons

| Status | Method | Path | Access | Description |
|---|---|---|---|---|
| ✅ | `POST` | `/leagues/{leagueID}/seasons` | admin | Create a season (points 3/1/0 by default, optional `max_squad_size`). Dates overlapping another season of the league → 409 |
| ✅ | `GET` | `/leagues/{leagueID}/seasons` | public | List the league's seasons, most recent first. Unknown league → 404 |
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}` | public | Read a season |
| ✅ | `PATCH` | `/leagues/{leagueID}/seasons/{seasonID}` | admin | Change dates, points or tie-breakers (careful with standings already published). Dates overlapping another season of the league → 409. Dates that would leave squad memberships or matches outside the season → 409 |
| ✅ | `DELETE` | `/leagues/{leagueID}/seasons/{seasonID}` | admin | Delete (refused if it has matches). Its registrations and squads are deleted with it |

## Teams registered for a season

| Status | Method | Path | Access | Description |
|---|---|---|---|---|
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/teams` | public | List the registered teams |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}` | admin | Register a team. Responds 201 |
| ✅ | `DELETE` | `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}` | admin | Unregister (refused if it has matches). Responds 204 |

## Squads

| Status | Method | Path | Access | Description |
|---|---|---|---|---|
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}/squad` | public | Current squad (`?all=true` to include players who left), with each member's `goals` and `assists` for this team in finished matches |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}/squad` | admin | Add a player (`player_id`, `number`, `joined_on`) |
| ✅ | `PATCH` | `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}/squad/{membershipID}` | admin | Change the number |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/teams/{teamID}/squad/{membershipID}/leave` | admin | Make a player leave (`left_on`, their last day in the team) |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/transfers` | admin | Transfer: leave then join, in one transaction. `on` is the last day in the former team, the new team is joined the day after |

## Matches

| Status | Method | Path | Access | Description |
|---|---|---|---|---|
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/matches` | public | Fixtures (`?matchday=`, `?from=&to=`, `?team=`, `?status=`). Each match carries the name and logo of both teams |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/matches` | admin | Schedule a match (optional `venue`) |
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}` | public | Read a match |
| ✅ | `PATCH` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}` | admin | Change the matchday or the kickoff, and fill in venue, referee, call time, video link |
| ✅ | `DELETE` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}` | admin | Delete a match scheduled by mistake |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/start` | admin | Move to `live` |
| ✅ | `PUT` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/score` | admin | Update the score of a live match, or correct the score of a finished match (it stays finished). 409 for a scheduled, postponed or cancelled match |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/finish` | admin | Finish the match |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/postpone` | admin | Postpone (optional new date) |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/cancel` | admin | Cancel |
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/events` | public | The match's events, by minute. `note` only for an admin of the league |
| ✅ | `POST` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/events` | admin | Record a goal, card, substitution or injury. A goal on a live match also changes the score |
| ✅ | `DELETE` | `/leagues/{leagueID}/seasons/{seasonID}/matches/{matchID}/events/{eventID}` | admin | Delete an event. Responds 204 |

## Standings

| Status | Method | Path | Access | Description |
|---|---|---|---|---|
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/standings` | public | Standings computed from the finished matches, with each team's `fair_play_points` |
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/scorers` | public | Buteurs ranking, from the finished matches |
| ✅ | `GET` | `/leagues/{leagueID}/seasons/{seasonID}/assists` | public | Passeurs ranking, from the finished matches |

## Authentication

| Status | Method | Path | Access | Description |
|---|---|---|---|---|
| ✅ | `POST` | `/auth/login` | public | Sign in |
| ✅ | `POST` | `/auth/logout` | signed in | Sign out |
| ✅ | `GET` | `/me` | signed in | Current user and the leagues they administer |
| ✅ | `PUT` | `/me/password` | signed in | Change one's password (`current_password`, `new_password`) |
| ✅ | `POST` | `/auth/password-reset` | public | Ask for a reset link (`email`). Responds 204 in every case |
| ✅ | `POST` | `/auth/password-reset/confirm` | public | Choose a new password (`token`, `password`) |
| ✅ | `POST` | `/leagues/{leagueID}/invitations` | superadmin | Invite an admin (`email`). Returns `link`, to send by `mailto:` from the web admin. Valid for 7 days, replaces the previous invitation to the same address |
| ✅ | `GET` | `/leagues/{leagueID}/invitations` | superadmin | Pending invitations |
| ✅ | `DELETE` | `/leagues/{leagueID}/invitations/{invitationID}` | superadmin | Cancel an invitation |
| ✅ | `POST` | `/invitations/lookup` | public | Read an invitation (`token`): address, league, `account_exists` |
| ✅ | `POST` | `/invitations/accept` | public | Accept (`token`, plus `name` + `password` if the account doesn't exist) |
| ✅ | `GET` | `/leagues/{leagueID}/admins` | admin | The league's admins |
| ✅ | `DELETE` | `/leagues/{leagueID}/admins/{userID}` | superadmin | Remove an admin from the league (the account stays) |
