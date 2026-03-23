import { Component, inject } from '@angular/core';

import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="theme-toggle"
      (click)="onToggle()"
      [attr.aria-label]="theme() === 'dark' ? 'Activar modo día' : 'Activar modo oscuro'"
      [title]="theme() === 'dark' ? 'Modo día' : 'Modo oscuro'"
    >
      @if (theme() === 'dark') {
        <span class="icon sun" aria-hidden="true"></span>
      } @else {
        <span class="icon moon" aria-hidden="true"></span>
      }
      <span class="label">{{ theme() === 'dark' ? 'Día' : 'Noche' }}</span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .theme-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      border: 1px solid var(--ng-border);
      border-radius: 999px;
      background: var(--ng-muted-bg);
      color: var(--ng-text-muted);
      padding: 0.38rem 0.75rem 0.38rem 0.55rem;
      font-family: var(--ng-font);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition:
        color 0.2s ease,
        background 0.2s ease,
        border-color 0.2s ease,
        transform 0.2s ease;
    }

    .theme-toggle:hover {
      color: var(--ng-text);
      border-color: var(--ng-border-strong);
      transform: translateY(-1px);
    }

    .icon {
      width: 1.1rem;
      height: 1.1rem;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .moon {
      background: linear-gradient(145deg, #64748b, #1e293b);
      box-shadow: 0 0 0 2px rgb(56 189 248 / 35%);
    }

    .sun {
      background: linear-gradient(145deg, #fbbf24, #f59e0b);
      box-shadow: 0 0 0 2px rgb(251 191 36 / 45%);
    }

    .label {
      line-height: 1;
    }

    @media (max-width: 420px) {
      .label {
        display: none;
      }

      .theme-toggle {
        padding: 0.42rem;
      }
    }
  `
})
export class ThemeToggleComponent {
  private readonly themeService = inject(ThemeService);
  protected readonly theme = this.themeService.theme;

  onToggle(): void {
    this.themeService.toggle();
  }
}
