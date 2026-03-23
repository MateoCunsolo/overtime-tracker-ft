import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { OvertimeEntry, WorkShift } from '../../../../../core/models/overtime.models';
import { OvertimeService } from '../../../../../core/services/overtime.service';
import { ProfileService } from '../../../../../core/services/profile.service';
import { AppSwal, closeProcessingAlert, showProcessingAlert } from '../../../../../core/utils/alert.util';
import { getLoadFailureMessage, getUserFacingErrorMessage, isUnauthorizedAfterLogout } from '../../../../../core/utils/api-error.util';

@Component({
  selector: 'app-overtime-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './overtime-page.component.html',
  styleUrl: './overtime-page.component.scss'
})
export class OvertimePageComponent {
  private readonly fb = inject(FormBuilder);
  @ViewChild('editFormCard') editFormCard?: ElementRef<HTMLElement>;

  entries: OvertimeEntry[] = [];
  editingEntryId: string | null = null;
  isManualMode = false;
  selectedPresetLabel: string | null = null;
  showEditGlow = false;
  errorMessage = '';
  /** Evita doble POST al guardar. */
  savingEntry = false;
  /** Id del registro que se está borrando (evita doble DELETE). */
  deletingEntryId: string | null = null;

  readonly form = this.fb.group({
    fecha: ['', [Validators.required]],
    horaInicio: ['', [Validators.required]],
    horaFin: ['', [Validators.required]],
    esFeriadoNacional: [false],
    observaciones: ['']
  });

  readonly filterForm = this.fb.group({
    fechaDesde: [''],
    fechaHasta: [''],
    tipoDia: ['all' as OvertimeEntry['tipoDia'] | 'all']
  });

  constructor(
    private readonly overtimeService: OvertimeService,
    private readonly profileService: ProfileService
  ) {
    this.reload();
  }

  get filteredEntries(): OvertimeEntry[] {
    const filter = this.filterForm.getRawValue();

    return this.entries.filter((entry) => {
      const fromOk = !filter.fechaDesde || entry.fecha >= filter.fechaDesde;
      const toOk = !filter.fechaHasta || entry.fecha <= filter.fechaHasta;
      const typeOk = filter.tipoDia === 'all' || entry.tipoDia === filter.tipoDia;
      return fromOk && toOk && typeOk;
    });
  }

