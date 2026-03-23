export const environment = {
  production: false,
  /**
   * Con `ng serve`, las peticiones van al mismo origen (4200) y `proxy.conf.json`
   * reenvía `/api/*` → `http://localhost:3000/*` (sin CORS en el navegador).
   */
  apiUrl: '/api'
};
