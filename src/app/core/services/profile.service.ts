import { Injectable } from '@angular/core';

import { UserProfile } from '../models/overtime.models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly profileKey = 'ot_profile';

  getProfile(): UserProfile | null {
    const raw = localStorage.getItem(this.profileKey);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<UserProfile>;
      if (!parsed.nombre || !parsed.apellido || !parsed.categoria) return null;

      return {
        nombre: parsed.nombre,
        apellido: parsed.apellido,
        categoria: parsed.categoria,
        antiguedadAnios: Number(parsed.antiguedadAnios ?? 0)
      };
    } catch {
      return null;
    }
  }

  saveProfile(profile: UserProfile): void {
    localStorage.setItem(this.profileKey, JSON.stringify(profile));
  }

  clearProfile(): void {
    localStorage.removeItem(this.profileKey);
  }
}
