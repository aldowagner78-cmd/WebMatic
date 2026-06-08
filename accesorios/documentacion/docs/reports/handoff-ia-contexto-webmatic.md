# Handoff IA - WebMatic (IAPOS/GeneXus)

Fecha: 2026-06-07
Repositorio: WebMatic
Rama: master

## Estado y diagnóstico

1. Por qué Delegación y Especialidad se grababan como TYPE:
- En src/content/content.js, el handler onChange grababa todo HTMLInputElement como input (TYPE), salvo select/checkbox/radio.
- No había detección de selección real de autocomplete en tiempo de grabación.

2. Metadata de autocomplete:
- Antes se capturaban opciones fiables principalmente de select nativo y datalist en inventario.
- Para input autocomplete dinámico (GeneXus), no se persistían opciones usadas/visibles durante grabación.

3. Editor visual:
- Sí puede mostrar VALUE como dropdown para input/text si existen opciones en metadata (ya funcionaba en src/modules/editor/step-editor.js + inventory).

4. Inventario/meta vs steps:
- El inventario sigue guardándose como metadata de macro, no como steps ejecutables.
- No se agregaron steps visibles de inventario.

5. Por qué la normalización inicial se veía:
- En src/modules/player/player.js, los pasos internos _fast de defaults hacían highlight visual igual que pasos normales.

## Cambio mínimo aplicado (sin features grandes)

Archivos tocados:
- src/content/content.js
- src/modules/player/player.js
- tests/unit/player.test.js
- tests/unit/step-editor-inventory.test.js

Qué se cambió:
- Recorder:
  - Detección mínima de selección de autocomplete por click en opción tipo listbox/option.
  - En onChange de input: si hay evidencia de selección autocomplete, graba choose_option con inputMode=autocomplete; si no, mantiene input (TYPE).
  - Catálogo mínimo de opciones usadas/visibles durante grabación por selector.
  - Merge de ese catálogo a metadata de inventario para que editor visual tenga opciones en VALUE.
- Player:
  - Pasos internos _fast (normalización de defaults) sin highlight visual.
- Tests:
  - Nuevo test: autocomplete con opciones capturadas se edita con VALUE select.
  - Nuevo test: autoCaptureDefaults interno no agrega pasos visibles por onStep.

## Validación ejecutada

- npm test: PASS (162/162)
- npm run test:e2e: PASS
- npm run test:e2e:firefox-extension: PASS
- No se habilitó IAPOS_E2E_REAL.
- No se ejecutaron acciones peligrosas en IAPOS real.

## Alcance exacto respecto al caso real

- Resuelve el gap técnico principal: deja de forzar TYPE en todo input y habilita ruta choose_option/autocomplete cuando hay evidencia de selección.
- Mantiene TYPE para input libre cuando no hay evidencia/opciones confiables.
- Defaults internos quedan silenciosos visualmente (sin highlight de pasos internos).

## Dato mínimo si vuelve a fallar manualmente en IAPOS

Enviar solo:
1. Línea exacta del step grabado para Delegación o Especialidad.
2. Captura del editor visual del paso (sección VALUE).
3. Selector exacto del campo en ese paso (ejemplo: #vDELEGACION o #vAUCAESPEFC).

## Restricciones de trabajo (importante)

- No habilitar IAPOS_E2E_REAL.
- No ejecutar acciones peligrosas.
- Priorizar cambio mínimo y costo-eficiente.
- No agregar features nuevas hasta cerrar completamente el caso real.

## Estilo de trabajo esperado para la IA

- Diagnóstico primero con evidencia.
- Proponer y aplicar fix mínimo, localizado.
- Validar SIEMPRE con tests automáticos disponibles.
- Reporte breve, directo, sin teoría innecesaria.
- Pedir datos mínimos solo si vuelve a fallar manualmente.
