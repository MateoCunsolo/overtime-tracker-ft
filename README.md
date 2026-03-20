# Overtime Tracker (v1.0.0)

Aplicacion Angular para que el operario lleve control personal de horas extra, calculos por tipo de dia y generacion de reportes PDF.

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

Todo se guarda en `localStorage` del navegador.

Claves principales:
- `ot_profile`
- `ot_entries`
- `ot_category_rates`
- `ot_category_rates_version`
- `ot_app_settings`

## Checklist pre-release rapido

- Ejecutar `npm run build` sin errores.
- Verificar flujo completo: registro -> carga -> edicion -> reportes PDF.
- Verificar backup y restore.
- Revisar responsive mobile (menu y tarjetas de historial).

## Notas de version 1.0.0

- MVP funcional completo validado manualmente.
- Se incorpora migracion basica de datos legacy al iniciar app.
- Se incorporan validaciones de negocio (fecha futura y maximo de horas por dia).
