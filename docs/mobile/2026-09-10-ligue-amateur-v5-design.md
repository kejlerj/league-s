# Ligue Amateur — App v5 — Design

**Date:** 2026-09-10
**Status:** Draft for review
**Source design:** Claude Design project `Soccer league mobile app`
(`5ac057bd-e7e3-4daf-aa3b-d6c73a01ca50`), file `Ligue Amateur - App.dc.html`,
**turn `t5` — "Version courante de chaque page"**.

---

## 1. Context & goal

`Ligue Amateur` is a French-language mobile app for a **fictional amateur
football district** (District Loire, D2, 10 teams, season 26/27). It lets a
supporter follow their teams' fixtures and results, browse league standings and
stat rankings, open a finished match's recap (video, events, MVP vote), make
score predictions (`Pronos`), and buy league merchandise (`Boutique`).

Turn 5 of the design doc is the current version of every screen. The two source
files `ios-frame.jsx` (canvas device-frame mock) and `support.js` (design-canvas
template runtime) are **not application code** — they belong to the design tool.
The translation target is the **visual design and described behaviour** of the
seven `t5` screens.

### This implementation (first slice)

Confirmed scope with the product owner:

**In scope**
- Navigation shell: bottom tab bar `Suivi · Classement · Pronos · Moi`.
- **Suivi** (5a) — chronological fixture list for followed teams.
- **Classement** (5d) — 4-tab standings & stat rankings.
- **Team** sub-page (5b) — reachable from Suivi and Classement, tab bar visible.
- **Match** sub-page (5c) — reachable from a list, **tab bar hidden**, closes
  back to its parent.
- **Moi** (5g) — minimal: profile header, stat cards, and a working **theme
  toggle** (System / Light / Dark). Product owner selected "System + toggle in
  Moi", so Moi ships minimally to host the toggle.
- **Pronos** and **Boutique** — `PlaceholderScreen` ("Bientôt disponible").
  Boutique is the target of the Suivi shop-suggestion row.
- Light + dark themes, French copy, mock data.

**Out of scope (later slices)**
- Pronos screens (Journée N score entry + auto-save, Classement leaderboard).
- Full Moi (shop promo card, MES ÉQUIPES notification settings, full COMPTE).
- Boutique (categories, product grid, product detail with size, cart, checkout).
- Team/league search, post-matchday results screen, live match screen.
- Any real backend calls (the service layer is built as the seam for them).

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Runtime | Expo (latest SDK), React Native, TypeScript |
| Routing | Expo Router (file-based) |
| Styling | NativeWind v4 (Tailwind for RN) |
| Client state | Zustand + `@react-native-async-storage/async-storage` (persist) |
| Server data | `src/services/*` async modules + a `useAsync` hook (backend seam) |
| Fonts | `@expo-google-fonts/ibm-plex-mono` (numeric/mono); system font otherwise |
| Misc | `expo-linking` (open video), RN core `Share` |
| Test | `jest-expo`, `@testing-library/react-native` |

**Why a service layer *and* Zustand:** they own different things. Services own
server data (fixtures, standings, team, match) and are the single import site for
mock data — each becomes a `fetch` later with no screen change. Zustand owns
client state the backend never holds: theme override, followed teams, MVP votes
cast on-device. TanStack Query, if wanted later, replaces `useAsync` at the same
service boundary. Using Zustand as a data cache now was considered and rejected
as premature for a two-screen slice.

---

## 3. Architecture & data flow

```
Screen
  ├── useAsync(() => service.getX(args), [args])  → { data, loading, error, reload }
  │        └── services/*  → imports data/* mock fixtures, adds ~250ms latency
  └── useAppStore(selector)                       → theme, follows, mvpVotes (+ persisted)
```

- **`useAsync<T>(fn, deps)`** — `src/hooks/useAsync.ts`. Runs `fn` on mount and
  when `deps` change; exposes `{ data, loading, error, reload }`. A module-level
  `SHOULD_FAIL` dev flag (default `false`) makes services reject, to exercise
  error states.
- **Services** — `src/services/`. Pure functions returning `Promise<T>`. Every
  league-scoped service takes the `leagueId` as its first parameter; screens get it
  from `useLeagueId()` (`src/hooks/useLeagueId.ts`), which reads the store.
  Artificial delay via `await sleep(250)`. No React, no store access.
