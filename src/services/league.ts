import { withLatency } from './_shared';
import { district } from '../data/district';
import type { District } from '../types';

export function getDistrict(): Promise<District> {
  return withLatency(() => district);
}
