import { Injectable } from '@angular/core';

export interface AppSettings {
  cutoffDay: number;
}

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly settingsKey = 'ot_app_settings';

  private readonly defaults: AppSettings = {
    cutoffDay: 23
  };

  getSettings(): AppSettings {
    const raw = localStorage.getItem(this.settingsKey);
    if (!raw) return this.defaults;

    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        cutoffDay: this.clampCutoffDay(Number(parsed.cutoffDay ?? this.defaults.cutoffDay))
      };
    } catch {
      return this.defaults;
    }
  }

  saveSettings(settings: AppSettings): void {
    const safe: AppSettings = {
      cutoffDay: this.clampCutoffDay(settings.cutoffDay)
    };
    localStorage.setItem(this.settingsKey, JSON.stringify(safe));
  }

  private clampCutoffDay(day: number): number {
    if (Number.isNaN(day)) return this.defaults.cutoffDay;
    return Math.max(1, Math.min(28, Math.trunc(day)));
  }
}
