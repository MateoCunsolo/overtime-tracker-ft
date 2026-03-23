import {
  HttpErrorResponse,
  HttpEventType,
  HttpInterceptorFn
} from '@angular/common/http';
import { catchError, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';

/** Claves que no deben verse en consola aunque sea dev. */
const SENSITIVE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'access_token',
  'refresh_token'
]);

function sanitizeForLog(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeForLog(item));
  if (typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = sanitizeForLog(v);
    }
  }
  return out;
}

/**
 * En desarrollo, loguea en consola cada llamada HTTP: método, URL, body (sanitizado),
 * y respuesta o error. En producción no hace nada.
 */
export const apiLogInterceptor: HttpInterceptorFn = (req, next) => {
  if (environment.production) {
    return next(req);
  }

  const id = Math.random().toString(36).slice(2, 8);
  const started = performance.now();

  console.groupCollapsed(`[API ${id}] ${req.method} ${req.urlWithParams}`);

  if (req.body !== null && req.body !== undefined) {
    try {
      const parsed =
        typeof req.body === 'string' ? JSON.parse(req.body as string) : req.body;
      console.log('→ Request body:', sanitizeForLog(parsed));
    } catch {
      console.log('→ Request body:', '(no JSON / blob)');
    }
  }

  return next(req).pipe(
    tap((event) => {
      if (event.type === HttpEventType.Response) {
        const ms = Math.round(performance.now() - started);
        console.log(`← Response ${event.status} (${ms} ms)`);
        console.log('← Body:', sanitizeForLog(event.body));
        console.groupEnd();
      }
    }),
    catchError((err: unknown) => {
      const ms = Math.round(performance.now() - started);
      if (err instanceof HttpErrorResponse) {
        console.log(`← Error ${err.status} (${ms} ms)`);
        console.log('← Message:', err.message);
        console.log('← Body:', sanitizeForLog(err.error));
      } else {
        console.log('← Error (no HttpErrorResponse):', err);
      }
      console.groupEnd();
      return throwError(() => err);
    })
  );
};
