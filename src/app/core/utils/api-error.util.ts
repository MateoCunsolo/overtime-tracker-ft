import { HttpErrorResponse } from '@angular/common/http';

/** Mensajes genéricos en inglés que devuelve el framework (no mostrar al usuario). */
const EN_GENERIC = /^(Bad Request|Unauthorized|Forbidden|Not Found|Internal Server Error|Conflict|Payload Too Large)$/i;

function extractMessageBody(err: HttpErrorResponse): string | null {
  const body = err.error as { message?: string | string[] } | undefined;
  if (body?.message != null) {
    const m = Array.isArray(body.message) ? body.message.join(' ') : body.message;
    const s = typeof m === 'string' ? m.trim() : '';
    return s || null;
  }
  if (typeof err.error === 'string' && err.error.trim() && !err.error.trim().startsWith('<')) {
    return err.error.trim();
  }
  return null;
}

/**
 * Texto crudo del cuerpo de error (útil en consola o soporte; no siempre apto para usuario).
 */
export function getApiErrorMessage(err: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  if (err instanceof HttpErrorResponse) {
    const body = extractMessageBody(err);
    if (body) return body;
    if (typeof err.error === 'string' && err.error.trim()) {
      return err.error;
    }
    return err.message || fallback;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return fallback;
}

/**
 * Mensaje seguro para mostrar en pantalla: sin tecnicismos de red, servidor o sesión técnica.
 */
export function getUserFacingErrorMessage(
  err: unknown,
  fallback = 'No pudimos completar la acción. Probá de nuevo en un momento.'
): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'No pudimos conectar. Revisá tu conexión a internet e intentá otra vez.';
    }
    if (err.status === 401) {
      return 'Tenés que volver a iniciar sesión.';
    }
    if (err.status === 403) {
      return 'No tenés permiso para hacer esto.';
    }
    if (err.status === 404) {
      return 'No encontramos lo que pediste.';
    }
    if (err.status === 409) {
      const m = extractMessageBody(err);
      if (m && !EN_GENERIC.test(m)) return m;
      return 'Ya existe un registro que no permite guardar esto.';
    }
    if (err.status >= 500) {
      return 'Algo falló de nuestro lado. Intentá más tarde.';
    }

    const bodyMsg = extractMessageBody(err);
    if (bodyMsg && bodyMsg.length <= 400 && !EN_GENERIC.test(bodyMsg.trim())) {
      return bodyMsg;
    }
    return fallback;
  }

  if (err instanceof Error && err.message && !err.message.includes('Http failure')) {
    return err.message.length < 400 ? err.message : fallback;
  }

  return fallback;
}

/** Cuando falla cargar listas o resúmenes. */
export function getLoadFailureMessage(err: unknown): string {
  return getUserFacingErrorMessage(err, 'No pudimos cargar la información. Actualizá la página o probá más tarde.');
}

/** El interceptor ya redirige a /auth; evitá modales duplicados o mensajes confusos. */
export function isUnauthorizedAfterLogout(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 401;
}

/**
 * Solo rutas internas (evita open redirect). Usado con `returnUrl` tras login o 401.
 */
export function resolveInternalReturnUrl(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== 'string') {
    return '/dashboard';
  }
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/dashboard';
  }
  if (trimmed.startsWith('/auth')) {
    return '/dashboard';
  }
  return trimmed;
}
