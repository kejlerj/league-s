import { fr } from '@/src/i18n/fr';

const pad = (value: number) => String(value).padStart(2, '0');

export function parseApiDate(iso: string): Date {
  return new Date(iso.replace(/(\.\d{3})\d+/, '$1'));
}

export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDayMonth(date: Date): string {
  return `${fr.dates.days[date.getDay()]} ${date.getDate()} ${fr.dates.months[date.getMonth()]}`;
}

export function formatDateTime(date: Date): string {
  return `${formatDayMonth(date)} · ${formatTime(date)}`;
}

export function toLocalDateParam(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