  async saveEntry(): Promise<void> {
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await AppSwal.fire({
        title: 'Faltan datos',
        text: 'Indicá la fecha y el horario de inicio y fin.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    const profile = this.profileService.getProfile();
    if (!profile) {
      this.errorMessage = 'Iniciá sesión para cargar horas.';
      await AppSwal.fire({
        title: 'Iniciá sesión',
        text: this.errorMessage,
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    const value = this.form.getRawValue();
    const duplicatedEntry = this.entries.find(
      (entry) => entry.fecha === value.fecha && entry.id !== this.editingEntryId
    );
    if (duplicatedEntry) {
      const result = await AppSwal.fire({
        title: 'Ya hay un registro ese día',
        text: 'Solo podés tener un registro por fecha. ¿Querés editar el que ya está?',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sí, editar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        this.startEdit(duplicatedEntry);
      }
      return;
    }

    const payload = {
      fecha: value.fecha!,
      horaInicio: value.horaInicio!,
      horaFin: value.horaFin!,
      esFeriadoNacional: Boolean(value.esFeriadoNacional),
      observaciones: value.observaciones?.trim() ?? ''
    };

    const editingId = this.editingEntryId;

    if (this.savingEntry) return;
    this.savingEntry = true;
    showProcessingAlert(editingId ? 'Guardando cambios...' : 'Guardando registro...');
    try {
      if (editingId) {
        await firstValueFrom(this.overtimeService.updateEntry(editingId, payload));
      } else {
        await firstValueFrom(this.overtimeService.createEntry(payload));
      }

      closeProcessingAlert();
      this.resetForm();
      this.reload();
      await AppSwal.fire({
        title: 'Listo',
        text: editingId ? 'Los cambios ya están guardados.' : 'El registro ya está guardado.',
        icon: 'success',
        timer: 1400,
        showConfirmButton: false
      });
    } catch (error) {
      closeProcessingAlert();
      this.errorMessage = getUserFacingErrorMessage(
        error,
        'No pudimos guardar. Revisá horarios, feriados y turno.'
      );
      await AppSwal.fire({
        title: 'No se pudo guardar',
        text: this.errorMessage,
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    } finally {
      this.savingEntry = false;
    }
  }

  startEdit(entry: OvertimeEntry): void {
    this.editingEntryId = entry.id;
    this.isManualMode = true;
    this.selectedPresetLabel = null;
    this.form.patchValue({
      fecha: entry.fecha,
      horaInicio: entry.horaInicio,
      horaFin: entry.horaFin,
      esFeriadoNacional: entry.esFeriadoNacional,
      observaciones: entry.observaciones
    });
    this.focusEditForm();
  }

  cancelEdit(): void {
    this.resetForm();
  }

  clearFilters(): void {
    this.filterForm.reset({
      fechaDesde: '',
      fechaHasta: '',
      tipoDia: 'all'
    });
  }

  applyQuickPreset(preset: { label: string; horaInicio: string; horaFin: string }): void {
    this.isManualMode = false;
    this.selectedPresetLabel = preset.label;
    this.form.patchValue({
      fecha: this.getTodayIsoDate(),
      horaInicio: preset.horaInicio,
      horaFin: preset.horaFin
    });
  }

  enableQuickMode(): void {
    if (this.editingEntryId) return;
    this.isManualMode = false;
  }

  enableManualMode(): void {
    this.isManualMode = true;
    this.selectedPresetLabel = null;
    if (!this.form.value.fecha) {
      this.form.patchValue({ fecha: this.getTodayIsoDate() });
    }
  }

  async deleteEntry(id: string): Promise<void> {
    const result = await AppSwal.fire({
      title: '¿Borrar este registro?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      customClass: {
        confirmButton: 'swal-btn swal-btn-danger',
        cancelButton: 'swal-btn swal-btn-cancel'
      },
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    if (this.deletingEntryId) return;
    this.deletingEntryId = id;
    showProcessingAlert('Eliminando registro...');
    try {
      await firstValueFrom(this.overtimeService.deleteEntry(id));
      closeProcessingAlert();
      this.reload();
      if (this.editingEntryId === id) this.resetForm();

      await AppSwal.fire({
        title: 'Borrado',
        text: 'El registro se eliminó.',
        icon: 'success',
        timer: 1400,
        showConfirmButton: false
      });
    } catch (error) {
      closeProcessingAlert();
      await AppSwal.fire({
        title: 'No se pudo borrar',
        text: getUserFacingErrorMessage(error, 'Probá de nuevo en un momento.'),
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    } finally {
      this.deletingEntryId = null;
    }
  }

  get dayTypeLabelMap(): Record<OvertimeEntry['tipoDia'], string> {
    return {
      weekday: 'Semana (+50%)',
      weekend: 'Sab/Dom (+100%)',
      holiday: 'Feriado (+65%)'
    };
  }

  get quickPresets(): { label: string; horaInicio: string; horaFin: string }[] {
    const day = new Date().getDay();
    if (day === 0) return [{ label: 'Hoy de 06:00 a 14:00', horaInicio: '06:00', horaFin: '14:00' }];
    if (day === 6) return [{ label: 'Hoy de 14:00 a 22:00', horaInicio: '14:00', horaFin: '22:00' }];

    const shift: WorkShift = this.profileService.getProfile()?.workShift ?? 'morning';
    if (shift === 'afternoon') {
      return [
        { label: 'Hoy de 10:00 a 11:00', horaInicio: '10:00', horaFin: '11:00' },
        { label: 'Hoy de 10:00 a 12:00', horaInicio: '10:00', horaFin: '12:00' },
        { label: 'Hoy de 10:00 a 13:00', horaInicio: '10:00', horaFin: '13:00' },
        { label: 'Hoy de 10:00 a 14:00', horaInicio: '10:00', horaFin: '14:00' }
      ];
    }
    return [
      { label: 'Hoy de 14:00 a 15:00', horaInicio: '14:00', horaFin: '15:00' },
      { label: 'Hoy de 14:00 a 16:00', horaInicio: '14:00', horaFin: '16:00' },
      { label: 'Hoy de 14:00 a 17:00', horaInicio: '14:00', horaFin: '17:00' },
      { label: 'Hoy de 14:00 a 18:00', horaInicio: '14:00', horaFin: '18:00' }
    ];
  }

  /** Ayuda para carga manual: feriados y fines de semana no usan esta ventana. */
  get weekdayShiftHint(): string {
    const shift = this.profileService.getProfile()?.workShift ?? 'morning';
    if (shift === 'afternoon') {
      return 'Turno tarde: en días de semana (sin feriado), horas extra entre 10:00 y 14:00, de 1 a 4 h completas.';
    }
    return 'Turno mañana: en días de semana (sin feriado), horas extra entre 14:00 y 18:00, de 1 a 4 h completas.';
  }

  private reload(): void {
    this.overtimeService.fetchEntries().subscribe({
      next: (list) => {
        this.entries = list;
      },
      error: async (err: unknown) => {
        if (isUnauthorizedAfterLogout(err)) {
          return;
        }
        await AppSwal.fire({
          title: 'No se pudo cargar el listado',
          text: getLoadFailureMessage(err),
          icon: 'error',
          confirmButtonText: 'Aceptar'
        });
      }
    });
  }

  private resetForm(): void {
    this.editingEntryId = null;
    this.isManualMode = false;
    this.selectedPresetLabel = null;
    this.showEditGlow = false;
    this.form.reset({
      fecha: '',
      horaInicio: '',
      horaFin: '',
      esFeriadoNacional: false,
      observaciones: ''
    });
  }

  private focusEditForm(): void {
    this.showEditGlow = true;
    this.editFormCard?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    setTimeout(() => {
      this.showEditGlow = false;
    }, 1800);
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
