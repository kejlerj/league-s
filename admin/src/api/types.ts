export type User = {
  id: string
  email: string
  name: string
  is_superadmin: boolean
}

export type LeagueRef = { id: string; name: string }

export type Me = User & { leagues: LeagueRef[] }

export type League = { id: string; name: string; logo: string | null }

export type Team = { id: string; league_id: string; name: string; logo: string | null }

export type Player = {
  id: string
  league_id: string
  firstname: string
  lastname: string
  icon: string | null
}

export type TieBreaker = 'goal_difference' | 'goals_scored' | 'head_to_head' | 'fair_play' | 'random'

export type Season = {
  id: string
  league_id: string
  name: string
  start_on: string
  end_on: string
  match_win_pts: number
  match_draw_pts: number
  match_loss_pts: number
  tie_breakers: TieBreaker[]
}

export type SeasonTeam = { id: string; name: string; logo: string | null }

export type SquadMember = {
  membership_id: string
  player_id: string
  firstname: string
  lastname: string
  icon: string | null
  number: number | null
  joined_on: string
  left_on: string | null
}

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'

export type Match = {
  id: string
  season_id: string
  home_team: SeasonTeam
  away_team: SeasonTeam
  matchday: number
  kickoff_at: string | null
  status: MatchStatus
  home_score: number | null
  away_score: number | null
  venue: string | null
  referee: string | null
  convocation_at: string | null
  video_url: string | null
}

export type StandingRow = {
  rank: number
  team_id: string
  team_name: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

export type LeagueAdmin = { id: string; email: string; name: string }

export type Invitation = { id: string; email: string; expires_at: string }

export type InvitationPreview = {
  email: string
  league: LeagueRef
  account_exists: boolean
}
