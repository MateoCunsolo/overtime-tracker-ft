import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { WorkerCategory } from '../../../../../core/models/overtime.models';
import { AppSettingsService } from '../../../../../core/services/app-settings.service';
import { RateConfigService } from '../../../../../core/services/rate-config.service';
import { AppSwal } from '../../../../../core/utils/alert.util';

@Component({
  selector: 'app-settings-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss'
})
export class SettingsPageComponent {
  private readonly fb = inject(FormBuilder);
  @ViewChild('backupInput') backupInput?: ElementRef<HTMLInputElement>;

  private readonly profileKey = 'ot_profile';
  private readonly ratesKey = 'ot_category_rates';
  private readonly ratesVersionKey = 'ot_category_rates_version';
  private readonly entriesKey = 'ot_entries';
  private readonly appSettingsKey = 'ot_app_settings';

  readonly categoryOrder: WorkerCategory[] = [
    'especial',
    'calificado',
    'semicalificado',
    'no_calificado',
    'peon'
  ];

  readonly configForm = this.fb.group({
    cutoffDay: [23, [Validators.required, Validators.min(1), Validators.max(28)]]
  });

  readonly ratesForm = this.fb.group({
    especial: [0, [Validators.required, Validators.min(1)]],
    calificado: [0, [Validators.required, Validators.min(1)]],
    semicalificado: [0, [Validators.required, Validators.min(1)]],
    no_calificado: [0, [Validators.required, Validators.min(1)]],
    peon: [0, [Validators.required, Validators.min(1)]]
  });

  constructor(
    private readonly router: Router,
    private readonly appSettingsService: AppSettingsService,
    private readonly rateConfigService: RateConfigService
  ) {
    this.loadCurrentConfig();
  }

  openImportDialog(): void {
    this.backupInput?.nativeElement.click();
  }

  async exportBackup(): Promise<void> {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: this.readJson(this.profileKey),
      categoryRates: this.readJson(this.ratesKey),
      categoryRatesVersion: localStorage.getItem(this.ratesVersionKey),
      entries: this.readJson(this.entriesKey),
      appSettings: this.readJson(this.appSettingsKey)
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `overtime-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await AppSwal.fire({
      title: 'Respaldo exportado',
      text: 'Se descargó el archivo de respaldo.',
      icon: 'success',
      confirmButtonText: 'Entendido'
    });
  }

  async importBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text) as {
        profile?: unknown;
        categoryRates?: unknown;
        categoryRatesVersion?: unknown;
        entries?: unknown;
        appSettings?: unknown;
      };

      if (!backup || typeof backup !== 'object') {
        throw new Error('Archivo invalido.');
      }

      if (backup.profile !== undefined) {
        localStorage.setItem(this.profileKey, JSON.stringify(backup.profile));
      }
      if (backup.categoryRates !== undefined) {
        localStorage.setItem(this.ratesKey, JSON.stringify(backup.categoryRates));
      }
      if (backup.categoryRatesVersion !== undefined) {
        localStorage.setItem(this.ratesVersionKey, String(backup.categoryRatesVersion));
      }
      if (backup.entries !== undefined) {
        localStorage.setItem(this.entriesKey, JSON.stringify(backup.entries));
      }
      if (backup.appSettings !== undefined) {
        localStorage.setItem(this.appSettingsKey, JSON.stringify(backup.appSettings));
      }

      await AppSwal.fire({
        title: 'Respaldo importado',
        text: 'Los datos fueron restaurados correctamente.',
        icon: 'success',
        confirmButtonText: 'Entendido'
      });

      window.location.reload();
    } catch {
      await AppSwal.fire({
        title: 'Error al importar',
        text: 'El archivo no tiene un formato valido.',
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
    } finally {
      input.value = '';
    }
  }

  async resetData(): Promise<void> {
    const result = await AppSwal.fire({
      title: 'Reiniciar datos',
      text: 'Se eliminarán perfil, registros y configuración. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      customClass: {
        confirmButton: 'swal-btn swal-btn-danger',
        cancelButton: 'swal-btn swal-btn-cancel'
      },
      confirmButtonText: 'Sí, reiniciar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    localStorage.removeItem(this.profileKey);
    localStorage.removeItem(this.entriesKey);
    localStorage.removeItem(this.ratesKey);
    localStorage.removeItem(this.ratesVersionKey);
    localStorage.removeItem(this.appSettingsKey);

    await AppSwal.fire({
      title: 'Datos reiniciados',
      icon: 'success',
      confirmButtonText: 'Entendido'
    });

    void this.router.navigate(['/auth']);
  }

  private readJson(key: string): unknown {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveGeneralConfig(): Promise<void> {
    if (this.configForm.invalid) {
      this.configForm.markAllAsTouched();
      return;
    }

    const { cutoffDay } = this.configForm.getRawValue();
    this.appSettingsService.saveSettings({
      cutoffDay: Number(cutoffDay)
    });

    await AppSwal.fire({
      title: 'Configuracion guardada',
      text: 'Se actualizo el dia de corte.',
      icon: 'success',
      confirmButtonText: 'Entendido'
    });
  }

  async saveRates(): Promise<void> {
    if (this.ratesForm.invalid) {
      this.ratesForm.markAllAsTouched();
      return;
    }

    const raw = this.ratesForm.getRawValue();
    const rates = this.categoryOrder.map((categoria) => ({
      categoria,
      valorHora: Number(raw[categoria] ?? 0)
    }));

    this.rateConfigService.saveRates(rates);

    await AppSwal.fire({
      title: 'Valores actualizados',
      text: 'Los valores por categoria fueron guardados.',
      icon: 'success',
      confirmButtonText: 'Entendido'
    });
  }

  categoryLabel(category: WorkerCategory): string {
    const labels: Record<WorkerCategory, string> = {
      especial: 'Especial',
      calificado: 'Calificado',
      semicalificado: 'Semicalificado',
      no_calificado: 'No calificado',
      peon: 'Peon'
    };
    return labels[category];
  }

  private loadCurrentConfig(): void {
    const settings = this.appSettingsService.getSettings();
    const rates = this.rateConfigService.getRates();

    this.configForm.patchValue({
      cutoffDay: settings.cutoffDay
    });

    const patch: Record<WorkerCategory, number> = {
      especial: 0,
      calificado: 0,
      semicalificado: 0,
      no_calificado: 0,
      peon: 0
    };
    rates.forEach((item) => {
      patch[item.categoria] = item.valorHora;
    });
    this.ratesForm.patchValue(patch);
  }
}
