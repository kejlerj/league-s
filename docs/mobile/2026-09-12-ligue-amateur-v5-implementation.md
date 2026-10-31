# Ligue Amateur v5 (First Slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Ligue Amateur Expo app — navigation shell, Suivi, Classement, the shared Team sub-page, the Match sub-page, and a minimal Moi with a working theme toggle — against mock data, ready to swap in a real backend later.

**Architecture:** Expo Router screens read data through `useAsync` + a `src/services/` layer (mock now, `fetch` later, zero screen changes) and read/write client state through a persisted Zustand store (theme, follows, MVP votes). Pure decision logic (fixture slot, shop-row injection, standings zone) lives in `src/logic/`, unit-tested in isolation. Team pages live inside each tab's own stack so the tab bar stays visible and correctly lit; Match is a root-level route so it has no tab bar and closes back to its parent.

**Tech Stack:** Expo (latest SDK) + Expo Router + TypeScript, NativeWind v4 (Tailwind for RN), Zustand + AsyncStorage persistence, `jest-expo` + `@testing-library/react-native`, `@expo-google-fonts/ibm-plex-mono`.

**Spec:** `docs/superpowers/specs/2026-09-10-ligue-amateur-v5-design.md` — this plan implements it in full; read both. Executors should treat the spec as the source of truth for *why*, this plan for *how*.

## Global Constraints

- All user-facing copy is **French**, sourced from `src/i18n/fr.ts` — no inline literal strings in components/screens.
- Styling is **NativeWind v4 utility classes only** — no raw `StyleSheet.create` for colors/spacing where a utility exists; `style={}` is reserved for numeric layout values Tailwind can't express cleanly (explicit pixel widths like `52`) and for dynamic values computed at runtime (`flex`, `width: '${p}%'`).
- **Theming has no whole-tree CSS-variable override in NativeWind v4.** Every themed color is a Tailwind class **pair**: a light key and a `...Dark` key (e.g. `bg-canvas dark:bg-canvasDark`), defined once in `tailwind.config.js` (Task 3) and always used together. Forcing a mode (vs. following the OS) is React Native's own `Appearance.setColorScheme('light' | 'dark' | null)`.
- **No backend calls.** Every screen's server data comes from `src/services/*`, which read `src/data/*` mock fixtures. Screens never import `src/data/*` directly.
- **TDD.** Every task with a `Test:` file writes the failing test before the implementation, per the Step numbering below. `npm test` must be green after every task's last step.
- Numeric/tabular values (scores, points, minutes, mono stat columns) use `mono` on `ThemedText` (IBM Plex Mono); everything else uses the system font.
- Package manager: `npm`. Run all commands from the repo root (now `mobile/`) unless a step says otherwise.

---

### Task 1: Scaffold the Expo Router app + NativeWind, verify it boots

**Files:**
- Create: entire Expo Router default template (`app/`, `assets/`, `package.json`, `app.json`, `tsconfig.json`, `.gitignore`, etc.)
- Modify: `tailwind.config.js`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, `app/_layout.tsx` (template's default, temporarily)
- Create: `global.css`, `nativewind-env.d.ts`
- Test: none (scaffolding task; verified by booting the app)

**Interfaces:**
- Produces: a working Expo Router project at the repo root, with NativeWind classes rendering, a `@/*` → repo-root TS path alias, and git initialized with one commit. Every later task builds inside `app/` and a new `src/` tree in this project.

- [ ] **Step 1: Scaffold into a temp directory, then move into the repo root**

The repo root (now `mobile/`) currently holds only `.DS_Store` and the `docs/` tree from planning — not empty, so `create-expo-app` needs a temp target:

```bash
cd /tmp
npx create-expo-app@latest ligue-amateur-scaffold
```

Accept the default template (TypeScript, Expo Router already included in current Expo SDKs).

```bash
rsync -a --exclude='.git' /tmp/ligue-amateur-scaffold/ ./
rm -rf /tmp/ligue-amateur-scaffold
```

- [ ] **Step 2: Initialize git at the repo root and commit the raw scaffold**

```bash
cd mobile
git init
git add -A
git commit -m "chore: scaffold Expo Router app"
```

- [ ] **Step 3: Confirm the `@/*` path alias is present**

Open `tsconfig.json`. It must contain (current Expo Router templates ship this by default — add it if missing):

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

- [ ] **Step 4: Add NativeWind v4 and its peers**

```bash
npm install nativewind tailwindcss react-native-reanimated react-native-safe-area-context react-native-screens react-native-gesture-handler
npx tailwindcss init
```

- [ ] **Step 5: Write `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

(Semantic colors are added in Task 3, once `src/theme` exists — keeping this task's diff small.)

- [ ] **Step 6: Write `global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Write `babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
```

- [ ] **Step 8: Write `metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 9: Write `nativewind-env.d.ts`**

```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 10: Import the stylesheet in the template's root layout**

Open `app/_layout.tsx` (still the template's default content at this point) and add at the very top:

```ts
import '../global.css';
```

- [ ] **Step 11: Boot the app and verify NativeWind renders**

Temporarily add a NativeWind class to the template's default screen (e.g. open `app/(tabs)/index.tsx` and add `className="bg-red-500"` to its outermost `View`) to get an unambiguous visual signal.

```bash
npx expo start
```

Press `i` to open the iOS Simulator (or `a` for Android). Confirm the screen shows the red background — proof NativeWind is wired end-to-end. Remove the temporary `className` afterward.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: add NativeWind v4"
```

---

### Task 2: Domain types and French copy

**Files:**
- Create: `src/types/index.ts`
- Create: `src/i18n/fr.ts`
- Test: none (pure declarations; verified by the type checker)

**Interfaces:**
- Produces: every type listed below, re-exported from `src/types/index.ts`; the `fr` object from `src/i18n/fr.ts`. All later tasks import from these two files — get the field names right here, they are load-bearing.

- [ ] **Step 1: Write `src/types/index.ts`**

```ts
export type ResultTag = 'V' | 'N' | 'D';

export interface District {
  id: string;
  name: string;
  division: string;
  season: string;
  seller: string;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  crestColor: string;
  rank: number;
  points: number;
  played: number;
  goalDiff: number;
  stadium: string;
  form: ResultTag[];
  squadCount: number;
}

export interface Player {
  id: string;
  teamId: string;
  number: number;
  name: string;
  position: string;
  matchesPlayed: number;
  goals: number;
  assists: number;
}

export type MatchStatus = 'upcoming' | 'live' | 'played';

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'yellow' | 'red' | 'sub';
  playerName: string;
  detail: string;
  score: string;
}

export interface MatchOdds {
  home: number;
  draw: number;
  away: number;
}

export interface MatchMvp {
  playerId: string;
  votePercent: number;
  voteCount: number;
}

export interface Match {
  id: string;
  matchday: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: string; // ISO 8601
  venue: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  odds?: MatchOdds;
  referee?: string;
  convocation?: string;
  spectators?: number;
  videoUrl?: string;
  videoDuration?: string;
  events?: MatchEvent[];
  mvp?: MatchMvp;
}

export type StandingsZone = 'promotion' | 'playoff' | 'relegation' | 'none';

export interface StandingsRow {
  rank: number;
  teamId: string;
  teamName: string;
  played: number;
  goalDiff: number;
  points: number;
  zone: StandingsZone;
  followed: boolean;
}

export interface PeopleRow {
  rank: number;
  playerId: string;
  name: string;
  teamName: string;
  value: number;
  unit: string;
}

export interface Profile {
  name: string;
  supporterOf: string;
  since: number;
  pronoPoints: number;
  pronoRank: number;
}

export interface ResultLine {
  matchId: string;
  opponent: string;
  venueTag: 'dom.' | 'ext.';
  result: ResultTag;
  score: string;
}

export interface TeamDetail {
  team: Team;
  nextMatch:
    | (Match & { opponentName: string; venueTag: 'dom.' | 'ext.' })
    | null;
  lastResults: ResultLine[];
  squad: Player[];
}

export type FixtureSlotTone = 'score' | 'live' | 'odds' | 'date';

export interface FixtureSlot {
  text: string;
  tone: FixtureSlotTone;
}

export type FixtureTarget =
  | { kind: 'match'; id: string }
  | { kind: 'team'; id: string };

export interface FixtureRow {
  matchId: string;
  when: string;
  match: string;
  sub: string;
  slot: FixtureSlot;
  target: FixtureTarget;
}

export type ListItem = { kind: 'fixture'; row: FixtureRow } | { kind: 'shop' };
```

- [ ] **Step 2: Write `src/i18n/fr.ts`**

```ts
export const fr = {
  common: {
    retry: 'Réessayer',
  },
  tabs: {
    suivi: 'Suivi',
    classement: 'Classement',
    pronos: 'Pronos',
    moi: 'Moi',
  },
  suivi: {
    title: 'Suivi',
    manage: 'Gérer',
    calendarLabel: 'Calendrier de mes équipes',
    footerNote:
      "Les cotes ouvrent une semaine avant le match ; « en cours » reste affiché jusqu'à la saisie du score. Une suggestion boutique apparaît toutes les cinq rencontres.",
    shopItemName: 'Maillot domicile 26/27 — 45 €',
    shopItemNote: 'Boutique de la ligue · floquage offert',
    shopCta: 'Voir',
    empty: 'Vous ne suivez aucune équipe pour le moment.',
    emptyHint: 'Ouvrez une équipe depuis Classement pour la suivre.',
    error: 'Impossible de charger votre calendrier.',
  },
  classement: {
    overline: 'District Loire · D2 · Saison 26/27',
    title: 'Classements',
    tabs: ['Général', 'Buteurs', 'Passeurs', 'MVP'],
    columnHeaders: { rank: '#', team: 'Équipe', played: 'MJ', diff: 'DIFF', pts: 'PTS' },
    standingsFooter:
      'Montée en D1 pour le 1ᵉʳ · barrage pour le 2ᵉ · descente pour les deux derniers.',
    peopleTitle: {
      scorers: 'Meilleurs buteurs',
      assists: 'Meilleures passes',
      mvp: 'Plus votés MVP',
    },
    peopleFooter: {
      scorers: 'Buts inscrits toutes compétitions confondues cette saison.',
      assists: 'Passes décisives comptabilisées par les votes des supporters.',
      mvp: 'Cumul des votes MVP reçus après chaque match.',
    },
    error: 'Impossible de charger le classement.',
  },
  team: {
    back: 'District Loire · D2',
    follow: 'Suivre',
    following: 'Suivi ✓',
    followHintOn: 'Vous suivez cette équipe — compos, buts, résultats.',
    followHintOff: 'Suivez pour recevoir résultats et compos.',
    share: 'Partager',
    form: 'Forme',
    nextMatch: 'Prochain match',
    oddsNote: 'Cote calculée sur la forme et le classement.',
    lastResults: 'Derniers résultats',
    squad: (count: number) => `Effectif · ${count} joueurs`,
    squadLegend: 'MJ · Buts · PD',
    seeFullSquad: "Voir l'effectif complet",
    away: 'extérieur',
    home: 'domicile',
    error: 'Impossible de charger cette équipe.',
  },
  match: {
    done: 'Terminé',
    videoLabel: 'Résumé du match',
    videoOpen: 'Ouvrir ›',
    events: 'Faits de match',
    mvpTitle: 'MVP du match',
    votes: (count: number) => `${count} votes`,
    voteCta: 'Voter pour le MVP',
    votedCta: 'Vous avez voté',
    info: 'Informations',
    infoKeys: {
      referee: 'Arbitre',
      venue: 'Lieu',
      spectators: 'Affluence',
      kickoff: "Coup d'envoi",
    },
    error: 'Impossible de charger ce match.',
  },
  moi: {
    editCta: 'Modifier',
    since: (year: number) => `Supporter depuis ${year}`,
    pronoStat: 'Points pronos',
    teamsStat: 'Équipes suivies',
    account: 'Compte',
    theme: 'Thème',
    themeOptions: ['Système', 'Clair', 'Sombre'],
    notifications: 'Notifications',
    privacy: 'Confidentialité',
    language: 'Langue',
    languageValue: 'Français',
    logout: 'Déconnexion',
  },
  placeholders: {
    pronosNote: 'Les pronostics par journée arrivent dans une prochaine version.',
    boutiqueNote: 'La boutique de la ligue arrive dans une prochaine version.',
  },
};
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors from these two new files (unused-export warnings are fine — nothing consumes them yet).

- [ ] **Step 4: Commit**

```bash
git add src/types src/i18n
git commit -m "feat: domain types and French copy"
```

---

### Task 3: Theme tokens + theme-sync hooks

**Files:**
- Modify: `tailwind.config.js`
- Create: `src/theme/useThemeSync.ts`
- Create: `src/theme/useIsDark.ts`
- Test: none (thin RN-API wrappers; exercised end-to-end once the store exists in Task 4 and the UI in later tasks — verified here by a manual toggle)

**Interfaces:**
- Produces: the Tailwind color pairs below (every later component uses these exact class names); `useThemeSync()` (call once near the app root); `useIsDark(): boolean`.

- [ ] **Step 1: Extend `tailwind.config.js` with the semantic color pairs**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#F4F5F7',
        canvasDark: '#0E1013',
        card: '#FFFFFF',
        cardDark: '#191C21',
        header: '#FFFFFF',
        headerDark: '#191C21',
        border: '#E4E7EC',
        borderDark: '#282C34',
        hairline: '#EEF0F3',
        hairlineDark: '#23272E',
        textPrimary: '#14161A',
        textPrimaryDark: '#ECEEF2',
        textMuted: '#5B6270',
        textMutedDark: '#9AA2AE',
        textFaint: '#5F6773',
        textFaintDark: '#9AA2AE',
        field: '#F8F9FB',
        fieldDark: '#22262E',
        accent: '#7C5CFF',
        accentDark: '#9B87FF',
        pos: '#1E7F4F',
        posDark: '#5AD08C',
        posBg: '#E4F3EA',
        posBgDark: '#1E2A22',
        neg: '#A82C1E',
        negDark: '#F09080',
        negBg: '#FFE4E0',
        negBgDark: '#3A211D',
        warn: '#8A5A00',
        warnDark: '#E7B45A',
        warnBg: '#FFEFD6',
        warnBgDark: '#2E2413',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Write `src/theme/useIsDark.ts`**

```ts
import { useColorScheme } from 'react-native';

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
```

- [ ] **Step 3: Write `src/theme/useThemeSync.ts`**

This reads the persisted theme mode (Task 4 defines the store) and forces RN's `Appearance` to match it, so `dark:` classes update immediately without waiting for an OS change.

```ts
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { useAppStore } from '../store/useAppStore';

export function useThemeSync() {
  const themeMode = useAppStore((s) => s.themeMode);

  useEffect(() => {
    Appearance.setColorScheme(themeMode === 'system' ? null : themeMode);
  }, [themeMode]);
}
```

This imports `useAppStore`, which doesn't exist until Task 4 — that's fine, TypeScript will fail here until then; the next task creates it before anything imports this hook at runtime. (No `tsc` check for this task in isolation; Task 4 checks the pair together.)

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.js src/theme
git commit -m "feat: theme color tokens and theme-sync hooks"
```

---

### Task 4: Testing infrastructure + Zustand store

**Files:**
- Modify: `package.json` (devDependencies, `jest` field, `test` script)
- Create: `jest.setup.js`
- Create: `src/store/useAppStore.ts`
- Test: `src/store/useAppStore.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: `useAppStore` — a Zustand store with state `{ themeMode: 'system' | 'light' | 'dark', follows: Record<string, { notifyLevel: 'full' | 'result' }>, mvpVotes: Record<string, string> }` and actions `setThemeMode(mode)`, `toggleFollow(teamId)`, `isFollowing(teamId): boolean`, `followedTeamIds(): string[]`, `toggleMvpVote(matchId, playerId)`, `hasVotedFor(matchId, playerId): boolean`. Exported type `ThemeMode`. Every screen task below reads from this store.

- [ ] **Step 1: Install test tooling and the store library**

```bash
npm install zustand @react-native-async-storage/async-storage
npm install --save-dev jest-expo @testing-library/react-native @types/jest react-test-renderer
```

- [ ] **Step 2: Add the `jest` field and `test` script to `package.json`**

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFiles": ["./jest.setup.js"]
  }
}
```

- [ ] **Step 3: Write `jest.setup.js`**

```js
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
```

- [ ] **Step 4: Write the failing test — `src/store/useAppStore.test.ts`**

```ts
import { useAppStore } from './useAppStore';

