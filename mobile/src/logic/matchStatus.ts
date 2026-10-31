import type { ApiMatchStatus, MatchStatus } from '@/src/types';

export function toMatchStatus(status: ApiMatchStatus): MatchStatus {
  switch (status) {
    case 'live':
      return 'live';
    case 'finished':
      return 'played';
    case 'cancelled':
      return 'cancelled';
    case 'scheduled':
    case 'postponed':
      return 'upcoming';
  }
}
