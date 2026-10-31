# Match events: design

**Status:** proposed. The owner approves this spec by merging its PR (#44). The code issues are created from it after the merge.

**Source of the scope:**
- #14: the owner keeps match events first among the Phase 6 features.
- #15, answer 4: yellow and red cards are entered from the admin during the match, and the `fair_play` tie-breaker is computed from them.
- `docs/plans/2026-10-30-finish-project.md` (PR-30…33).
- The mobile screens that commit `233f68a` removed for lack of data (`docs/mobile/2026-09-10-ligue-amateur-v5-design.md` §4, §7.2, §7.3, §7.4).

## 1. Goal

During a match, the league admin records what happens: goals (scorer, assist), yellow and red cards, and substitutions. From that data:

- supporters see **Faits de match** on the match screen, live and after the match;
- the standings screen gets the **Buteurs** and **Passeurs** tabs;
- a team's squad shows each player's **goals and assists** for the season;
- the `fair_play` tie-breaker, accepted but ignored today, ranks tied teams by their cards.

Success: an admin enters a match from a phone at the pitch side, and a supporter sees the scorers and cards on the mobile app with no other step.

### Out of scope

- Line-ups and starters. So there is no "matches played" (MJ) count per player, and substitutions are not checked against who is on the pitch.
- Cards for coaches or staff. Only players get cards.
- Live updates pushed to the app. The match screen refreshes when it is opened or pulled. Live screens and push are #47 and the push notifications item of #14.
- The MVP vote (#45), which will reuse the player stats shown here.
- The `random` tie-breaker (#122).

## 2. Approaches considered for the score

The main design choice is how goal events and the score relate. Today the admin sets the score with `PUT …/score` on a live match.

1. **The score follows the goal events (recommended).** On a live match, recording a goal adds 1 to its team's score, and deleting it removes 1, in the same transaction. On a finished match, goals can be added only as long as a team has fewer goal events than goals: the admin fills in scorers after the fact, and the score doesn't move. `PUT …/score` stays for corrections, but can't go below the number of goal events. Invariant: **a team's goal events never outnumber its goals.**
   - One tap records the goal and updates the score, which is what the admin wants at the pitch side.
   - Finished matches entered before this feature keep their score. Scorers can be added to them later.
2. **Score and events are independent.** The admin sets the score with `PUT /score` and adds goal events separately.
   - Two steps per goal during the match. The two can contradict each other (three goals listed, score 2-1).
3. **The score is computed from the events only.** `home_score` and `away_score` disappear from writes.
   - Strictest, but every past match would need its goals entered again. An organizer who doesn't know a scorer couldn't record the goal (see §3.2: a goal can have no scorer, which softens this).

Approach 1 keeps one step per goal and works for past matches, so the rest of this spec uses it.

## 3. Rules

### 3.1 All events

| Rule | Where |
|---|---|
| An event belongs to one match and to one of its two teams (`team_id` is the home or the away team) | service, 422 on `team_id` |
| Events are recorded on a **live** or **finished** match only. Scheduled, postponed and cancelled matches refuse them | `match.Match` rule, 409 |
| The minute is required, between 1 and 150. When the match has a kickoff, the admin form prefills it from the time elapsed since then | DTO validation, 422 |
| Every player named in an event is in the squad of the right team on the match day: joined on or before it, and not left before it. The match day is the UTC date of `kickoff_at`, or the day the event is recorded when the match has no kickoff | service, 422 on the player field |
| An event can't be edited: a wrong event is deleted and entered again | API surface |
| Events are listed by minute, then by entry order | query |
| A match's events can be read by anyone, like the rest of the match | access |

### 3.2 Goals

| Rule | Where |
|---|---|
| A goal counts for `team_id`. Its scorer (`player_id`) is optional: an organizer doesn't always know who scored | DTO |
| An **own goal** (`own_goal: true`) counts for `team_id`, and its scorer, when given, is in the **other** team's squad. It never counts in the Buteurs ranking | service, 422 |
| A **penalty** (`penalty: true`) or an own goal has no assist | `CHECK`, 422 |
| The assist (`assist_player_id`) is optional, in the scorer's team, and is not the scorer | service, 422 |
| On a live match, recording a goal adds 1 to the team's score, and deleting a goal removes 1, in the same transaction as the event (the match row is locked, `FOR UPDATE`, like the other match transitions) | `match.Service` |
| On a finished match, a goal can be recorded only while the team has fewer goal events than goals, and it doesn't change the score. Deleting one doesn't change the score either | `match.Match`, 409 |
| `PUT …/score` refuses a score lower than the team's number of goal events | `match.Match.SetScore`, 409 |

### 3.3 Cards

| Rule | Where |
|---|---|
| A card (`yellow_card`, `red_card`) names a player of `team_id` | DTO, service |
| A player gets at most two yellow cards and one red card per match | service, 409 |
| A player who is **sent off** (a red card, or a second yellow card) gets no further card in that match | service, 409 |
| A second yellow card is stored as a yellow card. The app shows it as a sending-off (`2e jaune`): no extra red card is stored | read model |

### 3.4 Substitutions

| Rule | Where |
|---|---|
| A substitution names the player who leaves (`player_id`) and the player who comes in (`player_in_id`), both in `team_id`'s squad, and different | service, 422 |
| Without line-ups, the API doesn't check that the player leaving is on the pitch | out of scope |

### 3.5 Rankings and squad stats

| Rule | Where |
|---|---|
| Buteurs and Passeurs count the goals of the season's **live and finished** matches: a goal shows as soon as it is entered | query |
| Own goals count for the team but not in Buteurs. Goals without a scorer count for the team only. Assists come from `assist_player_id` | query |
| A ranking row is a player. Its team is the team of the player's most recent goal or assist (a player transferred during the season appears once) | query |
| Equal values share a rank (1, 1, 3), sorted by last name then first name | query |
| A squad member's goals and assists are counted for that team and that season only | query |

### 3.6 Fair play

| Rule | Where |
|---|---|
| Fair-play points are counted per team over the season's **finished** matches, like the standings. **Fewer points ranks higher** | `standing.Compute` |
| Per player and per match: one yellow = 1, two yellows (sent off) = 3, a direct red = 4, a yellow then a direct red = 5. These are FIFA's fair-play values | pure function, unit-tested |
| `fair_play` applies in the order the season sets, like the other tie-breakers, and is computed on the whole season (not only the matches between the tied teams) | `standing.Compute` |
| The standings response adds a `fair_play_points` column, so a supporter can see why two teams are ordered | API |

## 4. Data model

One new table, migration `00012_create_match_event.sql`.

```sql
ALTER TABLE match ADD CONSTRAINT match_id_season_key UNIQUE (id, season_id);

CREATE TYPE match_event_type AS ENUM ('goal', 'yellow_card', 'red_card', 'substitution');

CREATE TABLE match_event (
    id                UUID PRIMARY KEY DEFAULT uuidv7(),
    league_id         UUID NOT NULL,
    season_id         UUID NOT NULL,
    match_id          UUID NOT NULL,
    team_id           UUID NOT NULL,
    type              match_event_type NOT NULL,
    minute            INT NOT NULL CHECK (minute BETWEEN 1 AND 150),
    player_id         UUID,
    assist_player_id  UUID,
    player_in_id      UUID,
    own_goal          BOOLEAN NOT NULL DEFAULT false,
    penalty           BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT match_event_match_fkey FOREIGN KEY (match_id, season_id)
        REFERENCES match(id, season_id) ON DELETE CASCADE,
    CONSTRAINT match_event_team_fkey FOREIGN KEY (season_id, team_id, league_id)
        REFERENCES season_team(season_id, team_id, league_id),
    CONSTRAINT match_event_player_fkey FOREIGN KEY (player_id, league_id)
        REFERENCES player(id, league_id) ON DELETE RESTRICT,
    CONSTRAINT match_event_assist_fkey FOREIGN KEY (assist_player_id, league_id)
        REFERENCES player(id, league_id) ON DELETE RESTRICT,
    CONSTRAINT match_event_player_in_fkey FOREIGN KEY (player_in_id, league_id)
        REFERENCES player(id, league_id) ON DELETE RESTRICT,
    CONSTRAINT match_event_goal_fields CHECK (type = 'goal' OR (NOT own_goal AND NOT penalty AND assist_player_id IS NULL)),
    CONSTRAINT match_event_card_player CHECK (type NOT IN ('yellow_card', 'red_card') OR player_id IS NOT NULL),
    CONSTRAINT match_event_substitution_players CHECK (
        (type = 'substitution') = (player_in_id IS NOT NULL)
        AND (type <> 'substitution' OR (player_id IS NOT NULL AND player_id <> player_in_id))
    ),
    CONSTRAINT match_event_no_assist CHECK (NOT (penalty OR own_goal) OR assist_player_id IS NULL)
);

CREATE INDEX match_event_match ON match_event (match_id, minute, id);
CREATE INDEX match_event_season ON match_event (season_id, type);
```

- `league_id` and `season_id` are repeated so the composite foreign keys keep leagues and seasons apart (decision 002), as in `squad_membership`. `match` gets a `UNIQUE (id, season_id)` for the event's foreign key, so an event can't point at a match of another season.
- A player with events can't be deleted (`RESTRICT`), which matches the rule "a player with history can't be deleted".
- Deleting a match deletes its events. Only a scheduled match can be deleted, and it has none.
- "The team is one of the match's two teams" and "the player is in the squad on the match day" need other rows, so the service checks them, inside the transaction that locks the match.

## 5. API

All routes are under `/api/v1/leagues/{leagueID}/seasons/{seasonID}`. Writes need a league admin (`LeagueAdminWrites`), reads are public. Every query filters on the URL's league and season, and a match of another league or season is a 404.

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/matches/{matchID}/events` | public | The match's events, by minute |
| `POST` | `/matches/{matchID}/events` | admin | Record an event. 201 with the event. A goal on a live match also changes the score |
| `DELETE` | `/matches/{matchID}/events/{eventID}` | admin | Delete an event. 204 |
| `GET` | `/scorers` | public | Buteurs ranking |
| `GET` | `/assists` | public | Passeurs ranking |

Changed responses:
- `GET …/standings`: each row gains `fair_play_points` (integer).
- `GET …/teams/{teamID}/squad`: each member gains `goals` and `assists` (integers, this team and this season).

### Event

```json
{
  "id": "…",
  "match_id": "…",
  "team_id": "…",
  "type": "goal",
  "minute": 37,
  "player": { "id": "…", "firstname": "Malik", "lastname": "Diarra" },
  "assist_player": { "id": "…", "firstname": "Léo", "lastname": "Dupont" },
  "player_in": null,
  "own_goal": false,
  "penalty": false,
  "sent_off": false,
  "home_score": 1,
  "away_score": 0
}
```

- `player`, `assist_player` and `player_in` are `null` when absent. They carry the names so the mobile app needs no other call.
- `sent_off` is `true` on a yellow card that is the player's second in the match, and on a red card.
- `home_score` and `away_score` are the running score **after** this event, on goals only (`null` on other events). They come from the goal events in minute order, so on a match whose scorers were filled in after the fact they can differ from the final score. The mobile app shows them only when the match's goal events add up to its score.

### Create request

```json
{ "type": "goal", "team_id": "…", "minute": 37, "player_id": "…", "assist_player_id": "…", "own_goal": false, "penalty": false }
{ "type": "yellow_card", "team_id": "…", "minute": 52, "player_id": "…" }
{ "type": "substitution", "team_id": "…", "minute": 60, "player_id": "…", "player_in_id": "…" }
```

Errors follow the API's conventions: 422 `{"errors": {...}}` for field validation, with the French messages of #29 (for example `{"errors": {"player_id": "n'est pas dans l'effectif de l'équipe ce jour-là"}}`), 409 `{"error": "..."}` for a refused state (`match is not live or finished`, `player is already sent off`, `team already has as many goal events as goals`), 404 for an unknown match or event.

### Ranking row

```json
{ "rank": 1, "player_id": "…", "firstname": "Malik", "lastname": "Diarra", "team_id": "…", "team_name": "FC Vallonnais", "value": 7 }
```

The full ranking is returned: a season has a few dozen scorers at most. Players with 0 are not listed.

## 6. Admin

### Match page

A new page `/leagues/:leagueId/seasons/:seasonId/matches/:matchId`, opened from a match row (`Faits de match`) for live and finished matches. It is made for a phone at the pitch side:

- header: the two teams, the score in large type, the status, the elapsed minute;
- four large buttons: **But**, **Carton jaune**, **Carton rouge**, **Remplacement**, each opening a short form:
  - team: two buttons (home / away), no dropdown;
  - player: the team's squad on the match day (from `GET …/squad?all=true`, filtered on the dates), by number then name. For a goal, `Buteur inconnu` is the first choice. For an own goal, the list switches to the other team;
  - for a goal: assist (optional), `Penalty` and `But contre son camp` checkboxes;
  - for a substitution: `Sort` and `Entre`;
  - minute: prefilled with the elapsed minutes since kickoff when the match has one, clamped to 1…150, editable;
- the list of events, newest first, each with `Supprimer` behind a confirmation;
- after a goal, the score in the header changes without reloading the page.

The existing `Score` action stays on the matches list for corrections. On a 409 because of goal events, it shows `Le score ne peut pas être inférieur au nombre de buts saisis.`

### Season

When the season's `tie_breakers` contain `fair_play`, the standings tab shows the `Fair-play` column.

## 7. Mobile

- **Match screen, `FAITS DE MATCH`** (`MatchScreen`, §7.4 of the mobile design), for live and finished matches with events: one row per event with the minute (mono), a tinted square per type, the player and a detail line, and the running score on goals. Detail lines: `Passe de M. Diarra`, `Penalty`, `Contre son camp`, `2e jaune`, `Remplace L. Dupont`, `Buteur inconnu`. The section is hidden when there is no event.
- **Classement, `Buteurs` and `Passeurs` tabs** (§7.2): `SegmentedTabs` `Général / Buteurs / Passeurs`, each tab a card of ranking rows (rank, name, team, value with `buts` / `passes`). `MVP` comes with #45. Empty state: `Aucun but pour le moment.` / `Aucune passe pour le moment.`
- **Team screen, squad rows** (§7.3): the line under the name becomes `{goals} buts · {assists} passes`. The `MJ` count stays out (no line-ups).
- All copy goes into `mobile/src/i18n/fr.ts`.

## 8. Tests

Following `docs/agents/testing.md`:

- **Go unit tests** (domain rules, no build tag):
  - event rules on `match.Match`: status, card limits and sending-off, own goal and penalty constraints, goal count vs score on a finished match;
  - fair-play points per player and per match (the four values), and `standing.Compute` with `fair_play` in the tie-breakers;
  - the running score of the event list.
- **Go integration tests** (`//go:build integration`, real Postgres):
  - each route: 201/204/200, 401, 403 for an admin of another league, 404 for a match or event of another league or season, 409 and 422 cases;
  - a goal on a live match changes the score; deleting it changes it back; `PUT /score` below the goal count is a 409;
  - a player outside the squad on the match day is a 422;
  - Buteurs and Passeurs: own goals and unknown scorers left out, live matches counted, cancelled ones not, ties share a rank;
  - squad `goals` and `assists` per team after a transfer;
  - the migration's `CHECK` constraints reject inconsistent rows written directly in SQL.
- **OpenAPI:** `docs/openapi.yaml` describes the new routes and fields (`TestOpenAPIDescribesEveryRoute`).
- **Admin:** page tests with MSW: recording each event type, the squad filtered on the match date, the score updated after a goal, the 409 and 422 messages shown under their fields, deleting an event. One Playwright scenario in `admin/e2e/`: start a match, record a goal and a card, finish it.
- **Mobile:** screen tests with a mocked `fetch`: `FAITS DE MATCH` (loading, error, events, empty), the Buteurs and Passeurs tabs, squad rows with goals and assists. The simulator pass is PR-26's.

## 9. Delivery

Four code issues, in this order, each its own PR:

1. **Back: events table and API.** Migration, `match` domain rules, routes, OpenAPI, spec docs. Depends on #121 (a live match can be interrupted) only for open question 3.
2. **Back: rankings, squad stats and fair play.** `/scorers`, `/assists`, squad `goals`/`assists`, `fair_play` in `standing.Compute`, `fair_play_points` in the standings. `docs/api/spec.md`: the `fair_play` ⚠️ becomes ✅.
3. **Admin: match page and event entry.** Depends on 1.
4. **Mobile: Faits de match, Buteurs and Passeurs, squad stats.** Depends on 1 and 2.

3 and 4 can run in parallel once 2 is merged.

## 10. Open questions for the owner

Each has the choice this spec makes. Merging the spec as is accepts these choices.

1. **Fair-play scale.** This spec uses FIFA's values (yellow 1, two yellows 3, direct red 4, yellow then red 5). A simpler scale (yellow 1, red 3) is an option.
2. **Goals without a scorer.** This spec allows them (`Buteur inconnu`), so an organizer who doesn't know the scorer can still record the goal and its minute. The alternative is to require a scorer.
3. **Events of an interrupted match.** With #121, a live match can be postponed or cancelled. This spec keeps its events for the record. They don't count in Buteurs, Passeurs or fair play, since only live and finished matches (finished for fair play) count. The alternative is to delete them.
4. **Minute required.** This spec requires a minute (prefilled from kickoff). Some organizers may prefer to record only "who scored", without the minute.
5. **Editing finished matches.** This spec lets an admin add or delete events on a finished match at any time, for corrections and late entry. A time limit (for example 7 days after the match) is an option.
6. **Line-ups.** Without them there is no "matches played" per player, and substitutions are not checked. Line-ups could be a later feature.
7. **Team of a transferred player in the rankings.** This spec shows the team of the player's most recent goal or assist. Showing every team the player scored for is an option.
