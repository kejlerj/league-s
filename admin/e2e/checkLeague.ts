export type Fixture = {
  matchday: number
  home: string
  away: string
  kickoff: string
  outcome: { status: 'finished'; score: [number, number]; video?: string } | { status: 'live'; score: [number, number] } | { status: 'postponed' } | { status: 'cancelled' } | { status: 'scheduled' }
}

const teams = ['Les Aigles', 'Les Bisons', 'Les Castors', 'Les Dauphins', 'Les Faucons', 'Les Guépards']
const firstnames = ['Adam', 'Bruno', 'Cyril', 'Driss', 'Enzo', 'Fabien', 'Gaël', 'Hugo']
const lastnames = ['Aubert', 'Bertin', 'Carré', 'Delmas', 'Ferrand', 'Garnier']

export const checkLeague = {
  name: 'Ligue de vérification',
  season: { name: '2026-2027', startOn: '2026-08-29', endOn: '2027-05-30' },
  squads: teams.map((team, i) => ({
    team,
    players: firstnames.map((firstname, j) => ({ firstname, lastname: lastnames[i], number: j + 1 })),
  })),
  fixtures: [
    { matchday: 1, home: teams[0], away: teams[1], kickoff: '2026-09-05T15:00', outcome: { status: 'finished', score: [2, 1], video: 'https://video.example.com/aigles-bisons' } },
    { matchday: 1, home: teams[2], away: teams[3], kickoff: '2026-09-05T16:00', outcome: { status: 'finished', score: [0, 0] } },
    { matchday: 1, home: teams[4], away: teams[5], kickoff: '2026-09-05T17:00', outcome: { status: 'finished', score: [3, 2] } },
    { matchday: 2, home: teams[0], away: teams[2], kickoff: '2026-09-12T15:00', outcome: { status: 'live', score: [1, 0] } },
    { matchday: 2, home: teams[1], away: teams[4], kickoff: '2026-09-12T16:00', outcome: { status: 'postponed' } },
    { matchday: 2, home: teams[3], away: teams[5], kickoff: '2026-09-12T17:00', outcome: { status: 'cancelled' } },
    { matchday: 3, home: teams[0], away: teams[3], kickoff: '2026-09-19T15:00', outcome: { status: 'scheduled' } },
    { matchday: 3, home: teams[1], away: teams[5], kickoff: '2026-09-19T16:00', outcome: { status: 'scheduled' } },
    { matchday: 3, home: teams[2], away: teams[4], kickoff: '2026-09-19T17:00', outcome: { status: 'scheduled' } },
  ] satisfies Fixture[],
}
