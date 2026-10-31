import type { Season } from '../types';

type SeasonFields = Pick<Season, 'id' | 'league_id' | 'name' | 'start_on' | 'end_on'>;

export function season(fields: SeasonFields): Season {
  return {
    match_win_pts: 3,
    match_draw_pts: 1,
    match_loss_pts: 0,
    tie_breakers: ['goal_difference'],
    max_squad_size: null,
    ...fields,
  };
}
