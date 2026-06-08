# Reporte: E2E local de WebMatic como extensión (diagnóstico Chromium)

## 1. Objetivo

Ejecutar un diagnóstico técnico en Chromium sobre fixture seguro, sin abrir IAPOS real ni habilitar `IAPOS_E2E_REAL=1`.

Importante: este reporte NO constituye validación final de compatibilidad Firefox.

## 2. Archivos creados/modificados

Modificados:

- `package.json`
- `tests/fixtures/iapos-safe-page.html`

Creados:

- `tests/e2e/webmatic-extension-safe/run.js`
- `docs/reports/webmatic-extension-e2e-local-report.md`

## 3. Navegador usado

- Chromium se usó solo como diagnóstico opcional.
- La validación final de extensión queda migrada a Firefox real en `npm run test:e2e:firefox-extension`.

## 4. Cómo se cargó la extensión

Se intentó cargar la extensión local de WebMatic con `launchPersistentContext` y flags:

- `--disable-extensions-except=<repo>`
- `--load-extension=<repo>`

y apertura de panel vía mensaje `OPEN_PANEL` al content script.

## 5. Fixture local usado

Archivo: `tests/fixtures/iapos-safe-page.html`

Incluye:

- input seguro (`#wm-input`)
- select nativo A/B (`#wm-select`: `A=Opción A`, `B=Opción B`)
- botón `Buscar` permitido
- botón `Autorizar` prohibido
- `input type=image` peligroso simulado
- tabla/grilla con acción peligrosa simulada

## 6. Flujo probado

Se implementó runner para intentar este flujo completo:

1. abrir fixture local
2. cargar extensión
3. abrir panel WebMatic
4. grabar macro read-only
5. detener grabación
6. verificar `choose_option`
7. abrir editor visual
8. editar `choose_option`
9. validar combo inteligente y cambiar a `A`
10. guardar macro local
11. verificar IIM con `CHOOSE_OPTION` y `VALUE="A"`
12. reproducir macro
13. validar select final en `A`
14. validar ausencia de overlay runtime `wm-choose-option-overlay`
15. validar ausencia de clicks peligrosos

## 7. Verificación de grabación

- El código del runner verifica explícitamente presencia de paso `choose_option` en el editor visual.
- En esta ejecución no se alcanzó esa etapa por limitación de inyección de extensión.

## 8. Verificación de editor visual inteligente

- El runner incluye validación de combo inteligente (`[data-wm-optcombo]`) y opciones reales (`Opción A`, `Opción B`).
- En esta ejecución no se alcanzó esa etapa por limitación de inyección de extensión.

## 9. Verificación de exportación IIM

- El runner incluye verificación de `CHOOSE_OPTION` + `VALUE="A"` en pestaña Script IIM.
- En esta ejecución no se alcanzó esa etapa por limitación de inyección de extensión.

## 10. Verificación de reproducción

- El runner incluye reproducción y verificación final del select en `A`.
- En esta ejecución no se alcanzó esa etapa por limitación de inyección de extensión.

## 11. Confirmaciones de seguridad

- IAPOS real no se abrió.
- `IAPOS_E2E_REAL` permaneció desactivado.
- No se usaron credenciales reales en esta prueba.
- No se alteró política read-only.
- No hay `.env*` trackeados.
- No hay JSON privados trackeados.
- No hay archivos trackeados dentro de `docs/private-fixtures/`, `tests/e2e/private/`, `tests/e2e/artifacts-private/`.
- No se agregaron screenshots sensibles nuevos (hay screenshots históricos del proyecto en `tests/e2e/screenshots/` de fixtures locales previos).

## 12. Resultado de npm test

```text
# tests 117
# pass 117
# fail 0
```

## 13. Resultado de npm run test:e2e

Resultado: **PASS** (fixture local seguro).

Resumen:

- safeFill OK
- safeSelectOption OK
- safeClick Buscar OK
- bloqueo Autorizar OK
- bloqueo input type=image OK
- bloqueo acción de grilla OK
- IAPOS real omitido por defecto

## 14. Resultado de npm run test:e2e:extension (diagnóstico Chromium)

Resultado: **FAIL (limitación técnica real)**

Error observado:

```text
Timeout esperando #webmatic-panel-root (extensión no inyectada)
```

Esto ocurrió incluso tras:

- instalar runtime Chromium de Playwright
- usar `channel: "chromium"`
- cargar extensión con flags estándar de Playwright

No se declara éxito falso.

## 15. Limitaciones técnicas de este diagnóstico

- En este entorno, la carga/inyección de la extensión MV2 de WebMatic no logró materializar `#webmatic-panel-root` en el flujo automatizado de `test:e2e:extension`.
- Por ese motivo no se pudo completar de extremo a extremo la parte de panel/grabación/edición/exportación/reproducción como extensión en esta corrida.

## 16. Riesgos pendientes

- Falta cerrar la causa exacta de no inyección de content script en el runner de extensión local.
- Hasta resolver ese punto, el flujo completo de extensión queda pendiente de validación automática en este entorno.

## 17. Estado actual y siguiente paso

1. Mantener `test:e2e:extension` como runner de diagnóstico Chromium, sin usarlo como gate final.
2. Usar `test:e2e:firefox-extension` como validación real de extensión en Firefox.
3. Reportar compatibilidad final de extensión únicamente con evidencia Firefox-first.