- **`useAppStore`** — `src/store/useAppStore.ts`. Zustand with `persist`
  middleware (AsyncStorage) for `themeMode`, `leagueId`, `followsByLeague`, `mvpVotes`.

### Store shape

```ts
type ThemeMode = 'system' | 'light' | 'dark';
type NotifyLevel = 'full' | 'result';

interface AppState {
  themeMode: ThemeMode;
  leagueId: string | null;                                  // the chosen league, null before the picker
  followsByLeague: Record<string, Record<string, { notifyLevel: NotifyLevel }>>; // leagueId -> teamId -> entry
  mvpVotes: Record<string, string>;                        // matchId -> playerId

  setThemeMode(mode: ThemeMode): void;
  setLeague(leagueId: string): void;
  toggleFollow(teamId: string): void;       // in the chosen league
  isFollowing(teamId: string): boolean;     // in the chosen league
  toggleMvpVote(matchId: string, playerId: string): void;

  // selectors (via hooks/selectors, not stored)
  // followedTeamIds(): string[]
}
```

Persisted keys: `themeMode`, `leagueId`, `followsByLeague`, `mvpVotes`. Follows are
kept per league: switching league shows that league's follows, and switching back
restores the previous ones. Store version 3 drops the follows saved before the
picker existed (they belonged to the hard-coded league).

---

## 4. Domain model (`src/types/`)

```ts
interface District {
  id: string; name: string;        // "District Loire"
  division: string;                // "D2"
  season: string;                  // "26/27"
  seller: string;                  // "District Loire" (Boutique vendor line)
}

interface Team {
  id: string;
  name: string;                    // "FC Vallonnais"
  shortName: string;               // "Vallonnais"
  crestColor: string;              // placeholder crest fill
  rank: number;                    // 1..10
  points: number;
  played: number;
  goalDiff: number;
  stadium: string;                 // "Stade des Marnes"
  form: ('V' | 'N' | 'D')[];       // most recent last, up to 5
  squadCount: number;              // "EFFECTIF · 18 JOUEURS"
}

interface Player {
  id: string; teamId: string;
  number: number;
  name: string;
  position: string;                // "Milieu", "Attaquant", ...
  matchesPlayed: number;
  goals: number;
  assists: number;
}

type MatchStatus = 'upcoming' | 'live' | 'played';

interface MatchEvent {
  minute: number;
  type: 'goal' | 'yellow' | 'red' | 'sub';
  playerName: string;
  detail: string;                  // "Passe de M. Diarra", "2e jaune", ...
  score: string;                   // running score "1–0"
}

interface Match {
  id: string;
  matchday: number;                // "Journée 3"
  homeTeamId: string; awayTeamId: string;
  kickoff: string;                 // ISO
  venue: string;                   // "Stade des Marnes, terrain 2"
  status: MatchStatus;
  homeScore?: number; awayScore?: number;
  odds?: { home: number; draw: number; away: number };   // percentages, sum 100
  referee?: string;
  convocation?: string;            // "13:45"
  spectators?: number;
  videoUrl?: string; videoDuration?: string;             // "8:42"
  events?: MatchEvent[];
  mvp?: { playerId: string; votePercent: number; voteCount: number };
}

type StandingsZone = 'promotion' | 'playoff' | 'relegation' | 'none';

interface StandingsRow {
  rank: number; teamId: string; teamName: string;
  played: number; goalDiff: number; points: number;
  zone: StandingsZone;
  followed: boolean;
}

interface PeopleRow {
  rank: number; playerId: string; name: string; teamName: string;
  value: number; unit: string;     // "buts" | "passes" | "votes"
}

interface Profile {
  name: string;                    // "Julien Mercier"
  supporterOf: string;             // "FC Vallonnais"
  since: number;                   // 2024
  pronoPoints: number;             // 248
  pronoRank: number;               // 3
}
```

---

## 5. Services (`src/services/`)

