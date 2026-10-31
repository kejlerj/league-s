import type { Season } from '@/src/types';
import { toLocalDateParam } from './dateTime';

export function pickCurrentSeason(seasons: Season[], now: Date): Season | undefined {
  const today = toLocalDateParam(now);
  const active = seasons.find((season) => season.start_on <= today && today <= season.end_on);
  return active ?? seasons[0];
}
