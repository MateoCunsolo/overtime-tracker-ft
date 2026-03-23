import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

export interface AppSettings {
  cutoffDay: number;
}

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  private readonly defaults: AppSettings = {
    cutoffDay: 24
  };

  private current: AppSettings = { ...this.defaults };

  getSettings(): AppSettings {
    return { cutoffDay: this.clampCutoffDay(this.current.cutoffDay) };
  }

  applyFromServer(settings: AppSettings | null | undefined): void {
    if (!settings) {
      this.current = { ...this.defaults };
      return;
    }
    this.current = {
      cutoffDay: this.clampCutoffDay(settings.cutoffDay)
    };
  }

  resetToDefaults(): void {
    this.current = { ...this.defaults };
  }

  saveSettings(settings: AppSettings): Observable<AppSettings> {
    const safe: AppSettings = {
      cutoffDay: this.clampCutoffDay(settings.cutoffDay)
    };

    return this.http.put<{ cutoffDay: number }>(`${this.apiUrl}/settings`, safe).pipe(
      tap((res) => this.applyFromServer(res)),
      map(() => this.getSettings())
    );
  }

  private clampCutoffDay(day: number): number {
    if (Number.isNaN(day)) return this.defaults.cutoffDay;
    return Math.max(1, Math.min(28, Math.trunc(day)));
  }
}
