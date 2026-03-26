import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppSettingsService } from '../../../../../core/services/app-settings.service';
import { ProfileService } from '../../../../../core/services/profile.service';
import { OvertimeService } from '../../../../../core/services/overtime.service';
import { OvertimeEntry, UserProfile } from '../../../../../core/models/overtime.models';
import { getLoadFailureMessage, isUnauthorizedAfterLogout } from '../../../../../core/utils/api-error.util';

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss'
})
export class DashboardPageComponent implements OnInit {
  private readonly onboardingDismissedKey = 'ot_onboarding_dismissed';
  profile: UserProfile | null = null;
  totalGanado = 0;
  totalHorasMesLiquidacion = 0;
  totalHorasHistorico = 0;
  totalGanadoMesLiquidacion = 0;
  horas50 = 0;
  horas100 = 0;
  horasFeriado = 0;
  ultimoRegistroFecha = '-';
  periodoLiquidacion = '';
  fechaPagoEstimada = '';
  cutoffDay = 24;
  liquidacionPeriodos: {
    label: string;
    total: number;
    horas: number;
    cierreMes: string;
    horas50: number;
    horas100: number;
    horasFeriado: number;
  }[] = [];
  expandedLiquidacionIndex: number | null = null;
  showOnboarding = false;
  loading = true;
  loadError = false;
  loadErrorMessage = '';

  constructor(
    private readonly profileService: ProfileService,
    private readonly overtimeService: OvertimeService,
    private readonly appSettingsService: AppSettingsService
  ) {}

  ngOnInit(): void {
    this.profile = this.profileService.getProfile();
    this.cutoffDay = this.appSettingsService.getSettings().cutoffDay;
    this.showOnboarding = localStorage.getItem(this.onboardingDismissedKey) !== '1';
    this.fetchEntries();
  }

  retry(): void {
    this.loading = true;
    this.loadError = false;
    this.loadErrorMessage = '';
    this.fetchEntries();
  }

  dismissOnboarding(): void {
    this.showOnboarding = false;
    localStorage.setItem(this.onboardingDismissedKey, '1');
  }

  /** Multiplicador aplicado al valor hora por antigüedad (regla: 1 + años/100). */
  get antiguedadMultiplier(): number {
    const y = this.profile?.antiguedadAnios ?? 0;
    return 1 + Math.max(0, y) / 100;
  }

  private fetchEntries(): void {
    this.overtimeService.fetchEntries().subscribe({
      next: (entries) => {
        this.applyEntries(entries);
        this.loading = false;
        this.loadError = false;
      },
      error: (err: unknown) => {
        this.loading = false;
        if (isUnauthorizedAfterLogout(err)) {
          return;
        }
        this.loadError = true;
        this.loadErrorMessage = getLoadFailureMessage(err);
      }
    });
  }

  private applyEntries(entries: OvertimeEntry[]): void {
    this.cutoffDay = this.appSettingsService.getSettings().cutoffDay;
    const period = this.getActiveLiquidationPeriod(this.cutoffDay, new Date());
    const periodEntries = this.filterEntriesByRange(entries, period.start, period.end);

    this.totalGanado = this.overtimeService.getTotalGanado(entries);
    this.totalHorasHistorico = this.sumHours(entries);
    this.totalHorasMesLiquidacion = this.sumHours(periodEntries);
    this.totalGanadoMesLiquidacion = this.sumAmount(periodEntries);
    this.horas50 = this.sumHoursByType(periodEntries, 'weekday');
    this.horas100 = this.sumHoursByType(periodEntries, 'weekend');
    this.horasFeriado = this.sumHoursByType(periodEntries, 'holiday');
    this.ultimoRegistroFecha = entries.length ? entries[0].fecha : '-';
    // Liquidación estandarizada: dd/MM/yyyy
    this.periodoLiquidacion = `${this.formatDate(period.start)} al ${this.formatDate(period.end)}`;
    // Pago estimado estandarizado: dd/MM/yyyy
    this.fechaPagoEstimada = this.formatDate(this.getFourthBusinessDayOfNextMonth(period.end));

    this.liquidacionPeriodos = this.buildLiquidationPeriodSummaries(entries, period.start, this.cutoffDay);
  }

