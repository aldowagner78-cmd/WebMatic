# Plan de validacion automatica ampliada

Fecha: 2026-06-19
Rama: modularizacion-base
Tag tecnico: v0.2.0-modular-rc1

## Objetivo

Agregar una segunda capa de QA automatizado sobre flujos simulados locales de WebMatic, sin continuar modularizando y sin cambiar comportamiento productivo.

## Infraestructura

- Runner: `node:test`.
- DOM simulado: `happy-dom`.
- E2E disponible: `playwright`.
- Helpers nuevos: `accesorios/pruebas/tests/helpers/browser-harness.js`.
- Fixtures nuevos: `accesorios/pruebas/fixtures/qa/`.

## Tests agregados

- `player-fixture-flow.test.js`: reproduccion sobre fixtures para input, textarea, contenteditable, checkbox/radio visible y oculto, labels, roles, select, click, dblclick, extract y wait_for.
- `recorder-fixture-flow.test.js`: selectors/steps simulados de recorder, defaults, exclusion de UI propia, select como choose_option y normalizacion.
- `content-background-flow.test.js`: routing, respuestas ok/error, tabs/navigation con mocks, storage de macros y background PLAYBACK_NAVIGATE.
- `editor-ui-flow.test.js`: validation de steps, render utils, componentes UI, shell-state, style utils, block utils, drag/drop e inline recording state.
- `webmatic-smoke-flow.test.js`: macro local completa sobre fixture con input, checkbox, select, click y extract.

## Flujos no cubiertos automaticamente

- Portal real o GeneXus real con datos vivos.
- Permisos reales de extension en Chrome/Firefox.
- Timing real de navegacion entre pestanas y frames cross-origin.
- Pixel perfect de UI.
- Captura contextmenu si depende de interaccion real del navegador.

## Pendientes manuales

- Smoke final en navegador con extension cargada.
- Grabacion y reproduccion sobre fixture local en Chrome/Firefox.
- Prueba supervisada sobre portal real/GeneXus con datos no sensibles.
- Validar permisos de `file://` y handoff entre pestanas en Firefox.

## Ejecucion

Ejecutar suite completa:

```bash
npm test
```

No usar pipes, `tail` ni filtros al reportar validacion final. Si el runner reporta solo 17 tests, no se ejecuto la suite completa.

## Advertencia

Estos tests amplian la confianza local, pero no reemplazan la prueba manual final sobre navegador/portal real. Antes de nuevas extracciones o cambios de comportamiento, agregar tests dedicados del modulo afectado.
