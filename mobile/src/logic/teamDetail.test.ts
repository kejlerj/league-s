import { buildTeamDetail } from './teamDetail';
import type { ApiMatch, SquadRow, StandingRow } from '@/src/types';

function finished(matchday: number, home: string, away: string, homeScore: number, awayScore: number): ApiMatch {
  return {
    id: `m${matchday}-${home}-${away}`,
    season_id: 's',
    home_team: { id: home, name: home.toUpperCase(), logo: null },
    away_team: { id: away, name: away.toUpperCase(), logo: null },
    matchday,
    kickoff_at: '2026-10-01T15:00:00Z',
    status: 'finished',
    home_score: homeScore,
    away_score: awayScore,
    venue: null,
    referee: null,
    convocation_at: null,
    video_url: null,
  };
}

const standing: StandingRow = {
  rank: 2, team_id: 'us', team_name: 'US', team_logo: null, played: 5, won: 3, drawn: 1, lost: 1,
  goals_for: 10, goals_against: 6, goal_difference: 4, points: 10, fair_play_points: 0,
};

const squad: SquadRow[] = [];

test('form and last results use the team perspective, most recent first', () => {
  const matches = [
    finished(1, 'us', 'a', 2, 0),
    finished(2, 'b', 'us', 3, 1),
    finished(3, 'us', 'c', 1, 1),
    finished(4, 'd', 'us', 0, 2),
    finished(5, 'us', 'e', 0, 1),
  ];
  const detail = buildTeamDetail({ teamId: 'us', standings: [standing], finished: matches, scheduled: [], squad });

  expect(detail.form).toEqual(['V', 'D', 'N', 'V', 'D']);
  expect(detail.lastResults.map((line) => line.score)).toEqual(['0–1', '2–0', '1–1']);
  expect(detail.lastResults[0].opponentName).toBe('E');
});

test('the next match is the earliest scheduled one', () => {
  const later = { ...finished(7, 'us', 'x', 0, 0), status: 'scheduled' as const, home_score: null, away_score: null, kickoff_at: '2026-10-20T15:00:00Z' };
  const sooner = { ...finished(6, 'y', 'us', 0, 0), status: 'scheduled' as const, home_score: null, away_score: null, kickoff_at: '2026-10-10T15:00:00Z', venue: 'Le Five' };
  const detail = buildTeamDetail({ teamId: 'us', standings: [], finished: [], scheduled: [later, sooner], squad });

  expect(detail.nextMatch?.matchId).toBe(sooner.id);
  expect(detail.nextMatch?.isHome).toBe(false);
  expect(detail.nextMatch?.venue).toBe('Le Five');
});

test('standing is looked up by team id, or null when absent', () => {
  expect(buildTeamDetail({ teamId: 'us', standings: [standing], finished: [], scheduled: [], squad }).standing).toBe(standing);
  expect(buildTeamDetail({ teamId: 'zz', standings: [standing], finished: [], scheduled: [], squad }).standing).toBeNull();
});

test('the squad is listed by shirt number', () => {
  const rows: SquadRow[] = [3, 1, 2].map((number) => ({
    membership_id: `m${number}`, player_id: `p${number}`, firstname: 'A', lastname: 'B', icon: null, number, joined_on: '2026-08-29', left_on: null, goals: 0, assists: 0,
  }));
  const detail = buildTeamDetail({ teamId: 'us', standings: [], finished: [], scheduled: [], squad: rows });
  expect(detail.squad.map((row) => row.number)).toEqual([1, 2, 3]);
});

test('the next match and the results carry the opponent logo', () => {
  const played = { ...finished(1, 'us', 'a', 2, 0), away_team: { id: 'a', name: 'A', logo: 'https://img.test/a.png' } };
  const next = { ...finished(2, 'b', 'us', 0, 0), status: 'scheduled' as const, home_score: null, away_score: null };
  const detail = buildTeamDetail({ teamId: 'us', standings: [], finished: [played], scheduled: [next], squad });

  expect(detail.lastResults[0].opponentLogo).toBe('https://img.test/a.png');
  expect(detail.nextMatch?.opponentLogo).toBeNull();
});
