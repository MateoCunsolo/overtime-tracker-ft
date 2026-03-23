import { Injectable } from '@angular/core';

import { AuthMeResponse } from '../models/api.models';
import { UserProfile, UserRole } from '../models/overtime.models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private profile: UserProfile | null = null;
  private role: UserRole = 'USER';

  getProfile(): UserProfile | null {
    return this.profile;
  }

  getRole(): UserRole {
    return this.role;
  }

  isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  hydrateFromMe(me: AuthMeResponse): void {
    this.role = me.role === 'ADMIN' ? 'ADMIN' : 'USER';

    if (!me.profile) {
      this.profile = null;
      return;
    }

    this.profile = {
      nombre: me.profile.nombre,
      apellido: me.profile.apellido,
      categoria: me.profile.categoria,
      antiguedadAnios: me.profile.antiguedadAnios,
      workShift: me.profile.workShift ?? 'morning',
      email: me.email
    };
  }

  /** Compatibilidad: ya no persiste en localStorage; la fuente de verdad es la API. */
  saveProfile(profile: UserProfile): void {
    this.profile = { ...profile };
  }

  clear(): void {
    this.profile = null;
    this.role = 'USER';
  }
}