const DEFAULT_FOLLOWS = {
  'fc-vallonnais': { notifyLevel: 'full' as const },
  'as-riverain': { notifyLevel: 'result' as const },
};

beforeEach(() => {
  useAppStore.setState({
    themeMode: 'system',
    follows: DEFAULT_FOLLOWS,
    mvpVotes: {},
  });
});

test('seeds the default followed teams', () => {
  expect(useAppStore.getState().followedTeamIds().sort()).toEqual([
    'as-riverain',
    'fc-vallonnais',
  ]);
});

test('toggleFollow adds a team that is not yet followed', () => {
  expect(useAppStore.getState().isFollowing('us-coteaux')).toBe(false);
  useAppStore.getState().toggleFollow('us-coteaux');
  expect(useAppStore.getState().isFollowing('us-coteaux')).toBe(true);
});

test('toggleFollow removes a team that is already followed', () => {
  expect(useAppStore.getState().isFollowing('fc-vallonnais')).toBe(true);
  useAppStore.getState().toggleFollow('fc-vallonnais');
  expect(useAppStore.getState().isFollowing('fc-vallonnais')).toBe(false);
});

test('toggleMvpVote sets a vote then clears it on a second call', () => {
  expect(useAppStore.getState().hasVotedFor('m-j3-1', 'p-diarra')).toBe(false);
  useAppStore.getState().toggleMvpVote('m-j3-1', 'p-diarra');
  expect(useAppStore.getState().hasVotedFor('m-j3-1', 'p-diarra')).toBe(true);
  useAppStore.getState().toggleMvpVote('m-j3-1', 'p-diarra');
  expect(useAppStore.getState().hasVotedFor('m-j3-1', 'p-diarra')).toBe(false);
});

test('setThemeMode updates themeMode', () => {
  useAppStore.getState().setThemeMode('dark');
  expect(useAppStore.getState().themeMode).toBe('dark');
});
```

- [ ] **Step 5: Run the test to see it fail**

```bash
npm test -- useAppStore
```

Expected: FAIL — `Cannot find module './useAppStore'`.

- [ ] **Step 6: Write `src/store/useAppStore.ts`**

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';
export type NotifyLevel = 'full' | 'result';

interface FollowEntry {
  notifyLevel: NotifyLevel;
}

interface AppState {
  themeMode: ThemeMode;
  follows: Record<string, FollowEntry>;
  mvpVotes: Record<string, string>;
  setThemeMode: (mode: ThemeMode) => void;
  toggleFollow: (teamId: string) => void;
  isFollowing: (teamId: string) => boolean;
  followedTeamIds: () => string[];
  toggleMvpVote: (matchId: string, playerId: string) => void;
  hasVotedFor: (matchId: string, playerId: string) => boolean;
}

const DEFAULT_FOLLOWS: Record<string, FollowEntry> = {
  'fc-vallonnais': { notifyLevel: 'full' },
  'as-riverain': { notifyLevel: 'result' },
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      themeMode: 'system',
      follows: DEFAULT_FOLLOWS,
      mvpVotes: {},

      setThemeMode: (mode) => set({ themeMode: mode }),

      toggleFollow: (teamId) =>
        set((state) => {
          const next = { ...state.follows };
          if (next[teamId]) {
            delete next[teamId];
          } else {
            next[teamId] = { notifyLevel: 'full' };
          }
          return { follows: next };
        }),

      isFollowing: (teamId) => Boolean(get().follows[teamId]),

      followedTeamIds: () => Object.keys(get().follows),

      toggleMvpVote: (matchId, playerId) =>
        set((state) => {
          const next = { ...state.mvpVotes };
          if (next[matchId] === playerId) {
            delete next[matchId];
          } else {
            next[matchId] = playerId;
          }
          return { mvpVotes: next };
        }),

      hasVotedFor: (matchId, playerId) => get().mvpVotes[matchId] === playerId,
    }),
    {
      name: 'ligue-amateur-app-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        follows: state.follows,
        mvpVotes: state.mvpVotes,
      }),
    }
  )
);
```

- [ ] **Step 7: Run the test to see it pass**

```bash
npm test -- useAppStore
```

Expected: PASS, 5 tests.

- [ ] **Step 8: Commit**

```bash
git add package.json jest.setup.js src/store
git commit -m "feat: Zustand app store with theme/follows/mvp-votes"
```

---

### Task 5: Pure decision logic — fixture slot, shop-row injection, standings zone

**Files:**
- Create: `src/logic/fixtureSlot.ts`
- Create: `src/logic/injectShopRows.ts`
- Create: `src/logic/standingsZone.ts`
- Test: `src/logic/fixtureSlot.test.ts`
- Test: `src/logic/injectShopRows.test.ts`
- Test: `src/logic/standingsZone.test.ts`

**Interfaces:**
- Consumes: `Match`, `FixtureSlot`, `FixtureTarget`, `FixtureRow`, `ListItem`, `StandingsZone` from `src/types`.
- Produces: `computeFixtureSlot(match: Match, now: Date, perspectiveTeamId: string): { slot: FixtureSlot; target: FixtureTarget }`; `injectShopRows(fixtures: FixtureRow[]): ListItem[]`; `computeStandingsZone(rank: number, teamCount: number): StandingsZone`. Task 7 (services) and Task 11–12 (screens) call these directly.

- [ ] **Step 1: Write the failing tests — `src/logic/fixtureSlot.test.ts`**

```ts
import { computeFixtureSlot } from './fixtureSlot';
import type { Match } from '../types';

const NOW = new Date('2026-09-12T09:00:00Z'); // Saturday

function baseMatch(overrides: Partial<Match>): Match {
  return {
    id: 'm1',
    matchday: 4,
    homeTeamId: 'fc-vallonnais',
    awayTeamId: 'us-coteaux',
    kickoff: '2026-09-15T15:00:00Z',
    venue: 'Stade des Marnes',
    status: 'upcoming',
    ...overrides,
  };
}

test('played, perspective team at home: score is home-away', () => {
  const match = baseMatch({ status: 'played', homeScore: 3, awayScore: 1 });
  const { slot, target } = computeFixtureSlot(match, NOW, 'fc-vallonnais');
  expect(slot).toEqual({ text: '3–1', tone: 'score' });
  expect(target).toEqual({ kind: 'match', id: 'm1' });
});

test('played, perspective team away: score is away-home', () => {
  const match = baseMatch({ status: 'played', homeScore: 3, awayScore: 1 });
  const { slot } = computeFixtureSlot(match, NOW, 'us-coteaux');
  expect(slot).toEqual({ text: '1–3', tone: 'score' });
});

test('live match shows "en cours" and targets the match page', () => {
  const match = baseMatch({ status: 'live' });
  const { slot, target } = computeFixtureSlot(match, NOW, 'fc-vallonnais');
  expect(slot).toEqual({ text: 'en cours', tone: 'live' });
  expect(target).toEqual({ kind: 'match', id: 'm1' });
});

test('upcoming within 7 days with odds shows the perspective team\'s percent and targets its team page', () => {
  const match = baseMatch({
    kickoff: '2026-09-15T15:00:00Z', // +3 days
    odds: { home: 34, draw: 19, away: 47 },
  });
  const { slot, target } = computeFixtureSlot(match, NOW, 'fc-vallonnais');
  expect(slot).toEqual({ text: '34 %', tone: 'odds' });
  expect(target).toEqual({ kind: 'team', id: 'fc-vallonnais' });
});

test('upcoming within 7 days, perspective team away, shows the away percent', () => {
  const match = baseMatch({
    kickoff: '2026-09-15T15:00:00Z',
    odds: { home: 34, draw: 19, away: 47 },
  });
  const { slot } = computeFixtureSlot(match, NOW, 'us-coteaux');
  expect(slot).toEqual({ text: '47 %', tone: 'odds' });
});

test('upcoming beyond 7 days shows the opening day, 7 days before kickoff', () => {
  const match = baseMatch({
    kickoff: '2026-09-22T15:00:00Z', // +10 days; opening day = +3 days = Tuesday
    odds: { home: 30, draw: 20, away: 50 },
  });
  const { slot, target } = computeFixtureSlot(match, NOW, 'fc-vallonnais');
  expect(slot).toEqual({ text: 'Cotes mar.', tone: 'date' });
  expect(target).toEqual({ kind: 'team', id: 'fc-vallonnais' });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npm test -- fixtureSlot
```

Expected: FAIL — `Cannot find module './fixtureSlot'`.

- [ ] **Step 3: Write `src/logic/fixtureSlot.ts`**

```ts
import type { Match, FixtureSlot, FixtureTarget } from '../types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_LABELS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

export function computeFixtureSlot(
  match: Match,
  now: Date,
  perspectiveTeamId: string
): { slot: FixtureSlot; target: FixtureTarget } {
  if (match.status === 'played') {
    const homeIsPerspective = match.homeTeamId === perspectiveTeamId;
    const text = homeIsPerspective
      ? `${match.homeScore}–${match.awayScore}`
      : `${match.awayScore}–${match.homeScore}`;
    return { slot: { text, tone: 'score' }, target: { kind: 'match', id: match.id } };
  }

  if (match.status === 'live') {
    return {
      slot: { text: 'en cours', tone: 'live' },
      target: { kind: 'match', id: match.id },
    };
  }

  const kickoff = new Date(match.kickoff);
  const msUntilKickoff = kickoff.getTime() - now.getTime();

  if (match.odds && msUntilKickoff <= WEEK_MS) {
    const percent =
      match.homeTeamId === perspectiveTeamId ? match.odds.home : match.odds.away;
    return {
      slot: { text: `${percent} %`, tone: 'odds' },
      target: { kind: 'team', id: perspectiveTeamId },
    };
  }

  const openingDate = new Date(kickoff.getTime() - WEEK_MS);
  const dayLabel = DAY_LABELS[openingDate.getUTCDay()];
  return {
    slot: { text: `Cotes ${dayLabel}`, tone: 'date' },
    target: { kind: 'team', id: perspectiveTeamId },
  };
}
```

