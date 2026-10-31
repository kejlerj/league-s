import type { components } from './api';

type Schemas = components['schemas'];

export type ResultTag = 'V' | 'N' | 'D';

export type MatchStatus = 'upcoming' | 'live' | 'played' | 'cancelled';

export type TabOrigin = 'following' | 'standings';

export type ApiMatchStatus = Schemas['MatchStatus'];
export type League = Schemas['League'];
export type Season = Schemas['Season'];
export type Team = Schemas['Team'];
export type TeamRef = Schemas['TeamRef'];
export type ApiMatch = Schemas['Match'];
export type StandingRow = Schemas['StandingRow'];
export type SquadRow = Schemas['SquadMember'];
export type PlayerDetail = Schemas['PlayerDetail'];
export type SeasonRef = Schemas['SeasonRef'];
export type CareerEntry = Schemas['CareerEntry'];
