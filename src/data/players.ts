import type { Player, PeopleRow } from '../types';

function squad(teamId: string, entries: [string, string, number, number][]): Player[] {
  return entries.map(([name, position, goals, assists], i) => ({
    id: `${teamId}-p${i + 1}`,
    teamId,
    number: i + 1 === 1 ? 1 : i * 3 + 2,
    name,
    position,
    matchesPlayed: 3,
    goals,
    assists,
  }));
}

const vallonnais = squad('fc-vallonnais', [
  ['Yanis Cottreau', 'Gardien', 0, 0],
  ['Karim Ferhat', 'Défenseur', 0, 1],
  ['Louis Brancher', 'Défenseur', 1, 0],
  ['Malik Diarra', 'Milieu', 5, 3],
  ['Théo Rasolo', 'Milieu', 2, 4],
  ['Bilal Amrani', 'Attaquant', 4, 1],
]);

const coteaux = squad('us-coteaux', [
  ['Enzo Vidal', 'Gardien', 0, 0],
  ['Antoine Reber', 'Défenseur', 0, 0],
  ['Samir Belkacem', 'Défenseur', 0, 1],
  ['Nolan Guéguen', 'Milieu', 1, 3],
  ['Julien Marchetti', 'Milieu', 2, 2],
  ['Rayan Foucher', 'Attaquant', 6, 1],
]);

const bellevue = squad('rc-bellevue', [
  ['Hugo Lemercier', 'Gardien', 0, 0],
  ['Oumar Traoré', 'Défenseur', 0, 0],
  ['Nathan Picard', 'Défenseur', 1, 0],
  ['Idris Chaabane', 'Milieu', 1, 2],
  ['Maxime Delaunay', 'Milieu', 0, 3],
  ['Yohan Perret', 'Attaquant', 4, 2],
]);

const grandval = squad('as-grandval', [
  ['Baptiste Roy', 'Gardien', 0, 0],
  ['Théo Vasseur', 'Défenseur', 0, 0],
  ['Adama Koné', 'Défenseur', 0, 0],
  ['Kevin Le Goff', 'Milieu', 1, 1],
  ['Sofiane Bouzid', 'Milieu', 1, 2],
  ['Romain Chevallier', 'Attaquant', 3, 1],
]);

const fontenay = squad('olympique-fontenay', [
  ['Alexandre Nguyen', 'Gardien', 0, 0],
  ['Yassine Amara', 'Défenseur', 0, 0],
  ['Pierre Aubertin', 'Défenseur', 0, 0],
  ['Ilyes Benali', 'Milieu', 0, 1],
  ['Corentin Faucher', 'Milieu', 1, 1],
  ['Dylan Ribeiro', 'Attaquant', 3, 0],
]);

const brecy = squad('stade-brecy', [
  ['Mathis Poulain', 'Gardien', 0, 0],
  ['Younes Zerhouni', 'Défenseur', 0, 0],
  ['Simon Gasnier', 'Défenseur', 0, 0],
  ['Wesley Camara', 'Milieu', 0, 1],
  ['Léo Vigneron', 'Milieu', 1, 0],
  ['Tom Charrier', 'Attaquant', 2, 1],
]);

const mornay = squad('etoile-de-mornay', [
  ['Gabin Ollivier', 'Gardien', 0, 0],
  ['Franck Diakite', 'Défenseur', 0, 0],
  ['Rémi Sanchez', 'Défenseur', 0, 0],
  ['Nassim Berrada', 'Milieu', 0, 0],
  ['Quentin Massé', 'Milieu', 1, 0],
  ['Ewen Le Bris', 'Attaquant', 1, 1],
]);

const riverain = squad('as-riverain', [
  ['Nolwenn Guillou', 'Gardien', 0, 0],
  ['Farid Meziane', 'Défenseur', 0, 0],
  ['Erwan Toussaint', 'Défenseur', 0, 0],
  ['Ismaël Haddad', 'Milieu', 1, 1],
  ['Loïc Pelletier', 'Milieu', 0, 1],
  ['Anthony Girard', 'Attaquant', 2, 0],
]);

const pontarnaud = squad('fc-pontarnaud', [
  ['Valentin Cosson', 'Gardien', 0, 0],
  ['Bastien Rocher', 'Défenseur', 0, 0],
  ['Kylian Andrieu', 'Défenseur', 0, 0],
  ['Mehdi Larbi', 'Milieu', 0, 0],
  ['Jérémy Fontaine', 'Milieu', 0, 0],
  ['Cyril Duchemin', 'Attaquant', 1, 0],
]);

