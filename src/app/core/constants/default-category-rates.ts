import { WorkerCategory } from '../models/overtime.models';

/**
 * Mismos valores que `overtime-tracker-api` (`default-category-rates.ts`).
 * Se usan en registro antes de tener sesión (tarifas globales en servidor).
 */
export const DEFAULT_CATEGORY_RATES_MAP: Record<WorkerCategory, number> = {
  especial: 11400.49,
  calificado: 9418.88,
  semicalificado: 8525.29,
  no_calificado: 7679.59,
  peon: 7315.85
};