(`getUTCDay`, not `getDay` — every `kickoff` is an ISO string with an explicit `Z`, so reading it back with local-time accessors would shift the calendar day near midnight depending on the machine's timezone. Every date accessor in this task and Task 7 uses the UTC variant for the same reason.)

- [ ] **Step 4: Run to see it pass**

```bash
npm test -- fixtureSlot
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing tests — `src/logic/injectShopRows.test.ts`**

```ts
import { injectShopRows } from './injectShopRows';
import type { FixtureRow } from '../types';

function rows(count: number): FixtureRow[] {
  return Array.from({ length: count }, (_, i) => ({
    matchId: `m${i + 1}`,
    when: 'Dim. 14',
    match: `Match ${i + 1}`,
    sub: 'J4',
    slot: { text: 'x', tone: 'score' as const },
    target: { kind: 'match' as const, id: `m${i + 1}` },
  }));
}

test('no shop row for fewer than 5 fixtures', () => {
  const items = injectShopRows(rows(4));
  expect(items.filter((i) => i.kind === 'shop')).toHaveLength(0);
  expect(items).toHaveLength(4);
});

test('one shop row after the 5th fixture, preserving order', () => {
  const items = injectShopRows(rows(6));
  expect(items).toHaveLength(7);
  expect(items[5]).toEqual({ kind: 'shop' });
  expect(items.map((i) => (i.kind === 'fixture' ? i.row.matchId : 'shop'))).toEqual([
    'm1', 'm2', 'm3', 'm4', 'm5', 'shop', 'm6',
  ]);
});

test('shop rows at indices 5 and 11 for 12 fixtures', () => {
  const items = injectShopRows(rows(12));
  expect(items[5]).toEqual({ kind: 'shop' });
  expect(items[11]).toEqual({ kind: 'shop' });
  expect(items.filter((i) => i.kind === 'shop')).toHaveLength(2);
});
```

- [ ] **Step 6: Run to see it fail, then write `src/logic/injectShopRows.ts`**

```bash
npm test -- injectShopRows
```

Expected: FAIL — module not found.

```ts
import type { FixtureRow, ListItem } from '../types';

const SHOP_ROW_INTERVAL = 5;

export function injectShopRows(fixtures: FixtureRow[]): ListItem[] {
  const items: ListItem[] = [];
  fixtures.forEach((row, index) => {
    items.push({ kind: 'fixture', row });
    if ((index + 1) % SHOP_ROW_INTERVAL === 0) {
      items.push({ kind: 'shop' });
    }
  });
  return items;
}
```

- [ ] **Step 7: Run to see it pass**

```bash
npm test -- injectShopRows
```

Expected: PASS, 3 tests.

- [ ] **Step 8: Write the failing tests — `src/logic/standingsZone.test.ts`**

```ts
import { computeStandingsZone } from './standingsZone';

test('rank 1 of 10 is promotion', () => {
  expect(computeStandingsZone(1, 10)).toBe('promotion');
});

test('rank 2 of 10 is playoff', () => {
  expect(computeStandingsZone(2, 10)).toBe('playoff');
});

test('the last two of 10 are relegation', () => {
  expect(computeStandingsZone(9, 10)).toBe('relegation');
  expect(computeStandingsZone(10, 10)).toBe('relegation');
});

test('a mid-table rank is none', () => {
  expect(computeStandingsZone(5, 10)).toBe('none');
});
```

- [ ] **Step 9: Run to see it fail, then write `src/logic/standingsZone.ts`**

```bash
npm test -- standingsZone
```

Expected: FAIL — module not found.

```ts
import type { StandingsZone } from '../types';

export function computeStandingsZone(rank: number, teamCount: number): StandingsZone {
  if (rank === 1) return 'promotion';
  if (rank === 2) return 'playoff';
  if (rank >= teamCount - 1) return 'relegation';
  return 'none';
}
```

- [ ] **Step 10: Run to see it pass**

```bash
npm test -- standingsZone
```

Expected: PASS, 4 tests.

- [ ] **Step 11: Commit**

```bash
git add src/logic
git commit -m "feat: fixture slot, shop-row injection, standings zone logic"
```

---

### Task 6: Mock data

**Files:**
- Create: `src/data/seasonNow.ts`
- Create: `src/data/district.ts`
- Create: `src/data/teams.ts`
- Create: `src/data/players.ts`
- Create: `src/data/fixtures.ts`
- Create: `src/data/profile.ts`
- Test: none (static data; validated implicitly by the services tests in Task 7)

**Interfaces:**
- Produces: `SEASON_NOW: Date`; `district: District`; `teams: Team[]` (10 entries); `players: Player[]`, `topScorers: PeopleRow[]`, `topAssists: PeopleRow[]`, `mvpRanking: PeopleRow[]` (8 entries each); `fixtures: Match[]`; `profile: Profile`. Task 7's services import every one of these.

- [ ] **Step 1: Write `src/data/seasonNow.ts`**

Fixed "now" so slot logic and tests stay deterministic — matches the reference date used in Task 5's tests.

```ts
export const SEASON_NOW = new Date('2026-09-12T09:00:00Z');
```

- [ ] **Step 2: Write `src/data/district.ts`**

```ts
import type { District } from '../types';

export const district: District = {
  id: 'district-loire',
  name: 'District Loire',
  division: 'D2',
  season: '26/27',
  seller: 'District Loire',
};
```

- [ ] **Step 3: Write `src/data/teams.ts`**

Ten teams, ranked 1–10. `fc-vallonnais` and `as-riverain` match the store's default follows (Task 4).

```ts
import type { Team } from '../types';

export const teams: Team[] = [
  { id: 'us-coteaux', name: 'US Coteaux', shortName: 'Coteaux', crestColor: '#2A3242', rank: 1, points: 9, played: 3, goalDiff: 6, stadium: 'Stade des Coteaux', form: ['V', 'V', 'V', 'N', 'V'], squadCount: 19 },
  { id: 'fc-vallonnais', name: 'FC Vallonnais', shortName: 'Vallonnais', crestColor: '#3B3F8A', rank: 2, points: 7, played: 3, goalDiff: 3, stadium: 'Stade des Marnes', form: ['V', 'V', 'N', 'D', 'V'], squadCount: 18 },
  { id: 'rc-bellevue', name: 'RC Bellevue', shortName: 'Bellevue', crestColor: '#8A2E2E', rank: 3, points: 7, played: 3, goalDiff: 2, stadium: 'Parc de Bellevue', form: ['V', 'N', 'V', 'V', 'D'], squadCount: 17 },
  { id: 'as-grandval', name: 'AS Grandval', shortName: 'Grandval', crestColor: '#2E6B4F', rank: 4, points: 6, played: 3, goalDiff: 1, stadium: 'Stade Grandval', form: ['N', 'V', 'V', 'D', 'N'], squadCount: 18 },
  { id: 'olympique-fontenay', name: 'Olympique Fontenay', shortName: 'Fontenay', crestColor: '#B98A2E', rank: 5, points: 5, played: 3, goalDiff: 0, stadium: 'Stade de Fontenay', form: ['D', 'V', 'N', 'V', 'D'], squadCount: 16 },
  { id: 'stade-brecy', name: 'Stade Brécy', shortName: 'Brécy', crestColor: '#4A4E58', rank: 6, points: 5, played: 3, goalDiff: -1, stadium: 'Stade Municipal de Brécy', form: ['N', 'D', 'V', 'N', 'V'], squadCount: 17 },
  { id: 'etoile-de-mornay', name: 'Étoile de Mornay', shortName: 'Mornay', crestColor: '#8A5A2E', rank: 7, points: 4, played: 3, goalDiff: -2, stadium: 'Stade de Mornay', form: ['D', 'D', 'V', 'N', 'D'], squadCount: 18 },
  { id: 'as-riverain', name: 'AS Riverain', shortName: 'Riverain', crestColor: '#6B4E8A', rank: 8, points: 4, played: 3, goalDiff: -2, stadium: 'Stade Riverain', form: ['N', 'D', 'N', 'V', 'D'], squadCount: 18 },
  { id: 'fc-pontarnaud', name: 'FC Pontarnaud', shortName: 'Pontarnaud', crestColor: '#7A2E4E', rank: 9, points: 2, played: 3, goalDiff: -4, stadium: 'Stade de Pontarnaud', form: ['D', 'D', 'N', 'D', 'D'], squadCount: 16 },
  { id: 'us-chantereine', name: 'US Chantereine', shortName: 'Chantereine', crestColor: '#4E4E4E', rank: 10, points: 1, played: 3, goalDiff: -5, stadium: 'Stade de Chantereine', form: ['D', 'D', 'D', 'N', 'D'], squadCount: 17 },
];
```

- [ ] **Step 4: Write `src/data/players.ts`**

A 6-player preview squad per team (Team screen shows a preview, not the full roster — `Team.squadCount` carries the season-long headcount), plus the three ranked lists for Classement.

```ts
import type { Player, PeopleRow } from '../types';

function squad(teamId: string, entries: [string, string, number, number][]): Player[] {
  return entries.map(([name, position, goals, assists], i) => ({
    id: `${teamId}-p${i + 1}`,
    teamId,
    number: i + 1 === 1 ? 1 : i * 3 + 2,
    name,
    position,
    matchesPlayed: 3,
    goals,
    assists,
  }));
}

const vallonnais = squad('fc-vallonnais', [
  ['Yanis Cottreau', 'Gardien', 0, 0],
  ['Karim Ferhat', 'Défenseur', 0, 1],
  ['Louis Brancher', 'Défenseur', 1, 0],
  ['Malik Diarra', 'Milieu', 5, 3],
  ['Théo Rasolo', 'Milieu', 2, 4],
  ['Bilal Amrani', 'Attaquant', 4, 1],
]);

const coteaux = squad('us-coteaux', [
  ['Enzo Vidal', 'Gardien', 0, 0],
  ['Antoine Reber', 'Défenseur', 0, 0],
  ['Samir Belkacem', 'Défenseur', 0, 1],
  ['Nolan Guéguen', 'Milieu', 1, 3],
  ['Julien Marchetti', 'Milieu', 2, 2],
  ['Rayan Foucher', 'Attaquant', 6, 1],
]);

const bellevue = squad('rc-bellevue', [
  ['Hugo Lemercier', 'Gardien', 0, 0],
  ['Oumar Traoré', 'Défenseur', 0, 0],
  ['Nathan Picard', 'Défenseur', 1, 0],
  ['Idris Chaabane', 'Milieu', 1, 2],
  ['Maxime Delaunay', 'Milieu', 0, 3],
  ['Yohan Perret', 'Attaquant', 4, 2],
]);

const grandval = squad('as-grandval', [
  ['Baptiste Roy', 'Gardien', 0, 0],
  ['Théo Vasseur', 'Défenseur', 0, 0],
  ['Adama Koné', 'Défenseur', 0, 0],
  ['Kevin Le Goff', 'Milieu', 1, 1],
  ['Sofiane Bouzid', 'Milieu', 1, 2],
  ['Romain Chevallier', 'Attaquant', 3, 1],
]);

const fontenay = squad('olympique-fontenay', [
  ['Alexandre Nguyen', 'Gardien', 0, 0],
  ['Yassine Amara', 'Défenseur', 0, 0],
  ['Pierre Aubertin', 'Défenseur', 0, 0],
  ['Ilyes Benali', 'Milieu', 0, 1],
  ['Corentin Faucher', 'Milieu', 1, 1],
  ['Dylan Ribeiro', 'Attaquant', 3, 0],
]);

const brecy = squad('stade-brecy', [
  ['Mathis Poulain', 'Gardien', 0, 0],
  ['Younes Zerhouni', 'Défenseur', 0, 0],
  ['Simon Gasnier', 'Défenseur', 0, 0],
  ['Wesley Camara', 'Milieu', 0, 1],
  ['Léo Vigneron', 'Milieu', 1, 0],
  ['Tom Charrier', 'Attaquant', 2, 1],
]);

const mornay = squad('etoile-de-mornay', [
  ['Gabin Ollivier', 'Gardien', 0, 0],
  ['Franck Diakite', 'Défenseur', 0, 0],
  ['Rémi Sanchez', 'Défenseur', 0, 0],
  ['Nassim Berrada', 'Milieu', 0, 0],
  ['Quentin Massé', 'Milieu', 1, 0],
  ['Ewen Le Bris', 'Attaquant', 1, 1],
]);

const riverain = squad('as-riverain', [
  ['Nolwenn Guillou', 'Gardien', 0, 0],
  ['Farid Meziane', 'Défenseur', 0, 0],
  ['Erwan Toussaint', 'Défenseur', 0, 0],
  ['Ismaël Haddad', 'Milieu', 1, 1],
  ['Loïc Pelletier', 'Milieu', 0, 1],
  ['Anthony Girard', 'Attaquant', 2, 0],
]);

const pontarnaud = squad('fc-pontarnaud', [
  ['Valentin Cosson', 'Gardien', 0, 0],
  ['Bastien Rocher', 'Défenseur', 0, 0],
  ['Kylian Andrieu', 'Défenseur', 0, 0],
  ['Mehdi Larbi', 'Milieu', 0, 0],
  ['Jérémy Fontaine', 'Milieu', 0, 0],
  ['Cyril Duchemin', 'Attaquant', 1, 0],
]);

const chantereine = squad('us-chantereine', [
  ['Axel Bourgoin', 'Gardien', 0, 0],
  ['Damien Séverin', 'Défenseur', 0, 0],
  ['Fabien Lacaze', 'Défenseur', 0, 0],
  ['Brahim Yousfi', 'Milieu', 0, 0],
  ['Gauthier Prévost', 'Milieu', 0, 0],
  ['Steven Marchal', 'Attaquant', 1, 0],
]);

export const players: Player[] = [
  ...vallonnais,
  ...coteaux,
  ...bellevue,
  ...grandval,
  ...fontenay,
  ...brecy,
  ...mornay,
  ...riverain,
  ...pontarnaud,
  ...chantereine,
];

export const topScorers: PeopleRow[] = [
  { rank: 1, playerId: 'us-coteaux-p6', name: 'Rayan Foucher', teamName: 'US Coteaux', value: 6, unit: 'buts' },
  { rank: 2, playerId: 'fc-vallonnais-p4', name: 'Malik Diarra', teamName: 'FC Vallonnais', value: 5, unit: 'buts' },
  { rank: 3, playerId: 'fc-vallonnais-p6', name: 'Bilal Amrani', teamName: 'FC Vallonnais', value: 4, unit: 'buts' },
  { rank: 3, playerId: 'rc-bellevue-p6', name: 'Yohan Perret', teamName: 'RC Bellevue', value: 4, unit: 'buts' },
  { rank: 5, playerId: 'as-grandval-p6', name: 'Romain Chevallier', teamName: 'AS Grandval', value: 3, unit: 'buts' },
  { rank: 5, playerId: 'olympique-fontenay-p6', name: 'Dylan Ribeiro', teamName: 'Olympique Fontenay', value: 3, unit: 'buts' },
  { rank: 7, playerId: 'stade-brecy-p6', name: 'Tom Charrier', teamName: 'Stade Brécy', value: 2, unit: 'buts' },
  { rank: 7, playerId: 'as-riverain-p6', name: 'Anthony Girard', teamName: 'AS Riverain', value: 2, unit: 'buts' },
];

export const topAssists: PeopleRow[] = [
  { rank: 1, playerId: 'fc-vallonnais-p5', name: 'Théo Rasolo', teamName: 'FC Vallonnais', value: 4, unit: 'passes' },
  { rank: 2, playerId: 'fc-vallonnais-p4', name: 'Malik Diarra', teamName: 'FC Vallonnais', value: 3, unit: 'passes' },
  { rank: 2, playerId: 'rc-bellevue-p5', name: 'Maxime Delaunay', teamName: 'RC Bellevue', value: 3, unit: 'passes' },
  { rank: 2, playerId: 'us-coteaux-p4', name: 'Nolan Guéguen', teamName: 'US Coteaux', value: 3, unit: 'passes' },
  { rank: 5, playerId: 'as-grandval-p5', name: 'Sofiane Bouzid', teamName: 'AS Grandval', value: 2, unit: 'passes' },
  { rank: 5, playerId: 'rc-bellevue-p4', name: 'Idris Chaabane', teamName: 'RC Bellevue', value: 2, unit: 'passes' },
  { rank: 7, playerId: 'us-coteaux-p3', name: 'Samir Belkacem', teamName: 'US Coteaux', value: 1, unit: 'passes' },
  { rank: 7, playerId: 'as-grandval-p4', name: 'Kevin Le Goff', teamName: 'AS Grandval', value: 1, unit: 'passes' },
];

export const mvpRanking: PeopleRow[] = [
  { rank: 1, playerId: 'fc-vallonnais-p4', name: 'Malik Diarra', teamName: 'FC Vallonnais', value: 61, unit: 'votes' },
  { rank: 2, playerId: 'us-coteaux-p6', name: 'Rayan Foucher', teamName: 'US Coteaux', value: 48, unit: 'votes' },
  { rank: 3, playerId: 'rc-bellevue-p6', name: 'Yohan Perret', teamName: 'RC Bellevue', value: 33, unit: 'votes' },
  { rank: 4, playerId: 'fc-vallonnais-p5', name: 'Théo Rasolo', teamName: 'FC Vallonnais', value: 29, unit: 'votes' },
  { rank: 5, playerId: 'as-grandval-p6', name: 'Romain Chevallier', teamName: 'AS Grandval', value: 22, unit: 'votes' },
  { rank: 6, playerId: 'olympique-fontenay-p6', name: 'Dylan Ribeiro', teamName: 'Olympique Fontenay', value: 18, unit: 'votes' },
  { rank: 7, playerId: 'stade-brecy-p6', name: 'Tom Charrier', teamName: 'Stade Brécy', value: 12, unit: 'votes' },
  { rank: 8, playerId: 'as-riverain-p6', name: 'Anthony Girard', teamName: 'AS Riverain', value: 9, unit: 'votes' },
];
```

- [ ] **Step 5: Write `src/data/fixtures.ts`**

Matchdays 1–3 played for `fc-vallonnais` and `as-riverain` (so Suivi has ≥ 6 rows and exercises the shop-row injection), one J4 fixture `live`, the rest of J4 `upcoming` with odds. J3's Vallonnais match carries `events`, `mvp`, and video fields for the Match screen.

```ts
import type { Match } from '../types';

export const fixtures: Match[] = [
  // FC Vallonnais — matchdays 1-3 played, J4 upcoming
  {
    id: 'm-j1-vallonnais',
    matchday: 1,
    homeTeamId: 'fc-vallonnais',
    awayTeamId: 'as-grandval',
    kickoff: '2026-08-23T15:00:00Z',
    venue: 'Stade des Marnes',
    status: 'played',
    homeScore: 2,
    awayScore: 0,
    referee: 'M. Talbot',
    spectators: 110,
  },
  {
    id: 'm-j2-vallonnais',
    matchday: 2,
    homeTeamId: 'rc-bellevue',
    awayTeamId: 'fc-vallonnais',
    kickoff: '2026-08-30T15:00:00Z',
    venue: 'Parc de Bellevue',
    status: 'played',
    homeScore: 0,
    awayScore: 2,
    referee: 'L. Fabre',
    spectators: 95,
  },
  {
    id: 'm-j3-vallonnais',
    matchday: 3,
    homeTeamId: 'fc-vallonnais',
    awayTeamId: 'etoile-de-mornay',
    kickoff: '2026-09-07T15:00:00Z',
    venue: 'Stade des Marnes, terrain 2',
    status: 'played',
    homeScore: 3,
    awayScore: 1,
    referee: 'L. Fabre',
    spectators: 140,
    videoUrl: 'https://www.youtube.com/watch?v=fc-vallonnais-j3',
    videoDuration: '8:42',
    events: [
      { minute: 12, type: 'goal', playerName: 'Malik Diarra', detail: 'Passe de T. Rasolo', score: '1–0' },
      { minute: 34, type: 'goal', playerName: 'Wael Chettibi', detail: 'Coup franc direct', score: '1–1' },
      { minute: 58, type: 'goal', playerName: 'Bilal Amrani', detail: 'Passe de M. Diarra', score: '2–1' },
      { minute: 77, type: 'goal', playerName: 'Malik Diarra', detail: "Frappe à l'entrée de la surface", score: '3–1' },
    ],
    mvp: { playerId: 'fc-vallonnais-p4', votePercent: 61, voteCount: 214 },
  },
  {
    id: 'm-j4-vallonnais',
    matchday: 4,
    homeTeamId: 'us-coteaux',
    awayTeamId: 'fc-vallonnais',
    kickoff: '2026-09-15T15:00:00Z',
    venue: 'Stade des Coteaux',
    status: 'upcoming',
    odds: { home: 34, draw: 19, away: 47 },
    referee: 'L. Fabre',
    convocation: '13:45',
  },

  // AS Riverain — matchdays 1-3 played, J4 live
  {
    id: 'm-j1-riverain',
    matchday: 1,
    homeTeamId: 'as-riverain',
    awayTeamId: 'stade-brecy',
    kickoff: '2026-08-23T13:00:00Z',
    venue: 'Stade Riverain',
    status: 'played',
    homeScore: 1,
    awayScore: 1,
  },
  {
    id: 'm-j2-riverain',
    matchday: 2,
    homeTeamId: 'fc-pontarnaud',
    awayTeamId: 'as-riverain',
    kickoff: '2026-08-30T13:00:00Z',
    venue: 'Stade de Pontarnaud',
    status: 'played',
    homeScore: 0,
    awayScore: 2,
  },
  {
    id: 'm-j3-riverain',
    matchday: 3,
    homeTeamId: 'as-riverain',
    awayTeamId: 'olympique-fontenay',
    kickoff: '2026-09-06T13:00:00Z',
    venue: 'Stade Riverain',
    status: 'played',
    homeScore: 1,
    awayScore: 2,
  },
  {
    id: 'm-j4-riverain',
    matchday: 4,
    homeTeamId: 'as-riverain',
    awayTeamId: 'us-chantereine',
    kickoff: '2026-09-12T15:00:00Z',
    venue: 'Stade Riverain',
    status: 'live',
  },
];
```

- [ ] **Step 6: Write `src/data/profile.ts`**

```ts
import type { Profile } from '../types';

export const profile: Profile = {
  name: 'Julien Mercier',
  supporterOf: 'FC Vallonnais',
  since: 2024,
  pronoPoints: 248,
  pronoRank: 3,
};
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/data
git commit -m "feat: mock data — district, teams, players, fixtures, profile"
```

---

### Task 7: Services + `useAsync` hook

**Files:**
- Create: `src/services/_shared.ts`
- Create: `src/services/league.ts`
- Create: `src/services/standings.ts`
- Create: `src/services/teams.ts`
- Create: `src/services/matches.ts`
- Create: `src/hooks/useAsync.ts`
- Test: `src/services/standings.test.ts`
- Test: `src/services/matches.test.ts`
- Test: `src/hooks/useAsync.test.ts`

**Interfaces:**
- Consumes: `computeFixtureSlot`, `computeStandingsZone` (Task 5); `teams`, `players`, `topScorers`, `topAssists`, `mvpRanking`, `fixtures`, `district`, `SEASON_NOW` (Task 6).
- Produces: `getDistrict(): Promise<District>`; `getStandings(followedTeamIds?: string[]): Promise<StandingsRow[]>`; `getTopScorers/getTopAssists/getMvpRanking(): Promise<PeopleRow[]>`; `getTeam(id: string): Promise<TeamDetail>` (throws if not found); `getMyFixtures(followedTeamIds: string[]): Promise<FixtureRow[]>`; `getMatch(id: string): Promise<Match>` (throws if not found); `useAsync<T>(factory: () => Promise<T>, deps: unknown[]): { data: T | null; loading: boolean; error: Error | null; reload: () => void }`. Every screen task (11–15) calls these.

- [ ] **Step 1: Write `src/services/_shared.ts`**

```ts
export const SHOULD_FAIL = { current: false };

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withLatency<T>(factory: () => T): Promise<T> {
  await sleep(250);
  if (SHOULD_FAIL.current) {
    throw new Error('Erreur réseau simulée');
  }
  return factory();
}
```

- [ ] **Step 2: Write `src/services/league.ts`**

```ts
import { withLatency } from './_shared';
import { district } from '../data/district';
import type { District } from '../types';

export function getDistrict(): Promise<District> {
  return withLatency(() => district);
}
```

- [ ] **Step 3: Write the failing test — `src/services/standings.test.ts`**

```ts
import { getStandings, getTopScorers, getTopAssists, getMvpRanking } from './standings';

test('getStandings returns 10 rows ordered by rank with computed zone and followed flag', async () => {
  const rows = await getStandings(['fc-vallonnais']);
  expect(rows).toHaveLength(10);
  expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(rows[0].zone).toBe('promotion');
  expect(rows[9].zone).toBe('relegation');
  expect(rows.find((r) => r.teamId === 'fc-vallonnais')?.followed).toBe(true);
  expect(rows.find((r) => r.teamId === 'us-coteaux')?.followed).toBe(false);
});

test('getTopScorers/getTopAssists/getMvpRanking each return 8 rows', async () => {
  expect(await getTopScorers()).toHaveLength(8);
  expect(await getTopAssists()).toHaveLength(8);
  expect(await getMvpRanking()).toHaveLength(8);
});
```

- [ ] **Step 4: Run to see it fail, then write `src/services/standings.ts`**

```bash
npm test -- standings
```

Expected: FAIL — module not found.

```ts
import { withLatency } from './_shared';
import { teams } from '../data/teams';
import { topScorers, topAssists, mvpRanking } from '../data/players';
import { computeStandingsZone } from '../logic/standingsZone';
import type { StandingsRow, PeopleRow } from '../types';

export function getStandings(followedTeamIds: string[] = []): Promise<StandingsRow[]> {
  return withLatency(() =>
    [...teams]
      .sort((a, b) => a.rank - b.rank)
      .map((team) => ({
        rank: team.rank,
        teamId: team.id,
        teamName: team.name,
        played: team.played,
        goalDiff: team.goalDiff,
        points: team.points,
        zone: computeStandingsZone(team.rank, teams.length),
        followed: followedTeamIds.includes(team.id),
      }))
  );
}

export function getTopScorers(): Promise<PeopleRow[]> {
  return withLatency(() => topScorers);
}

export function getTopAssists(): Promise<PeopleRow[]> {
  return withLatency(() => topAssists);
}

export function getMvpRanking(): Promise<PeopleRow[]> {
  return withLatency(() => mvpRanking);
}
```

- [ ] **Step 5: Run to see it pass**

```bash
npm test -- standings
```

Expected: PASS, 2 tests.

- [ ] **Step 6: Write `src/services/teams.ts`** (no dedicated test file — exercised through the Team screen test in Task 13; the logic is a straightforward filter/map read from Task 6's fixed fixtures)

```ts
import { withLatency } from './_shared';
import { teams } from '../data/teams';
import { players } from '../data/players';
import { fixtures } from '../data/fixtures';
import type { TeamDetail, ResultLine, Match } from '../types';

export function getTeam(id: string): Promise<TeamDetail> {
  return withLatency(() => {
    const team = teams.find((t) => t.id === id);
    if (!team) {
      throw new Error(`Équipe introuvable : ${id}`);
    }

    const teamFixtures = fixtures.filter((m) => m.homeTeamId === id || m.awayTeamId === id);

    const opponentName = (m: Match) => {
      const opponentId = m.homeTeamId === id ? m.awayTeamId : m.homeTeamId;
      return teams.find((t) => t.id === opponentId)?.name ?? opponentId;
    };

    const nextFixture = teamFixtures
      .filter((m) => m.status === 'upcoming')
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())[0];

    const nextMatch = nextFixture
      ? {
          ...nextFixture,
          opponentName: opponentName(nextFixture),
          venueTag: (nextFixture.homeTeamId === id ? 'dom.' : 'ext.') as const,
        }
      : null;

    const lastResults: ResultLine[] = teamFixtures
      .filter((m) => m.status === 'played')
      .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())
      .slice(0, 3)
      .map((m) => {
        const isHome = m.homeTeamId === id;
        const ownScore = isHome ? m.homeScore! : m.awayScore!;
        const theirScore = isHome ? m.awayScore! : m.homeScore!;
        const result = ownScore > theirScore ? 'V' : ownScore === theirScore ? 'N' : 'D';
        return {
          matchId: m.id,
          opponent: opponentName(m),
          venueTag: isHome ? 'dom.' : 'ext.',
          result,
          score: `${ownScore}–${theirScore}`,
        };
      });

    const squad = players.filter((p) => p.teamId === id).slice(0, 6);

    return { team, nextMatch, lastResults, squad };
  });
}
```

- [ ] **Step 7: Write the failing test — `src/services/matches.test.ts`**

```ts
import { getMyFixtures, getMatch } from './matches';
import { fixtures } from '../data/fixtures';

