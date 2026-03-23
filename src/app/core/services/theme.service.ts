import { Injectable, signal } from '@angular/core';

export type ThemeId = 'light' | 'dark';

const STORAGE_KEY = 'ot_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Sincronizado con `document.documentElement[data-theme]`. */
  readonly theme = signal<ThemeId>('light');

  /** Aplicar preferencia guardada (o default día). Llamar en APP_INITIALIZER. */
  init(): void {
    if (typeof document === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    const initial: ThemeId = saved === 'dark' || saved === 'light' ? saved : 'light';
    this.apply(initial, false);
  }

  /** Modo oscuro activo. */
  isDark(): boolean {
    return this.theme() === 'dark';
  }

  setTheme(next: ThemeId): void {
    this.apply(next, true);
  }

  toggle(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private apply(next: ThemeId, persist: boolean): void {
    this.theme.set(next);
    document.documentElement.setAttribute('data-theme', next);
    if (persist) {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }
}
