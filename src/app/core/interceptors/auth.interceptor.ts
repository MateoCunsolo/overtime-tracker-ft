import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

function isAuthPublicUrl(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/register');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getAccessToken();

  const authReq =
    token && !isAuthPublicUrl(req.url)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !isAuthPublicUrl(req.url)) {
        auth.logout();
        const path = router.url.split('?')[0] ?? '';
        if (!path.startsWith('/auth')) {
          void router.navigate(['/auth'], {
            queryParams: { returnUrl: path || '/dashboard' }
          });
        }
      }
      return throwError(() => err);
    })
  );
};
