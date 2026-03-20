import { Injectable } from '@angular/core';

import { OvertimeEntry } from '../models/overtime.models';

@Injectable({ providedIn: 'root' })
export class DataMigrationService {
  private readonly dataVersionKey = 'ot_data_version';
  private readonly currentVersion = 1;

  runMigrations(): void {
    const rawVersion = Number(localStorage.getItem(this.dataVersionKey) ?? 0);
    if (rawVersion >= this.currentVersion) return;

    this.migrateLegacyEntries();
    this.migrateAppSettings();
    this.cleanupLegacyKeys();

    localStorage.setItem(this.dataVersionKey, String(this.currentVersion));
  }

  private migrateLegacyEntries(): void {
    const entriesKey = 'ot_entries';
    const raw = localStorage.getItem(entriesKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<OvertimeEntry>[];
      if (!Array.isArray(parsed)) return;

      const normalized = parsed
        .filter((entry) => typeof entry === 'object' && entry !== null)
        .map((entry) => ({
          ...entry,
          observaciones: String(entry.observaciones ?? ''),
          esFeriadoNacional: Boolean(entry.esFeriadoNacional),
          horasExtra: Number(entry.horasExtra ?? 0),
          totalPesos: Number(entry.totalPesos ?? 0),
          multiplicador: Number(entry.multiplicador ?? 1.5),
          antiguedadAnios: Number(entry.antiguedadAnios ?? 0),
          valorHoraBase: Number(entry.valorHoraBase ?? 0),
          valorHoraConAntiguedad: Number(entry.valorHoraConAntiguedad ?? entry.valorHoraBase ?? 0)
        }));

      localStorage.setItem(entriesKey, JSON.stringify(normalized));
    } catch {
      // Si el JSON está corrupto, no bloqueamos la app.
    }
  }

  private migrateAppSettings(): void {
    const appSettingsKey = 'ot_app_settings';
    const raw = localStorage.getItem(appSettingsKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { cutoffDay?: unknown };
      const safeCutoff = this.clampCutoffDay(Number(parsed.cutoffDay ?? 23));
      localStorage.setItem(appSettingsKey, JSON.stringify({ cutoffDay: safeCutoff }));
    } catch {
      localStorage.setItem(appSettingsKey, JSON.stringify({ cutoffDay: 23 }));
    }
  }

  private cleanupLegacyKeys(): void {
    localStorage.removeItem('ot_holidays');
  }

  private clampCutoffDay(day: number): number {
    if (Number.isNaN(day)) return 23;
    return Math.max(1, Math.min(28, Math.trunc(day)));
  }
}
