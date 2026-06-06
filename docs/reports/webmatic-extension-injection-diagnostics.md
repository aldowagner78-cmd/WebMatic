# Diagnóstico de inyección de extensión en test:e2e:extension

## 1) Objetivo

Diagnosticar por qué la corrida local de extensión no inyecta WebMatic y no aparece el panel en el DOM.

Restricciones respetadas:

- Sin IAPOS real.
- Sin nuevas funcionalidades de producto.
- Sin commit ni push.

## 2) Evidencia ejecutada

Se ejecutaron:

- npm test
- npm run test:e2e
- npm run test:e2e:extension

Resultados:

- npm test: PASS (117/117)
- npm run test:e2e: PASS (fixture local seguro)
- npm run test:e2e:extension: FAIL por timeout esperando #webmatic-panel-root

Además se ejecutó diagnóstico dedicado en matriz de URL:

- http://localhost:18085/iapos-safe-page.html
- http://127.0.0.1:18085/iapos-safe-page.html
- file:///home/usuario/Escritorio/WebMatic/tests/fixtures/iapos-safe-page.html

## 3) Estado del manifiesto

Se verificó [manifest.json](manifest.json):

- manifest_version: 2
- content_scripts con matches: <all_urls>
- all_frames: true
- run_at: document_idle
- background scripts clásicos (no service worker)

## 4) Evidencia técnica clave

Diagnóstico dedicado de runtime de extensión:

- backgroundPages al inicio: vacío
- serviceWorkers al inicio: vacío
- backgroundPages tras navegar: vacío
- serviceWorkers tras navegar: vacío

Diagnóstico DOM en las 3 URL:

- hasStyleLink: false (no aparece #webmatic-style-link)
- hasPanel: false (no aparece #webmatic-panel-root)
- sin marcador de recorder flotante

Diagnóstico de consola:

- Solo aparece 404 de recurso de página (favicon).
- No hay error de ejecución del content script porque el content script no llega a inyectarse.

Prueba de control para aislar causa:

- Se cargó una extensión mínima MV3 temporal con Playwright + Chromium.
- Resultado: sí aparece service worker de extensión.
- Conclusión: el mecanismo de carga de extensiones en Playwright/Chromium sí funciona en este entorno.

Versión de Chromium usada por Playwright:

- 148.0.7778.96

## 5) Causa probable/confirmada

Causa confirmada por descarte con evidencia:

- La extensión WebMatic (MV2) no llega a cargarse en Chromium 148 en este entorno.
- No se inicializa background page ni service worker, por lo tanto no existe inyección de content script en ningún origen probado (localhost, 127.0.0.1, file).
- El fallo no depende de la URL del fixture ni del servidor local.

## 6) Estado de apertura de panel

- Apertura automática: no ocurre, porque no hay inyección.
- Apertura por mensaje OPEN_PANEL desde background: no efectiva, porque no hay runtime de extensión activo para enrutar el mensaje hacia content script inyectado.

## 7) Cambios de diagnóstico realizados

Se agregó telemetría de diagnóstico al runner para que el error sea autodescriptivo:

- [tests/e2e/webmatic-extension-safe/run.js](tests/e2e/webmatic-extension-safe/run.js)

Incluye:

- Dump de páginas, backgroundPages y serviceWorkers.
- Dump de marcadores DOM relevantes (style/panel).
- Captura de console error y pageerror.

Se agregó script de diagnóstico profundo:

- [tests/e2e/webmatic-extension-safe/diagnose-injection.js](tests/e2e/webmatic-extension-safe/diagnose-injection.js)

## 8) Recomendación concreta

Para habilitar E2E de extensión en Chromium moderno:

1. Migrar la extensión a MV3 (background service worker y ajustes de permisos/API).
2. Mantener el runner actual y revalidar inyección con los mismos checks de DOM/runtime.
3. Una vez inyecte, completar nuevamente el flujo grabar/editar/exportar/reproducir en test:e2e:extension.

Mientras no se migre a MV3, el comando npm run test:e2e:extension seguirá fallando por ausencia de inyección de la extensión en este entorno.
