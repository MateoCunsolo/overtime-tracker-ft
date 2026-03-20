import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProfileService } from '../../../../../core/services/profile.service';
import { WorkerCategory } from '../../../../../core/models/overtime.models';
import { RateConfigService } from '../../../../../core/services/rate-config.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);

  readonly categorias: { value: WorkerCategory; label: string }[] = [
    { value: 'especial', label: 'Especial' },
    { value: 'calificado', label: 'Calificado' },
    { value: 'semicalificado', label: 'Semicalificado' },
    { value: 'no_calificado', label: 'No calificado' },
    { value: 'peon', label: 'Peon' }
  ];

  readonly form = this.fb.group({
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    categoria: ['calificado' as WorkerCategory, [Validators.required]],
    antiguedadAnios: [0, [Validators.required, Validators.min(0), Validators.max(50)]]
  });

  constructor(
    private readonly profileService: ProfileService,
    private readonly rateConfigService: RateConfigService,
    private readonly router: Router
  ) {
    if (this.profileService.getProfile()) {
      void this.router.navigate(['/dashboard']);
    }
  }

  get valorHoraSeleccionado(): number {
    const categoria = this.form.controls.categoria.value;
    return categoria ? this.rateConfigService.getRateForCategory(categoria) : 0;
  }

  get valorHoraConAntiguedadSeleccionada(): number {
    const antiguedad = Number(this.form.controls.antiguedadAnios.value ?? 0);
    const antiguedadAcotada = Math.min(50, Math.max(0, antiguedad));
    return this.valorHoraSeleccionado * (1 + antiguedadAcotada / 100);
  }

  get nombreControl() {
    return this.form.controls.nombre;
  }

  get apellidoControl() {
    return this.form.controls.apellido;
  }

  get antiguedadControl() {
    return this.form.controls.antiguedadAnios;
  }

  register(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.profileService.saveProfile({
      nombre: value.nombre!.trim(),
      apellido: value.apellido!.trim(),
      categoria: value.categoria!,
      antiguedadAnios: Number(value.antiguedadAnios ?? 0)
    });

    void this.router.navigate(['/dashboard']);
  }
}