  private getActiveLiquidationPeriod(cutoffDay: number, now: Date): { start: Date; end: Date } {
    const y = now.getFullYear();
    const m = now.getMonth();

    // Si hoy ya pasó el día de corte (ej: > 24), el período activo arranca en el 24 de este mes.
    const isAfterCutoff = now.getDate() > cutoffDay;

    const start = isAfterCutoff ? new Date(y, m, cutoffDay) : new Date(y, m - 1, cutoffDay);
    const end = isAfterCutoff ? new Date(y, m + 1, cutoffDay) : new Date(y, m, cutoffDay);

    return { start, end };
  }

  private filterEntriesByRange(entries: OvertimeEntry[], start: Date, end: Date): OvertimeEntry[] {
    return entries.filter((entry) => {
      const d = this.parseLocalDate(entry.fecha);
      return d >= start && d <= end;
    });
  }

  private buildLiquidationPeriodSummaries(
    entries: OvertimeEntry[],
    activeStart: Date,
    cutoffDay: number
  ): {
    label: string;
    total: number;
    horas: number;
    cierreMes: string;
    horas50: number;
    horas100: number;
    horasFeriado: number;
  }[] {
    if (!entries.length) return [];

    const minDate = entries
      .map((e) => this.parseLocalDate(e.fecha))
      .reduce((min, d) => (d < min ? d : min));

    const summaries: {
      label: string;
      total: number;
      horas: number;
      cierreMes: string;
      horas50: number;
      horas100: number;
      horasFeriado: number;
    }[] = [];

    // Recorremos períodos hacia atrás en pasos de 1 mes:
    // período M => [M/cutoffDay .. (M+1)/cutoffDay]
    let cursorStart = new Date(activeStart.getFullYear(), activeStart.getMonth(), cutoffDay);
    let guard = 0;

    while (guard < 360) {
      const start = cursorStart;
      const end = new Date(start.getFullYear(), start.getMonth() + 1, cutoffDay);

      if (end < minDate) break;

      const periodEntries = this.filterEntriesByRange(entries, start, end);
      if (periodEntries.length) {
        const total = this.sumAmount(periodEntries);
        const horas = this.sumHours(periodEntries);
        const horas50 = this.sumHoursByType(periodEntries, 'weekday');
        const horas100 = this.sumHoursByType(periodEntries, 'weekend');
        const horasFeriado = this.sumHoursByType(periodEntries, 'holiday');
        summaries.push({
          label: `${this.formatDate(start)} al ${this.formatDate(end)}`,
          total,
          horas,
          cierreMes: this.getSpanishMonthUpper(end),
          horas50,
          horas100,
          horasFeriado
        });
      }

      cursorStart = new Date(start.getFullYear(), start.getMonth() - 1, cutoffDay);
      guard += 1;
    }

    return summaries;
  }

  toggleLiquidacion(i: number): void {
    this.expandedLiquidacionIndex = this.expandedLiquidacionIndex === i ? null : i;
  }

  private getSpanishMonthUpper(date: Date): string {
    const month = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(date);
    // Ej: "marzo" -> "MARZO"
    return month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
  }

  private sumHours(entries: OvertimeEntry[]): number {
    return Number(entries.reduce((acc, entry) => acc + entry.horasExtra, 0).toFixed(2));
  }

  private sumAmount(entries: OvertimeEntry[]): number {
    return entries.reduce((acc, entry) => acc + entry.totalPesos, 0);
  }

  private sumHoursByType(entries: OvertimeEntry[], type: OvertimeEntry['tipoDia']): number {
    return Number(
      entries
        .filter((entry) => entry.tipoDia === type)
        .reduce((acc, entry) => acc + entry.horasExtra, 0)
        .toFixed(2)
    );
  }

  private getFourthBusinessDayOfNextMonth(referenceDate: Date): Date {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth() + 1;
    const cursor = new Date(year, month, 1);
    let businessDays = 0;

    while (businessDays < 4) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) businessDays += 1;
      if (businessDays < 4) cursor.setDate(cursor.getDate() + 1);
    }

    return cursor;
  }

  private parseLocalDate(isoDate: string): Date {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  private formatDayMonth(date: Date): string {
    // Intl en es-AR devuelve algo como "6 de mayo" (sin año).
    const day = date.getDate();
    const monthUpper = this.getSpanishMonthUpper(date);
    return `${day} de ${monthUpper}`;
  }

  private formatDayMonthUpper(date: Date): string {
    const day = date.getDate();
    const monthUpper = this.getSpanishMonthUpper(date);
    return `${day} de ${monthUpper}`;
  }
}
