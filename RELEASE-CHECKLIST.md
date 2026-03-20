# Release Checklist - Overtime Tracker v1.0.0

## 1) Verificaciones funcionales minimas

- [ ] Registro de perfil correcto
- [ ] Carga de hora extra correcta
- [ ] Validaciones (campos vacios, fecha futura, rango horario invalido, >16h)
- [ ] Edicion y eliminacion con confirmacion
- [ ] Reporte PDF por mes / corte / rango
- [ ] Orden por fecha ascendente en vista previa y PDF
- [ ] Backup y restore

## 2) Verificaciones visuales

- [ ] Mobile 360px-390px sin solapes
- [ ] Menu burger correcto
- [ ] Botones de historial con tamano y color sobrios
- [ ] Dashboard visible completo con FAB

## 3) Verificacion tecnica

- [ ] `npm run build` exitoso
- [ ] Sin errores de linter en archivos modificados

## 4) Deploy (elige una opcion)

### Opcion A - Vercel

1. `npm i -g vercel`
2. `vercel`
3. En setup:
   - Framework: Angular
   - Build command: `npm run build`
   - Output directory: `dist/overtime-tracker/browser`

### Opcion B - Netlify

1. `npm run build`
2. Publicar carpeta `dist/overtime-tracker/browser` en Netlify (drag & drop o CLI)

### Opcion C - Firebase Hosting

1. `npm i -g firebase-tools`
2. `firebase login`
3. `firebase init hosting`
4. Public directory: `dist/overtime-tracker/browser`
5. Single-page app rewrite: Yes
6. `npm run build`
7. `firebase deploy`

## 5) Post-deploy smoke test

- [ ] Abrir URL publica
- [ ] Crear un registro de prueba
- [ ] Generar PDF de prueba
- [ ] Verificar que localStorage persiste tras recargar
