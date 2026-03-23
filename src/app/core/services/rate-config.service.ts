import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CategoryRate, WorkerCategory } from '../models/overtime.models';

@Injectable({ providedIn: 'root' })
export class RateConfigService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  private rates: CategoryRate[] = [];

  /** Los datos se cargan al iniciar sesión (`AuthService`). */
  ensureSeedData(): void {
    /* intencionalmente vacío */
  }

  clearCache(): void {
    this.rates = [];
  }

  setFromServer(rates: CategoryRate[]): void {
    this.rates = [...rates];
  }

  getRates(): CategoryRate[] {
    return this.rates;
  }

  getRateForCategory(categoria: WorkerCategory): number {
    return this.rates.find((item) => item.categoria === categoria)?.valorHora ?? 0;
  }

  saveRates(rates: CategoryRate[]): Observable<CategoryRate[]> {
    return this.http.put<CategoryRate[]>(`${this.apiUrl}/rates`, rates).pipe(
      tap((next) => this.setFromServer(next))
    );
  }
}
