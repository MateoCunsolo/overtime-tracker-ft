import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { OvertimeEntry, UserProfile } from '../../../../../core/models/overtime.models';
import { AppSettingsService } from '../../../../../core/services/app-settings.service';
import { OvertimeService } from '../../../../../core/services/overtime.service';
import { ProfileService } from '../../../../../core/services/profile.service';
import { AppSwal, closeProcessingAlert, showProcessingAlert } from '../../../../../core/utils/alert.util';
import { getLoadFailureMessage, isUnauthorizedAfterLogout } from '../../../../../core/utils/api-error.util';
import { IsoDateToDmyPipe } from '../../../../../core/pipes/iso-date-to-dmy.pipe';

@Component({
  selector: 'app-reports-page',
  imports: [CommonModule, ReactiveFormsModule, IsoDateToDmyPipe],
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.scss'
})
export class ReportsPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  profile: UserProfile | null = null;
  cutoffDay = 24;
  entries: OvertimeEntry[] = [];
  filteredEntries: OvertimeEntry[] = [];
  /** Errores de validación del filtro (no confundir con fallo de red). */
  errorMessage = '';
  entriesLoading = true;
  entriesLoadError = false;
  entriesLoadErrorMessage = '';
  /** Evita abrir dos diálogos de exportación a la vez. */
  exportInProgress = false;

  readonly form = this.fb.group({
    modo: ['corte' as 'mes' | 'rango' | 'corte', [Validators.required]],
    mes: ['', [Validators.required]],
    fechaDesde: [''],
    fechaHasta: [''],
    incluirObservaciones: [false]
  });

  constructor(
    private readonly overtimeService: OvertimeService,
    private readonly profileService: ProfileService,
    private readonly appSettingsService: AppSettingsService
  ) {}

  ngOnInit(): void {
    this.profile = this.profileService.getProfile();
    this.cutoffDay = this.appSettingsService.getSettings().cutoffDay;
    if (this.form.controls.modo.value === 'mes') {
      this.form.controls.mes.setValue(this.getCurrentMonthValue());
    }
    this.loadEntries();
  }

  retryLoadEntries(): void {
    this.entriesLoading = true;
    this.entriesLoadError = false;
    this.entriesLoadErrorMessage = '';
    this.loadEntries();
  }

  private loadEntries(): void {
    this.overtimeService.fetchEntries().subscribe({
      next: (list) => {
        this.entries = list;
        this.entriesLoading = false;
        this.entriesLoadError = false;
        this.applyFilter();
      },
      error: (err: unknown) => {
        this.entriesLoading = false;
        if (isUnauthorizedAfterLogout(err)) {
          return;
        }
        this.entries = [];
        this.filteredEntries = [];
        this.entriesLoadError = true;
        this.entriesLoadErrorMessage = getLoadFailureMessage(err);
      }
    });
  }

  get totalFiltrado(): number {
    return this.filteredEntries.reduce((acc, item) => acc + item.totalPesos, 0);
  }

  getPreviewTypeLabel(type: OvertimeEntry['tipoDia']): string {
    if (type === 'holiday') return 'Feriado';
    if (type === 'weekend') return 'Sábado / domingo';
    return 'Día de semana';
  }

  get includeObservaciones(): boolean {
    return Boolean(this.form.controls.incluirObservaciones.value);
  }

  applyFilter(): void {
    if (this.entriesLoadError || this.entriesLoading) {
      return;
    }
    this.errorMessage = '';
    const value = this.form.getRawValue();
    const mode = value.modo;

    if (mode === 'mes') {
      // UX: al elegir "Por mes", autoseleccionamos el mes actual.
      const monthValue = value.mes || this.getCurrentMonthValue();
      if (!value.mes) {
        this.form.controls.mes.setValue(monthValue);
      }

      const [yearStr, monthStr] = monthValue.split('-');
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
      // UX: al elegir "corte", dejamos precargado el rango actual (sirve si luego pasa a "rango").
      this.form.patchValue(
        { fechaDesde: period.startIso, fechaHasta: period.endIso },
        { emitEvent: false }
      );
      this.filteredEntries = this.entries.filter(
        (item) => item.fecha >= period.startIso && item.fecha <= period.endIso
      );
      this.filteredEntries = this.sortEntriesByDateAsc(this.filteredEntries);
      return;
    }

    if (!value.fechaDesde || !value.fechaHasta) {
      this.filteredEntries = [];
      this.errorMessage = 'Indicá fecha desde y fecha hasta.';
      return;
    }

    // type="date" devuelve YYYY-MM-DD, se puede comparar como string.
    if (value.fechaDesde > value.fechaHasta) {
      this.filteredEntries = [];
      this.errorMessage = 'La fecha “desde” no puede ser posterior a la fecha “hasta”.';
      return;
    }

    this.filteredEntries = this.entries.filter(
      (item) => item.fecha >= value.fechaDesde! && item.fecha <= value.fechaHasta!
    );
    this.filteredEntries = this.sortEntriesByDateAsc(this.filteredEntries);
  }

  async exportReport(): Promise<void> {
    if (this.exportInProgress) return;
    this.exportInProgress = true;
    try {
      const { isConfirmed, isDenied } = await AppSwal.fire({
        title: '¿Cómo querés exportar?',
        text: 'Elegí el formato del reporte.',
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
    } finally {
      this.exportInProgress = false;
    }
  }

  async generatePdf(): Promise<void> {
    const canExport = await this.validateReportData();
    if (!canExport) return;

    showProcessingAlert('Generando PDF...');
    const reportLabelRaw = this.getReportLabel();
    const reportLabelHuman = this.getReportLabelHuman();
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      doc.setFontSize(18);
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

      doc.setFontSize(12);
      const operatorLine = `Operario: ${this.profile?.nombre ?? ''} ${this.profile?.apellido ?? ''}`.trim();
      doc.setFillColor(145, 255, 80);
      doc.roundedRect(36, 48, 335, 22, 4, 4, 'F');
      doc.setTextColor(20, 35, 20);
      doc.text(operatorLine, 40, 63);
      doc.setTextColor(0, 0, 0);
      doc.text(`Categoria: ${this.profile?.categoria ?? '-'}`, 40, 83);
      doc.text(`Periodo: ${reportLabelHuman}`, 40, 101);
      doc.text(`Registros: ${this.filteredEntries.length}`, 40, 119);

      const includeObs = this.includeObservaciones;
      autoTable(doc, {
        startY: 140,
        head: [['FECHA', 'PORCENTAJE DE PAGO', 'HORAS']],
        body: this.filteredEntries.flatMap((entry) => {
          const baseRow = [
            this.formatIsoToDMY(entry.fecha),
            this.getDayTypeLabel(entry),
            entry.horasExtra.toString()
          ];

          const rows: unknown[] = [baseRow];

          if (includeObs) {
            const obs = (entry.observaciones ?? '').trim();
            // Uniforme con la imagen: siempre agregamos la línea de observaciones (aunque esté vacía).
            rows.push([
              {
                content: `Observaciones: ${obs || '-'}`,
                colSpan: 3,
                styles: {
                  fontSize: 10,
                  textColor: [55, 65, 81],
                  fillColor: [248, 250, 252],
                  overflow: 'linebreak' as const,
                  valign: 'top' as const
                }
              }
            ]);
          }

          // Separador visual entre registros (línea horizontal).
          rows.push([
            {
              content: '',
              colSpan: 3,
              styles: {
                fillColor: [255, 255, 255],
                textColor: [255, 255, 255],
                cellPadding: 0,
                minCellHeight: 12,
                lineColor: [229, 231, 235],
                lineWidth: { top: 0.6, right: 0, bottom: 0, left: 0 } as const
              }
            }
          ]);

          return rows as unknown as any[];
        }),
        styles: {
          fontSize: 11,
          cellPadding: 4,
          overflow: 'linebreak',
          cellWidth: 'wrap',
          valign: 'top'
        },
        headStyles: { fillColor: [17, 24, 39], fontSize: 12 },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 260 },
          2: { cellWidth: 80, halign: 'right' }
        }
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
        styles: { fontSize: 11, cellPadding: 4 },
        headStyles: { fillColor: [107, 114, 128], fontSize: 12 },
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
      doc.setFontSize(11);
      doc.setTextColor(107, 114, 128);
      doc.text('Herramienta desarrollada por Mateo Cunsolo', 40, pageHeight - 20);
      doc.setTextColor(0, 0, 0);

      const operatorName = `${this.profile?.apellido ?? 'operario'}-${this.profile?.nombre ?? ''}`
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
      const fileName = `reporte-horas-${operatorName}-${reportLabelRaw.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      doc.save(fileName);

      closeProcessingAlert();
      await AppSwal.fire({
        title: 'Listo',
        text: 'El PDF se descargó en tu carpeta de descargas.',
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });
    } catch {
      closeProcessingAlert();
      await AppSwal.fire({
        title: 'No se pudo exportar',
        text: 'No pudimos generar el PDF. Probá de nuevo o exportá como imagen.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
  }

  private async generateImage(format: 'png' | 'jpeg'): Promise<void> {
    const canExport = await this.validateReportData();
    if (!canExport) return;

    showProcessingAlert('Generando imagen...');
    const reportLabelRaw = this.getReportLabel();
    const reportLabelHuman = this.getReportLabelHuman();
    const operatorLine = `Operario: ${this.profile?.nombre ?? ''} ${this.profile?.apellido ?? ''}`.trim();
    const totals = this.calculateHoursByRateType();
    const rows = this.filteredEntries.length;
    const canvasWidth = 900;
    const includeObs = this.includeObservaciones;
    const baseHeight = 360;
    const summaryRowsCount = 3;
    const summaryTitleHeight = 42;
    const summaryRowHeight = 46;
    const summaryRowsHeight = summaryRowHeight * summaryRowsCount;
    const summarySpacingTop = 24;
    const summarySpacingBottom = 28;
    const footerPaddingBottom = 34;
    const tableHeaderHeight = 42;
    const minRowHeight = 46;
    const canvasTmp = document.createElement('canvas');
    const ctxTmp = canvasTmp.getContext('2d');
    const tableX = 40;
    const tableWidth = canvasWidth - 80;
    const rowHeights =
      includeObs && ctxTmp
        ? this.filteredEntries.map((e) => {
            // Layout “apilado”: una línea principal + observación debajo + separador.
            ctxTmp.font = '500 16px Montserrat, sans-serif';
            const obs = (e.observaciones ?? '').trim();
            ctxTmp.font = '500 15px Montserrat, sans-serif';
            const obsLines = obs ? this.wrapTextLines(ctxTmp, obs, tableWidth - 28) : [];
            const obsHeight = obsLines.length ? obsLines.length * 16 + 10 : 0;
            const baseLine = 38; // altura para la línea principal
            const separator = 16; // espacio para línea separadora
            return Math.max(minRowHeight, baseLine + obsHeight + separator);
          })
        : this.filteredEntries.map(() => minRowHeight);
    const tableBodyHeight = rowHeights.reduce((acc, h) => acc + h, 0);
    const canvasHeight =
      baseHeight +
      tableHeaderHeight +
      tableBodyHeight +
      summarySpacingTop +
      summaryTitleHeight +
      summaryRowsHeight +
      summarySpacingBottom +
      footerPaddingBottom;
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    try {
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        closeProcessingAlert();
        await AppSwal.fire({
          title: 'No se pudo crear la imagen',
          text: 'Probá exportar en PDF o intentá de nuevo.',
          icon: 'error',
          confirmButtonText: 'Aceptar'
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

      const logoW = 170;
      const logoH = (logoW * 30) / 206.22;
      const x = canvasWidth - logoW - 30;
      const y = 16;
      ctx.drawImage(logoImg, x, y, logoW, logoH);
    }

    ctx.fillStyle = '#111827';
    ctx.font = '700 34px Montserrat, sans-serif';
    ctx.fillText('Reporte de Horas Extras', 45, 62);

    ctx.fillStyle = '#91ff50';
    ctx.fillRect(40, 90, 820, 44);
    ctx.fillStyle = '#142314';
    ctx.font = '600 25px Montserrat, sans-serif';
    ctx.fillText(operatorLine, 50, 120);

    ctx.fillStyle = '#111827';
    ctx.font = '500 20px Montserrat, sans-serif';
    ctx.fillText(`Categoria: ${this.profile?.categoria ?? '-'}`, 45, 176);
    ctx.fillText(`Periodo: ${reportLabelHuman}`, 45, 206);
    ctx.fillText(`Registros: ${this.filteredEntries.length}`, 45, 236);

    const tableTop = 266;
    const dateX = tableX + 14;
    const typeX = tableX + 250;
    const hoursX = tableX + tableWidth - 24;
    ctx.fillStyle = '#111827';
    ctx.fillRect(tableX, tableTop, tableWidth, 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 17px Montserrat, sans-serif';
    ctx.fillText('FECHA', dateX, tableTop + 28);
    ctx.fillText('PORCENTAJE DE PAGO', typeX, tableTop + 28);
    ctx.textAlign = 'right';
    ctx.fillText('HORAS', hoursX, tableTop + 28);
    ctx.textAlign = 'left';

    let cursorY = tableTop + tableHeaderHeight;
    this.filteredEntries.forEach((entry, index) => {
      const rowHeight = rowHeights[index] ?? minRowHeight;
      const y = cursorY;
      ctx.fillStyle = index % 2 === 0 ? '#f8fafc' : '#ffffff';
      ctx.fillRect(tableX, y, tableWidth, rowHeight);
      ctx.fillStyle = '#111827';
      ctx.font = '500 16px Montserrat, sans-serif';
      ctx.fillText(this.formatIsoToDMY(entry.fecha), dateX, y + 30);
      ctx.fillText(this.getDayTypeLabel(entry), typeX, y + 30);
      ctx.textAlign = 'right';
      ctx.fillText(entry.horasExtra.toFixed(2), hoursX, y + 30);
      ctx.textAlign = 'left';

      if (includeObs) {
        const obs = (entry.observaciones ?? '').trim();
        ctx.fillStyle = '#111827';
        ctx.font = '500 15px Montserrat, sans-serif';
        this.drawWrappedText(ctx, `Observaciones: ${obs || '-'}`, dateX, y + 54, tableWidth - 28, 16);

        // Separador
        const sepY = y + rowHeight - 10;
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tableX + 10, sepY);
        ctx.lineTo(tableX + tableWidth - 10, sepY);
        ctx.stroke();
      }

      cursorY += rowHeight;
    });

    const summaryTop = tableTop + tableHeaderHeight + tableBodyHeight + summarySpacingTop;
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(tableX, summaryTop, tableWidth, summaryTitleHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 17px Montserrat, sans-serif';
    ctx.fillText('RESUMEN', dateX, summaryTop + 28);
    ctx.textAlign = 'right';
    ctx.fillText('HORAS', hoursX, summaryTop + 28);
    ctx.textAlign = 'left';

    const summaryRows = [
      ['TOTAL HORAS TRABAJADAS AL 50%', totals.weekday.toFixed(2)],
      ['TOTAL HORAS TRABAJADAS AL 100%', totals.weekend.toFixed(2)],
      ['TOTAL HORAS TRABAJADAS FERIADOS', totals.holiday.toFixed(2)]
    ];

    summaryRows.forEach((row, index) => {
      const y = summaryTop + summaryTitleHeight + summaryRowHeight * index;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tableX, y, tableWidth, summaryRowHeight);
      ctx.strokeStyle = '#e5e7eb';
      ctx.strokeRect(tableX, y, tableWidth, summaryRowHeight);
      ctx.fillStyle = '#111827';
      ctx.font = '500 16px Montserrat, sans-serif';
      ctx.fillText(row[0], dateX, y + 30);
      ctx.textAlign = 'right';
      ctx.fillText(row[1], hoursX, y + 30);
      ctx.textAlign = 'left';
    });

    ctx.fillStyle = '#6b7280';
    ctx.font = '500 16px Montserrat, sans-serif';
    const footerY = summaryTop + summaryTitleHeight + summaryRowsHeight + summarySpacingBottom;
    ctx.fillText('Herramienta desarrollada por Mateo Cunsolo', 45, footerY);

    const operatorName = `${this.profile?.apellido ?? 'operario'}-${this.profile?.nombre ?? ''}`
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    const extension = format === 'png' ? 'png' : 'jpg';
    const fileName = `reporte-horas-${operatorName}-${reportLabelRaw.replace(/\s+/g, '-').toLowerCase()}.${extension}`;
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, 0.95);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      link.click();

      closeProcessingAlert();
      await AppSwal.fire({
        title: 'Listo',
        text: 'La imagen se descargó en tu carpeta de descargas.',
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });
    } catch {
      closeProcessingAlert();
      await AppSwal.fire({
        title: 'No se pudo exportar',
        text: 'No pudimos generar la imagen. Probá de nuevo o exportá como PDF.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
  }

  private async validateReportData(): Promise<boolean> {
    this.applyFilter();
    if (this.errorMessage) {
      await AppSwal.fire({
        title: 'Revisá las fechas',
        text: this.errorMessage,
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return false;
    }

    if (!this.filteredEntries.length) {
      this.errorMessage = 'No hay registros en el período que elegiste.';
      await AppSwal.fire({
        title: 'No hay datos para mostrar',
        text: this.errorMessage,
        icon: 'info',
        confirmButtonText: 'Aceptar'
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
    return `${this.formatIsoToDMY(period.startIso)} al ${this.formatIsoToDMY(period.endIso)}`;
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

  private formatIsoToDMY(isoDate: string): string {
    const iso = isoDate.length >= 10 ? isoDate.slice(0, 10) : isoDate;
    const [yStr, mStr, dStr] = iso.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!y || !m || !d) return isoDate;
    const dt = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(dt);
  }

  private drawTextEllipsis(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number
  ): void {
    if (!text) return;
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    if (ctx.measureText(clean).width <= maxWidth) {
      ctx.fillText(clean, x, y);
      return;
    }
    const ellipsis = '…';
    let lo = 0;
    let hi = clean.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const candidate = clean.slice(0, mid) + ellipsis;
      if (ctx.measureText(candidate).width <= maxWidth) lo = mid + 1;
      else hi = mid;
    }
    const finalText = clean.slice(0, Math.max(0, lo - 1)) + ellipsis;
    ctx.fillText(finalText, x, y);
  }

  private wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    if (ctx.measureText(clean).width <= maxWidth) return [clean];
    const words = clean.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = w;
    }
    if (current) lines.push(current);
    return lines;
  }

  private drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): void {
    const lines = this.wrapTextLines(ctx, text, maxWidth);
    if (!lines.length) return;
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y + i * lineHeight);
    });
  }

  private getReportLabelHuman(): string {
    const value = this.form.getRawValue();
    if (value.modo === 'mes' && value.mes) {
      // value.mes viene como YYYY-MM
      const [yStr, mStr] = value.mes.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (!y || !m) return value.mes;
      const dt = new Date(y, m - 1, 1);
      return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(dt);
    }

    const raw = this.getReportLabel();
    if (!raw) return raw;
    const parts = raw.split('_a_');
    if (parts.length !== 2) return raw;
    return `${this.formatIsoToDMY(parts[0])} al ${this.formatIsoToDMY(parts[1])}`;
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
    const today = new Date(year, month, now.getDate());

    // Periodo "actual" por defecto: 24 del mes pasado -> 24 del mes actual.
    // Pero si ya pasó el 24 del mes actual, el período vigente es: 24 del mes actual -> 24 del mes siguiente.
    let start = new Date(year, month - 1, this.cutoffDay);
    let end = new Date(year, month, this.cutoffDay);

    if (end < today) {
      start = end;
      end = new Date(year, month + 1, this.cutoffDay);
    }

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