| Module | Function | Returns |
|---|---|---|
| `league.ts` | `getDistrict()` | `District` |
| `standings.ts` | `getStandings()` | `StandingsRow[]` (10, rank asc, `zone`/`followed` computed) |
| | `getTopScorers()` | `PeopleRow[]` (8, unit `"buts"`) |
| | `getTopAssists()` | `PeopleRow[]` (8, unit `"passes"`) |
| | `getMvpRanking()` | `PeopleRow[]` (8, unit `"votes"`) |
| `teams.ts` | `getTeam(id)` | `{ team, nextMatch, lastResults: ResultLine[], squad: Player[] }` |
| `matches.ts` | `getMyFixtures(followedTeamIds)` | `FixtureRow[]` (see §7.1) |
| | `getMatch(id)` | `Match` (with `events`, `mvp`, `videoUrl` when `played`) |

`getStandings` and `getMyFixtures` take the followed-team set from the caller
(screen reads it from the store and passes it in) so services stay pure.

Helpers: `src/services/_shared.ts` — `sleep`, `SHOULD_FAIL`, `maybeFail()`.

---

## 6. Navigation (Expo Router)

```
app/
  _layout.tsx                     Root <Stack> (headerShown: false)
                                    - leagues        league picker, no tab bar
                                    - (tabs)
                                    - match/[id]     full screen, no tab bar
                                    - boutique       placeholder
  (tabs)/
    _layout.tsx                   <Tabs> with custom tabBar (src/components/TabBar)
    following/
      _layout.tsx                 <Stack headerShown:false>: index, team/[id]
      index.tsx                   -> <FollowingScreen/>
      team/[id].tsx               -> <TeamScreen origin="following"/>
      squad/[teamId].tsx          -> <SquadScreen origin="following"/>
      player/[id].tsx             -> <PlayerScreen/>
    standings/
      _layout.tsx                 <Stack headerShown:false>: index, team/[id]
      index.tsx                   -> <StandingsScreen/>
      team/[id].tsx               -> <TeamScreen origin="standings"/>
      squad/[teamId].tsx          -> <SquadScreen origin="standings"/>
      player/[id].tsx             -> <PlayerScreen/>
    predictions/index.tsx         -> <PlaceholderScreen title="Pronos"/>
    profile/index.tsx             -> <ProfileScreen/>
  index.tsx                       -> /following, or /leagues when no league is chosen
  leagues.tsx                     -> <LeaguePickerScreen/>
  match/[id].tsx                  -> <MatchScreen/>
  boutique/index.tsx             -> <PlaceholderScreen title="Boutique"/>
```

**League guard.** `index`, `(tabs)/_layout` and `match/[id]` render through
`<RequireLeague>` (`src/components/RequireLeague.tsx`): it waits for the persisted
store to load, then redirects to `/leagues` when no league is chosen. The tabs are
keyed by `leagueId`, so changing league remounts every tab and refetches.

