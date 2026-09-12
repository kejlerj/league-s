export type ResultTag = 'V' | 'N' | 'D';

export interface District {
  id: string;
  name: string;
  division: string;
  season: string;
  seller: string;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  crestColor: string;
  rank: number;
  points: number;
  played: number;
  goalDiff: number;
  stadium: string;
  form: ResultTag[];
  squadCount: number;
}

export interface Player {
  id: string;
  teamId: string;
  number: number;
  name: string;
  position: string;
  matchesPlayed: number;
  goals: number;
  assists: number;
}

export type MatchStatus = 'upcoming' | 'live' | 'played';

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'yellow' | 'red' | 'sub';
  playerName: string;
  detail: string;
  score: string;
}

export interface MatchOdds {
  home: number;
  draw: number;
  away: number;
}

export interface MatchMvp {
  playerId: string;
  votePercent: number;
  voteCount: number;
}

export interface Match {
  id: string;
  matchday: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: string; // ISO 8601
  venue: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  odds?: MatchOdds;
  referee?: string;
  convocation?: string;
  spectators?: number;
  videoUrl?: string;
  videoDuration?: string;
  events?: MatchEvent[];
  mvp?: MatchMvp;
}

export type StandingsZone = 'promotion' | 'playoff' | 'relegation' | 'none';

export interface StandingsRow {
  rank: number;
  teamId: string;
  teamName: string;
  played: number;
  goalDiff: number;
  points: number;
  zone: StandingsZone;
  followed: boolean;
}

export interface PeopleRow {
  rank: number;
  playerId: string;
  name: string;
  teamName: string;
  value: number;
  unit: string;
}

export interface Profile {
  name: string;
  supporterOf: string;
  since: number;
  pronoPoints: number;
  pronoRank: number;
}

export interface ResultLine {
  matchId: string;
  opponent: string;
  venueTag: 'dom.' | 'ext.';
  result: ResultTag;
  score: string;
}

export interface TeamDetail {
  team: Team;
  nextMatch:
    | (Match & { opponentName: string; venueTag: 'dom.' | 'ext.' })
    | null;
  lastResults: ResultLine[];
  squad: Player[];
}

export type FixtureSlotTone = 'score' | 'live' | 'odds' | 'date';

export interface FixtureSlot {
  text: string;
  tone: FixtureSlotTone;
}

export type FixtureTarget =
  | { kind: 'match'; id: string }
  | { kind: 'team'; id: string };

export interface FixtureRow {
  matchId: string;
  when: string;
  match: string;
  sub: string;
  slot: FixtureSlot;
  target: FixtureTarget;
}

export type ListItem = { kind: 'fixture'; row: FixtureRow } | { kind: 'shop' };
