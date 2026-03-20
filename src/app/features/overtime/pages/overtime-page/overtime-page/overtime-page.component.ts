import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { OvertimeEntry } from '../../../../../core/models/overtime.models';
import { OvertimeService } from '../../../../../core/services/overtime.service';
import { ProfileService } from '../../../../../core/services/profile.service';
import { AppSwal } from '../../../../../core/utils/alert.util';

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
        text: 'Completa fecha, hora de inicio y hora de fin para continuar.',
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const profile = this.profileService.getProfile();
    if (!profile) {
      this.errorMessage = 'Debes registrarte antes de cargar horas.';
      await AppSwal.fire({
        title: 'Perfil no encontrado',
        text: this.errorMessage,
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const value = this.form.getRawValue();
    const duplicatedEntry = this.entries.find(
      (entry) => entry.fecha === value.fecha && entry.id !== this.editingEntryId
    );
    if (duplicatedEntry) {
      const result = await AppSwal.fire({
        title: 'Ya existe un registro en esa fecha',
        text: 'No se puede guardar otro registro el mismo día. ¿Quieres editar el existente?',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sí, editarlo',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        this.startEdit(duplicatedEntry);
      }
      return;
    }

    try {
      const payload = {
        fecha: value.fecha!,
        horaInicio: value.horaInicio!,
        horaFin: value.horaFin!,
        esFeriadoNacional: Boolean(value.esFeriadoNacional),
        observaciones: value.observaciones?.trim() ?? '',
        categoriaUsuario: profile.categoria,
        antiguedadAnios: profile.antiguedadAnios
      };

      const editingId = this.editingEntryId;
      if (editingId) {
        this.overtimeService.updateEntry(editingId, payload);
      } else {
        this.overtimeService.createEntry(payload);
      }

      this.resetForm();
      this.reload();
      await AppSwal.fire({
        title: editingId ? 'Registro actualizado' : 'Registro guardado',
        text: editingId
          ? 'La hora extra se actualizo correctamente.'
          : 'La hora extra se guardo correctamente.',
        icon: 'success',
        timer: 1400,
        showConfirmButton: false
      });
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'No fue posible guardar el registro.';
      await AppSwal.fire({
        title: 'No se pudo guardar',
        text: this.errorMessage,
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
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
      title: 'Eliminar registro',
      text: 'Esta accion no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    this.overtimeService.deleteEntry(id);
    this.reload();
    if (this.editingEntryId === id) this.resetForm();

    await AppSwal.fire({
      title: 'Registro eliminado',
      icon: 'success',
      timer: 1400,
      showConfirmButton: false
    });
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
    return [
      { label: 'Hoy de 14:00 a 15:00', horaInicio: '14:00', horaFin: '15:00' },
      { label: 'Hoy de 14:00 a 16:00', horaInicio: '14:00', horaFin: '16:00' },
      { label: 'Hoy de 14:00 a 17:00', horaInicio: '14:00', horaFin: '17:00' },
      { label: 'Hoy de 14:00 a 18:00', horaInicio: '14:00', horaFin: '18:00' }
    ];
  }

  private reload(): void {
    this.entries = this.overtimeService.getEntries();
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
