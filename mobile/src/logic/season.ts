import type { Season } from '@/src/types';
import { parseApiDate } from './dateTime';

export function pickCurrentSeason(seasons: Season[], now: Date): Season | undefined {
  const active = seasons.find(
    (season) => parseApiDate(season.start_on) <= now && now <= parseApiDate(season.end_on)
  );
  return active ?? seasons[0];
}