test('getMyFixtures returns one row per fixture for every followed team, sorted by kickoff', async () => {
  const rows = await getMyFixtures(['fc-vallonnais', 'as-riverain']);
  expect(rows.length).toBeGreaterThanOrEqual(6);

  const kickoffOf = (matchId: string) =>
    new Date(fixtures.find((m) => m.id === matchId)!.kickoff).getTime();
  const timestamps = rows.map((r) => kickoffOf(r.matchId));
  expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
});

test('getMatch resolves a known match and rejects an unknown id', async () => {
  const match = await getMatch('m-j3-vallonnais');
  expect(match.homeScore).toBe(3);
  await expect(getMatch('does-not-exist')).rejects.toThrow('Match introuvable');
});
```

- [ ] **Step 8: Run to see it fail, then write `src/services/matches.ts`**

```bash
npm test -- matches
```

Expected: FAIL — module not found.

```ts
import { withLatency } from './_shared';
import { fixtures } from '../data/fixtures';
import { teams } from '../data/teams';
import { computeFixtureSlot } from '../logic/fixtureSlot';
import { SEASON_NOW } from '../data/seasonNow';
import type { FixtureRow, Match } from '../types';

const DAY_LABELS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function teamName(id: string): string {
  return teams.find((t) => t.id === id)?.name ?? id;
}

function formatWhen(date: Date): string {
  return `${DAY_LABELS[date.getUTCDay()]} ${date.getUTCDate()}`;
}

function formatTime(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

export function getMyFixtures(followedTeamIds: string[]): Promise<FixtureRow[]> {
  return withLatency(() => {
    const rows: FixtureRow[] = [];

    for (const teamId of followedTeamIds) {
      for (const match of fixtures) {
        if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) continue;

        const opponentId = match.homeTeamId === teamId ? match.awayTeamId : match.homeTeamId;
        const venueTag = match.homeTeamId === teamId ? 'dom.' : 'ext.';
        const kickoff = new Date(match.kickoff);
        const { slot, target } = computeFixtureSlot(match, SEASON_NOW, teamId);

        rows.push({
          matchId: match.id,
          when: formatWhen(kickoff),
          match: `${teamName(teamId)} — ${teamName(opponentId)}`,
          sub: `J${match.matchday} · ${venueTag === 'dom.' ? 'domicile' : 'extérieur'} · ${formatTime(kickoff)}`,
          slot,
          target,
        });
      }
    }

    return rows.sort((a, b) => {
      const kickoffOf = (matchId: string) =>
        new Date(fixtures.find((m) => m.id === matchId)!.kickoff).getTime();
      return kickoffOf(a.matchId) - kickoffOf(b.matchId);
    });
  });
}

export function getMatch(id: string): Promise<Match> {
  return withLatency(() => {
    const match = fixtures.find((m) => m.id === id);
    if (!match) {
      throw new Error(`Match introuvable : ${id}`);
    }
    return match;
  });
}
```

- [ ] **Step 9: Run to see it pass**

```bash
npm test -- matches
```

Expected: PASS, 2 tests.

- [ ] **Step 10: Write the failing test — `src/hooks/useAsync.test.ts`**

```ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useAsync } from './useAsync';

test('resolves data and flips loading to false', async () => {
  const { result } = renderHook(() => useAsync(() => Promise.resolve('ok'), []));
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data).toBe('ok');
  expect(result.current.error).toBeNull();
});

test('captures a rejected promise as error', async () => {
  const { result } = renderHook(() => useAsync(() => Promise.reject(new Error('boom')), []));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error?.message).toBe('boom');
});

test('reload re-runs the factory', async () => {
  let calls = 0;
  const factory = () => Promise.resolve(++calls);
  const { result } = renderHook(() => useAsync(factory, []));
  await waitFor(() => expect(result.current.data).toBe(1));
  result.current.reload();
  await waitFor(() => expect(result.current.data).toBe(2));
});
```

- [ ] **Step 11: Run to see it fail, then write `src/hooks/useAsync.ts`**

```bash
npm test -- useAsync
```

Expected: FAIL — module not found.

```ts
import { useCallback, useEffect, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAsync<T>(
  factory: () => Promise<T>,
  deps: unknown[]
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    factory()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  return { ...state, reload };
}
```

- [ ] **Step 12: Run to see it pass**

```bash
npm test -- useAsync
```

Expected: PASS, 3 tests.

- [ ] **Step 13: Commit**

```bash
git add src/services src/hooks
git commit -m "feat: services layer and useAsync hook"
```

---

### Task 8: Layout primitive components

**Files:**
- Create: `src/components/Screen.tsx`
- Create: `src/components/HeaderCard.tsx`
- Create: `src/components/Card.tsx`
- Create: `src/components/SectionLabel.tsx`
- Create: `src/components/ThemedText.tsx`
- Create: `src/components/BackLink.tsx`
- Create: `src/components/Avatar.tsx`
- Create: `src/components/Skeleton.tsx`
- Create: `src/components/ErrorState.tsx`
- Create: `src/components/PlaceholderScreen.tsx`
- Test: `src/components/ThemedText.test.tsx`

**Interfaces:**
- Consumes: `fr` (Task 2), Task 3's Tailwind color pairs.
- Produces: `Screen`, `HeaderCard`, `Card`, `CardRow` (from `Card.tsx`), `SectionLabel`, `ThemedText` (props `tone?: 'primary'|'muted'|'faint'|'accent'`, `mono?: boolean`, `weight?: 'normal'|'medium'|'semibold'`, `size?: number`, plus `TextProps`), `BackLink`, `Avatar`/`Crest` (from `Avatar.tsx`), `Skeleton`, `ErrorState`, `PlaceholderScreen`. Every screen task (11–15) composes these.

- [ ] **Step 1: Write `src/components/Screen.tsx`**

```tsx
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvasDark">
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Write `src/components/HeaderCard.tsx`**

```tsx
import React from 'react';
import { View } from 'react-native';

export function HeaderCard({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-header dark:bg-headerDark border-b border-hairline dark:border-hairlineDark px-5 pt-3 pb-3.5">
      {children}
    </View>
  );
}
```

(`SafeAreaView` already reserves the status-bar/notch inset — this `pt-3` is padding *within* the safe area, not a substitute for it.)

- [ ] **Step 3: Write `src/components/Card.tsx`**

```tsx
import React from 'react';
import { View } from 'react-native';

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-card dark:bg-cardDark border border-border dark:border-borderDark rounded-2xl overflow-hidden">
      {children}
    </View>
  );
}

export function CardRow({
  children,
  isFirst = false,
}: {
  children: React.ReactNode;
  isFirst?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3 ${
        isFirst ? '' : 'border-t border-hairline dark:border-hairlineDark'
      }`}
    >
      {children}
    </View>
  );
}
```

- [ ] **Step 4: Write the failing test — `src/components/ThemedText.test.tsx`**

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemedText } from './ThemedText';

test('renders its children', () => {
  render(<ThemedText>Bonjour</ThemedText>);
  expect(screen.getByText('Bonjour')).toBeTruthy();
});

test('mono applies an IBM Plex Mono font family', () => {
  render(<ThemedText mono weight="semibold">42</ThemedText>);
  const node = screen.getByText('42');
  expect(node.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ fontFamily: 'IBMPlexMono_600SemiBold' })])
  );
});
```

