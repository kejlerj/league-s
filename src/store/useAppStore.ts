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
