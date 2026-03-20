export type WorkerCategory =
  | 'especial'
  | 'calificado'
  | 'semicalificado'
  | 'no_calificado'
  | 'peon';

export interface UserProfile {
  nombre: string;
  apellido: string;
  categoria: WorkerCategory;
  antiguedadAnios: number;
}

export interface CategoryRate {
  categoria: WorkerCategory;
  valorHora: number;
}

export type DayType = 'weekday' | 'weekend' | 'holiday';

export interface OvertimeEntry {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  esFeriadoNacional: boolean;
  observaciones: string;
  horasExtra: number;
  multiplicador: number;
  totalPesos: number;
  tipoDia: DayType;
  categoriaUsuario: WorkerCategory;
  valorHoraBase: number;
  antiguedadAnios: number;
  valorHoraConAntiguedad: number;
}