- [ ] **Step 5: Run to see it fail, then write `src/components/ThemedText.tsx`**

```bash
npm test -- ThemedText
```

Expected: FAIL — module not found.

```tsx
import React from 'react';
import { Text, type TextProps } from 'react-native';

type Tone = 'primary' | 'muted' | 'faint' | 'accent';
type Weight = 'normal' | 'medium' | 'semibold';

interface ThemedTextProps extends TextProps {
  tone?: Tone;
  mono?: boolean;
  weight?: Weight;
  size?: number;
  children: React.ReactNode;
}

const TONE_CLASS: Record<Tone, string> = {
  primary: 'text-textPrimary dark:text-textPrimaryDark',
  muted: 'text-textMuted dark:text-textMutedDark',
  faint: 'text-textFaint dark:text-textFaintDark',
  accent: 'text-accent dark:text-accentDark',
};

const WEIGHT_CLASS: Record<Weight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
};

const MONO_FAMILY: Record<Weight, string> = {
  normal: 'IBMPlexMono_400Regular',
  medium: 'IBMPlexMono_500Medium',
  semibold: 'IBMPlexMono_600SemiBold',
};

export function ThemedText({
  tone = 'primary',
  mono = false,
  weight = 'normal',
  size = 14,
  className,
  style,
  children,
  ...rest
}: ThemedTextProps) {
  return (
    <Text
      className={`${TONE_CLASS[tone]} ${WEIGHT_CLASS[weight]} ${className ?? ''}`}
      style={[
        { fontSize: size, fontFamily: mono ? MONO_FAMILY[weight] : undefined },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
```

- [ ] **Step 6: Run to see it pass**

```bash
npm test -- ThemedText
```

Expected: PASS, 2 tests.

- [ ] **Step 7: Write `src/components/SectionLabel.tsx`**

```tsx
import React from 'react';
import { ThemedText } from './ThemedText';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide">
      {children}
    </ThemedText>
  );
}
```

- [ ] **Step 8: Write `src/components/BackLink.tsx`**

```tsx
import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from './ThemedText';

export function BackLink({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
      <ThemedText tone="muted" weight="medium" size={13.5}>
        {'‹ '}
        {label}
      </ThemedText>
    </Pressable>
  );
}
```

- [ ] **Step 9: Write `src/components/Avatar.tsx`**

```tsx
import React from 'react';
import { View } from 'react-native';

export function Avatar({ size = 32, rounded = 'full' }: { size?: number; rounded?: 'full' | 'md' }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: rounded === 'full' ? size / 2 : 8 }}
      className="bg-field dark:bg-fieldDark border border-border dark:border-borderDark"
    />
  );
}

export function Crest({ size = 32 }: { size?: number }) {
  return <Avatar size={size} rounded="md" />;
}
```

- [ ] **Step 10: Write `src/components/Skeleton.tsx`**

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

export function Skeleton({ rows = 4 }: { rows?: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View className="gap-3 px-5 py-4" testID="skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <Animated.View
          key={i}
          style={{ opacity, height: 52 }}
          className="rounded-2xl bg-field dark:bg-fieldDark"
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 11: Write `src/components/ErrorState.tsx`**

```tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { fr } from '../i18n/fr';

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="items-center gap-3 px-5 py-10">
      <ThemedText tone="muted" size={13.5}>{message}</ThemedText>
      <Pressable
        onPress={onRetry}
        className="bg-accent dark:bg-accentDark rounded-xl px-4 py-2.5"
        accessibilityRole="button"
      >
        <ThemedText style={{ color: '#fff' }} weight="semibold" size={13.5}>
          {fr.common.retry}
        </ThemedText>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 12: Write `src/components/PlaceholderScreen.tsx`**

```tsx
import React from 'react';
import { View } from 'react-native';
import { Screen } from './Screen';
import { ThemedText } from './ThemedText';

export function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-2 px-8">
        <View className="w-14 h-14 rounded-2xl bg-field dark:bg-fieldDark mb-2" />
        <ThemedText weight="semibold" size={20}>{title}</ThemedText>
        <ThemedText tone="muted" size={14}>Bientôt disponible</ThemedText>
        <ThemedText tone="faint" size={12.5} className="text-center mt-1">{note}</ThemedText>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 13: Commit**

```bash
git add src/components
git commit -m "feat: layout primitive components"
```

---

### Task 9: Interactive display components

**Files:**
- Create: `src/components/SlotChip.tsx`
- Create: `src/components/FormChips.tsx`
- Create: `src/components/OddsBar.tsx`
- Create: `src/components/SegmentedTabs.tsx`
- Test: `src/components/SlotChip.test.tsx`
- Test: `src/components/FormChips.test.tsx`
- Test: `src/components/OddsBar.test.tsx`
- Test: `src/components/SegmentedTabs.test.tsx`

**Interfaces:**
- Consumes: `ThemedText` (Task 8), `FixtureSlotTone`, `ResultTag` (Task 2).
- Produces: `SlotChip({ text, tone })`; `FormChips({ form: ResultTag[] })`; `OddsBar({ home, draw, away }: { home: number; draw: number; away: number })`; `SegmentedTabs({ options: string[], value: number, onChange: (index: number) => void })` — rendering each option with `testID={`segmented-tab-${option}`}`. Screens (11, 12, 15) use all four.

- [ ] **Step 1: Write the failing test — `src/components/SlotChip.test.tsx`**

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SlotChip } from './SlotChip';

test('renders a played score', () => {
  render(<SlotChip text="3–1" tone="score" />);
  expect(screen.getByText('3–1')).toBeTruthy();
});

test('renders a live label', () => {
  render(<SlotChip text="en cours" tone="live" />);
  expect(screen.getByText('en cours')).toBeTruthy();
});

test('renders an odds percentage', () => {
  render(<SlotChip text="47 %" tone="odds" />);
  expect(screen.getByText('47 %')).toBeTruthy();
});
```

- [ ] **Step 2: Run to see it fail, then write `src/components/SlotChip.tsx`**

```bash
npm test -- SlotChip
```

Expected: FAIL — module not found.

```tsx
import React from 'react';
import { View } from 'react-native';
import { ThemedText } from './ThemedText';
import type { FixtureSlotTone } from '../types';

const TONE_CLASS: Record<FixtureSlotTone, string> = {
  score: 'bg-field dark:bg-fieldDark',
  live: 'bg-warnBg dark:bg-warnBgDark',
  odds: 'bg-accent dark:bg-accentDark',
  date: 'bg-field dark:bg-fieldDark',
};

export function SlotChip({ text, tone }: { text: string; tone: FixtureSlotTone }) {
  return (
    <View
      className={`h-[26px] px-2.5 rounded-lg items-center justify-center ${TONE_CLASS[tone]}`}
    >
      <ThemedText
        mono
        weight="semibold"
        size={12.5}
        className={tone === 'live' ? 'text-warn dark:text-warnDark' : undefined}
        style={tone === 'odds' ? { color: '#fff' } : undefined}
      >
        {text}
      </ThemedText>
    </View>
  );
}
```

- [ ] **Step 3: Run to see it pass**

```bash
npm test -- SlotChip
```

Expected: PASS, 3 tests.

- [ ] **Step 4: Write the failing test — `src/components/FormChips.test.tsx`**

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { FormChips } from './FormChips';

test('renders one chip per result, in order', () => {
  render(<FormChips form={['V', 'V', 'N', 'D', 'V']} />);
  expect(screen.getAllByText('V')).toHaveLength(3);
  expect(screen.getByText('N')).toBeTruthy();
  expect(screen.getByText('D')).toBeTruthy();
});
```

- [ ] **Step 5: Run to see it fail, then write `src/components/FormChips.tsx`**

```bash
npm test -- FormChips
```

Expected: FAIL — module not found.

```tsx
import React from 'react';
import { View } from 'react-native';
import { ThemedText } from './ThemedText';
import type { ResultTag } from '../types';

const BG_CLASS: Record<ResultTag, string> = {
  V: 'bg-accent dark:bg-accentDark',
  N: 'bg-field dark:bg-fieldDark',
  D: 'bg-negBg dark:bg-negBgDark',
};

const TEXT_STYLE: Record<ResultTag, { color: string } | undefined> = {
  V: { color: '#fff' },
  N: undefined,
  D: { color: '#A82C1E' },
};

export function FormChips({ form }: { form: ResultTag[] }) {
  return (
    <View className="flex-row gap-1.5">
      {form.map((tag, i) => (
        <View
          key={i}
          className={`w-[22px] h-[22px] rounded-md items-center justify-center ${BG_CLASS[tag]}`}
        >
          <ThemedText weight="semibold" size={11.5} style={TEXT_STYLE[tag]}>
            {tag}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 6: Run to see it pass**

```bash
npm test -- FormChips
```

Expected: PASS, 1 test.

- [ ] **Step 7: Write the failing test — `src/components/OddsBar.test.tsx`**

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { OddsBar } from './OddsBar';

test('gives each segment a flex weight equal to its percentage', () => {
  render(<OddsBar home={34} draw={19} away={47} />);
  expect(screen.getByTestId('odds-home').props.style.flex).toBe(34);
  expect(screen.getByTestId('odds-draw').props.style.flex).toBe(19);
  expect(screen.getByTestId('odds-away').props.style.flex).toBe(47);
});

test('renders every percentage label', () => {
  render(<OddsBar home={34} draw={19} away={47} />);
  expect(screen.getByText('34 %')).toBeTruthy();
  expect(screen.getByText('19 %')).toBeTruthy();
  expect(screen.getByText('47 %')).toBeTruthy();
});
```

- [ ] **Step 8: Run to see it fail, then write `src/components/OddsBar.tsx`**

```bash
npm test -- OddsBar
```

Expected: FAIL — module not found.

```tsx
import React from 'react';
import { View } from 'react-native';
import { ThemedText } from './ThemedText';

export function OddsBar({ home, draw, away }: { home: number; draw: number; away: number }) {
  const segments = [
    { key: 'home', value: home },
    { key: 'draw', value: draw },
    { key: 'away', value: away },
  ];
  const max = Math.max(home, draw, away);

  return (
    <View className="flex-row gap-1.5">
      {segments.map((s) => {
        const isMax = s.value === max;
        return (
          <View
            key={s.key}
            testID={`odds-${s.key}`}
            style={{ flex: s.value }}
            className={`h-[30px] rounded-lg items-center justify-center ${
              isMax ? 'bg-accent dark:bg-accentDark' : 'bg-field dark:bg-fieldDark'
            }`}
          >
            <ThemedText
              mono
              weight={isMax ? 'semibold' : 'medium'}
              size={12}
              style={isMax ? { color: '#fff' } : undefined}
              className={isMax ? undefined : 'text-textMuted dark:text-textMutedDark'}
            >
              {s.value} %
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 9: Run to see it pass**

```bash
npm test -- OddsBar
```

Expected: PASS, 2 tests.

- [ ] **Step 10: Write the failing test — `src/components/SegmentedTabs.test.tsx`**

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SegmentedTabs } from './SegmentedTabs';

test('calls onChange with the pressed index', () => {
  const onChange = jest.fn();
  render(<SegmentedTabs options={['Général', 'Buteurs']} value={0} onChange={onChange} />);
  fireEvent.press(screen.getByTestId('segmented-tab-Buteurs'));
  expect(onChange).toHaveBeenCalledWith(1);
});

test('marks the active segment as selected', () => {
  render(<SegmentedTabs options={['Général', 'Buteurs']} value={1} onChange={() => {}} />);
  expect(screen.getByTestId('segmented-tab-Buteurs').props.accessibilityState.selected).toBe(true);
  expect(screen.getByTestId('segmented-tab-Général').props.accessibilityState.selected).toBe(false);
});
```

- [ ] **Step 11: Run to see it fail, then write `src/components/SegmentedTabs.tsx`**

```bash
npm test -- SegmentedTabs
```

Expected: FAIL — module not found.

```tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from './ThemedText';

export function SegmentedTabs({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: number;
  onChange: (index: number) => void;
}) {
  return (
    <View className="flex-row gap-1.5 bg-field dark:bg-fieldDark p-1 rounded-xl">
      {options.map((label, index) => {
        const active = index === value;
        return (
          <Pressable
            key={label}
            testID={`segmented-tab-${label}`}
            onPress={() => onChange(index)}
            className={`flex-1 py-2 rounded-lg items-center ${active ? 'bg-accent dark:bg-accentDark' : ''}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <ThemedText
              weight="semibold"
              size={12.5}
              style={active ? { color: '#fff' } : undefined}
              className={active ? undefined : 'text-textMuted dark:text-textMutedDark'}
            >
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 12: Run to see it pass**

```bash
npm test -- SegmentedTabs
```

Expected: PASS, 2 tests.

- [ ] **Step 13: Commit**

```bash
git add src/components
git commit -m "feat: interactive display components"
```

---

### Task 10: Navigation shell

**Files:**
- Create: `src/components/TabBar.tsx`
- Modify: `app/_layout.tsx` (replace template content)
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/suivi/_layout.tsx`
- Create: `app/(tabs)/suivi/index.tsx` (temporary placeholder body — Task 11 replaces it)
- Create: `app/(tabs)/suivi/team/[id].tsx`
- Create: `app/(tabs)/classement/_layout.tsx`
- Create: `app/(tabs)/classement/index.tsx` (temporary placeholder body — Task 12 replaces it)
- Create: `app/(tabs)/classement/team/[id].tsx`
- Create: `app/(tabs)/pronos/index.tsx`
- Create: `app/(tabs)/moi/index.tsx` (temporary placeholder body — Task 15 replaces it)
- Create: `app/match/[id].tsx` (temporary placeholder body — Task 14 replaces it)
- Create: `app/boutique/index.tsx`
- Delete: the template's original `app/(tabs)` files and any template example screens it replaces
- Test: none (navigation wiring; verified by manual boot + tap-through, since Expo Router screens need a running app to exercise realistically)

**Interfaces:**
- Consumes: nothing from `src/screens` yet (those don't exist until Tasks 11–15 — this task points `suivi/index.tsx`, `classement/index.tsx`, `moi/index.tsx`, and `match/[id].tsx` at temporary `PlaceholderScreen`s that the later tasks swap for the real screens).
- Produces: the full route tree described in the spec §6 — the shape every later screen task's route file plugs into.

- [ ] **Step 1: Remove the template's default tab screens**

Delete whatever the scaffold generated under `app/(tabs)/` (typically `index.tsx` and `explore.tsx`) and any now-unused template components it imports (e.g. a template `HelloWave`, `ParallaxScrollView` if unused elsewhere) — check `app/(tabs)/` and `components/` from the scaffold and remove what nothing else references.

- [ ] **Step 2: Write `src/components/TabBar.tsx`**

```tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ThemedText } from './ThemedText';
import { fr } from '../i18n/fr';