const chantereine = squad('us-chantereine', [
  ['Axel Bourgoin', 'Gardien', 0, 0],
  ['Damien Séverin', 'Défenseur', 0, 0],
  ['Fabien Lacaze', 'Défenseur', 0, 0],
  ['Brahim Yousfi', 'Milieu', 0, 0],
  ['Gauthier Prévost', 'Milieu', 0, 0],
  ['Steven Marchal', 'Attaquant', 1, 0],
]);

export const players: Player[] = [
  ...vallonnais,
  ...coteaux,
  ...bellevue,
  ...grandval,
  ...fontenay,
  ...brecy,
  ...mornay,
  ...riverain,
  ...pontarnaud,
  ...chantereine,
];

export const topScorers: PeopleRow[] = [
  { rank: 1, playerId: 'us-coteaux-p6', name: 'Rayan Foucher', teamName: 'US Coteaux', value: 6, unit: 'buts' },
  { rank: 2, playerId: 'fc-vallonnais-p4', name: 'Malik Diarra', teamName: 'FC Vallonnais', value: 5, unit: 'buts' },
  { rank: 3, playerId: 'fc-vallonnais-p6', name: 'Bilal Amrani', teamName: 'FC Vallonnais', value: 4, unit: 'buts' },
  { rank: 3, playerId: 'rc-bellevue-p6', name: 'Yohan Perret', teamName: 'RC Bellevue', value: 4, unit: 'buts' },
  { rank: 5, playerId: 'as-grandval-p6', name: 'Romain Chevallier', teamName: 'AS Grandval', value: 3, unit: 'buts' },
  { rank: 5, playerId: 'olympique-fontenay-p6', name: 'Dylan Ribeiro', teamName: 'Olympique Fontenay', value: 3, unit: 'buts' },
  { rank: 7, playerId: 'stade-brecy-p6', name: 'Tom Charrier', teamName: 'Stade Brécy', value: 2, unit: 'buts' },
  { rank: 7, playerId: 'as-riverain-p6', name: 'Anthony Girard', teamName: 'AS Riverain', value: 2, unit: 'buts' },
];

export const topAssists: PeopleRow[] = [
  { rank: 1, playerId: 'fc-vallonnais-p5', name: 'Théo Rasolo', teamName: 'FC Vallonnais', value: 4, unit: 'passes' },
  { rank: 2, playerId: 'fc-vallonnais-p4', name: 'Malik Diarra', teamName: 'FC Vallonnais', value: 3, unit: 'passes' },
  { rank: 2, playerId: 'rc-bellevue-p5', name: 'Maxime Delaunay', teamName: 'RC Bellevue', value: 3, unit: 'passes' },
  { rank: 2, playerId: 'us-coteaux-p4', name: 'Nolan Guéguen', teamName: 'US Coteaux', value: 3, unit: 'passes' },
  { rank: 5, playerId: 'as-grandval-p5', name: 'Sofiane Bouzid', teamName: 'AS Grandval', value: 2, unit: 'passes' },
  { rank: 5, playerId: 'rc-bellevue-p4', name: 'Idris Chaabane', teamName: 'RC Bellevue', value: 2, unit: 'passes' },
  { rank: 7, playerId: 'us-coteaux-p3', name: 'Samir Belkacem', teamName: 'US Coteaux', value: 1, unit: 'passes' },
  { rank: 7, playerId: 'as-grandval-p4', name: 'Kevin Le Goff', teamName: 'AS Grandval', value: 1, unit: 'passes' },
];

export const mvpRanking: PeopleRow[] = [
  { rank: 1, playerId: 'fc-vallonnais-p4', name: 'Malik Diarra', teamName: 'FC Vallonnais', value: 61, unit: 'votes' },
  { rank: 2, playerId: 'us-coteaux-p6', name: 'Rayan Foucher', teamName: 'US Coteaux', value: 48, unit: 'votes' },
  { rank: 3, playerId: 'rc-bellevue-p6', name: 'Yohan Perret', teamName: 'RC Bellevue', value: 33, unit: 'votes' },
  { rank: 4, playerId: 'fc-vallonnais-p5', name: 'Théo Rasolo', teamName: 'FC Vallonnais', value: 29, unit: 'votes' },
  { rank: 5, playerId: 'as-grandval-p6', name: 'Romain Chevallier', teamName: 'AS Grandval', value: 22, unit: 'votes' },
  { rank: 6, playerId: 'olympique-fontenay-p6', name: 'Dylan Ribeiro', teamName: 'Olympique Fontenay', value: 18, unit: 'votes' },
  { rank: 7, playerId: 'stade-brecy-p6', name: 'Tom Charrier', teamName: 'Stade Brécy', value: 12, unit: 'votes' },
  { rank: 8, playerId: 'as-riverain-p6', name: 'Anthony Girard', teamName: 'AS Riverain', value: 9, unit: 'votes' },
];
