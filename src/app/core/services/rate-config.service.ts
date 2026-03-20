import { Injectable } from '@angular/core';

import { CategoryRate, WorkerCategory } from '../models/overtime.models';

@Injectable({ providedIn: 'root' })
export class RateConfigService {
  private readonly ratesKey = 'ot_category_rates';
  private readonly ratesVersionKey = 'ot_category_rates_version';
  private readonly currentRatesVersion = 'ars-cct42-v1';

  private readonly defaultRates: CategoryRate[] = [
    // Valor hora calculado como: salario basico mensual / 200 horas.
    { categoria: 'especial', valorHora: 11400.49 },
    { categoria: 'calificado', valorHora: 9418.88 },
    { categoria: 'semicalificado', valorHora: 8525.29 },
    { categoria: 'no_calificado', valorHora: 7679.59 },
    { categoria: 'peon', valorHora: 7315.85 }
  ];

  ensureSeedData(): void {
    const storedVersion = localStorage.getItem(this.ratesVersionKey);
    if (!localStorage.getItem(this.ratesKey) || storedVersion !== this.currentRatesVersion) {
      localStorage.setItem(this.ratesKey, JSON.stringify(this.defaultRates));
      localStorage.setItem(this.ratesVersionKey, this.currentRatesVersion);
    }
  }

  getRates(): CategoryRate[] {
    this.ensureSeedData();

    const raw = localStorage.getItem(this.ratesKey);
    if (!raw) return this.defaultRates;

    try {
      return JSON.parse(raw) as CategoryRate[];
    } catch {
      return this.defaultRates;
    }
  }

  getRateForCategory(categoria: WorkerCategory): number {
    const rate = this.getRates().find((item) => item.categoria === categoria);
    return rate?.valorHora ?? 0;
  }

  saveRates(rates: CategoryRate[]): void {
    localStorage.setItem(this.ratesKey, JSON.stringify(rates));
    localStorage.setItem(this.ratesVersionKey, this.currentRatesVersion);
  }
}
