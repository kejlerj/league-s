import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';
export type NotifyLevel = 'full' | 'result';

interface FollowEntry {
  notifyLevel: NotifyLevel;
}

type Follows = Record<string, FollowEntry>;

interface PersistedState {
  themeMode: ThemeMode;
  leagueId: string | null;
  followsByLeague: Record<string, Follows>;
}

interface AppState extends PersistedState {
  setThemeMode: (mode: ThemeMode) => void;
  setLeague: (leagueId: string) => void;
  toggleFollow: (teamId: string) => void;
  isFollowing: (teamId: string) => boolean;
  followedTeamIds: () => string[];
}

const STORE_VERSION = 3;
const NO_FOLLOWS: Follows = {};

export function migrateAppState(persisted: unknown, version: number): PersistedState {
  const state = persisted as PersistedState;
  if (version >= STORE_VERSION) return state;
  return { themeMode: state.themeMode, leagueId: null, followsByLeague: {} };
}

function currentFollows(state: PersistedState): Follows {
  return state.leagueId ? state.followsByLeague[state.leagueId] ?? NO_FOLLOWS : NO_FOLLOWS;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      let cachedFollows: Follows | null = null;
      let cachedIds: string[] = [];

      return {
        themeMode: 'system',
        leagueId: null,
        followsByLeague: {},

        setThemeMode: (mode) => set({ themeMode: mode }),

        setLeague: (leagueId) => set({ leagueId }),

        toggleFollow: (teamId) =>
          set((state) => {
            if (!state.leagueId) return {};
            const next = { ...currentFollows(state) };
            if (next[teamId]) {
              delete next[teamId];
            } else {
              next[teamId] = { notifyLevel: 'full' };
            }
            return { followsByLeague: { ...state.followsByLeague, [state.leagueId]: next } };
          }),

        isFollowing: (teamId) => Boolean(currentFollows(get())[teamId]),

        followedTeamIds: () => {
          const follows = currentFollows(get());
          if (follows !== cachedFollows) {
            cachedFollows = follows;
            cachedIds = Object.keys(follows);
          }
          return cachedIds;
        },
      };
    },
    {
      name: 'ligue-amateur-app-store',
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted, version) => migrateAppState(persisted, version),
      partialize: (state) => ({
        themeMode: state.themeMode,
        leagueId: state.leagueId,
        followsByLeague: state.followsByLeague,
      }),
    }
  )
);
