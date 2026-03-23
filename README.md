# Overtime Tracker (v1.0.0)

Aplicacion Angular para que el operario lleve control personal de horas extras, calculos por tipo de dia y generacion de reportes PDF.

## Backend (API)

El backend NestJS vive **fuera** de esta carpeta, como proyecto hermano:

- `../overtime-tracker-api/` — API (NestJS + Prisma, etc.)

Así el frontend y la API quedan separados y cada uno con su propio `package.json`.

## Funcionalidades MVP

- Registro de usuario (nombre, apellido, categoria, antiguedad).
- Valores hora por categoria (persistidos en `localStorage`).
- Calculo automatico:
  - Dia de semana: +50%
  - Sabado/Domingo: +100%
  - Feriado manual: +65%
- Dashboard con resumen del periodo de liquidacion.
- Configuracion de dia de corte (ej: 23 a 23, 25 a 25).
- Historial de cargas con edicion y eliminacion.
- Reportes PDF con resumen de horas por tipo.
- Backup / restore de datos locales.
- Alertas UI con SweetAlert2.

## Requisitos

- Node.js 18+ (recomendado LTS)
- npm 9+

## Comandos

```bash
npm install
npm run start
```

La app se abre en `http://localhost:4200`.

Build de produccion:

```bash
npm run build
```

Salida: `dist/overtime-tracker`.

## Datos y almacenamiento

La app usa la **API** (`overtime-tracker-api`): perfil, tarifas, horas extras y ajustes se guardan en **PostgreSQL**. En el navegador solo queda el **token JWT** (`ot_access_token`) y preferencias locales (por ejemplo onboarding).

- **Desarrollo (`ng serve`)**: `environment.ts` usa `apiUrl: '/api'`. El archivo `proxy.conf.json` reenvía eso a `http://localhost:3000` (mismo origen en el navegador, sin pelear con CORS).
- **Producción**: `environment.prod.ts` — poné ahí la URL pública real de la API (ver `angular.json` → `fileReplacements`).

### Arranque típico desarrollo

1. Levantar Postgres + API (ver `../overtime-tracker-api/README.md`).
2. `npm run start` en esta carpeta → `http://localhost:4200`.
3. Registrarte o iniciar sesión en `/auth`.

Claves legacy en `localStorage` (migraciones antiguas) pueden seguir existiendo pero **ya no son la fuente de verdad**:
- `ot_profile`, `ot_entries`, `ot_category_rates`, etc.

## Checklist pre-release rapido

- Ejecutar `npm run build` sin errores.
- Verificar flujo completo: registro -> carga -> edicion -> reportes PDF.
- Verificar backup y restore.
- Revisar responsive mobile (menu y tarjetas de historial).

## Notas de version 1.0.0

- MVP funcional completo validado manualmente.
- Se incorpora migracion basica de datos legacy al iniciar app.
- Se incorporan validaciones de negocio (fecha futura y maximo de horas por dia).
