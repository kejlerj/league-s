# league-s business specifications

The business rules, independent of how they are coded. For each rule: where it is enforced today, or what is left to do.

Technical choices are in `decision.md`, tasks in `checklist.md`, routes in `endpoints.md`.

**Legend**
- ✅ enforced (the place is given)
- ⚠️ not enforced yet
- ❓ to confirm (open business question)

## Context

An app for amateur football leagues (five-a-side, urban football), not for professional football. Each league is run by its organizers and is fully independent of the others.

## League

| Rule | Status |
|---|---|
| A league is isolated from the others: its teams, players, seasons and matches can be neither seen nor changed from another league | ✅ `league_id` filters + composite foreign keys (decision 002) |
| **A league has only one season at a time**: the periods of its seasons don't overlap (first and last day included) | ✅ constraint `season_league_no_overlap` (`EXCLUDE USING gist (league_id WITH =, daterange(start_on, end_on, '[]') WITH &&)`, `btree_gist`), 409 on create and on update |
| A league with a history (teams, players, seasons) can't be deleted | ✅ `ON DELETE RESTRICT`, 409 |
| Name: required, 50 characters max. Logo: URL, optional | ✅ DTO validation |
| Creating or deleting a league: superadmin only | ✅ `auth.SuperadminWrites` |
| A league admin changes its name or its logo | ✅ `PATCH /leagues/{leagueID}`, only the fields sent change |

## Team

| Rule | Status |
|---|---|
| A team belongs to a single league | ✅ `team.league_id` |
| The name is unique within the league (two leagues can each have a team with the same name) | ✅ `UNIQUE (league_id, name)`, 409 |
| Name: required, 50 characters max. Logo: URL, optional | ✅ DTO validation |
| A team takes part in a season by registering for it | ✅ table `season_team` |
| A team can be registered only once for a season | ✅ primary key `(season_id, team_id)`, 409 |
| A team that already has matches in the season can't be unregistered | ✅ `ON DELETE RESTRICT`, 409 |
| A team registered for a season can't be deleted | ✅ `ON DELETE RESTRICT` on `season_team`, 409 |

## Player

| Rule | Status |
|---|---|
| A player belongs to a single league. The same person playing in two leagues has two player records | ✅ `player.league_id` |
| First and last name: required, 50 characters max. Icon: URL, optional | ✅ DTO validation |
| Two players can have the same name | ✅ no uniqueness constraint |
| A player has no position: in five-a-side and urban football, players rotate during the match | ✅ no position field, neither on the player nor in the squad |
| A player who has been in a squad can't be deleted | ✅ `ON DELETE RESTRICT` on `squad_membership`, 409 |

## Season

