import { Injectable } from '@angular/core';

import { OvertimeEntry, WorkerCategory } from '../models/overtime.models';
import { RateConfigService } from './rate-config.service';

type OvertimeInput = Pick<
  OvertimeEntry,
  'fecha' | 'horaInicio' | 'horaFin' | 'esFeriadoNacional' | 'observaciones'
> & { categoriaUsuario: WorkerCategory; antiguedadAnios: number };

@Injectable({ providedIn: 'root' })
export class OvertimeService {
  private readonly entriesKey = 'ot_entries';
  private readonly maxOvertimeHoursPerDay = 16;

  constructor(private readonly rateConfigService: RateConfigService) {}

  getEntries(): OvertimeEntry[] {
    const raw = localStorage.getItem(this.entriesKey);
    if (!raw) return [];

    try {
      return (JSON.parse(raw) as OvertimeEntry[]).sort((a, b) => b.fecha.localeCompare(a.fecha));
    } catch {
      return [];
    }
  }

  createEntry(input: OvertimeInput): OvertimeEntry {
    const entry = this.buildEntry(input, crypto.randomUUID());
    const next = [entry, ...this.getEntries()];
    localStorage.setItem(this.entriesKey, JSON.stringify(next));
    return entry;
  }

  updateEntry(id: string, input: OvertimeInput): OvertimeEntry {
    const updated = this.buildEntry(input, id);
    const next = this.getEntries().map((entry) => (entry.id === id ? updated : entry));
    localStorage.setItem(this.entriesKey, JSON.stringify(next));
    return updated;
  }

  deleteEntry(id: string): void {
    const next = this.getEntries().filter((item) => item.id !== id);
    localStorage.setItem(this.entriesKey, JSON.stringify(next));
  }

  getTotalGanado(): number {
    return this.getEntries().reduce((acc, item) => acc + item.totalPesos, 0);
  }

  private buildEntry(input: OvertimeInput, id: string): OvertimeEntry {
    const baseRate = this.rateConfigService.getRateForCategory(input.categoriaUsuario);
    const seniorityMultiplier = this.resolveSeniorityMultiplier(input.antiguedadAnios);
    const adjustedRate = baseRate * seniorityMultiplier;
    const dayData = this.resolveDayType(input.fecha, input.esFeriadoNacional);
    const hours = this.calculateOvertimeHours(input.horaInicio, input.horaFin);

    return {
      id,
      fecha: input.fecha,
      horaInicio: input.horaInicio,
      horaFin: input.horaFin,
      esFeriadoNacional: input.esFeriadoNacional,
      observaciones: input.observaciones,
      horasExtra: hours,
      multiplicador: dayData.multiplier,
      totalPesos: Math.round(hours * adjustedRate * dayData.multiplier),
      tipoDia: dayData.type,
      categoriaUsuario: input.categoriaUsuario,
      valorHoraBase: baseRate,
      antiguedadAnios: input.antiguedadAnios,
      valorHoraConAntiguedad: Number(adjustedRate.toFixed(2))
    };
  }

  private calculateOvertimeHours(start: string, end: string): number {
    const startDate = this.buildDateFromTime(start);
    const endDate = this.buildDateFromTime(end);
    const workedMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

    if (workedMinutes <= 0) {
      throw new Error('El rango horario no es valido. Verifica hora de inicio y fin.');
    }

    const hours = Number((workedMinutes / 60).toFixed(2));
    if (hours > this.maxOvertimeHoursPerDay) {
      throw new Error(`No puedes registrar más de ${this.maxOvertimeHoursPerDay} horas extra por día.`);
    }

    return hours;
  }

  private buildDateFromTime(time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private resolveDayType(
    fecha: string,
    esFeriadoNacional: boolean
  ): { type: OvertimeEntry['tipoDia']; multiplier: number } {
    if (esFeriadoNacional) {
      return { type: 'holiday', multiplier: 1.65 };
    }

    const day = new Date(`${fecha}T00:00:00`).getDay();
    if (day === 0 || day === 6) {
      return { type: 'weekend', multiplier: 2 };
    }

    return { type: 'weekday', multiplier: 1.5 };
  }

  private resolveSeniorityMultiplier(antiguedadAnios: number): number {
    const safeYears = Math.max(0, antiguedadAnios);
    return 1 + safeYears / 100;
  }
}
