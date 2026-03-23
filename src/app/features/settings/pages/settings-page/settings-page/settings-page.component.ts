import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { WorkerCategory, WorkShift } from '../../../../../core/models/overtime.models';
import { AppSettingsService } from '../../../../../core/services/app-settings.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { OvertimeService } from '../../../../../core/services/overtime.service';
import { ProfileService } from '../../../../../core/services/profile.service';
import { RateConfigService } from '../../../../../core/services/rate-config.service';
import { AppSwal } from '../../../../../core/utils/alert.util';
import { getUserFacingErrorMessage } from '../../../../../core/utils/api-error.util';

@Component({
  selector: 'app-settings-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss'
})
export class SettingsPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  @ViewChild('backupInput') backupInput?: ElementRef<HTMLInputElement>;

  readonly categoryOrder: WorkerCategory[] = [
    'especial',
    'calificado',
    'semicalificado',
    'no_calificado',
    'peon'
  ];

  readonly categorias: { value: WorkerCategory; label: string }[] = [
    { value: 'especial', label: 'Especial' },
    { value: 'calificado', label: 'Calificado' },
    { value: 'semicalificado', label: 'Semicalificado' },
    { value: 'no_calificado', label: 'No calificado' },
    { value: 'peon', label: 'Peon' }
  ];

  readonly turnos: { value: WorkShift; label: string }[] = [
    { value: 'morning', label: 'Turno mañana (14:00–18:00 en semana)' },
    { value: 'afternoon', label: 'Turno tarde (10:00–14:00 en semana)' }
  ];

  readonly profileForm = this.fb.group({
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    categoria: ['calificado' as WorkerCategory, [Validators.required]],
    antiguedadAnios: [0, [Validators.required, Validators.min(0), Validators.max(50)]],
    workShift: ['morning' as WorkShift, [Validators.required]]
  });

  readonly configForm = this.fb.group({
    cutoffDay: [24, [Validators.required, Validators.min(1), Validators.max(28)]]
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
    private readonly rateConfigService: RateConfigService,
    private readonly authService: AuthService,
    private readonly profileService: ProfileService,
    private readonly overtimeService: OvertimeService
  ) {
    this.loadCurrentConfig();
  }

  ngOnInit(): void {
    if (!this.profileService.isAdmin()) {
      this.configForm.disable({ emitEvent: false });
      this.ratesForm.disable({ emitEvent: false });
    }
  }

  get isAdmin(): boolean {
    return this.profileService.isAdmin();
  }

  get profileEmail(): string | null {
    return this.profileService.getProfile()?.email ?? null;
  }

  openImportDialog(): void {
    this.backupInput?.nativeElement.click();
  }

  async exportBackup(): Promise<void> {
    try {
      const entries = await firstValueFrom(this.overtimeService.fetchEntries());
      const profile = this.profileService.getProfile();
      const categoryRates = this.rateConfigService.getRates();
      const appSettings = this.appSettingsService.getSettings();

      const payload = {
        version: 2,
        source: 'api',
        exportedAt: new Date().toISOString(),
        profile,
        email: profile?.email ?? null,
        categoryRates,
        entries,
        appSettings
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
        title: 'Listo',
        text: 'El archivo de respaldo se descargó en tu carpeta de descargas.',
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });
    } catch (err) {
      await AppSwal.fire({
        title: 'No se pudo exportar',
        text: getUserFacingErrorMessage(err, 'No pudimos generar el archivo. Probá de nuevo.'),
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
  }

  async importBackup(_event: Event): Promise<void> {
    await AppSwal.fire({
      title: 'Importar no está disponible',
      text: 'Por ahora los cambios se hacen desde los formularios de la app. Si necesitás ayuda, contactá a quien administra el sistema.',
      icon: 'info',
      confirmButtonText: 'Aceptar'
    });
    const input = _event.target as HTMLInputElement;
    input.value = '';
  }

  async resetData(): Promise<void> {
    const result = await AppSwal.fire({
      title: '¿Salir de la cuenta?',
      text: 'Vas a salir en este dispositivo. Tus registros siguen guardados.',
      icon: 'warning',
      showCancelButton: true,
      customClass: {
        confirmButton: 'swal-btn swal-btn-danger',
        cancelButton: 'swal-btn swal-btn-cancel'
      },
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    this.authService.logout();
    localStorage.removeItem('ot_onboarding_dismissed');

    await AppSwal.fire({
      title: 'Listo',
      text: 'Saliste de tu cuenta.',
      icon: 'success',
      confirmButtonText: 'Aceptar'
    });

    void this.router.navigate(['/auth']);
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const raw = this.profileForm.getRawValue();
    try {
      await firstValueFrom(
        this.authService.updateProfile({
          nombre: raw.nombre!.trim(),
          apellido: raw.apellido!.trim(),
          categoria: raw.categoria!,
          antiguedadAnios: Number(raw.antiguedadAnios ?? 0),
          workShift: raw.workShift!
        })
      );

      await AppSwal.fire({
        title: 'Listo',
        text: 'Tu perfil se actualizó correctamente.',
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });
    } catch (err) {
      await AppSwal.fire({
        title: 'No se pudo guardar',
        text: getUserFacingErrorMessage(err, 'Revisá los datos e intentá otra vez.'),
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
  }

  async saveGeneralConfig(): Promise<void> {
    if (!this.profileService.isAdmin()) {
      await AppSwal.fire({
        title: 'Solo administración',
        text: 'Solo quien administra la cuenta puede cambiar el día de corte.',
        icon: 'info',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    if (this.configForm.invalid) {
      this.configForm.markAllAsTouched();
      return;
    }

    const { cutoffDay } = this.configForm.getRawValue();

    try {
      await firstValueFrom(
        this.appSettingsService.saveSettings({
          cutoffDay: Number(cutoffDay)
        })
      );

      await AppSwal.fire({
        title: 'Listo',
        text: 'El día de corte se guardó correctamente.',
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });
    } catch (err) {
      await AppSwal.fire({
        title: 'No se pudo guardar',
        text: getUserFacingErrorMessage(err, 'Probá de nuevo en un momento.'),
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
  }

  async saveRates(): Promise<void> {
    if (!this.profileService.isAdmin()) {
      await AppSwal.fire({
        title: 'Solo administración',
        text: 'Solo quien administra la cuenta puede cambiar los valores por categoría.',
        icon: 'info',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    if (this.ratesForm.invalid) {
      this.ratesForm.markAllAsTouched();
      return;
    }

    const raw = this.ratesForm.getRawValue();
    const rates = this.categoryOrder.map((categoria) => ({
      categoria,
      valorHora: Number(raw[categoria] ?? 0)
    }));

    try {
      await firstValueFrom(this.rateConfigService.saveRates(rates));

      await AppSwal.fire({
        title: 'Listo',
        text: 'Los valores por categoría se guardaron correctamente.',
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });
    } catch (err) {
      await AppSwal.fire({
        title: 'No se pudo guardar',
        text: getUserFacingErrorMessage(err, 'Probá de nuevo en un momento.'),
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
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
    const profile = this.profileService.getProfile();
    if (profile) {
      this.profileForm.patchValue({
        nombre: profile.nombre,
        apellido: profile.apellido,
        categoria: profile.categoria,
        antiguedadAnios: profile.antiguedadAnios,
        workShift: profile.workShift
      });
    }

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
