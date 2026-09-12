const DAY_LABELS_LONG = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTH_LABELS = ['jan.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "dim. 7 sept." — a full day + date, UTC-based so it matches the mock data regardless of device timezone. */
export function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  return `${DAY_LABELS_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_LABELS[d.getUTCMonth()]}`;
}

/** "dim. 7 sept. · 15:00" — full date plus kickoff time, for the Match screen's fuller info lines. */
export function formatMatchDateTime(iso: string): string {
  const d = new Date(iso);
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return `${formatMatchDate(iso)} · ${time}`;
}

/** "7 sept." — short date without weekday, for compact badges like Team screen's next-match tag. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTH_LABELS[d.getUTCMonth()]}`;
}
