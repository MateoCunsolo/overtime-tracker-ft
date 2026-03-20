import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { OvertimeEntry, UserProfile } from '../../../../../core/models/overtime.models';
import { AppSettingsService } from '../../../../../core/services/app-settings.service';
import { OvertimeService } from '../../../../../core/services/overtime.service';
import { ProfileService } from '../../../../../core/services/profile.service';
import { AppSwal } from '../../../../../core/utils/alert.util';

@Component({
  selector: 'app-reports-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.scss'
})
export class ReportsPageComponent {
  private readonly fb = inject(FormBuilder);

  readonly profile: UserProfile | null;
  readonly cutoffDay: number;
  entries: OvertimeEntry[] = [];
  filteredEntries: OvertimeEntry[] = [];
  errorMessage = '';

  readonly form = this.fb.group({
    modo: ['mes' as 'mes' | 'rango' | 'corte', [Validators.required]],
    mes: ['', [Validators.required]],
    fechaDesde: [''],
    fechaHasta: ['']
  });

  constructor(
    private readonly overtimeService: OvertimeService,
    private readonly profileService: ProfileService,
    private readonly appSettingsService: AppSettingsService
  ) {
    this.profile = this.profileService.getProfile();
    this.cutoffDay = this.appSettingsService.getSettings().cutoffDay;
    this.entries = this.overtimeService.getEntries();
    this.form.controls.mes.setValue(this.getCurrentMonthValue());
    this.applyFilter();
  }

  get totalFiltrado(): number {
    return this.filteredEntries.reduce((acc, item) => acc + item.totalPesos, 0);
  }

  getPreviewTypeLabel(type: OvertimeEntry['tipoDia']): string {
    if (type === 'holiday') return 'Feriado';
    if (type === 'weekend') return 'Sábado / domingo';
    return 'Día de semana';
  }

