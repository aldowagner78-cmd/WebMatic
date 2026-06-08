# Reporte: Pruebas E2E seguras sobre IAPOS

## 1. Objetivo

Implementar una infraestructura de pruebas E2E read-only para validar WebMatic sobre un caso real (IAPOS/GeneXus) sin ejecutar acciones peligrosas ni modificar datos del sistema.

## 2. Archivos creados/modificados

Modificados:

- `.gitignore`
- `package.json`

Creados:

- `tests/e2e/iapos-safe/danger-terms.js`
- `tests/e2e/iapos-safe/sanitize-log.js`
- `tests/e2e/iapos-safe/env-loader.js`
- `tests/e2e/iapos-safe/safety-actions.js`
- `tests/e2e/iapos-safe/inventory.js`
- `tests/e2e/iapos-safe/run.js`
- `tests/fixtures/iapos-safe-page.html`
- `tests/unit/e2e-safety.test.js`
- `docs/reports/iapos-safe-e2e-report.md`

## 3. Cómo se manejan credenciales

- Se carga `.env.local` con helper propio (`env-loader.js`), sin hardcodear credenciales.
- Variables usadas: `IAPOS_URL`, `IAPOS_USER`, `IAPOS_PASS`.
- No se imprimen secretos en logs: `sanitize-log.js` enmascara usuario/contraseña y patrones sensibles.
- `.env`, `.env.local` y `.env.*` quedaron excluidos en `.gitignore`.

## 4. Cómo se evita modificar datos reales

- Toda acción pasa por guardas de seguridad: `safeClick`, `safeFill`, `safeSelectOption`.
- Antes de actuar se inspecciona: texto visible, title, aria-label, alt, id, name, class, value, href, onclick, role y contexto de fila/grilla.
- Si se detecta término peligroso o acción de fila de grilla, se aborta con `SAFE_ABORT`.
- Excepción acotada para login (`allowLogin: true`) y búsquedas explícitas read-only (`Buscar`, `Consultar`, `Filtrar`).

## 5. Lista de acciones bloqueadas

Se bloquean términos peligrosos como:

- Autorizar / Autorización
- Aprobar / Approve
- Confirmar / Confirm
- Guardar / Save / Submit
- Eliminar / Delete / Borrar
- Anular / Rechazar / Reject
- Modificar / Actualizar / Update
- Enviar / Procesar / Finalizar / Aceptar
- Imprimir autorización
- Cargar comentario
- Registrar / Dar de baja / Replicar / Documentos / Acción

Además, se bloquean clicks en filas de grilla por política read-only.

## 6. Acciones permitidas

- Login (solo si `allowLogin: true` y etapa `login`).
- Navegación de consulta read-only.
- Selección de filtros en `select`.
- Escritura de filtros no sensibles.
- Click en acciones explícitas de búsqueda: `Buscar`, `Consultar`, `Filtrar`.
- Inventario técnico sanitizado.

## 7. Tests agregados

Archivo: `tests/unit/e2e-safety.test.js`

Cobertura:

- `safeClick` permite Buscar/Consultar/Filtrar.
- `safeClick` bloquea Autorizar/Eliminar/Anular/Guardar/Confirmar.
- `safeClick` bloquea `input type=image` peligroso.
- `safeClick` bloquea acciones de fila de grilla.
- `safeFill` y `safeSelectOption` en controles seguros.
- `sanitizeForLog` no expone usuario/contraseña.
- Uso de fixture HTML sintético en `tests/fixtures/iapos-safe-page.html`.

## 8. Resultado de npm test

Salida real:

```text
# tests 117
# pass 117
# fail 0
```

## 9. Resultado de test:e2e, si se ejecutó

Se ejecutó `npm run test:e2e`.

Resultado de `npx playwright install firefox`:

```text
Firefox 150.0.2 (playwright firefox v1522) downloaded to /home/usuario/.cache/ms-playwright/firefox-1522
FFmpeg (playwright ffmpeg v1011) downloaded to /home/usuario/.cache/ms-playwright/ffmpeg-1011
```

Resultado real:

- Runner seguro iniciado.
- Fase fixture local: **PASÓ** (sin SKIP).
- Se cargó el fixture `tests/fixtures/iapos-safe-page.html`.
- Se validó `safeFill`, `safeSelectOption`, `safeClick` (permitiendo `Buscar`) y bloqueos de acciones peligrosas (`Autorizar`, `input type=image`, acción de fila de grilla).
- Fase IAPOS real: omitida por seguridad (requiere `IAPOS_E2E_REAL=1`).
- No se declaró éxito falso.

## 10. Limitaciones técnicas encontradas

- La automatización completa de extensión en Firefox puede tener limitaciones de runtime según el entorno objetivo; por eso se mantiene modo real opcional explícito y flujo principal read-only.

## 11. Confirmación de que no se agregaron secretos ni JSON privados

Confirmado:

- No hay `.env*` trackeados.
- No hay `webmatic-dom-inventory*.json` trackeados.
- No hay `*.private.json` trackeados.
- No hay archivos trackeados en `tests/e2e/private/`, `tests/e2e/artifacts-private/` ni `docs/private-fixtures/`.
- No se agregaron screenshots sensibles nuevos; los screenshots existentes en `tests/e2e/screenshots/` son históricos de fixtures locales del proyecto.

## 12. Confirmación de que no se ejecutaron acciones peligrosas

Confirmado:

- La capa `safe*` aborta acciones peligrosas con `SAFE_ABORT`.
- No se ejecutaron acciones de autorización, eliminación, guardado ni modificación real.
- La fase real quedó desactivada por defecto y requiere habilitación explícita.

## 13. Riesgos pendientes

- Falta validar la fase real sobre IAPOS en entorno controlado (sin habilitar por defecto), con whitelist de pantallas y revisión operativa.
- Falta parametrizar selectores de login reales por entorno para robustez multi-sitio, manteniendo política read-only.

## 14. Próximo paso recomendado

1. Mantener `IAPOS_E2E_REAL` desactivado por defecto.
2. Definir entorno de QA read-only para fase real y ejecutar con aprobación explícita.
3. Mantener artefactos técnicos solo en carpetas privadas ignoradas.
