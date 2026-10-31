export type ResultTag = 'V' | 'N' | 'D';

export type ApiMatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

export type MatchStatus = 'upcoming' | 'live' | 'played' | 'cancelled';

export interface League {
  id: string;
  name: string;
  logo: string | null;
}

export interface Season {
  id: string;
  league_id: string;
  name: string;
  start_on: string;
  end_on: string;
}

export interface Team {
  id: string;
  league_id: string;
  name: string;
  logo: string | null;
}

export interface TeamRef {
  id: string;
  name: string;
  logo: string | null;
}

export interface ApiMatch {
  id: string;
  season_id: string;
  home_team: TeamRef;
  away_team: TeamRef;
  matchday: number;
  kickoff_at: string | null;
  status: ApiMatchStatus;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  referee: string | null;
  convocation_at: string | null;
  video_url: string | null;
}

export interface StandingRow {
  rank: number;
  team_id: string;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

export interface SquadRow {
  membership_id: string;
  player_id: string;
  firstname: string;
  lastname: string;
  icon: string | null;
  number: number;
  joined_on: string;
  left_on: string | null;
}

export interface PlayerDetail {
  id: string;
  league_id: string;
  firstname: string;
  lastname: string;
  icon: string | null;
  current_team: TeamRef | null;
}

export interface SeasonRef {
  id: string;
  name: string;
}

export interface CareerEntry {
  membership_id: string;
  season: SeasonRef;
  team: TeamRef;
  number: number;
  joined_on: string;
  left_on: string | null;
}

export type TabOrigin = 'following' | 'standings';