  applyFilter(): void {
    this.errorMessage = '';
    const value = this.form.getRawValue();
    const mode = value.modo;

    if (mode === 'mes') {
      if (!value.mes) {
        this.filteredEntries = [];
        this.errorMessage = 'Selecciona un mes para filtrar.';
        return;
      }

      const [yearStr, monthStr] = value.mes.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);

      this.filteredEntries = this.entries.filter((item) => {
        const d = new Date(`${item.fecha}T00:00:00`);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
      this.filteredEntries = this.sortEntriesByDateAsc(this.filteredEntries);
      return;
    }

    if (mode === 'corte') {
      const period = this.getCurrentCutoffPeriod();
      this.filteredEntries = this.entries.filter(
        (item) => item.fecha >= period.startIso && item.fecha <= period.endIso
      );
      this.filteredEntries = this.sortEntriesByDateAsc(this.filteredEntries);
      return;
    }

    if (!value.fechaDesde || !value.fechaHasta) {
      this.filteredEntries = [];
      this.errorMessage = 'Para rango personalizado debes completar desde y hasta.';
      return;
    }

    if (value.fechaDesde > value.fechaHasta) {
      this.filteredEntries = [];
      this.errorMessage = 'La fecha desde no puede ser mayor que la fecha hasta.';
      return;
    }

    this.filteredEntries = this.entries.filter(
      (item) => item.fecha >= value.fechaDesde! && item.fecha <= value.fechaHasta!
    );
    this.filteredEntries = this.sortEntriesByDateAsc(this.filteredEntries);
  }

  async exportReport(): Promise<void> {
    const { isConfirmed, isDenied } = await AppSwal.fire({
      title: 'Elegir formato de exportacion',
      text: 'Selecciona en que formato quieres exportar el reporte.',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'PDF',
      denyButtonText: 'Imagen',
      cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
      await this.generatePdf();
      return;
    }

    if (isDenied) {
      await this.generateImage('png');
    }
  }

  async generatePdf(): Promise<void> {
    const canExport = await this.validateReportData();
    if (!canExport) return;

    const reportLabel = this.getReportLabel();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    doc.setFontSize(14);
    doc.text('Reporte de Horas Extras', 40, 40);

    // Logo local en esquina superior derecha.
    const logoPngDataUrl = await this.getLocalLogoDataUrl();

    if (logoPngDataUrl) {
      const pageW = doc.internal.pageSize.getWidth();
      const logoW = 95;
      const logoH = (logoW * 30) / 206.22;
      const x = pageW - logoW - 40;
      doc.addImage(logoPngDataUrl, 'PNG', x, 18, logoW, logoH);
    }

    doc.setFontSize(10);
    const operatorLine = `Operario: ${this.profile?.nombre ?? ''} ${this.profile?.apellido ?? ''}`.trim();
    doc.setFillColor(145, 255, 80);
    doc.roundedRect(36, 48, 270, 18, 4, 4, 'F');
    doc.setTextColor(20, 35, 20);
    doc.text(operatorLine, 40, 60);
    doc.setTextColor(0, 0, 0);
    doc.text(`Categoria: ${this.profile?.categoria ?? '-'}`, 40, 75);
    doc.text(`Periodo: ${reportLabel}`, 40, 90);
    doc.text(`Registros: ${this.filteredEntries.length}`, 40, 105);

    autoTable(doc, {
      startY: 125,
      head: [['FECHA', 'PORCENTAJE DE PAGO', 'HORAS']],
      body: this.filteredEntries.map((entry) => [
        entry.fecha,
        this.getDayTypeLabel(entry),
        entry.horasExtra.toString()
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [17, 24, 39] }
    });

    const totals = this.calculateHoursByRateType();
    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 125;
    autoTable(doc, {
      startY: finalY + 20,
      head: [['RESUMEN', 'HORAS']],
      body: [
        ['TOTAL HORAS TRABAJADAS AL 50%', totals.weekday.toFixed(2)],
        ['TOTAL HORAS TRABAJADAS AL 100%', totals.weekend.toFixed(2)],
        ['TOTAL HORAS TRABAJADAS FERIADOS', totals.holiday.toFixed(2)]
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [107, 114, 128] },
      columnStyles: {
        0: { cellWidth: 360 },
        1: { halign: 'right' }
      },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index === 1) {
          data.cell.styles.halign = 'right';
        }
      }
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('Herramienta desarrollada por Mateo Cunsolo', 40, pageHeight - 20);
    doc.setTextColor(0, 0, 0);

    const operatorName = `${this.profile?.apellido ?? 'operario'}-${this.profile?.nombre ?? ''}`
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    const fileName = `reporte-horas-${operatorName}-${reportLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    doc.save(fileName);

    await AppSwal.fire({
      title: 'PDF generado',
      text: `Archivo: ${fileName}`,
      icon: 'success',
      confirmButtonText: 'Entendido'
    });
  }

  private async generateImage(format: 'png' | 'jpeg'): Promise<void> {
    const canExport = await this.validateReportData();
    if (!canExport) return;

    const reportLabel = this.getReportLabel();
    const operatorLine = `Operario: ${this.profile?.nombre ?? ''} ${this.profile?.apellido ?? ''}`.trim();
    const totals = this.calculateHoursByRateType();
    const rows = this.filteredEntries.length;
    const canvasWidth = 1200;
    const rowHeight = 34;
    const baseHeight = 260;
    const summaryRowsCount = 3;
    const summaryTitleHeight = 36;
    const summaryRowsHeight = rowHeight * summaryRowsCount;
    const summarySpacingTop = 24;
    const summarySpacingBottom = 28;
    const footerPaddingBottom = 34;
    const canvasHeight =
      baseHeight +
      rows * rowHeight +
      summarySpacingTop +
      summaryTitleHeight +
      summaryRowsHeight +
      summarySpacingBottom +
      footerPaddingBottom;
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      await AppSwal.fire({
        title: 'Error al exportar imagen',
        text: 'No se pudo generar el archivo de imagen.',
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Logo local en esquina superior derecha.
    const logoPngDataUrl = await this.getLocalLogoDataUrl();

    if (logoPngDataUrl) {
      const logoImg = new Image();
      logoImg.decoding = 'async';
      logoImg.src = logoPngDataUrl;
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
      });

      const logoW = 200;
      const logoH = (logoW * 30) / 206.22;
      const x = canvasWidth - logoW - 30;
      const y = 16;
      ctx.drawImage(logoImg, x, y, logoW, logoH);
    }

    ctx.fillStyle = '#111827';
    ctx.font = '700 32px Montserrat, sans-serif';
    ctx.fillText('Reporte de Horas Extras', 45, 60);

    ctx.fillStyle = '#91ff50';
    ctx.fillRect(40, 78, 560, 36);
    ctx.fillStyle = '#142314';
    ctx.font = '600 22px Montserrat, sans-serif';
    ctx.fillText(operatorLine, 50, 103);

    ctx.fillStyle = '#111827';
    ctx.font = '500 18px Montserrat, sans-serif';
    ctx.fillText(`Categoria: ${this.profile?.categoria ?? '-'}`, 45, 138);
    ctx.fillText(`Periodo: ${reportLabel}`, 45, 166);
    ctx.fillText(`Registros: ${this.filteredEntries.length}`, 45, 194);

    const tableTop = 220;
    ctx.fillStyle = '#111827';
    ctx.fillRect(40, tableTop, 1120, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 16px Montserrat, sans-serif';
    ctx.fillText('FECHA', 55, tableTop + 24);
    ctx.fillText('PORCENTAJE DE PAGO', 300, tableTop + 24);
    ctx.fillText('HORAS', 1080, tableTop + 24);

    this.filteredEntries.forEach((entry, index) => {
      const y = tableTop + 36 + rowHeight * index;
      ctx.fillStyle = index % 2 === 0 ? '#f8fafc' : '#ffffff';
      ctx.fillRect(40, y, 1120, rowHeight);
      ctx.fillStyle = '#111827';
      ctx.font = '500 15px Montserrat, sans-serif';
      ctx.fillText(entry.fecha, 55, y + 22);
      ctx.fillText(this.getDayTypeLabel(entry), 300, y + 22);
      ctx.textAlign = 'right';
      ctx.fillText(entry.horasExtra.toFixed(2), 1140, y + 22);
      ctx.textAlign = 'left';
    });

    const summaryTop = tableTop + 36 + rowHeight * rows + summarySpacingTop;
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(40, summaryTop, 1120, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 16px Montserrat, sans-serif';
    ctx.fillText('RESUMEN', 55, summaryTop + 24);
    ctx.textAlign = 'right';
    ctx.fillText('HORAS', 1140, summaryTop + 24);
    ctx.textAlign = 'left';

    const summaryRows = [
      ['TOTAL HORAS TRABAJADAS AL 50%', totals.weekday.toFixed(2)],
      ['TOTAL HORAS TRABAJADAS AL 100%', totals.weekend.toFixed(2)],
      ['TOTAL HORAS TRABAJADAS FERIADOS', totals.holiday.toFixed(2)]
    ];

    summaryRows.forEach((row, index) => {
      const y = summaryTop + 36 + rowHeight * index;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(40, y, 1120, rowHeight);
      ctx.strokeStyle = '#e5e7eb';
      ctx.strokeRect(40, y, 1120, rowHeight);
      ctx.fillStyle = '#111827';
      ctx.font = '500 15px Montserrat, sans-serif';
      ctx.fillText(row[0], 55, y + 22);
      ctx.textAlign = 'right';
      ctx.fillText(row[1], 1140, y + 22);
      ctx.textAlign = 'left';
    });

    ctx.fillStyle = '#6b7280';
    ctx.font = '500 14px Montserrat, sans-serif';
    const footerY = summaryTop + summaryTitleHeight + summaryRowsHeight + summarySpacingBottom;
    ctx.fillText('Herramienta desarrollada por Mateo Cunsolo', 45, footerY);

    const operatorName = `${this.profile?.apellido ?? 'operario'}-${this.profile?.nombre ?? ''}`
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    const extension = format === 'png' ? 'png' : 'jpg';
    const fileName = `reporte-horas-${operatorName}-${reportLabel.replace(/\s+/g, '-').toLowerCase()}.${extension}`;
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, 0.95);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.click();

    await AppSwal.fire({
      title: 'Imagen generada',
      text: `Archivo: ${fileName}`,
      icon: 'success',
      confirmButtonText: 'Entendido'
    });
  }

  private async validateReportData(): Promise<boolean> {
    this.applyFilter();
    if (this.errorMessage) {
      await AppSwal.fire({
        title: 'No se pudo generar el reporte',
        text: this.errorMessage,
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return false;
    }

    if (!this.filteredEntries.length) {
      this.errorMessage = 'No hay horas extra para el periodo seleccionado.';
      await AppSwal.fire({
        title: 'Sin datos',
        text: this.errorMessage,
        icon: 'info',
        confirmButtonText: 'Entendido'
      });
      return false;
    }

    return true;
  }

  private getCurrentMonthValue(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private getReportLabel(): string {
    const value = this.form.getRawValue();
    if (value.modo === 'mes' && value.mes) return value.mes;
    if (value.modo === 'corte') {
      const period = this.getCurrentCutoffPeriod();
      return `${period.startIso}_a_${period.endIso}`;
    }
    return `${value.fechaDesde ?? ''}_a_${value.fechaHasta ?? ''}`;
  }

  get cutoffPeriodLabel(): string {
    const period = this.getCurrentCutoffPeriod();
    return `${period.startIso} al ${period.endIso}`;
  }

  private getDayTypeLabel(entry: OvertimeEntry): string {
    const dayName = this.getSpanishDayName(entry.fecha);
    if (entry.tipoDia === 'holiday') return `${dayName} - al 65%`;
    if (entry.tipoDia === 'weekend') return `${dayName} - al 100%`;
    return `${dayName} - al 50%`;
  }

  private getSpanishDayName(isoDate: string): string {
    const day = new Date(`${isoDate}T00:00:00`).getDay();
    const map = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    return map[day] ?? 'Dia';
  }

  private calculateHoursByRateType(): { weekday: number; weekend: number; holiday: number } {
    return this.filteredEntries.reduce(
      (acc, entry) => {
        if (entry.tipoDia === 'holiday') {
          acc.holiday += entry.horasExtra;
          return acc;
        }

        if (entry.tipoDia === 'weekend') {
          acc.weekend += entry.horasExtra;
          return acc;
        }

        acc.weekday += entry.horasExtra;
        return acc;
      },
      { weekday: 0, weekend: 0, holiday: 0 }
    );
  }

  private getCurrentCutoffPeriod(): { startIso: string; endIso: string } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const end = new Date(year, month, this.cutoffDay);
    const start = new Date(year, month - 1, this.cutoffDay);

    return {
      startIso: this.toIsoDate(start),
      endIso: this.toIsoDate(end)
    };
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private sortEntriesByDateAsc(entries: OvertimeEntry[]): OvertimeEntry[] {
    return [...entries].sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  private async getLocalLogoDataUrl(): Promise<string | null> {
    try {
      const res = await fetch('/norgreen-head.png', { cache: 'force-cache' });
      if (!res.ok) return null;

      const blob = await res.blob();
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }
}
