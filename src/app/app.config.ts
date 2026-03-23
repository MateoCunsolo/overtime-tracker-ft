import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

import { routes } from './app.routes';
import { apiLogInterceptor } from './core/interceptors/api-log.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, apiLogInterceptor])),
    provideAppInitializer(() => inject(ThemeService).init()),
    provideAppInitializer(() => inject(AuthService).bootstrap()),
    importProvidersFrom(SweetAlert2Module.forRoot())
  ]
};
