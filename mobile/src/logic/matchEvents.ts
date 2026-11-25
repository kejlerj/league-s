import { fr } from '@/src/i18n/fr';
import type { ApiMatch, MatchEvent, MatchEventPlayer } from '@/src/types';

export type EventTone = 'goal' | 'yellow' | 'red' | 'neutral';

export interface EventRow {
  id: string;
  minute: string;
  tone: EventTone;
  playerName: string;
  detail: string;
  score: string | null;
}

type Score = Pick<ApiMatch, 'home_score' | 'away_score'>;

const copy = fr.match.eventDetail;

function fullName(player: MatchEventPlayer | null): string {
  return player ? `${player.firstname} ${player.lastname}` : '';
}

function shortName(player: MatchEventPlayer | null): string {
  return player ? `${player.firstname.charAt(0)}. ${player.lastname}` : '';
}

function goalDetail(event: MatchEvent): string {
  if (event.own_goal) return copy.ownGoal;
  if (!event.player) return copy.unknownScorer;
  if (event.penalty) return copy.penalty;
  if (event.assist_player) return copy.assist(shortName(event.assist_player));
  return copy.goal;
}

function describe(event: MatchEvent): Pick<EventRow, 'tone' | 'playerName' | 'detail'> {
  switch (event.type) {
    case 'goal':
      return { tone: 'goal', playerName: event.player ? fullName(event.player) : copy.goal, detail: goalDetail(event) };
    case 'yellow_card':
      return event.sent_off
        ? { tone: 'red', playerName: fullName(event.player), detail: copy.secondYellow }
        : { tone: 'yellow', playerName: fullName(event.player), detail: copy.yellow };
    case 'red_card':
      return { tone: 'red', playerName: fullName(event.player), detail: copy.red };
    case 'substitution':
      return { tone: 'neutral', playerName: fullName(event.player_in), detail: copy.replaces(shortName(event.player)) };
    case 'injury':
      return { tone: 'neutral', playerName: fullName(event.player), detail: copy.injury };
  }
}

function goalsAddUp(events: MatchEvent[], score: Score): boolean {
  if (score.home_score === null || score.away_score === null) return false;
  const goals = events.filter((event) => event.type === 'goal').length;
  return goals === score.home_score + score.away_score;
}

export function eventRows(events: MatchEvent[], score: Score): EventRow[] {
  const showScore = goalsAddUp(events, score);
  return events.map((event) => ({
    id: event.id,
    minute: `${event.minute}'`,
    ...describe(event),
    score:
      showScore && event.home_score !== null && event.away_score !== null
        ? `${event.home_score}–${event.away_score}`
        : null,
  }));
}