const LABELS: Record<string, string> = {
  suivi: fr.tabs.suivi,
  classement: fr.tabs.classement,
  pronos: fr.tabs.pronos,
  moi: fr.tabs.moi,
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View className="flex-row bg-header dark:bg-headerDark border-t border-hairline dark:border-hairlineDark px-2 pt-2.5 pb-7">
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            onPress={() => navigation.navigate(route.name)}
            className="flex-1 items-center gap-1.5"
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
          >
            <View
              className={`w-5 h-5 rounded-md ${
                focused ? 'bg-accent dark:bg-accentDark' : 'bg-border dark:bg-borderDark'
              }`}
            />
            <ThemedText
              weight={focused ? 'semibold' : 'medium'}
              size={10}
              tone={focused ? 'accent' : 'muted'}
              className="uppercase tracking-wide"
            >
              {LABELS[route.name] ?? route.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 3: Write `app/_layout.tsx`**

```tsx
import '../global.css';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import {
  useFonts,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import * as SplashScreen from 'expo-splash-screen';
import { useThemeSync } from '@/src/theme/useThemeSync';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useThemeSync();
  const [fontsLoaded] = useFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="match/[id]" />
      <Stack.Screen name="boutique/index" />
    </Stack>
  );
}
```

- [ ] **Step 4: Install the font package and the fonts/splash deps**

```bash
npm install @expo-google-fonts/ibm-plex-mono expo-font expo-splash-screen expo-linking
```

- [ ] **Step 5: Write `app/(tabs)/_layout.tsx`**

```tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '@/src/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="suivi" />
      <Tabs.Screen name="classement" />
      <Tabs.Screen name="pronos" />
      <Tabs.Screen name="moi" />
    </Tabs>
  );
}
```

- [ ] **Step 6: Write the Suivi tab's stack**

`app/(tabs)/suivi/_layout.tsx`:

```tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function SuiviLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="team/[id]" />
    </Stack>
  );
}
```

`app/(tabs)/suivi/index.tsx` (temporary — Task 11 replaces the body):

```tsx
import React from 'react';
import { PlaceholderScreen } from '@/src/components/PlaceholderScreen';
import { fr } from '@/src/i18n/fr';

export default function SuiviRoute() {
  return <PlaceholderScreen title={fr.tabs.suivi} note="En construction." />;
}
```

`app/(tabs)/suivi/team/[id].tsx`:

```tsx
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TeamScreen } from '@/src/screens/TeamScreen';

export default function SuiviTeamRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TeamScreen id={id} />;
}
```

This imports `TeamScreen`, which doesn't exist until Task 13 — expected; this task's manual boot check (Step 11) only exercises `suivi/index` and `classement/index`, not the `team/[id]` routes yet.

- [ ] **Step 7: Write the Classement tab's stack**

`app/(tabs)/classement/_layout.tsx`:

```tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function ClassementLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="team/[id]" />
    </Stack>
  );
}
```

`app/(tabs)/classement/index.tsx` (temporary — Task 12 replaces the body):

```tsx
import React from 'react';
import { PlaceholderScreen } from '@/src/components/PlaceholderScreen';
import { fr } from '@/src/i18n/fr';

export default function ClassementRoute() {
  return <PlaceholderScreen title={fr.tabs.classement} note="En construction." />;
}
```

`app/(tabs)/classement/team/[id].tsx`:

```tsx
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TeamScreen } from '@/src/screens/TeamScreen';

export default function ClassementTeamRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TeamScreen id={id} />;
}
```

- [ ] **Step 8: Write the Pronos and Moi tab routes**

`app/(tabs)/pronos/index.tsx`:

```tsx
import React from 'react';
import { PlaceholderScreen } from '@/src/components/PlaceholderScreen';
import { fr } from '@/src/i18n/fr';

export default function PronosRoute() {
  return <PlaceholderScreen title={fr.tabs.pronos} note={fr.placeholders.pronosNote} />;
}
```

`app/(tabs)/moi/index.tsx` (temporary — Task 15 replaces the body):

```tsx
import React from 'react';
import { PlaceholderScreen } from '@/src/components/PlaceholderScreen';
import { fr } from '@/src/i18n/fr';

export default function MoiRoute() {
  return <PlaceholderScreen title={fr.tabs.moi} note="En construction." />;
}
```

- [ ] **Step 9: Write the root-level Match and Boutique routes**

`app/match/[id].tsx` (temporary — Task 14 replaces the body):

```tsx
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/src/components/PlaceholderScreen';

export default function MatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceholderScreen title={`Match ${id}`} note="En construction." />;
}
```

`app/boutique/index.tsx`:

```tsx
import React from 'react';
import { PlaceholderScreen } from '@/src/components/PlaceholderScreen';
import { fr } from '@/src/i18n/fr';

export default function BoutiqueRoute() {
  return <PlaceholderScreen title="Boutique" note={fr.placeholders.boutiqueNote} />;
}
```

- [ ] **Step 10: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors only for `@/src/screens/TeamScreen` (not created until Task 13) — every other import should resolve. That's expected at this point in the plan.

- [ ] **Step 11: Boot and manually verify the shell**

```bash
npx expo start
```

Press `i`. Confirm: four tabs render (Suivi, Classement, Pronos, Moi) each showing its placeholder; tapping each tab switches the active icon/label to accent; Pronos and Boutique show their real placeholder copy.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: navigation shell — tabs, team sub-stacks, match/boutique routes"
```

---

### Task 11: Suivi screen

**Files:**
- Create: `src/screens/SuiviScreen.tsx`
- Modify: `app/(tabs)/suivi/index.tsx` (point at the real screen)
- Test: `src/screens/SuiviScreen.test.tsx`

**Interfaces:**
- Consumes: `Screen`, `HeaderCard`, `Card`/`CardRow`, `SectionLabel`, `SlotChip`, `ThemedText`, `Skeleton`, `ErrorState` (Task 8/9); `useAsync` (Task 7); `useAppStore` (Task 4); `getMyFixtures` (Task 7); `injectShopRows` (Task 5); `teams` (Task 6); `fr` (Task 2).
- Produces: `SuiviScreen()` — a component with no props, reading followed teams from the store.

- [ ] **Step 1: Write the failing test — `src/screens/SuiviScreen.test.tsx`**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SuiviScreen } from './SuiviScreen';
import * as matchesService from '../services/matches';
import { useAppStore } from '../store/useAppStore';
import type { FixtureRow, FixtureSlotTone } from '../types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function fixtureRow(id: string, tone: FixtureSlotTone = 'score'): FixtureRow {
  return {
    matchId: id,
    when: 'Dim. 14',
    match: `Match ${id}`,
    sub: 'J4 · domicile · 15:00',
    slot: { text: tone === 'score' ? '3–1' : 'en cours', tone },
    target: { kind: 'match', id },
  };
}

beforeEach(() => {
  mockPush.mockClear();
  useAppStore.setState({
    follows: { 'fc-vallonnais': { notifyLevel: 'full' } },
    mvpVotes: {},
    themeMode: 'system',
  });
});

test('renders a shop-suggestion row after the 5th fixture', async () => {
  const rows = Array.from({ length: 6 }, (_, i) => fixtureRow(`m${i + 1}`));
  jest.spyOn(matchesService, 'getMyFixtures').mockResolvedValue(rows);

  render(<SuiviScreen />);

  await waitFor(() => expect(screen.getByText('Match m6')).toBeTruthy());
  expect(screen.getByText('Boutique de la ligue · floquage offert')).toBeTruthy();
});

test('tapping a played fixture row navigates to its match page', async () => {
  jest.spyOn(matchesService, 'getMyFixtures').mockResolvedValue([fixtureRow('m1')]);

  render(<SuiviScreen />);

  await waitFor(() => expect(screen.getByText('Match m1')).toBeTruthy());
  fireEvent.press(screen.getByText('Match m1'));
  expect(mockPush).toHaveBeenCalledWith('/match/m1');
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npm test -- SuiviScreen
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/screens/SuiviScreen.tsx`**

```tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { SlotChip } from '../components/SlotChip';
import { ThemedText } from '../components/ThemedText';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useAppStore } from '../store/useAppStore';
import { getMyFixtures } from '../services/matches';
import { injectShopRows } from '../logic/injectShopRows';
import { teams } from '../data/teams';
import { fr } from '../i18n/fr';
import type { FixtureTarget } from '../types';

export function SuiviScreen() {
  const router = useRouter();
  const followedTeamIds = useAppStore((s) => s.followedTeamIds());
  const { data: fixtures, loading, error, reload } = useAsync(
    () => getMyFixtures(followedTeamIds),
    [followedTeamIds.join(',')]
  );

  const followedNames = followedTeamIds
    .map((id) => teams.find((t) => t.id === id)?.name ?? id)
    .join(' · ')
    .toUpperCase();

  const items = fixtures ? injectShopRows(fixtures) : [];

  function goToFixture(target: FixtureTarget) {
    router.push(target.kind === 'match' ? `/match/${target.id}` : `/suivi/team/${target.id}`);
  }

  return (
    <Screen>
      <HeaderCard>
        <View className="flex-row items-end justify-between">
          <View>
            <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide">
              {followedNames || fr.suivi.calendarLabel.toUpperCase()}
            </ThemedText>
            <ThemedText weight="semibold" size={24} className="mt-1.5">{fr.suivi.title}</ThemedText>
          </View>
          <ThemedText tone="accent" weight="medium" size={12.5} onPress={() => router.push('/moi')}>
            {fr.suivi.manage}
          </ThemedText>
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-2.5 pb-6">
        {loading && <Skeleton rows={5} />}
        {error && <ErrorState message={fr.suivi.error} onRetry={reload} />}

        {fixtures && (
          <>
            <SectionLabel>{fr.suivi.calendarLabel}</SectionLabel>

            {items.length === 0 ? (
              <View className="py-6 gap-1">
                <ThemedText tone="muted" size={13.5}>{fr.suivi.empty}</ThemedText>
                <ThemedText tone="faint" size={12}>{fr.suivi.emptyHint}</ThemedText>
              </View>
            ) : (
              <Card>
                {items.map((item, index) =>
                  item.kind === 'fixture' ? (
                    <Pressable key={item.row.matchId} onPress={() => goToFixture(item.row.target)}>
                      <CardRow isFirst={index === 0}>
                        <View style={{ width: 52 }}>
                          <ThemedText tone="muted" weight="medium" size={11.5}>{item.row.when}</ThemedText>
                        </View>
                        <View className="flex-1">
                          <ThemedText weight="medium" size={14.5}>{item.row.match}</ThemedText>
                          <ThemedText tone="muted" size={11.5} className="mt-0.5">{item.row.sub}</ThemedText>
                        </View>
                        <SlotChip text={item.row.slot.text} tone={item.row.slot.tone} />
                      </CardRow>
                    </Pressable>
                  ) : (
                    <CardRow key={`shop-${index}`} isFirst={index === 0}>
                      <View style={{ width: 52, height: 40 }} className="rounded-lg bg-field dark:bg-fieldDark" />
                      <View className="flex-1">
                        <ThemedText weight="medium" size={13.5}>{fr.suivi.shopItemName}</ThemedText>
                        <ThemedText tone="muted" size={11.5} className="mt-0.5">{fr.suivi.shopItemNote}</ThemedText>
                      </View>
                      <ThemedText
                        tone="accent"
                        weight="semibold"
                        size={12.5}
                        onPress={() => router.push('/boutique')}
                      >
                        {fr.suivi.shopCta}
                      </ThemedText>
                    </CardRow>
                  )
                )}
              </Card>
            )}

            <ThemedText tone="muted" size={11.5} className="leading-5">
              {fr.suivi.footerNote}
            </ThemedText>
          </>
        )}
      </View>
    </Screen>
  );
}
```

- [ ] **Step 4: Run to see it pass**

```bash
npm test -- SuiviScreen
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Point the route at the real screen — `app/(tabs)/suivi/index.tsx`**

```tsx
import { SuiviScreen } from '@/src/screens/SuiviScreen';

export default SuiviScreen;
```

- [ ] **Step 6: Boot and manually verify**

```bash
npx expo start
```

Press `i`, open the Suivi tab. Confirm: header shows "FC VALLONNAIS · AS RIVERAIN" (the two default follows from Task 4), the calendar card lists all 8 fixture rows for both teams merged chronologically with the correct right-column content (scores for played matches, "en cours" for the live AS Riverain J4 match, an odds percentage for the upcoming FC Vallonnais J4 match), a shop-suggestion row appears after the 5th row, and tapping a played row opens its Match placeholder (`/match/m-j3-vallonnais`, still a placeholder until Task 14).

- [ ] **Step 7: Commit**

```bash
git add src/screens/SuiviScreen.tsx src/screens/SuiviScreen.test.tsx app/\(tabs\)/suivi/index.tsx
git commit -m "feat: Suivi screen"
```

---

### Task 12: Classement screen

**Files:**
- Create: `src/screens/ClassementScreen.tsx`
- Modify: `app/(tabs)/classement/index.tsx` (point at the real screen)
- Test: `src/screens/ClassementScreen.test.tsx`

**Interfaces:**
- Consumes: `Screen`, `HeaderCard`, `Card`/`CardRow`, `SectionLabel`, `SegmentedTabs`, `ThemedText`, `Crest`, `Skeleton`, `ErrorState` (Task 8/9); `useAsync` (Task 7); `useAppStore` (Task 4); `getStandings`/`getTopScorers`/`getTopAssists`/`getMvpRanking` (Task 7); `fr` (Task 2).
- Produces: `ClassementScreen()`.

- [ ] **Step 1: Write the failing test — `src/screens/ClassementScreen.test.tsx`**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ClassementScreen } from './ClassementScreen';
import * as standingsService from '../services/standings';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

beforeEach(() => {
  jest.spyOn(standingsService, 'getStandings').mockResolvedValue([
    { rank: 1, teamId: 't1', teamName: 'US Coteaux', played: 3, goalDiff: 6, points: 9, zone: 'promotion', followed: false },
  ]);
  jest.spyOn(standingsService, 'getTopScorers').mockResolvedValue([
    { rank: 1, playerId: 'p1', name: 'Malik Diarra', teamName: 'FC Vallonnais', value: 5, unit: 'buts' },
  ]);
  jest.spyOn(standingsService, 'getTopAssists').mockResolvedValue([]);
  jest.spyOn(standingsService, 'getMvpRanking').mockResolvedValue([]);
});

test('shows the standings table by default', async () => {
  render(<ClassementScreen />);
  await waitFor(() => expect(screen.getByText('US Coteaux')).toBeTruthy());
});

test('switching to the Buteurs tab shows the scorers list', async () => {
  render(<ClassementScreen />);
  await waitFor(() => expect(screen.getByText('US Coteaux')).toBeTruthy());

  fireEvent.press(screen.getByTestId('segmented-tab-Buteurs'));

  await waitFor(() => expect(screen.getByText('Malik Diarra')).toBeTruthy());
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npm test -- ClassementScreen
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/screens/ClassementScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { ThemedText } from '../components/ThemedText';
import { Crest } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useAppStore } from '../store/useAppStore';
import { getStandings, getTopScorers, getTopAssists, getMvpRanking } from '../services/standings';
import { fr } from '../i18n/fr';
import type { PeopleRow } from '../types';

export function ClassementScreen() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const followedTeamIds = useAppStore((s) => s.followedTeamIds());

  const standings = useAsync(() => getStandings(followedTeamIds), [followedTeamIds.join(',')]);
  const scorers = useAsync(() => getTopScorers(), []);
  const assists = useAsync(() => getTopAssists(), []);
  const mvp = useAsync(() => getMvpRanking(), []);

  const peopleByTab: Record<number, ReturnType<typeof useAsync<PeopleRow[]>>> = {
    1: scorers,
    2: assists,
    3: mvp,
  };
  const peopleTitleByTab: Record<number, string> = {
    1: fr.classement.peopleTitle.scorers,
    2: fr.classement.peopleTitle.assists,
    3: fr.classement.peopleTitle.mvp,
  };
  const peopleFooterByTab: Record<number, string> = {
    1: fr.classement.peopleFooter.scorers,
    2: fr.classement.peopleFooter.assists,
    3: fr.classement.peopleFooter.mvp,
  };

  const current = tab === 0 ? standings : peopleByTab[tab];

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-3.5">
          <View>
            <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide">
              {fr.classement.overline}
            </ThemedText>
            <ThemedText weight="semibold" size={24} className="mt-1.5">{fr.classement.title}</ThemedText>
          </View>
          <SegmentedTabs options={fr.classement.tabs} value={tab} onChange={setTab} />
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-3.5 pb-6">
        {current.loading && <Skeleton rows={8} />}
        {current.error && <ErrorState message={fr.classement.error} onRetry={current.reload} />}

        {tab === 0 && standings.data && (
          <>
            <View className="flex-row items-center gap-3 px-1">
              <ThemedText tone="faint" mono size={10.5} style={{ width: 20 }}>
                {fr.classement.columnHeaders.rank}
              </ThemedText>
              <ThemedText tone="faint" mono size={10.5} className="flex-1">
                {fr.classement.columnHeaders.team}
              </ThemedText>
              <View style={{ width: 112 }} className="flex-row justify-between">
                <ThemedText tone="faint" mono size={10.5}>{fr.classement.columnHeaders.played}</ThemedText>
                <ThemedText tone="faint" mono size={10.5}>{fr.classement.columnHeaders.diff}</ThemedText>
                <ThemedText tone="faint" mono size={10.5}>{fr.classement.columnHeaders.pts}</ThemedText>
              </View>
            </View>
            <Card>
              {standings.data.map((row, i) => (
                <Pressable key={row.teamId} onPress={() => router.push(`/classement/team/${row.teamId}`)}>
                  <CardRow isFirst={i === 0}>
                    <ThemedText
                      mono
                      weight="semibold"
                      size={14}
                      style={{ width: 20 }}
                      className={
                        row.zone === 'promotion'
                          ? 'text-accent dark:text-accentDark'
                          : row.zone === 'playoff'
                          ? 'text-warn dark:text-warnDark'
                          : row.zone === 'relegation'
                          ? 'text-neg dark:text-negDark'
                          : undefined
                      }
                    >
                      {row.rank}
                    </ThemedText>
                    <Crest size={26} />
                    <ThemedText weight="medium" size={14.5} className="flex-1">{row.teamName}</ThemedText>
                    <View style={{ width: 112 }} className="flex-row justify-between">
                      <ThemedText tone="muted" weight="medium" size={13.5}>{row.played}</ThemedText>
                      <ThemedText tone="muted" weight="medium" size={13.5}>{row.goalDiff}</ThemedText>
                      <ThemedText weight="semibold" size={13.5}>{row.points}</ThemedText>
                    </View>
                  </CardRow>
                </Pressable>
              ))}
            </Card>
            <ThemedText tone="muted" size={11.5} className="px-1">{fr.classement.standingsFooter}</ThemedText>
          </>
        )}

        {tab > 0 && current.data && (
          <>
            <SectionLabel>{peopleTitleByTab[tab]}</SectionLabel>
            <Card>
              {(current.data as PeopleRow[]).map((row, i) => (
                <CardRow key={row.playerId} isFirst={i === 0}>
                  <ThemedText mono weight="semibold" size={14} tone="faint" style={{ width: 20 }}>
                    {row.rank}
                  </ThemedText>
                  <Crest size={34} />
                  <View className="flex-1">
                    <ThemedText weight="medium" size={14.5}>{row.name}</ThemedText>
                    <ThemedText tone="muted" size={11.5} className="mt-0.5">{row.teamName}</ThemedText>
                  </View>
                  <View className="items-end">
                    <ThemedText mono weight="semibold" size={17}>{row.value}</ThemedText>
                    <ThemedText tone="faint" mono size={10.5} className="mt-0.5">{row.unit}</ThemedText>
                  </View>
                </CardRow>
              ))}
            </Card>
            <ThemedText tone="muted" size={11.5} className="px-1">{peopleFooterByTab[tab]}</ThemedText>
          </>
        )}
      </View>
    </Screen>
  );
}
```

- [ ] **Step 4: Run to see it pass**

```bash
npm test -- ClassementScreen
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Point the route at the real screen — `app/(tabs)/classement/index.tsx`**

```tsx
import { ClassementScreen } from '@/src/screens/ClassementScreen';

export default ClassementScreen;
```

- [ ] **Step 6: Boot and manually verify**

Confirm: Général tab shows all 10 teams ranked, rank 1 accent-colored, ranks 9–10 red; switching to Buteurs/Passeurs/MVP swaps to the people list with the right title/footer; tapping a standings row opens the Team placeholder (real until Task 13 lands) at `/classement/team/{id}`.

- [ ] **Step 7: Commit**

```bash
git add src/screens/ClassementScreen.tsx src/screens/ClassementScreen.test.tsx app/\(tabs\)/classement/index.tsx
git commit -m "feat: Classement screen"
```

---

### Task 13: Team screen

**Files:**
- Create: `src/screens/TeamScreen.tsx`
- Test: `src/screens/TeamScreen.test.tsx`

**Interfaces:**
- Consumes: `Screen`, `HeaderCard`, `BackLink`, `Card`/`CardRow`, `SectionLabel`, `ThemedText`, `FormChips`, `OddsBar`, `Crest`/`Avatar`, `Skeleton`, `ErrorState` (Task 8/9); `useAsync` (Task 7); `useAppStore` (Task 4); `getTeam` (Task 7); `fr` (Task 2).
- Produces: `TeamScreen({ id }: { id: string })`. Already consumed by `app/(tabs)/suivi/team/[id].tsx` and `app/(tabs)/classement/team/[id].tsx` (Task 10).

- [ ] **Step 1: Write the failing test — `src/screens/TeamScreen.test.tsx`**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TeamScreen } from './TeamScreen';
import * as teamsService from '../services/teams';
import { useAppStore } from '../store/useAppStore';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

const mockTeamDetail = {
  team: {
    id: 'fc-vallonnais',
    name: 'FC Vallonnais',
    shortName: 'Vallonnais',
    crestColor: '#000',
    rank: 2,
    points: 7,
    played: 3,
    goalDiff: 3,
    stadium: 'Stade des Marnes',
    form: ['V', 'V', 'N', 'D', 'V'] as const,
    squadCount: 18,
  },
  nextMatch: null,
  lastResults: [],
  squad: [],
};

beforeEach(() => {
  useAppStore.setState({ follows: {}, mvpVotes: {}, themeMode: 'system' });
  jest.spyOn(teamsService, 'getTeam').mockResolvedValue(mockTeamDetail);
});

test('toggling Follow updates the button label and the store', async () => {
  render(<TeamScreen id="fc-vallonnais" />);
  await waitFor(() => expect(screen.getByText('Suivre')).toBeTruthy());

  fireEvent.press(screen.getByText('Suivre'));

  expect(useAppStore.getState().isFollowing('fc-vallonnais')).toBe(true);
  await waitFor(() => expect(screen.getByText('Suivi ✓')).toBeTruthy());
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npm test -- TeamScreen
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/screens/TeamScreen.tsx`**

```tsx
import React from 'react';
import { Pressable, Share, View } from 'react-native';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { BackLink } from '../components/BackLink';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { ThemedText } from '../components/ThemedText';
import { FormChips } from '../components/FormChips';
import { OddsBar } from '../components/OddsBar';
import { Avatar, Crest } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useAppStore } from '../store/useAppStore';
import { getTeam } from '../services/teams';
import { fr } from '../i18n/fr';

export function TeamScreen({ id }: { id: string }) {
  const isFollowing = useAppStore((s) => s.isFollowing(id));
  const toggleFollow = useAppStore((s) => s.toggleFollow);
  const { data, loading, error, reload } = useAsync(() => getTeam(id), [id]);

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <BackLink label={fr.team.back} />
            <View className="w-[26px] h-[26px] rounded-full bg-field dark:bg-fieldDark" />
          </View>

          {data && (
            <>
              <View className="flex-row items-center gap-3.5">
                <Crest size={56} />
                <View className="flex-1">
                  <ThemedText weight="semibold" size={24}>{data.team.name}</ThemedText>
                  <ThemedText tone="muted" size={13.5} className="mt-1">
                    {data.team.rank}ᵉ · {data.team.points} pts · {data.team.stadium}
                  </ThemedText>
                </View>
              </View>

              <View className="flex-row items-center gap-2.5">
                <Pressable
                  onPress={() => toggleFollow(id)}
                  className={`h-10 px-4 rounded-xl items-center justify-center ${
                    isFollowing ? 'bg-accent dark:bg-accentDark' : 'border border-border dark:border-borderDark'
                  }`}
                >
                  <ThemedText weight="medium" size={14} style={isFollowing ? { color: '#fff' } : undefined}>
                    {isFollowing ? fr.team.following : fr.team.follow}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => Share.share({ message: data.team.name })}
                  className="h-10 px-4 rounded-xl border border-border dark:border-borderDark items-center justify-center"
                >
                  <ThemedText weight="medium" size={14}>{fr.team.share}</ThemedText>
                </Pressable>
              </View>

              <ThemedText tone="muted" size={12}>
                {isFollowing ? fr.team.followHintOn : fr.team.followHintOff}
              </ThemedText>

              <View className="flex-row items-center gap-1.5">
                <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide mr-1">
                  {fr.team.form}
                </ThemedText>
                <FormChips form={data.team.form} />
              </View>
            </>
          )}
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-5 pb-6">
        {loading && <Skeleton rows={4} />}
        {error && <ErrorState message={fr.team.error} onRetry={reload} />}

        {data && (
          <>
            {data.nextMatch && (
              <Card>
                <View className="p-4 gap-3">
                  <View className="flex-row items-center justify-between">
                    <SectionLabel>{fr.team.nextMatch}</SectionLabel>
                    <ThemedText tone="accent" mono weight="semibold" size={12.5}>
                      {new Date(data.nextMatch.kickoff).toLocaleDateString('fr-FR')}
                    </ThemedText>
                  </View>
                  <ThemedText weight="semibold" size={17}>
                    {data.nextMatch.opponentName}{' '}
                    <ThemedText tone="muted" size={17}>
                      — {data.nextMatch.venueTag === 'dom.' ? fr.team.home : fr.team.away}
                    </ThemedText>
                  </ThemedText>
                  {data.nextMatch.odds && <OddsBar {...data.nextMatch.odds} />}
                  <ThemedText tone="muted" size={12}>{fr.team.oddsNote}</ThemedText>
                </View>
              </Card>
            )}

            {data.lastResults.length > 0 && (
              <View className="gap-2.5">
                <SectionLabel>{fr.team.lastResults}</SectionLabel>
                <Card>
                  {data.lastResults.map((r, i) => (
                    <CardRow key={r.matchId} isFirst={i === 0}>
                      <View
                        className={`w-5 h-5 rounded-md items-center justify-center ${
                          r.result === 'V'
                            ? 'bg-accent dark:bg-accentDark'
                            : r.result === 'D'
                            ? 'bg-negBg dark:bg-negBgDark'
                            : 'bg-field dark:bg-fieldDark'
                        }`}
                      >
                        <ThemedText weight="semibold" size={11} style={r.result === 'V' ? { color: '#fff' } : undefined}>
                          {r.result}
                        </ThemedText>
                      </View>
                      <ThemedText weight="medium" size={14.5} className="flex-1">
                        {r.opponent} <ThemedText tone="muted" size={14.5}>{r.venueTag}</ThemedText>
                      </ThemedText>
                      <ThemedText mono weight="semibold" size={15}>{r.score}</ThemedText>
                    </CardRow>
                  ))}
                </Card>
              </View>
            )}

            {data.squad.length > 0 && (
              <View className="gap-2.5">
                <View className="flex-row items-baseline justify-between">
                  <SectionLabel>{fr.team.squad(data.team.squadCount)}</SectionLabel>
                  <ThemedText tone="faint" mono weight="medium" size={10.5}>{fr.team.squadLegend}</ThemedText>
                </View>
                <Card>
                  {data.squad.map((p, i) => (
                    <CardRow key={p.id} isFirst={i === 0}>
                      <ThemedText mono weight="semibold" size={14} tone="faint" style={{ width: 30 }}>
                        {p.number}
                      </ThemedText>
                      <Avatar size={32} />
                      <View className="flex-1">
                        <ThemedText weight="medium" size={14.5}>{p.name}</ThemedText>
                        <ThemedText tone="muted" size={11.5} className="mt-0.5">{p.position}</ThemedText>
                      </View>
                      <ThemedText tone="muted" weight="medium" size={13.5}>
                        {p.matchesPlayed} · {p.goals} · {p.assists}
                      </ThemedText>
                    </CardRow>
                  ))}
                  <CardRow>
                    <ThemedText tone="accent" weight="medium" size={13.5}>{fr.team.seeFullSquad}</ThemedText>
                  </CardRow>
                </Card>
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
```

- [ ] **Step 4: Run to see it pass**

```bash
npm test -- TeamScreen
```

Expected: PASS, 1 test.

- [ ] **Step 5: Type-check the whole project**

```bash
npx tsc --noEmit
```

Expected: no errors now that `TeamScreen` exists (Task 10's routes resolve).

- [ ] **Step 6: Boot and manually verify**

Open a team from Classement. Confirm: crest/name/rank header, Follow toggles between "Suivre" and "Suivi ✓" and immediately reflects in Suivi's header/list on switching tabs, next-match odds bar renders with the winning side highlighted, last results and squad preview render, "Voir l'effectif complet" is present but inert.

- [ ] **Step 7: Commit**

```bash
git add src/screens/TeamScreen.tsx src/screens/TeamScreen.test.tsx
git commit -m "feat: Team screen"
```

---

### Task 14: Match screen

**Files:**
- Create: `src/screens/MatchScreen.tsx`
- Modify: `app/match/[id].tsx` (point at the real screen)
- Test: `src/screens/MatchScreen.test.tsx`

**Interfaces:**
- Consumes: `Screen`, `HeaderCard`, `BackLink`, `Card`/`CardRow`, `SectionLabel`, `ThemedText`, `Crest`, `Skeleton`, `ErrorState` (Task 8/9); `useAsync` (Task 7); `useAppStore` (Task 4); `getMatch` (Task 7); `teams`, `players` (Task 6); `fr` (Task 2).
- Produces: `MatchScreen({ id }: { id: string })`. Already consumed by `app/match/[id].tsx` (Task 10).

- [ ] **Step 1: Write the failing test — `src/screens/MatchScreen.test.tsx`**

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { MatchScreen } from './MatchScreen';
import * as matchesService from '../services/matches';
import { useAppStore } from '../store/useAppStore';
import { fr } from '../i18n/fr';
import type { Match } from '../types';

jest.mock('expo-router', () => ({}));

const mockMatch: Match = {
  id: 'm-j3-vallonnais',
  matchday: 3,
  homeTeamId: 'fc-vallonnais',
  awayTeamId: 'etoile-de-mornay',
  kickoff: '2026-09-07T15:00:00Z',
  venue: 'Stade des Marnes, terrain 2',
  status: 'played',
  homeScore: 3,
  awayScore: 1,
  referee: 'L. Fabre',
  spectators: 140,
  videoUrl: 'https://example.com/video',
  videoDuration: '8:42',
  events: [
    { minute: 12, type: 'goal', playerName: 'Malik Diarra', detail: 'Passe de T. Rasolo', score: '1–0' },
  ],
  mvp: { playerId: 'fc-vallonnais-p4', votePercent: 61, voteCount: 214 },
};

beforeEach(() => {
  useAppStore.setState({ follows: {}, mvpVotes: {}, themeMode: 'system' });
  jest.spyOn(matchesService, 'getMatch').mockResolvedValue(mockMatch);
});

test('tapping the MVP vote button toggles the label and the vote count', async () => {
  render(<MatchScreen id="m-j3-vallonnais" />);

  await waitFor(() => expect(screen.getByText(fr.match.voteCta)).toBeTruthy());
  expect(screen.getByText(fr.match.votes(214))).toBeTruthy();

  fireEvent.press(screen.getByTestId('mvp-vote-button'));

  await waitFor(() => expect(screen.getByText(fr.match.votedCta)).toBeTruthy());
  expect(screen.getByText(fr.match.votes(215))).toBeTruthy();
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npm test -- MatchScreen
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/screens/MatchScreen.tsx`**

```tsx
import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { BackLink } from '../components/BackLink';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { ThemedText } from '../components/ThemedText';
import { Crest } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useAsync } from '../hooks/useAsync';
import { useAppStore } from '../store/useAppStore';
import { getMatch } from '../services/matches';
import { teams } from '../data/teams';
import { players } from '../data/players';
import { fr } from '../i18n/fr';

export function MatchScreen({ id }: { id: string }) {
  const { data: match, loading, error, reload } = useAsync(() => getMatch(id), [id]);
  const hasVotedFor = useAppStore((s) => s.hasVotedFor);
  const toggleMvpVote = useAppStore((s) => s.toggleMvpVote);

  const homeTeam = match ? teams.find((t) => t.id === match.homeTeamId) : undefined;
  const awayTeam = match ? teams.find((t) => t.id === match.awayTeamId) : undefined;
  const mvpPlayer = match?.mvp ? players.find((p) => p.id === match.mvp!.playerId) : undefined;
  const voted = match?.mvp ? hasVotedFor(match.id, match.mvp.playerId) : false;
  const voteCount = match?.mvp ? match.mvp.voteCount + (voted ? 1 : 0) : 0;

  return (
    <Screen>
      <HeaderCard>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <BackLink label={`Journée ${match?.matchday ?? ''}`} />
            <View className="bg-field dark:bg-fieldDark rounded-md px-2 py-1">
              <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide">
                {fr.match.done}
              </ThemedText>
            </View>
          </View>

          {match && (
            <>
              <View className="flex-row items-center gap-2">
                <View className="flex-1 items-center gap-2">
                  <Crest size={46} />
                  <ThemedText weight="medium" size={13.5} className="text-center">{homeTeam?.name}</ThemedText>
                </View>
                <View className="flex-row items-center gap-2.5">
                  <ThemedText mono weight="semibold" size={40}>{match.homeScore}</ThemedText>
                  <ThemedText tone="faint" size={26}>–</ThemedText>
                  <ThemedText mono weight="semibold" size={40} tone="muted">{match.awayScore}</ThemedText>
                </View>
                <View className="flex-1 items-center gap-2">
                  <Crest size={46} />
                  <ThemedText weight="medium" size={13.5} tone="muted" className="text-center">
                    {awayTeam?.name}
                  </ThemedText>
                </View>
              </View>
              <ThemedText tone="muted" size={12.5} className="text-center">
                {new Date(match.kickoff).toLocaleDateString('fr-FR')} · {match.venue}
                {match.spectators ? ` · ${match.spectators} spectateurs` : ''}
              </ThemedText>
            </>
          )}
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-5 pb-6">
        {loading && <Skeleton rows={4} />}
        {error && <ErrorState message={fr.match.error} onRetry={reload} />}

        {match && (
          <>
            {match.videoUrl && (
              <Pressable onPress={() => Linking.openURL(match.videoUrl!)}>
                <Card>
                  <View className="h-[186px] bg-field dark:bg-fieldDark items-center justify-center">
                    <ThemedText tone="faint" size={11.5}>
                      résumé vidéo · {match.videoDuration}
                    </ThemedText>
                  </View>
                  <CardRow>
                    <ThemedText weight="medium" size={13.5} className="flex-1">{fr.match.videoLabel}</ThemedText>
                    <ThemedText tone="accent" weight="semibold" size={12.5}>{fr.match.videoOpen}</ThemedText>
                  </CardRow>
                </Card>
              </Pressable>
            )}

            {match.events && match.events.length > 0 && (
              <View className="gap-2.5">
                <SectionLabel>{fr.match.events}</SectionLabel>
                <Card>
                  {match.events.map((e, i) => (
                    <CardRow key={i} isFirst={i === 0}>
                      <ThemedText mono weight="medium" size={13} tone="muted" style={{ width: 34 }}>
                        {e.minute}'
                      </ThemedText>
                      <View className="w-5 h-5 rounded-[5px] bg-accent dark:bg-accentDark" />
                      <View className="flex-1">
                        <ThemedText weight="medium" size={14.5}>{e.playerName}</ThemedText>
                        <ThemedText tone="muted" size={11.5} className="mt-0.5">{e.detail}</ThemedText>
                      </View>
                      <ThemedText tone="muted" weight="medium" size={12.5}>{e.score}</ThemedText>
                    </CardRow>
                  ))}
                </Card>
              </View>
            )}

            {match.mvp && mvpPlayer && (
              <Card>
                <View className="p-4 gap-3.5">
                  <View className="flex-row items-center justify-between">
                    <SectionLabel>{fr.match.mvpTitle}</SectionLabel>
                    <ThemedText tone="faint" size={11.5}>{fr.match.votes(voteCount)}</ThemedText>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <Crest size={48} />
                    <View className="flex-1">
                      <ThemedText weight="semibold" size={16}>{mvpPlayer.name}</ThemedText>
                      <ThemedText tone="muted" size={12.5} className="mt-0.5">
                        {mvpPlayer.position} · {match.mvp.votePercent}% des voix
                      </ThemedText>
                    </View>
                  </View>
                  <View className="h-2 rounded bg-field dark:bg-fieldDark overflow-hidden">
                    <View style={{ width: `${match.mvp.votePercent}%` }} className="h-2 bg-accent dark:bg-accentDark" />
                  </View>
                  <Pressable
                    testID="mvp-vote-button"
                    onPress={() => toggleMvpVote(match.id, match.mvp!.playerId)}
                    className={`h-11 rounded-xl items-center justify-center ${
                      voted ? 'bg-accent dark:bg-accentDark' : 'border border-border dark:border-borderDark'
                    }`}
                  >
                    <ThemedText weight="semibold" size={14} style={voted ? { color: '#fff' } : undefined}>
                      {voted ? fr.match.votedCta : fr.match.voteCta}
                    </ThemedText>
                  </Pressable>
                </View>
              </Card>
            )}

            <View className="gap-2.5">
              <SectionLabel>{fr.match.info}</SectionLabel>
              <Card>
                {(
                  [
                    match.referee ? [fr.match.infoKeys.referee, match.referee] : null,
                    [fr.match.infoKeys.venue, match.venue],
                    match.spectators ? [fr.match.infoKeys.spectators, String(match.spectators)] : null,
                    [fr.match.infoKeys.kickoff, new Date(match.kickoff).toLocaleString('fr-FR')],
                  ].filter((entry): entry is [string, string] => entry !== null)
                ).map(([k, v], i) => (
                  <CardRow key={k} isFirst={i === 0}>
                    <ThemedText tone="muted" size={12.5} style={{ width: 104 }}>{k}</ThemedText>
                    <ThemedText weight="medium" size={13.5} className="flex-1">{v}</ThemedText>
                  </CardRow>
                ))}
              </Card>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
```

- [ ] **Step 4: Run to see it pass**

```bash
npm test -- MatchScreen
```

Expected: PASS, 1 test.

- [ ] **Step 5: Point the route at the real screen — `app/match/[id].tsx`**

```tsx
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { MatchScreen } from '@/src/screens/MatchScreen';

export default function MatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MatchScreen id={id} />;
}
```

- [ ] **Step 6: Boot and manually verify**

From Suivi, tap the J3 FC Vallonnais row. Confirm: no tab bar on this screen, score header `3 – 1`, video card opens the browser on tap, match events list, MVP card with progress bar, vote button toggles label + count, back returns to Suivi with the tab bar restored.

- [ ] **Step 7: Commit**

```bash
git add src/screens/MatchScreen.tsx src/screens/MatchScreen.test.tsx app/match
git commit -m "feat: Match screen"
```

---

### Task 15: Moi screen (minimal, with theme toggle)

**Files:**
- Create: `src/screens/MoiScreen.tsx`
- Modify: `app/(tabs)/moi/index.tsx` (point at the real screen)
- Test: `src/screens/MoiScreen.test.tsx`

**Interfaces:**
- Consumes: `Screen`, `HeaderCard`, `Card`/`CardRow`, `SectionLabel`, `SegmentedTabs`, `ThemedText`, `Avatar` (Task 8/9); `useAppStore`, `ThemeMode` (Task 4); `profile` (Task 6); `fr` (Task 2).
- Produces: `MoiScreen()`. Already consumed by `app/(tabs)/moi/index.tsx` (Task 10).

- [ ] **Step 1: Write the failing test — `src/screens/MoiScreen.test.tsx`**

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MoiScreen } from './MoiScreen';
import { useAppStore } from '../store/useAppStore';

beforeEach(() => {
  useAppStore.setState({ themeMode: 'system', follows: { 'fc-vallonnais': { notifyLevel: 'full' } }, mvpVotes: {} });
});

test('renders the profile name and followed-team count', () => {
  render(<MoiScreen />);
  expect(screen.getByText('Julien Mercier')).toBeTruthy();
  expect(screen.getByText('1')).toBeTruthy();
});

test('tapping a theme segment updates the store', () => {
  render(<MoiScreen />);
  fireEvent.press(screen.getByTestId('segmented-tab-Sombre'));
  expect(useAppStore.getState().themeMode).toBe('dark');
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npm test -- MoiScreen
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/screens/MoiScreen.tsx`**

```tsx
import React from 'react';
import { View } from 'react-native';
import { Screen } from '../components/Screen';
import { HeaderCard } from '../components/HeaderCard';
import { Card, CardRow } from '../components/Card';
import { SectionLabel } from '../components/SectionLabel';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { ThemedText } from '../components/ThemedText';
import { Avatar } from '../components/Avatar';
import { useAppStore, type ThemeMode } from '../store/useAppStore';
import { profile } from '../data/profile';
import { fr } from '../i18n/fr';

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function MoiScreen() {
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const followedCount = useAppStore((s) => s.followedTeamIds().length);

  const accountRows = [
    { label: fr.moi.notifications, value: '' },
    { label: fr.moi.privacy, value: '' },
    { label: fr.moi.language, value: fr.moi.languageValue },
    { label: fr.moi.logout, value: '' },
  ];

  return (
    <Screen>
      <HeaderCard>
        <View className="flex-row items-center gap-3.5">
          <Avatar size={56} />
          <View className="flex-1">
            <ThemedText weight="semibold" size={20}>{profile.name}</ThemedText>
            <ThemedText tone="muted" size={12.5} className="mt-1">
              {fr.moi.since(profile.since)} · {profile.supporterOf}
            </ThemedText>
          </View>
          <ThemedText tone="accent" weight="medium" size={12.5}>{fr.moi.editCta}</ThemedText>
        </View>
      </HeaderCard>

      <View className="px-5 pt-4 gap-4.5 pb-6">
        <View className="flex-row gap-3">
          <Card>
            <View className="p-3.5">
              <ThemedText mono tone="accent" weight="semibold" size={20}>{profile.pronoPoints}</ThemedText>
              <ThemedText tone="muted" weight="medium" size={11} className="mt-1.5 uppercase tracking-wide">
                {fr.moi.pronoStat} · {profile.pronoRank}ᵉ
              </ThemedText>
            </View>
          </Card>
          <Card>
            <View className="p-3.5">
              <ThemedText mono weight="semibold" size={20}>{followedCount}</ThemedText>
              <ThemedText tone="muted" weight="medium" size={11} className="mt-1.5 uppercase tracking-wide">
                {fr.moi.teamsStat}
              </ThemedText>
            </View>
          </Card>
        </View>

        <View className="gap-2.5">
          <SectionLabel>{fr.moi.account}</SectionLabel>
          <Card>
            <CardRow isFirst>
              <ThemedText weight="medium" size={14.5} className="flex-1">{fr.moi.theme}</ThemedText>
              <SegmentedTabs
                options={fr.moi.themeOptions}
                value={THEME_MODES.indexOf(themeMode)}
                onChange={(index) => setThemeMode(THEME_MODES[index])}
              />
            </CardRow>
            {accountRows.map((row) => (
              <CardRow key={row.label}>
                <ThemedText weight="medium" size={14.5} className="flex-1">{row.label}</ThemedText>
                {row.value ? <ThemedText tone="muted" size={12.5}>{row.value}</ThemedText> : null}
                <ThemedText tone="faint" size={15}>›</ThemedText>
              </CardRow>
            ))}
          </Card>
        </View>
      </View>
    </Screen>
  );
}
```

- [ ] **Step 4: Run to see it pass**

```bash
npm test -- MoiScreen
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Point the route at the real screen — `app/(tabs)/moi/index.tsx`**

```tsx
import { MoiScreen } from '@/src/screens/MoiScreen';

export default MoiScreen;
```

- [ ] **Step 6: Boot and manually verify the theme toggle end-to-end**

Open Moi, tap "Sombre" in the Thème row. Confirm every screen (Suivi, Classement, Team, Match) flips to its dark palette immediately. Reload the app (stop and re-run `npx expo start`, reopen in the simulator) and confirm dark mode persisted. Tap "Système" and confirm it now tracks the simulator's OS appearance setting (Settings app → Developer/Display & Brightness toggle in the simulator).

- [ ] **Step 7: Commit**

```bash
git add src/screens/MoiScreen.tsx src/screens/MoiScreen.test.tsx app/\(tabs\)/moi/index.tsx
git commit -m "feat: Moi screen with theme toggle"
```

---

### Task 16: Full-suite verification and cleanup pass

**Files:**
- Modify: any file touched by the fixes this task's checks turn up (expected to be small — dead template leftovers, an unused import, a lint warning)
- Test: none new — this task runs everything written so far

**Interfaces:**
- Consumes/Produces: nothing new; this is the "done" bar for the slice.

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: PASS, all suites (Tasks 4, 5, 7, 8, 9, 11–15 — roughly 35+ tests).

- [ ] **Step 2: Type-check the whole project**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Remove any leftover scaffold template files**

Check for template artifacts Task 10 didn't already remove (default `components/`, `constants/`, `hooks/`, `scripts/reset-project.js` from the create-expo-app template, if still present and unused by this app). Delete anything not referenced by `app/` or `src/`.

```bash
git grep -l "ParallaxScrollView\|HelloWave" -- app src || echo "none referenced — safe to delete leftovers"
```

- [ ] **Step 4: Full manual walkthrough on the iOS Simulator**

```bash
npx expo start
```

Press `i`. Walk the whole slice in order:
1. Suivi shows FC Vallonnais's calendar; tap "Gérer" → lands on Moi.
2. Classement's four tabs all render; tap a standings row → Team page, tab bar still shows Classement active.
3. On Team, tap Follow → Suivi (switch tabs) now includes both teams' fixtures merged chronologically.
4. Tap a played fixture in Suivi → Match page, no tab bar; tap MVP vote → count and label update; back → returns to Suivi with the tab bar back.
5. Moi → theme toggle flips light/dark app-wide; stat cards show live counts.
6. Suivi's shop row (once ≥ 5 fixtures are visible for the followed teams) → Boutique placeholder; Pronos tab → Pronos placeholder.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verification pass — full suite green, template leftovers removed"
```
