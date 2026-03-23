import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { concatMap, firstValueFrom, forkJoin, map, Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AuthMeResponse,
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UpdateProfileRequest
} from '../models/api.models';
import { CategoryRate } from '../models/overtime.models';
import { AppSettingsService } from './app-settings.service';
import { ProfileService } from './profile.service';
import { RateConfigService } from './rate-config.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'ot_access_token';
  private readonly apiUrl = environment.apiUrl;

  private readonly http = inject(HttpClient);
  private readonly profileService = inject(ProfileService);
  private readonly appSettingsService = inject(AppSettingsService);
  private readonly rateConfigService = inject(RateConfigService);

  getAccessToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  setAccessToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  clearAccessToken(): void {
    localStorage.removeItem(this.tokenKey);
  }

  logout(): void {
    this.clearAccessToken();
    this.profileService.clear();
    this.appSettingsService.resetToDefaults();
    this.rateConfigService.clearCache();
  }

  /** Ejecutado antes del primer render (APP_INITIALIZER). */
  async bootstrap(): Promise<void> {
    if (!this.isLoggedIn()) {
      return;
    }

    try {
      await firstValueFrom(this.hydrateSession$());
    } catch {
      this.logout();
    }
  }

  login(body: LoginRequest): Observable<void> {
    return this.http.post<TokenResponse>(`${this.apiUrl}/auth/login`, body).pipe(
      tap((res) => this.setAccessToken(res.accessToken)),
      concatMap(() => this.hydrateSession$())
    );
  }

  register(body: RegisterRequest): Observable<void> {
    return this.http.post<TokenResponse>(`${this.apiUrl}/auth/register`, body).pipe(
      tap((res) => this.setAccessToken(res.accessToken)),
      concatMap(() => this.hydrateSession$())
    );
  }

  /** Actualiza perfil en el servidor y vuelve a cargar perfil, settings y tarifas como tras el login. */
  updateProfile(body: UpdateProfileRequest): Observable<void> {
    return this.http.put<unknown>(`${this.apiUrl}/auth/profile`, body).pipe(concatMap(() => this.hydrateSession$()));
  }

  /**
   * Recarga `/auth/me` y tarifas y aplica estado en memoria (perfil, settings, rates).
   * Útil tras cambios en el servidor o para refrescar manualmente.
   */
  hydrateSession$(): Observable<void> {
    return forkJoin({
      me: this.http.get<AuthMeResponse>(`${this.apiUrl}/auth/me`),
      rates: this.http.get<CategoryRate[]>(`${this.apiUrl}/rates`)
    }).pipe(
      tap(({ me, rates }) => {
        this.profileService.hydrateFromMe(me);
        this.appSettingsService.applyFromServer(me.settings ?? undefined);
        this.rateConfigService.setFromServer(rates);
      }),
      map(() => undefined)
    );
  }
}
