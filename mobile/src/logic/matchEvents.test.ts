import { eventRows } from './matchEvents';
import type { MatchEvent, MatchEventPlayer } from '@/src/types';

const diarra: MatchEventPlayer = { id: 'p1', firstname: 'Malik', lastname: 'Diarra' };
const dupont: MatchEventPlayer = { id: 'p2', firstname: 'Léo', lastname: 'Dupont' };

function event(fields: Partial<MatchEvent>): MatchEvent {
  return {
    id: 'e',
    match_id: 'm',
    team_id: 'h',
    type: 'goal',
    minute: 10,
    player: null,
    assist_player: null,
    player_in: null,
    own_goal: false,
    penalty: false,
    note: null,
    sent_off: false,
    home_score: null,
    away_score: null,
    ...fields,
  };
}

const twoOne = { home_score: 2, away_score: 1 };

test('a goal with an assist names the scorer and the passer, with the running score', () => {
  const [row] = eventRows([event({ minute: 37, player: diarra, assist_player: dupont, home_score: 1, away_score: 0 })], { home_score: 1, away_score: 0 });
  expect(row).toEqual({ id: 'e', minute: "37'", tone: 'goal', playerName: 'Malik Diarra', detail: 'Passe de L. Dupont', score: '1–0' });
});

test.each([
  ['a penalty', event({ player: diarra, penalty: true }), 'Malik Diarra', 'Penalty'],
  ['an own goal', event({ player: diarra, own_goal: true }), 'Malik Diarra', 'Contre son camp'],
  ['an unknown scorer', event({}), 'But', 'Buteur inconnu'],
  ['a goal alone', event({ player: diarra }), 'Malik Diarra', 'But'],
])('%s', (_name, e, playerName, detail) => {
  const [row] = eventRows([e], { home_score: 1, away_score: 0 });
  expect(row.playerName).toBe(playerName);
  expect(row.detail).toBe(detail);
  expect(row.tone).toBe('goal');
});

test.each([
  ['a yellow card', event({ type: 'yellow_card', player: diarra }), 'Carton jaune', 'yellow'],
  ['a second yellow', event({ type: 'yellow_card', player: diarra, sent_off: true }), '2e jaune', 'red'],
  ['a red card', event({ type: 'red_card', player: diarra, sent_off: true }), 'Carton rouge', 'red'],
  ['an injury, without its note', event({ type: 'injury', player: diarra, note: 'Cheville' }), 'Blessure', 'neutral'],
])('%s', (_name, e, detail, tone) => {
  const [row] = eventRows([e], twoOne);
  expect(row).toMatchObject({ playerName: 'Malik Diarra', detail, tone, score: null });
});

test('a substitution names the player coming in, and the one he replaces', () => {
  const [row] = eventRows([event({ type: 'substitution', player: diarra, player_in: dupont })], twoOne);
  expect(row).toMatchObject({ playerName: 'Léo Dupont', detail: 'Remplace M. Diarra', tone: 'neutral', score: null });
});

test('the running score is left out when the goal events do not add up to the score', () => {
  const goals = [event({ id: 'g1', player: diarra, home_score: 1, away_score: 0 }), event({ id: 'g2', player: diarra, home_score: 2, away_score: 0 })];
  expect(eventRows(goals, { home_score: 2, away_score: 0 }).map((r) => r.score)).toEqual(['1–0', '2–0']);
  expect(eventRows(goals, twoOne).map((r) => r.score)).toEqual([null, null]);
  expect(eventRows(goals, { home_score: null, away_score: null }).map((r) => r.score)).toEqual([null, null]);
});
