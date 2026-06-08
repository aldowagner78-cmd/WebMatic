# Reporte breve - Fase 1 VALUE dropdown

Fecha: 2026-06-07
Rama: master

## Objetivo
Convertir el campo VALUE del editor visual en un `<select>` real cuando haya opciones disponibles, y habilitar matching cross-control para casos autocomplete/input -> native-select relacionado.

## Cambios
- `src/modules/editor/step-editor.js`
  - `_syncOptionPicker(fieldsDiv, typeValue, step)` ahora reemplaza `[data-field="value"]` input por `<select data-field="value" data-wm-optcombo="1">`.
  - Añade opción manual (`✏ valor manual…`) + input manual asociado.
  - Mantiene fallback manual cuando no hay opciones.
  - Usa inventario con búsqueda por `findOptionsForStep`.
- `src/modules/inventory/page-inventory.js`
  - Nuevo `findOptionsForStep(step, inventories)` con lookup por:
    1) selector exacto
    2) controlRef.selector
    3) controlRef.altSelectors
    4) cross-control por label/prefijo de id
  - Exportado en `api`.
- `tests/unit/step-editor.test.js`
  - Ajustes para VALUE como `<select>` real y opción manual preservando valor.
- `tests/unit/step-editor-inventory.test.js`
  - Ajustes por opción manual adicional.
  - Nuevos tests cross-control GeneXus-like.
- `tests/e2e/firefox-extension-safe/run.js`
  - Verifica que `[data-field="value"]` sea un `<select>` real en editor visual.
  - Agrega check de cross-control con `findOptionsForStep` sobre fixture GeneXus-like.
- `tests/fixtures/genexus-like.html`
  - Fixture nuevo con patrón input visible + select oculto relacionado:
    - `#vDELEGACION` (input)
    - `#vDELEGCOMBO` (select oculto con opciones)

## Resultado de tests
- `npm test`
  - pass: 160
  - fail: 0
- `npm run test:e2e`
  - resultado: OK (safe local read-only)
- `npm run test:e2e:firefox-extension`
  - resultado: OK
  - incluye validación `findOptionsForStep` para Delegación GeneXus-like

## Seguridad / alcance
- Se tocó solo E2E de Firefox y fixture de pruebas para validar Fase 1.1.
- No se ejecutó IAPOS real.
- No se habilitó `IAPOS_E2E_REAL=1`.