**Rationale.** The design shows the tab bar on the Team page (with the origin tab
still active) but **not** on the Match page ("la page match n'en a pas, c'est une
sous-page qui se referme sur son parent"). Placing `team/[id]` inside each tab's
stack keeps the bar and the active tab; placing `match/[id]` at the root removes
the bar and makes "back" return to whichever list pushed it. `<TeamScreen>` is
one shared component; the per-tab route files are one line each.

**Row-tap targets**
- Suivi fixture row: `played` / `live` → `/match/{id}`; `upcoming` →
  `/following/team/{followedTeamId}`.
- Suivi shop-suggestion row "Voir" → `/boutique`.
- Suivi header "Gérer" → `/profile`.
- Classement standings row → `/standings/team/{teamId}`.
- Team "Partager" → RN `Share.share()`.
- Match video card → `Linking.openURL(videoUrl)`.

**Navigation `dispatch`/params:** team id and match id via
`useLocalSearchParams<{ id: string }>()`.

---

## 7. Screens

### 7.1 Suivi (`src/screens/FollowingScreen.tsx`)

**Header** (`HeaderCard`): overline = followed team names uppercased, joined
`" · "` (`FC VALLONNAIS · AS RIVERAIN`); title `Suivi`; trailing text button
`Gérer` → `/profile`.

**Body** (scroll): `SectionLabel` `CALENDRIER DE MES ÉQUIPES`; one `Card`
containing rows; footer note (muted, small):
> Les cotes ouvrent une semaine avant le match ; « en cours » reste affiché
> jusqu'à la saisie du score. Une suggestion boutique apparaît toutes les cinq
> rencontres.

**FixtureRow** — left `when` (~52 px, e.g. `Dim. 14`), middle `match`
(`FC Vallonnais — US Coteaux`) + `sub` (`J4 · extérieur · 15:00`), right
`SlotChip`.

**`FixtureRow` model produced by `getMyFixtures`:**
```ts
interface FixtureRow {
  matchId: string;
  when: string;                 // "Dim. 14"
  match: string;                // "FC Vallonnais — US Coteaux"
  sub: string;                  // "J4 · extérieur · 15:00"
  slot: { text: string; tone: 'score' | 'live' | 'odds' | 'date' };
  target: { kind: 'match'; id: string } | { kind: 'team'; id: string };
}
```

**Slot logic** (`src/logic/fixtureSlot.ts`, unit-tested):
- `status === 'played'` → `{ text: "3–1", tone: 'score' }`, `target: match`.
- `status === 'live'` → `{ text: "en cours", tone: 'live' }`, `target: match`.
- `status === 'upcoming'` and `kickoff - now < 7 days` and `odds` present →
  `{ text: "47 %", tone: 'odds' }` (the followed team's win probability),
  `target: team`.
- otherwise → `{ text: "Cotes dim.", tone: 'date' }` (opening day =
  `kickoff - 7 days`), `target: team`.

**Shop-suggestion row** (`src/logic/injectShopRows.ts`, unit-tested): after every
5th fixture row, insert:
> striped thumb · `Maillot domicile 26/27 — 45 €` · `Boutique de la ligue ·
> floquage offert` · `Voir` → `/boutique`

For N fixture rows the shop row appears at list index 5, 11, 17, … (0-based),
i.e. after positions 5, 10, 15 of the fixtures.

**States:** `Skeleton` (5 grey rows) while loading; `ErrorState` with retry.

### 7.2 Classement (`src/screens/StandingsScreen.tsx`)

**Header** (`HeaderCard`): overline `DISTRICT LOIRE · D2 · SAISON 26/27`; title
`Classements`; `SegmentedTabs` `['Général', 'Buteurs', 'Passeurs', 'MVP']`
(local `useState` index, no persistence).

**Général tab:** a column-header strip (`#` / `ÉQUIPE` / `MJ` `DIFF` `PTS`), then
a `Card` of 10 `StandingsRow`s: rank (mono, colour by `zone` — `promotion`
accent, `playoff` amber, `relegation` red, `none` muted), crest, name, and the
`MJ / DIFF / PTS` trio right-aligned (PTS bold). Rows where `followed` get a
subtle accent-tinted background. Footer note:
> Montée en D1 pour le 1ᵉʳ · barrage pour le 2ᵉ · descente pour les deux
> derniers.

`zone` from `src/logic/standingsZone.ts` (unit-tested): rank 1 → `promotion`,
rank 2 → `playoff`, rank ≥ 9 (of 10) → `relegation`, else `none`.

**Buteurs / Passeurs / MVP tabs:** `SectionLabel` = `peopleTitle`
(`MEILLEURS BUTEURS` / `MEILLEURES PASSES` / `PLUS VOTÉS MVP`), `Card` of 8
`PeopleRow`s (rank mono, avatar, name + team, `value` mono + `unit`), footer
`peopleFoot` (short explanatory line per tab).

**States:** skeleton / error per tab load.

### 7.3 Team (`src/screens/TeamScreen.tsx`, prop `origin: 'following' | 'standings'`)

**Header** (`HeaderCard`, taller): `BackLink` `‹ District Loire · D2`; crest +
name + `2ᵉ · 7 pts · Stade des Marnes`; row of **Follow toggle button**
(`Suivre` ↔ `Suivi ✓`, accent-filled when following) + `Partager` (outline);
follow hint line (`Vous suivez cette équipe — compos, buts, résultats` /
`Suivez pour recevoir résultats et compos`); `FORME` label + up-to-5 `FormChips`
(`V` accent, `N` grey, `D` red).

**Body:**
1. `PROCHAIN MATCH` `Card` — label + date `DIM. 14 · 15:00` (accent); opponent
   `US Coteaux — extérieur`; `OddsBar` (3 flex-weighted segments by
   `odds.home/draw/away`, each showing its %, the max highlighted accent); note
   `Cote calculée sur la forme et le classement · Arbitre L. Fabre ·
   Convocation 13:45`.
2. `DERNIERS RÉSULTATS` — `Card` of 3 rows: result chip (`V`/`N`/`D`),
   `Étoile de Mornay` + `dom.`/`ext.`, score `3–1` (mono).
3. `EFFECTIF · {squadCount} JOUEURS` label + `MJ · BUTS · PD` legend; `Card` of
   squad rows (number mono, avatar, name + position, `MP · goals · assists`
   line); final row `Voir l'effectif complet ›` opens the full squad
   (`/{origin}/squad/{teamId}`, same tab).

**Follow button** calls `toggleFollow(teamId)`; the change is observable
immediately in Suivi (list membership) and Classement (row tint) and Moi (count).

**States:** skeleton / error.

### 7.3b Full squad (`src/screens/SquadScreen.tsx`, props `teamId`, `origin`)

**Header**: `‹ Retour`, team name, current season name. **Body**: the season's
squad with departures (`GET …/squad?all=true`), in two sections:
`EFFECTIF ACTUEL · {n} JOUEURS` and `DÉPARTS · {n}` (only when there are any). Rows:
number (mono), avatar, name, and `Parti le 12 oct. 2026` for a departure. A row
opens the player (`/{origin}/player/{playerId}`, same tab).
**States:** skeleton / error with `Réessayer` / `Aucun joueur cette saison.`

### 7.3c Player (`src/screens/PlayerScreen.tsx`, prop `id`)

**Header**: `‹ Retour`, avatar, name, `Club actuel · {team}` or `Sans club`
(`GET /leagues/{id}/players/{playerId}`, `current_team`). **Body**: `PARCOURS`
`Card`, one row per stint from `GET …/players/{playerId}/career`, most recent
first: crest, `{team} · N° {number}`, `Depuis le 29 août 2026` or
`30 août 2025 → 31 mai 2026`, season name on the right.
**States:** skeleton / error with `Réessayer` / `Aucun passage en club.`

### 7.4 Match (`src/screens/MatchScreen.tsx`) — no tab bar

**Header** (`HeaderCard`): `BackLink` `‹ Journée 3`; `TERMINÉ` badge (pill); a
three-column score block — home crest + name / big mono `3 – 1` / away crest +
name; centered meta `Dim. 7 sept. · Stade des Marnes, terrain 2 · 140
spectateurs`.

**Body:**
1. **Video card** — striped 16:9 area with a play glyph and
   `résumé YouTube · 8:42` overlay; footer row `Résumé du match` + `OUVRIR ›`.
   Whole card → `Linking.openURL(match.videoUrl)`.
2. `FAITS DE MATCH` — `Card` of `MatchEvent` rows: minute (mono, ~34 px), a
   type-tinted square, `playerName` + `detail`, running `score` (muted right).
3. **`MVP DU MATCH` card** — label + `{voteCount} votes`; player avatar +
   `Malik Diarra` + `Milieu · 2 buts, 1 passe · 61 % des voix`; progress bar at
   `votePercent`; **vote toggle button**: `Voter pour le MVP` ↔ `Vous avez voté`
   (accent-filled). Toggle calls `toggleMvpVote(matchId, mvp.playerId)`; the
   displayed `voteCount` is `base + (hasVoted ? 1 : 0)` and the button label
   reflects `hasVoted`. (Percent bar stays at the mock `votePercent` — recomputing
   it is out of scope.)
4. `INFORMATIONS` — `Card` of key/value rows (`Arbitre` / `Lieu` /
   `Affluence` / `Compétition` / `Coup d'envoi`).

**States:** skeleton / error. Invalid `id` → `ErrorState` "Match introuvable".

### 7.5 Moi (`src/screens/ProfileScreen.tsx`) — minimal

**Header** (`HeaderCard`): avatar; `Julien Mercier`; `Supporter FC Vallonnais ·
depuis 2024`; trailing `Modifier` (inert).

**Body:**
1. Two stat `Card`s side by side: `248` / `POINTS PRONOS · 3ᵉ`;
   `{followedTeamIds().length}` / `ÉQUIPES SUIVIES`.
2. `SectionLabel` `COMPTE`; `Card` with rows:
   - **`Thème`** — label left; inline `SegmentedTabs`
     `['Système', 'Clair', 'Sombre']` right, bound to `themeMode`
     (`system`/`light`/`dark`) via `setThemeMode`. **Working.**
   - `Notifications`, `Confidentialité`, `Langue` (`Français`), `Déconnexion` —
     present with chevron, inert this slice.

### 7.5b League picker (`src/screens/LeaguePickerScreen.tsx`)

Shown on first launch and from Moi. **Header**: `‹ Retour` (only when a league is
already chosen), title `Choisissez votre ligue`, hint `Vous pourrez en changer
depuis Moi.` **Body**: one `Card` with a row per league from `GET /leagues`
(sorted by name by the API): crest + name, `✓` on the current league. Tapping a
row saves the league (`setLeague`) and replaces the screen with `/following`.
Loading skeleton, error with `Réessayer`, `Aucune ligue disponible.` when empty.

**Moi** gets a `LIGUE` section above the stats: the current league's name
(`GET /leagues/{id}`) and a `Changer` link to `/leagues`. The followed-teams count
is for the current league.

### 7.6 Pronos & Boutique — `PlaceholderScreen`

Centered: rounded-square glyph, title (`Pronos` / `Boutique`),
`Bientôt disponible`, one muted line of context. Pronos keeps its tab bar;
Boutique is a root route (no tab bar) reached from the Suivi shop row.

---

## 8. Theming (`src/theme/`)

**Verified mechanism (NativeWind v4 has no whole-tree CSS-variable override):**
`dark:` utility variants read React Native's `Appearance` color scheme directly;
forcing a mode app-wide (regardless of OS setting) is React Native's own
`Appearance.setColorScheme('light' | 'dark' | null)` — `null` reverts to system.
There is no separate NativeWind "dark mode provider" to configure.

- `tailwind.config.js` `theme.extend.colors` gets **two keys per semantic
  colour** — a light default and an explicit `...Dark` suffix:

  | base key | light value | `...Dark` key | dark value |
  |---|---|---|---|
  | `canvas` | `#F4F5F7` | `canvasDark` | `#0E1013` |
  | `card` / `header` | `#FFFFFF` | `cardDark` / `headerDark` | `#191C21` |
  | `border` | `#E4E7EC` | `borderDark` | `#282C34` |
  | `hairline` | `#EEF0F3` | `hairlineDark` | `#23272E` |
  | `textPrimary` | `#14161A` | `textPrimaryDark` | `#ECEEF2` |
  | `textMuted` | `#5B6270` | `textMutedDark` | `#9AA2AE` |
  | `textFaint` | `#5F6773` | `textFaintDark` | `#9AA2AE` |
  | `field` | `#F8F9FB` | `fieldDark` | `#22262E` |
  | `accent` | `#7C5CFF` | `accentDark` | `#9B87FF` |
  | `pos` / `posBg` | `#1E7F4F` / `#E4F3EA` | `posDark` / `posBgDark` | `#5AD08C` / `#1E2A22` |
  | `neg` / `negBg` | `#A82C1E` / `#FFE4E0` | `negDark` / `negBgDark` | `#F09080` / `#3A211D` |
  | `warn` / `warnBg` | `#8A5A00` / `#FFEFD6` | `warnDark` / `warnBgDark` | `#E7B45A` / `#2E2413` |

  (Accent purple is one token pair — "l'accent est un réglage, tout en dérive".)
- Components pair each utility with its dark companion inline, e.g.
  `className="bg-canvas dark:bg-canvasDark"`. This pairing is written **once**,
  inside the shared primitives (`Screen`, `HeaderCard`, `Card`, `ThemedText`,
  …) — screens that compose those primitives don't repeat it.
- `src/theme/useThemeSync.ts` — a hook mounted once near the root: watches
  `useAppStore.themeMode`; whenever it changes (or on mount), calls
  `Appearance.setColorScheme(themeMode === 'system' ? null : themeMode)`.
  `dark:` variants throughout the app then follow automatically, including on
  first paint from the persisted value.
- `src/theme/useIsDark.ts` — `() => useColorScheme() === 'dark'` (React Native's
  hook, reflecting whatever `Appearance` currently reports) for the rare
  component that needs a branch instead of a class pair (e.g. choosing an icon
  tint prop).

---

## 9. Components (`src/components/`)

| Component | Purpose |
|---|---|
| `Screen` | `SafeAreaView` + `bg-canvas`, optional `ScrollView` with sensible padding |
| `HeaderCard` | Top block: `bg-header`, bottom `border-hairline`, status-bar-safe top padding, `children` |
| `Card` | Inset surface: `rounded-2xl` (~14), `bg-card`, `border-border`, `overflow-hidden` |
| `Card.Row` | Row with top `border-hairline` (except first), padding, `flex-row items-center` |
| `ListRow` | Composed row: leading (`icon`/`slot`), `title` + optional `subtitle`, trailing (`text` / chevron / node) |
| `SectionLabel` | Uppercase 11px, letter-spaced, `text-muted` |
| `SegmentedTabs` | Pill track `bg-chip`, N segments; active = `bg-accent text-accent-contrast`; `value` + `onChange`; used at 4 (Classement) and 3 (Moi) |
| `FormChips` | Maps `('V'|'N'|'D')[]` to coloured square chips (`pos` / muted / `neg`) |
| `OddsBar` | 3 segments, `flex` weighted by percent; each labelled; max segment `bg-accent text-accent-contrast`, others `bg-field` |
| `SlotChip` | Right-column chip; `tone` → `score` (`bg-chip`), `live` (`warn`), `odds` (`bg-accent`), `date` (`bg-field` muted) |
| `ThemedText` | Text with theme colour; `mono` prop → IBM Plex Mono; `tone` prop (`primary`/`muted`/`faint`/`accent`) |
| `Avatar` / `Crest` | Circle / rounded-square colour block; `size` prop; image-ready later |
| `BackLink` | `‹ {label}` pressable → `router.back()` |
| `Skeleton` | Pulsing grey blocks; `rows` prop for list skeletons |
| `ErrorState` | Message + `Réessayer` button → `reload` |
| `PlaceholderScreen` | Glyph + title + "Bientôt disponible" + note |
| `TabBar` | Custom `<Tabs>` `tabBar`: 4 items, rounded-square glyph + label (`SUIVI` / `CLASSEMENT` / `PRONOS` / `MOI`), active `text-accent`, top `border-hairline`, safe-area bottom inset |

All components are theme-driven via NativeWind classes; no inline hex.

---

## 10. Mock data (`src/data/`)

| File | Contents |
|---|---|
| `district.ts` | `District Loire`, `D2`, `26/27`, seller `District Loire` |
| `teams.ts` | 10 teams; `FC Vallonnais` rank 2 / 7 pts, `AS Riverain` mid-table; ranks, `form`, `stadium`, `goalDiff`, `squadCount` all set; distinct `crestColor` |
| `players.ts` | ~6 players for each shown squad (Vallonnais, opponents in fixtures) + a pooled top-scorer / assist / MVP list of ~10 across teams; `Malik Diarra` (Vallonnais, Milieu, 2 goals recent) as J3 MVP |
| `fixtures.ts` | Matchdays 1–4. J1–J3 `played` (Vallonnais J3 `3–1` Étoile de Mornay with `events[]`, `mvp`, `videoUrl`, `spectators`, `referee`, `venue`); one J4 fixture `live`; remaining J4 `upcoming` with `odds`. Enough Vallonnais + Riverain fixtures that Suivi shows ≥ 6 rows (to exercise the shop-row injection) |
| `profile.ts` | `Julien Mercier`, `FC Vallonnais`, since `2024`, `248` pts, rank `3` |

Fixture `kickoff` values are generated relative to a fixed `SEASON_NOW`
constant (not `Date.now()`) so slot logic (`< 7 days`) is deterministic in tests
and stable in the running app.

---

## 11. i18n & fonts

- `src/i18n/fr.ts` — every user-facing string as a flat keyed object; components
  import `t` (a typed lookup). French only; structure allows a second locale
  later. No runtime i18n library.
- `@expo-google-fonts/ibm-plex-mono` (`IBMPlexMono_400Regular/500Medium/
  600SemiBold`) loaded in `app/_layout.tsx` with `expo-splash-screen` held until
  ready. Non-mono text uses the platform system font.

---

## 12. Loading, error & empty states

- Every screen that calls a service renders: `Skeleton` while `loading`,
  `ErrorState` (with `reload`) on `error`, content on `data`.
- Suivi with zero followed teams → empty state: "Vous ne suivez aucune équipe" +
  hint to open a team from Classement. (Reachable if the user unfollows both.)
- `useAsync` `SHOULD_FAIL` dev flag flips all services to reject, for manual QA
  of error states.

---

## 13. Testing (TDD)

Write the logic tests first, then components, then screens.

**Logic (pure, `src/logic/*` + store)**
- `fixtureSlot`: each branch — played → score; live → "en cours"; upcoming
  < 7 days with odds → `odds` %; upcoming ≥ 7 days → "Cotes {jour}" with the
  correct opening day; `target` kind per branch.
- `injectShopRows`: shop row lands at list index 5, 11, 17 for 6 / 12 / 18
  fixtures; no shop row for < 6 fixtures; original order preserved.
- `standingsZone`: ranks 1, 2, 9, 10 and a mid rank in a 10-team table.
- `useAppStore`: `toggleFollow` adds/removes and `isFollowing` reflects it;
  `toggleMvpVote` sets then clears; `setThemeMode` persists (mock AsyncStorage);
  default follows seeded once.

**Components (`@testing-library/react-native`)**
- `SlotChip` renders the right text/style per `tone`.
- `SegmentedTabs` calls `onChange` with the pressed index and marks the active
  segment.
- `OddsBar` gives segments `flex` proportional to the percentages and highlights
  the max.
- `FormChips` maps letters to the right count and colours.

**Screens (services mocked)**
- Suivi: renders N fixture rows and a shop-suggestion row at the expected
  position; tapping a `played` row navigates to `/match/:id`.
- Classement: switching `SegmentedTabs` swaps table ↔ people list; `promotion`
  rank styled distinctly.
- Team: Follow button label toggles and `useAppStore.follows` updates.
- Match: vote button toggles label and the displayed vote count changes by 1.

**Bar for "done":** `npm test` green; app boots in Expo Go (or dev client) to
Suivi; all four tabs reachable; Team and Match reachable from lists; Match has no
tab bar and back returns to the list; theme toggle in Moi flips light/dark and
survives a reload.

---

## 14. Project setup

1. Scaffold an Expo Router + TS app **into the current working directory**
   (the repository root at the time, which held only `.DS_Store` and this
   `docs/` tree). Use `create-expo-app` in a temp directory with the default
   (Expo Router + TS) template, then move its contents in and keep `docs/`; see
   §15 for the non-empty-dir handling.
2. Add NativeWind v4 per its Expo Router guide: `nativewind`, `tailwindcss`,
   `react-native-reanimated`, `react-native-safe-area-context`,
   `react-native-screens`; `global.css`, `tailwind.config.js`, `metro.config.js`
   wrap, `babel.config.js` preset, `nativewind-env.d.ts`.
3. Add `zustand`, `@react-native-async-storage/async-storage`,
   `@expo-google-fonts/ibm-plex-mono`, `expo-font`, `expo-splash-screen`,
   `expo-linking`.
4. Dev: `jest-expo`, `@testing-library/react-native`, `@types/jest`; `jest`
   config in `package.json` (`preset: "jest-expo"`), `test` script.
5. `git init`; `.gitignore` from the Expo template; initial commit. *(The working
   directory is not currently a git repository.)*

---

## 15. Risks & assumptions

- **NativeWind v4 theming.** Resolved (§8): verified against current docs there
  is no whole-tree CSS-variable override in v4 — theming is `dark:` variant
  pairs per semantic colour plus RN's `Appearance.setColorScheme()` to force a
  mode.
- **`create-expo-app` into a non-empty dir.** The dir holds only `.DS_Store` and
  this `docs/` tree; scaffold into a temp path and move, or use `--no-install`
  then reconcile, if the CLI refuses.
- **Design copy.** Some strings in the mock are placeholders (`{{ followHint }}`,
  `{{ peopleTitle }}`). Concrete French copy is fixed in `src/i18n/fr.ts` and
  listed per screen above; product owner can adjust wording later without
  structural change.
- **Odds semantics.** The mock shows `34 / 19 / 47`. Treated as win-probability
  percentages summing to 100; `OddsBar` and the Suivi `odds` slot both read the
  followed team's side.
- **MVP percentage after a local vote** is not recalculated (§7.4) — only the
  count and button state change on device.
