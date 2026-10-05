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
  setThemeMode: (mode: ThemeMode) => void;
  toggleFollow: (teamId: string) => void;
  isFollowing: (teamId: string) => boolean;
  followedTeamIds: () => string[];
}

const STORE_VERSION = 2;

export function migrateAppState<T extends { follows: Record<string, FollowEntry> }>(
  persisted: unknown,
  version: number
): T {
  const state = persisted as T;
  return version < STORE_VERSION ? { ...state, follows: {} } : state;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      let cachedFollows: Record<string, FollowEntry> | null = null;
      let cachedIds: string[] = [];

      return {
        themeMode: 'system',
        follows: {},

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

        followedTeamIds: () => {
          const follows = get().follows;
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
        follows: state.follows,
      }),
    }
  )
);
