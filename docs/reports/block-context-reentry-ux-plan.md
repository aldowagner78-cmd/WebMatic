# Block context reentry UX plan - WebMatic

## 1. Estado actual

El recorder estampa `_wmBlockKey`, `_wmBlockStart` y `_wmBlockEnd` al capturar pasos. El editor visual usa esos metadatos para delimitar bloques físicos consecutivos y renderizarlos con ordinal, contexto y estilo por tema.

## 2. Evidencia de código revisada

- `src/content/content.js`: `_resolveStepBlockKey()` calcula la identidad de contexto a partir de URL/step; `captureStep()` agrega `_wmBlockKey`, `_wmBlockStart` y `_wmBlockEnd`.
- `src/modules/editor/step-editor.js`: `_isExecutionBlockBoundaryStep()` y `_findExecutionBlockBounds()` agrupan bloques; el render usa `wm-sved-block`, `wm-sved-block-defaults`, `wm-sved-block-theme-*` y `wm-sved-block-context`.
- `src/modules/ui/ui-shell.css`: el estilo actual distingue bloques por ordinal de tema y conserva un tratamiento especial para defaults.
- `accesorios/pruebas/tests/unit/step-editor.test.js`: ya existen pruebas del editor visual, incluyendo bloques colapsados, reordenamiento y defaults.

## 3. Problema

Cuando una macro vuelve a un contexto previo en un flujo lineal del tipo `A -> B -> A`, el editor muestra tres bloques físicos independientes. Eso respeta la ejecución real, pero el tercer bloque puede percibirse como un contexto nuevo y no como reingreso al mismo contexto.

## 4. Estrategias evaluadas

### Estrategia A: fusionar bloques no consecutivos
- Riesgo: alto.
- Motivo para NO implementarla salvo rediseño mayor: rompe la linealidad visual, complica edición/reordenamiento y puede inducir una lectura falsa del orden real de ejecución.

### Estrategia B: mantener orden lineal y marcar reingresos
- Ventajas: conserva la estructura real de `steps`, evita tocar Player y permite explicar al usuario que se vuelve al mismo contexto.
- Riesgo: bajo a medio; se limita al render del editor y al estilo.
- Implementación propuesta: calcular en render la cantidad de visitas por `_wmBlockKey`, marcar bloques con `visitIndex > 1` como reingreso y mostrar badge/tooltip sin fusionar cuerpos.

## 5. Cambios propuestos

1. Agregar helpers en `step-editor.js` para derivar metadatos visuales por bloque: `visitIndex`, `isReentry` y contexto formateado.
2. Mostrar en el header del bloque una etiqueta de visita (`visita 1`, `visita 2`) y un badge `reingreso` cuando corresponda.
3. Agregar clase visual específica, preferentemente `wm-sved-block-reentry`, manteniendo los temas actuales por ordinal para minimizar riesgo.
4. No tocar recorder, Player, Background ni IIM.

## 6. Tests a agregar

1. Caso `A -> B -> A`: tres bloques físicos, tercer bloque marcado como reingreso, mismo contexto compartido y sin fusión.
2. Caso `A -> A` consecutivo: no marcar reingreso falso.
3. Caso defaults: el estilo/identidad default sigue vigente.
4. Caso sin `_wmBlockKey`: macros viejas siguen renderizando.
5. Verificar que las pruebas de reorder existentes sigan pasando.

## 7. Riesgos de regresión

1. Cambios en el header del bloque podrían romper tests del DOM si asumen estructura exacta.
2. El cálculo de visitas debe ignorar filas internas del mismo bloque para no marcar reingresos falsos.
3. El estilo de defaults no debe quedar ocultado por la marca de reingreso.

## 8. Límites explícitos

- No se fusionan bloques no consecutivos.
- No se altera el orden real de ejecución.
- No se modifica Player.
- No se cambia la semántica de `open_tab`, `switch_tab` ni `close_tab`.
- No se ejecuta IAPOS real.

## 9. Criterios de aceptación

1. Un flujo `A -> B -> A` se ve como tres bloques físicos consecutivos.
2. El tercer bloque muestra que es una nueva visita al mismo contexto.
3. El contexto compartido es reconocible sin alterar la linealidad.
4. Las macros viejas sin metadatos siguen renderizando.
5. `npm test`, `npm run verify:v2:firefox:fast` y `npm run verify:v2:firefox:full` quedan en verde.
