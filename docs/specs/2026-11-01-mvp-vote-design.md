# MVP vote: design

**Status:** proposed. The owner approves this spec by merging its PR (#45). The code issues are created from it after the merge.

**Source of the scope:**
- #14: the owner keeps the MVP vote, right after match events.
- `docs/specs/2026-10-31-match-events-design.md` (#44, merged): the match page, squads on the match day, the Buteurs and Passeurs rankings. This spec builds on it.
- `docs/plans/2026-10-30-finish-project.md` §4.2: "needs an identity per device or per user, and abuse protection".
- The mobile screens that commit `233f68a` removed for lack of data (`docs/mobile/2026-09-10-ligue-amateur-v5-design.md` §7.2 `MVP` tab, §7.4 `MVP DU MATCH` card).

## 1. Goal

After a match, supporters vote for the best player of the match (MVP) from the mobile app. From the votes:

- the match screen shows the **MVP du match**, the vote count and each candidate's share, and lets a supporter vote or change their vote;
- the standings screen gets the **MVP** tab: the season's players ranked by MVP titles.

Success: a supporter who opens a finished match votes in two taps, with no account. A league's MVP can't be won by one person voting many times from one phone, or by a simple script.

### Out of scope

- Supporter accounts. The app has none today, and creating them only for a vote is too much friction (§2).
- Proof that a voter is a real person (captcha, phone number, App Attest, Play Integrity). §2 explains why, and open question 2 keeps it for later.
- Votes from the admin, or an MVP picked by the organizers.
- Notifications when voting opens or closes. They come with push notifications, which can reuse the device of §3.1.
- Line-ups. Without them, the candidates are the squads on the match day, not the players who played (§3.3).

## 2. Approaches considered for the voter identity

The main design choice is who "one vote" belongs to.

1. **A device registered with the API (recommended).** On first use, the app calls `POST /devices` and gets an opaque random token, which it keeps. Every vote carries the token. One vote per device and per match. Registration is rate-limited per IP address.
   - No account, no form: two taps to vote.
   - Reinstalling the app or clearing its data gives a new device, so one person can vote again. Doing it at scale needs many IP addresses or a lot of patience, because registration and votes are rate-limited.
   - The same device can later carry push notification settings, so the work is reused.
2. **Supporter accounts** (email and password, or a magic link).
   - Stronger: one vote per email address. But a throwaway email is free, so it doesn't stop a determined cheater either.
   - Every supporter has to sign up before voting: most won't. It also needs password reset and account deletion for supporters, which the API only has for admins.
3. **Platform attestation** (Apple App Attest, Google Play Integrity) on top of 1.
   - Proves that the request comes from the real app on a real phone, which blocks scripts.
   - A new external service per platform, server-side verification, and nothing to test on a simulator. Too heavy for an amateur league's MVP, and it is a new service, which needs the owner's decision (`CLAUDE.md`).

Approach 1 matches the stakes: the MVP is for fun, and the rules below make cheating visible and slow. The rest of this spec uses it.

## 3. Rules

### 3.1 Devices

| Rule | Where |
|---|---|
| `POST /devices` creates a device and returns its token once: 32 random bytes, base64url. The API stores only its SHA-256 hash | `device` service |
| A device is not tied to a league: one phone follows several leagues | data model |
| A request names its device with the `X-Device-Token` header. An unknown token is a 401 | middleware |
| `POST /devices` is limited to 5 per hour per IP address (`httprate`, like the login) | router, 429 |
| A device that hasn't been seen for 18 months is deleted with its votes. The results and MVP titles of closed votes don't change, since they are stored per match when the vote closes (§3.4) | daily job (open question 6) |

### 3.2 Voting window

| Rule | Where |
|---|---|
| Voting opens when the match is **finished** | `mvp` service, 409 |
| It closes **72 hours** after the match was finished (open question 1) | `mvp` service, 409 |
| A finished match that is corrected later (match events spec §3.3) keeps its window: the correction doesn't reopen voting | `mvp` service |
| A cancelled or postponed match has no vote | `mvp` service, 409 |
| Matches finished before this feature have no vote: voting needs `finished_at`, which they don't have | migration |

`match` gains a `finished_at TIMESTAMPTZ` column, set by `Match.Finish`. It is `NULL` for matches finished before the migration, and the API treats them as closed with no votes.

### 3.3 Candidates and votes

| Rule | Where |
|---|---|
| The candidates are the players in the squad of either team on the match day (same definition as the match events spec §3.1) | `mvp` service, 422 on `player_id` |
| A device has at most one vote per match. Voting again replaces its vote. It can also withdraw its vote | primary key, `PUT` / `DELETE` |
| Votes and withdrawals are refused after the window closes | `mvp` service, 409 |
| Votes are limited to 30 per minute per IP address and 10 per minute per device | router, 429 |
| A league admin can't vote from the admin: votes only come from devices | API surface |

### 3.4 Results

| Rule | Where |
|---|---|
| The results are public while the vote is open, and final once it closes: total votes, and each candidate with at least one vote, with their count and share (percent rounded to the nearest integer) | query |
| The **MVP** is the candidate with the most votes. When several share the lead, they are all MVPs of the match | query |
| A match with no vote has no MVP | query |
| At closing, the result is stored in `match_mvp` (one row per MVP of the match, with the vote count and the total). Closing is done by the first read or write after the deadline, and by the daily job, in a transaction that locks the match | `mvp` service |
| After closing, a player deleted from a squad or a device deleted doesn't change the stored result | data model |

### 3.5 MVP ranking

| Rule | Where |
|---|---|
| A ranking row is a player. Its value is the number of **MVP titles** in the season's matches whose vote is closed (open question 3) | query |
| Ties: more total votes in those matches ranks higher, then last name and first name. Equal titles and equal votes share a rank (1, 1, 3) | query |
| Its team is the team of the player's most recent title, like the Buteurs ranking (match events spec §3.7) | query |
| Players with no title are not listed | query |

### 3.6 Abuse

| Rule | Where |
|---|---|
| A league admin can **void** a match's vote, open or closed: all its votes and its stored result are deleted, `match.mvp_voided_at` is set, and voting is closed for good. Used when a vote was obviously stuffed | `mvp` service, admin route |
| Voiding is logged (admin, match, vote count) | handler, `slog` |
| The admin match page shows the number of devices that voted, and how many of them were registered in the 24 hours before voting: a sudden wave of new devices is the visible sign of cheating | admin read |

## 4. Data model

One migration, after the match events one (the next free number at the time).

```sql
ALTER TABLE match ADD COLUMN finished_at TIMESTAMPTZ, ADD COLUMN mvp_voided_at TIMESTAMPTZ;

CREATE TABLE device (
    id            UUID PRIMARY KEY DEFAULT uuidv7(),
    token_hash    BYTEA NOT NULL UNIQUE CHECK (length(token_hash) = 32),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mvp_vote (
    league_id   UUID NOT NULL,
    season_id   UUID NOT NULL,
    match_id    UUID NOT NULL,
    device_id   UUID NOT NULL REFERENCES device(id) ON DELETE CASCADE,
    player_id   UUID NOT NULL,
    voted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, device_id),
    CONSTRAINT mvp_vote_match_fkey FOREIGN KEY (match_id, season_id)
        REFERENCES match(id, season_id) ON DELETE CASCADE,
    CONSTRAINT mvp_vote_player_fkey FOREIGN KEY (player_id, league_id)
        REFERENCES player(id, league_id) ON DELETE RESTRICT
);

CREATE INDEX mvp_vote_match_player ON mvp_vote (match_id, player_id);

CREATE TABLE match_mvp (
    league_id    UUID NOT NULL,
    season_id    UUID NOT NULL,
    match_id     UUID NOT NULL,
    player_id    UUID NOT NULL,
    team_id      UUID NOT NULL,
    votes        INT NOT NULL CHECK (votes > 0),
    total_votes  INT NOT NULL CHECK (total_votes >= votes),
    PRIMARY KEY (match_id, player_id),
    CONSTRAINT match_mvp_match_fkey FOREIGN KEY (match_id, season_id)
        REFERENCES match(id, season_id) ON DELETE CASCADE,
    CONSTRAINT match_mvp_player_fkey FOREIGN KEY (player_id, league_id)
        REFERENCES player(id, league_id) ON DELETE RESTRICT,
    CONSTRAINT match_mvp_team_fkey FOREIGN KEY (season_id, team_id, league_id)
        REFERENCES season_team(season_id, team_id, league_id)
);

CREATE INDEX match_mvp_season ON match_mvp (season_id, player_id);
```

- `match(id, season_id)` is unique since the match events migration, so a vote can't point at a match of another season.
- `league_id` and `season_id` are repeated for the composite foreign keys (decision 002), as in `match_event`.
- A player with votes or titles can't be deleted (`RESTRICT`), like a player with events.
- A match with a vote is finished, so it can't be deleted (only scheduled matches can), and `CASCADE` never fires in practice.
- `device` holds no personal data beyond the token's hash and two dates. No IP address is stored: rate limits are kept in memory by `httprate`.
- A vote closed with no result row is a match with no vote. "Closed" is computed from `finished_at`, not stored. "Void" is `mvp_voided_at IS NOT NULL`.

## 5. API

### Devices

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/devices` | public, rate-limited | Register a device. 201 `{"token": "…"}`. The token is shown only here |

### Votes

Under `/api/v1/leagues/{leagueID}/seasons/{seasonID}`. Every query filters on the URL's league and season; a match of another league or season is a 404.

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/matches/{matchID}/mvp` | public | The vote's state and results. With `X-Device-Token`, also the device's vote |
| `PUT` | `/matches/{matchID}/mvp/vote` | device | Vote, or change the vote. Body `{"player_id": "…"}`. 200 with the same body as `GET` |
| `DELETE` | `/matches/{matchID}/mvp/vote` | device | Withdraw the vote. 204 |
| `DELETE` | `/matches/{matchID}/mvp` | admin | Void the match's vote (§3.6). 204 |
| `GET` | `/mvp` | public | The season's MVP ranking |

`X-Device-Token` is added to the CORS allowed headers.

### Vote state

```json
{
  "status": "open",
  "closes_at": "2026-11-04T18:30:00Z",
  "total_votes": 41,
  "my_vote": "…",
  "candidates": [
    { "player": { "id": "…", "firstname": "Malik", "lastname": "Diarra" }, "team_id": "…", "votes": 25, "percent": 61 },
    { "player": { "id": "…", "firstname": "Léo", "lastname": "Dupont" }, "team_id": "…", "votes": 16, "percent": 39 }
  ],
  "mvp": ["…"]
}
```

- `status`: `not_open` (the match isn't finished), `open`, `closed`, or `void` (an admin voided it). Matches finished before the feature are `closed` with no votes.
- `closes_at` is `null` when the status is `not_open`, or for a match finished before the feature.
- `my_vote` is the device's `player_id`, or `null` with no vote or no token.
- `candidates` lists players with at least one vote, most votes first. The full candidate list (the squads) comes from the existing squad routes.
- `mvp` holds the leaders' IDs: empty with no vote, several on a tie. While the vote is open, it is the current leader.
- For an admin of the league, the response also carries `devices_registered_last_24h` (§3.6). It is absent for everyone else.

Errors: 401 `{"error": "unknown device"}`, 409 `{"error": "voting is not open"}` (`not_open`, `closed` or `void`), 422 `{"errors": {"player_id": "n'est pas dans l'effectif d'une des deux équipes ce jour-là"}}`, 429 when rate-limited.

### Ranking row

Same shape as Buteurs and Passeurs (match events spec §5), so the mobile app reuses its row:

```json
{ "rank": 1, "player_id": "…", "firstname": "Malik", "lastname": "Diarra", "team_id": "…", "team_name": "FC Vallonnais", "value": 3 }
```

## 6. Admin

On the match page of the match events spec (§6), for a finished match, an **MVP** section:

- the status (`Vote ouvert jusqu'au 4 nov. à 18 h 30`, `Vote clos`, `Vote annulé`), the total votes, the MVP(s), and the candidates with their votes and shares;
- `Appareils récents : 12 sur 41` with a short explanation (`appareils enregistrés dans les 24 h avant le vote`);
- **Annuler le vote**, behind a confirmation (`Tous les votes de ce match seront supprimés. Le match n'aura pas de MVP.`).

The season's standings tab gets no MVP column: the ranking is for supporters.

## 7. Mobile

- **Device:** on the first vote, the app calls `POST /devices` and keeps the token in AsyncStorage (already used for persisted state, no new library). A 401 on a vote means the token was deleted on the server: the app registers again and retries once.
- **Store:** the persisted `mvpVotes` of the v5 design is replaced by the server's `my_vote`. The store keeps only the token.
- **Match screen, `MVP DU MATCH` card** (§7.4 of the mobile design), on a finished match:
  - `open`: the leader (avatar, name, `{share} % des voix`, progress bar), `{total} votes`, and `Voter pour le MVP`, which opens a sheet with both squads, grouped by team, by number then name. After voting: `Vous avez voté pour M. Diarra` and `Changer` / `Retirer mon vote`. A line says when voting closes (`Vote ouvert jusqu'au mar. 4 nov. à 18 h 30`).
  - `closed`: `MVP du match` with the MVP(s) and their share. No button.
  - `closed` with no vote, or `void`: the card is hidden.
- **Classement, `MVP` tab** (§7.2): `SegmentedTabs` `Général / Buteurs / Passeurs / MVP`, ranking rows with the value in `MVP` (`3 MVP`). Empty state: `Aucun MVP pour le moment.`
- All copy goes into `mobile/src/i18n/fr.ts`.

## 8. Tests

Following `docs/agents/testing.md`:

- **Go unit tests:** the voting window from `finished_at` (not open, open, closed at exactly 72 hours, legacy match), the results (shares, rounding, ties, no vote), the ranking order and shared ranks.
- **Go integration tests** (`//go:build integration`, real Postgres):
  - `POST /devices`: 201, the token works, only its hash is stored, the sixth registration in an hour from one IP is a 429;
  - voting: 200, changing and withdrawing, 401 without or with an unknown token, 409 before finishing, after closing and after voiding, 422 for a player outside both squads on the match day, 404 for a match of another league or season;
  - closing stores `match_mvp`, and a later device deletion doesn't change it;
  - `DELETE …/mvp`: 204 for the league's admin, 401, 403 for an admin of another league;
  - `devices_registered_last_24h` present for an admin, absent otherwise;
  - the ranking: titles, ties broken by votes, voided matches left out;
  - correcting a finished match doesn't reopen its vote.
- **OpenAPI:** the new routes, the `X-Device-Token` header (`TestOpenAPIDescribesEveryRoute`).
- **Admin:** page tests with MSW: the MVP section for each status, voiding with its confirmation.
- **Mobile:** screen tests with a mocked `fetch`: the card for each status, voting, changing, withdrawing, the device registered on the first vote and again after a 401, the MVP tab (loading, error, rows, empty). Store tests: the token is persisted. The simulator pass is PR-26's.

## 9. Delivery

Three code issues, each its own PR, after the match events issues they depend on:

1. **Back: devices, votes and the MVP ranking.** Migration, `device` and `mvp` packages, routes, rate limits, the daily job (open question 6), OpenAPI, spec docs. Depends on the match events back issue (`match(id, season_id)` and squads on the match day).
2. **Admin: MVP section of the match page.** Depends on 1 and on the admin match page.
3. **Mobile: MVP du match card and MVP tab.** Depends on 1, and on the mobile match events issue for the shared ranking row.

2 and 3 can run in parallel once 1 is merged.

## 10. Open questions for the owner

Each has the choice this spec makes. Merging the spec as is accepts these choices.

1. **Voting window.** This spec opens voting when the match finishes and closes it 72 hours later. Options: 24 hours, until the next matchday's kickoff, or voting during the match too.
2. **Abuse protection.** This spec uses a device token and rate limits, with no account and no attestation. Someone determined can still vote several times (new install, several networks). An admin can void a stuffed vote. Stronger options, each with more friction or a new service: supporter accounts, a phone number check, or Apple App Attest and Google Play Integrity.
3. **MVP ranking value.** This spec counts MVP **titles** (matches won), ties broken by total votes. The v5 design showed **total votes** (`PLUS VOTÉS MVP`, unit `votes`), which favours teams with more supporters.
4. **Candidates.** This spec lets supporters vote for any player in either squad on the match day, since there are no line-ups. A player who didn't play can win. Options: only players with an event in the match, or an admin-picked shortlist.
5. **Live results.** This spec shows the counts while voting is open. Hiding them until the vote closes avoids a bandwagon effect, but makes the card less lively.
6. **Device cleanup.** This spec deletes devices unseen for 18 months, with a daily job, and closes votes in the same job. The API has no scheduled job yet: the alternative is to close votes only on read and keep devices forever (they hold no personal data beyond two dates).
7. **Voting from another league's supporters.** A device can vote in any league's matches. Limiting votes to followed teams isn't possible, since follows stay on the phone.
