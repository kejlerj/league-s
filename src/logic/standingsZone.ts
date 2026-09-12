import type { StandingsZone } from '../types';

export function computeStandingsZone(rank: number, teamCount: number): StandingsZone {
  if (rank === 1) return 'promotion';
  if (rank === 2) return 'playoff';
  if (rank >= teamCount - 1) return 'relegation';
  return 'none';
}
