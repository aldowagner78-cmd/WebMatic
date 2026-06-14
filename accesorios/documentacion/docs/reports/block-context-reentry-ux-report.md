# Block context reentry UX report - WebMatic

## 1. Resumen ejecutivo

Se implementó una mejora visual segura para que el editor reconozca reingresos a contextos ya vistos sin fusionar bloques no consecutivos ni alterar el orden lineal de ejecución de la macro.

## 2. Problema

En flujos del tipo `A -> B -> A`, el editor mostraba tres bloques físicos correctos, pero el tercer bloque podía parecer un bloque totalmente nuevo aunque en realidad fuera un regreso al mismo contexto.

## 3. Decisión técnica

Se eligió mantener la macro lineal y marcar reingresos solo en el render del editor. La identidad de contexto sigue derivándose de `_wmBlockKey`, y el editor calcula `visitIndex` e `isReentry` por bloque físico consecutivo.

## 4. Qué se implementó

1. Cálculo visual por bloque de visita de contexto y reingreso en `step-editor.js`.
2. Badge `visita N` para bloques con `_wmBlockKey`.
3. Badge `reingreso` y clase `wm-sved-block-reentry` cuando un contexto reaparece en un bloque posterior.
4. Tooltip que aclara que el bloque vuelve a un contexto ya usado.
5. Preservación del estilo de defaults y compatibilidad con macros viejas sin `_wmBlockKey`.

## 5. Qué NO se implementó

1. No se fusionan bloques no consecutivos.
2. No se altera el orden de ejecución.
3. No se modifica Player.
4. No se cambia la semántica de `open_tab`, `switch_tab` ni `close_tab`.
5. No se agrega export/import nuevo para IIM o WM_JSON.

## 6. Archivos modificados

- `src/modules/editor/step-editor.js`
- `src/modules/ui/ui-shell.css`
- `accesorios/pruebas/tests/unit/step-editor.test.js`
- `docs/reports/block-context-reentry-ux-plan.md`

## 7. Tests agregados

1. `A -> B -> A` marca reingreso sin fusionar bloques.
2. Mismo contexto consecutivo no marca reingreso falso.
3. Defaults conservan su estilo aunque haya reingreso posterior.
4. Macros viejas sin `_wmBlockKey` siguen renderizando.

## 8. Validación ejecutada

- `node --test accesorios/pruebas/tests/unit/step-editor.test.js`: OK
- `npm test`: pendiente hasta validación final de la ronda
- `npm run verify:v2:firefox:fast`: pendiente hasta validación final de la ronda
- `npm run verify:v2:firefox:full`: pendiente hasta validación final de la ronda

## 9. Riesgos remanentes

1. El color principal del bloque sigue siendo por ordinal, no por hash estable de contexto.
2. La identidad visual compartida entre visitas depende hoy del texto de contexto y del badge, no de una paleta específica por `_wmBlockKey`.

## 10. NO VERIFICADO

- NO VERIFICADO: comportamiento visual manual en navegador real en esta ronda.

## 11. Criterio de aceptación

Se cumple si un flujo `A -> B -> A` se muestra como tres bloques físicos consecutivos, el tercero se identifica como reingreso y la macro mantiene orden lineal intacto.

## 12. Próximos pasos

1. Si se desea reforzar la identidad visual, evaluar color estable por `_wmBlockKey` en una ronda separada.
2. Revisar manualmente la UX del badge en Firefox/Chromium antes de mergear.
