import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DEFAULT_CATEGORY_RATES_MAP } from '../../../../../core/constants/default-category-rates';
import { WorkerCategory, WorkShift } from '../../../../../core/models/overtime.models';
import { AuthService } from '../../../../../core/services/auth.service';
import { ProfileService } from '../../../../../core/services/profile.service';
import { RateConfigService } from '../../../../../core/services/rate-config.service';
import { AppSwal } from '../../../../../core/utils/alert.util';
import { getUserFacingErrorMessage, resolveInternalReturnUrl } from '../../../../../core/utils/api-error.util';

@Component({
  selector: 'app-login-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  isLoginMode = true;

  readonly categorias: { value: WorkerCategory; label: string }[] = [
    { value: 'especial', label: 'Especial' },
    { value: 'calificado', label: 'Calificado' },
    { value: 'semicalificado', label: 'Semicalificado' },
    { value: 'no_calificado', label: 'No calificado' },
    { value: 'peon', label: 'Peon' }
  ];

  readonly turnos: { value: WorkShift; label: string }[] = [
    { value: 'morning', label: 'Turno mañana (extras en semana: 14:00–18:00)' },
    { value: 'afternoon', label: 'Turno tarde (extras en semana: 10:00–14:00)' }
  ];

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  readonly registerForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    categoria: ['calificado' as WorkerCategory, [Validators.required]],
    antiguedadAnios: [0, [Validators.required, Validators.min(0), Validators.max(50)]],
    workShift: ['morning' as WorkShift, [Validators.required]]
  });

  constructor(
    private readonly authService: AuthService,
    private readonly profileService: ProfileService,
    private readonly rateConfigService: RateConfigService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn() && this.profileService.getProfile()) {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      void this.router.navigateByUrl(resolveInternalReturnUrl(returnUrl));
    }
  }

  get nombreControl() {
    return this.registerForm.controls.nombre;
  }

  get apellidoControl() {
    return this.registerForm.controls.apellido;
  }

  get antiguedadControl() {
    return this.registerForm.controls.antiguedadAnios;
  }

  get valorHoraSeleccionado(): number {
    const categoria = this.registerForm.controls.categoria.value;
    if (!categoria) return 0;
    const fromServer = this.rateConfigService.getRateForCategory(categoria);
    if (fromServer > 0) {
      return fromServer;
    }
    return DEFAULT_CATEGORY_RATES_MAP[categoria] ?? 0;
  }

  get valorHoraConAntiguedadSeleccionada(): number {
    const antiguedad = Number(this.registerForm.controls.antiguedadAnios.value ?? 0);
    const antiguedadAcotada = Math.min(50, Math.max(0, antiguedad));
    return this.valorHoraSeleccionado * (1 + antiguedadAcotada / 100);
  }

  setMode(login: boolean): void {
    this.isLoginMode = login;
  }

  async submitLogin(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const value = this.loginForm.getRawValue();
    try {
      await firstValueFrom(
        this.authService.login({
          email: value.email!.trim().toLowerCase(),
          password: value.password!
        })
      );
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      void this.router.navigateByUrl(resolveInternalReturnUrl(returnUrl));
    } catch (err) {
      const text = getUserFacingErrorMessage(
        err,
        'Email o contraseña incorrectos. Revisá los datos e intentá otra vez.'
      );
      await AppSwal.fire({
        title: 'No pudimos iniciar sesión',
        text,
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
  }

  async submitRegister(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const value = this.registerForm.getRawValue();
    try {
      await firstValueFrom(
        this.authService.register({
          email: value.email!.trim().toLowerCase(),
          password: value.password!,
          nombre: value.nombre!.trim(),
          apellido: value.apellido!.trim(),
          categoria: value.categoria!,
          antiguedadAnios: Number(value.antiguedadAnios ?? 0),
          workShift: value.workShift!
        })
      );
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      void this.router.navigateByUrl(resolveInternalReturnUrl(returnUrl));
    } catch (err) {
      const text = getUserFacingErrorMessage(
        err,
        'No pudimos crear la cuenta. Si el email ya está en uso, probá con otro o iniciá sesión.'
      );
      await AppSwal.fire({
        title: 'No pudimos registrarte',
        text,
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    }
  }
}
