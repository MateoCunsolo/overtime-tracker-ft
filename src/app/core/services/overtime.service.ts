import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { OvertimeEntry } from '../models/overtime.models';

export type OvertimeCreatePayload = Pick<
  OvertimeEntry,
  'fecha' | 'horaInicio' | 'horaFin' | 'esFeriadoNacional' | 'observaciones'
>;

@Injectable({ providedIn: 'root' })
export class OvertimeService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  fetchEntries(): Observable<OvertimeEntry[]> {
    return this.http.get<OvertimeEntry[]>(`${this.apiUrl}/overtime/entries`).pipe(
      map((rows) => [...rows].sort((a, b) => b.fecha.localeCompare(a.fecha)))
    );
  }

  createEntry(payload: OvertimeCreatePayload): Observable<OvertimeEntry> {
    return this.http.post<OvertimeEntry>(`${this.apiUrl}/overtime/entries`, {
      fecha: payload.fecha,
      horaInicio: payload.horaInicio,
      horaFin: payload.horaFin,
      esFeriadoNacional: payload.esFeriadoNacional,
      observaciones: payload.observaciones ?? ''
    });
  }

  updateEntry(id: string, payload: OvertimeCreatePayload): Observable<OvertimeEntry> {
    return this.http.put<OvertimeEntry>(`${this.apiUrl}/overtime/entries/${id}`, {
      fecha: payload.fecha,
      horaInicio: payload.horaInicio,
      horaFin: payload.horaFin,
      esFeriadoNacional: payload.esFeriadoNacional,
      observaciones: payload.observaciones ?? ''
    });
  }

  deleteEntry(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/overtime/entries/${id}`);
  }

  getTotalGanado(entries: OvertimeEntry[]): number {
    return entries.reduce((acc, item) => acc + item.totalPesos, 0);
  }
}