| Rule | Status |
|---|---|
| The competition rules (points, tie-breakers) belong to the season, not to the league: changing them doesn't rewrite past standings | ✅ columns of `season` |
| The name is unique within the league | ✅ `UNIQUE (league_id, name)`, 409 |
| The end is after the start | ✅ `CHECK (end_on > start_on)` and `Season.CheckDates` (422 on `end_on`). Season dates are in `YYYY-MM-DD` format in the API (`datetime=2006-01-02`). On `PATCH`, the constraint also refuses (422 on `end_on`) a new date that puts the end before the start, even when only one of the two is sent |
| New season dates keep everything the season holds: squad memberships (`joined_on` to `left_on`, or `joined_on` alone while open) and match kickoffs stay inside the new dates (first and last days included, kickoffs in UTC) | ✅ `PostgresStore.Update`: in one transaction, `LockSeason` (`FOR UPDATE`), then `Season.CheckContent` → `ErrUpdateMembershipsOutside` / `ErrUpdateMatchesOutside`, 409. A refused change changes nothing. Joins (`LockSquad`) and leaves (`GetSquadRules`, inside `Service.Leave`'s transaction) take `FOR SHARE OF season`, and the match service locks the season, so they don't race with a date change |
| A season that has matches can't be deleted. Without matches, its registrations and squads are deleted with it | ✅ `ON DELETE RESTRICT` from `match` on `season_team`, 409. `ON DELETE CASCADE` for `season_team` and `squad_membership` |
| **Only one season at a time per league** | ✅ see League |
| Default points: 3 (win), 1 (draw), 0 (loss) | ✅ optional fields in the DTO: an omitted field takes the default value (`season.DefaultMatchWinPts`…), an explicit `0` is kept |
| Possible tie-breakers: goal difference, goals scored, head-to-head, fair play, applied in the chosen order. By default: goal difference, then head-to-head (who won between the tied teams). No drawing lots (decision #122) | ✅ `tie_breakers` omitted on create → `season.DefaultTieBreakers()` (`goal_difference`, `head_to_head`), like the column's default value. A single name, `goals_scored`, in the database and in the validator. `standing.Compute` applies `goal_difference`, `goals_scored` and `head_to_head`. `random` is refused (422), and migration 00013 removed it from existing seasons. ⚠️ `fair_play` is accepted but ignored: there is no card data. On a complete tie, alphabetical order decides |
| Maximum squad size, optional | ✅ `max_squad_size` (`NULL` = no limit, `CHECK > 0`), accepted on create (`min=1`, 422 otherwise) and returned by the seasons API |

## Squad

**Vocabulary**
- a **membership** (`Membership`, one row of `squad_membership`): one player, in one team, for one season, between two dates;
- a team's **squad** for a season: all its memberships. It has no table of its own: it is anchored on the `season_team` row (the team's registration for the season).

| Rule | Status |
|---|---|
| Only a team registered for the season can have a squad | ✅ foreign key to `season_team` |
| The player and the team are from the same league | ✅ composite foreign keys |
| A player is active in only one team at a time. Since a league has only one season at a time, "one per season" means "one in the league" | ✅ partial index `squad_membership_active_player`, 409 (depends on the "one season at a time" rule) |
| A player can leave a team and come back: each membership is a row | ✅ data model |
| Leaving deletes nothing: it sets `left_on`, and the history stays readable | ✅ `CloseSquadMembership`, `ListSquadMemberships` with history |
| Leaving is on the same day as joining or later | ✅ `CHECK squad_membership_left_after_joined`, `ErrLeaveBeforeJoining` |
| Two memberships of the same player don't overlap, even in the past (first and last days included) | ✅ constraint `squad_membership_no_overlap` (`EXCLUDE USING gist (player_id WITH =, season_id WITH =, daterange(joined_on, left_on, '[]') WITH &&)`), `ErrJoinOverlap`, 409 (decision 008). Scoped by season: memberships stay inside their season and seasons don't overlap, so it is one team at a time in the league, and an open membership of a past season doesn't block the next one |
| Shirt number: optional, between 1 and 99 | ✅ `CHECK` in the database and DTO validation (422) |
| A number is unique within the active squad. It becomes free when the player leaves | ✅ partial index `squad_membership_active_number`, 409 |
| Joining and leaving happen during the season (first and last day included) | ✅ `SquadRules.CheckJoin` and `CheckLeave`, called by the service: `ErrJoinOutsideSeason`, `ErrLeaveOutsideSeason` |
| The squad doesn't exceed the season's maximum size | ✅ `Service.Join`: `LockSquad` (lock on `season_team`), `CountActive`, then `SquadRules.CheckJoin` → `ErrJoinSquadFull`. Also applies to the receiving team of a transfer |
| A transfer (leaving then joining) is all or nothing | ✅ `Service.Transfer`, inside `store.InTx` |
| A transfer on day D: the player's last day in the former team is D, they join the new team on D + 1. A transfer on the season's last day is refused | ✅ `Transfer.JoinedOn`, `ErrJoinOutsideSeason` (422) |
| `left_on` is the player's last day in the team (included) | ✅ decided in #15. The overlap constraint uses inclusive bounds (`'[]'`), so joining another team on that same day is refused |

## Match (planned)

| Rule | Status |
|---|---|
| A match is between two different teams, both registered for the season | ✅ `CHECK (home_team_id <> away_team_id)` + foreign keys to `season_team` |
| Matchday number strictly positive | ✅ `CHECK (matchday > 0)` |
| The score is complete (both teams) or absent, never negative | ✅ `CHECK` in the database |
| A finished match has a score | ✅ `CHECK (status <> 'finished' OR home_score IS NOT NULL)` |
| Lifecycle: scheduled, in progress, finished, postponed, cancelled, with forbidden transitions | ✅ rich entity `match.Match` (decision 007), 409 on a forbidden transition. The service locks the match (`FOR UPDATE`) during the transition |
| Transitions: a scheduled match can start, be postponed or cancelled. A match in progress can finish, or be interrupted: postponed or cancelled. A postponed match can be rescheduled or cancelled. A finished or cancelled match no longer changes status (decision #15) | ✅ `Match.Start`, `Match.Finish`, `Match.Postpone`, `Match.Cancel`, 409 |
| An interrupted match keeps its score for the record, but doesn't count in the standings. When a postponed match gets a new kickoff, it is scheduled again without a score, and restarts at 0-0 | ✅ `Match.Postpone`, `Match.Cancel`, `Match.Reschedule`, `Match.Winner` |
| The score starts at 0-0 at kickoff and only changes during the match | ✅ `Match.Start`, `Match.SetScore` |
| Postponing without a new date sets the match to `postponed`. Giving it a kickoff reschedules it | ✅ `Match.Postpone`, `Match.Reschedule` |
| A team has no home ground: the venue (the booked pitch) belongs to each match, is optional, and is given when scheduling or later | ✅ `match.venue`, accepted by `POST` and `PATCH` |
| Referee, call time and video link are optional and filled in by the admin, whatever the match status | ✅ `Match.UpdateDetails`, through the `PATCH`. The video link must be `http` or `https` |
| Changing the matchday or the kickoff is only allowed for scheduled or postponed matches | ✅ `Match.Reschedule`, 409. A refused `PATCH` changes nothing, not even the details sent with it |
| Dates and times are stored and returned in UTC. The display time zone is the reader's device time zone | ✅ `TIMESTAMPTZ` in the database, `kickoff_at` and `convocation_at` returned with the `Z` suffix |
| Only a match that is still scheduled can be deleted | ✅ `Match.CheckDeletable`, 409 |
| A team plays at most one match per matchday (cancelled matches don't count) | ✅ `match.Service`, with a lock on the season against concurrent creates, 409 |
| The kickoff is during the season (first and last day included, in UTC) | ✅ `match.Service`, 422 |

## Match events

Design: `docs/specs/2026-10-31-match-events-design.md`.

| Rule | Status |
|---|---|
| An event belongs to one match and to one of its two teams | ✅ `Match.RecordEvent`, 422 on `team_id`. `match_event_match_fkey` keeps the event in the match's season |
| Events are recorded and deleted on a live or finished match only | ✅ `Match.RecordEvent`, `Match.RemoveEvent`, 409. A finished match stays finished |
| The minute is required, between 1 and 150 | ✅ DTO validation and `Event.Clean`, 422. `CHECK` in the database |
| Every player named is in the squad of the right team on the match day (the UTC date of the kickoff, or the day the event is recorded without a kickoff) | ✅ `match.Service.RecordEvent`, in the transaction that locks the match, 422 on the player field |
| An event can't be edited: a wrong event is deleted and entered again | ✅ no `PATCH` route |
| Events are listed by minute, then by entry order, and can be read by anyone | ✅ `ListMatchEvents`, public `GET` |
| A goal's scorer is optional. An own goal counts for `team_id`, and its scorer is in the other team's squad | ✅ `Event.SquadTeamID`, 422 |
| A penalty or an own goal has no assist. The assist is in the scorer's team, and is not the scorer | ✅ `Event.Clean`, `match.Service`, 422. `CHECK` in the database |
| On a live match, a goal adds 1 to its team's score, and deleting it removes 1, in the same transaction | ✅ `Match.RecordEvent`, `Match.RemoveEvent`, the match row locked `FOR UPDATE` |
| On a finished match, a goal is accepted only while the team has fewer goal events than goals, and the score doesn't move | ✅ `Match.RecordEvent`, 409 |
| `PUT …/score` refuses a score lower than a team's number of goal events | ✅ `Match.CheckGoalEvents`, called by `match.Service.SetScore`, 409 |
| A card names a player. A player sent off (a red card, or a second yellow card) gets no further card, so at most two yellows and one red per match | ✅ `Match.RecordEvent`, 409 |
| A second yellow card is stored as a yellow card, and read as a sending-off | ✅ `SummarizeEvents`, `sent_off` in the response |
| A substitution names the player leaving and the player coming in, both in the team's squad, and different. Who is on the pitch is not checked (no line-ups) | ✅ `Event.Clean`, `match.Service`, 422. `CHECK` in the database |
| An injury names a player and takes an optional note of 1 to 200 characters after trimming. Only an injury has a note | ✅ `Event.Clean`, 422. `CHECK` in the database |
| The injury note is returned only to an admin of the league | ✅ the events handler asks `auth.Service.CanWrite`. Anyone else gets `note: null`, never a 401 or 403 |
| A player with events can't be deleted | ✅ `ON DELETE RESTRICT` on the player foreign keys |

## Standings (planned)

| Rule | Status |
|---|---|
| The standings are not stored: they are computed from the matches, with the season's rules | ✅ `standing.Compute` |
| Only finished matches count | ✅ `Match.Winner` refuses the others |
| Tie-breakers apply in the order set by the season | ✅ `standing.Compute`. Head-to-head counts only the matches between the tied teams, and is recomputed on the remaining subgroup |

## Access (planned)

| Rule | Status |
|---|---|
| Reads are public | ✅ `GET` requests go through without a session |
| A league's writes are reserved to its admins. A league can have several admins, and an admin several leagues | ✅ `auth.LeagueAdminWrites` on every league route: 401 without a session, 403 without rights on that league |
| The superadmin creates and deletes leagues, and has every right on each of them | ✅ `auth.SuperadminWrites` |
| The superadmin account is created at startup from `SUPERADMIN_EMAIL`, without a password. A single-use link, valid for one hour, is sent by email (SMTP) to choose one. Without `SMTP_HOST`, no email is sent and the link is written nowhere | ✅ `auth.EnsureSuperadmin`. A new link is issued at each startup as long as no password is set |
| Forgotten password: a single-use link, valid for one hour, sent by email (SMTP). The response is the same whether the email exists or not | ✅ `POST /auth/password-reset` then `/confirm`. Resetting closes every session of the account |
| A signed-in user changes their password by giving the current one | ✅ `PUT /me/password`. The account's other sessions are closed |
| The superadmin appoints admins through an invitation: a single-use link, valid for 7 days, sent by `mailto:` from the web admin | ✅ table `invitation`, `auth.Invitations`. Only the token's hash is stored, the link is returned only on creation. A new invitation to the same address replaces the previous one. Accepting creates the account, or attaches the league to the existing account. No open sign-up in v1 |
| A session lasts 30 days, extended on each use. Signing out deletes it on the server | ✅ table `session`, only the token's hash is stored |
| Expired sessions, expired or used password reset links, and invitations that expired without being accepted are deleted. Accepted invitations stay, as the record of how an admin joined | ✅ `auth.Cleaner`, at startup and every `CLEANUP_INTERVAL` (1 hour by default) |
| An admin of league A has no rights on league B | ✅ tested on the real router (`internal/server/auth_test.go`) |
