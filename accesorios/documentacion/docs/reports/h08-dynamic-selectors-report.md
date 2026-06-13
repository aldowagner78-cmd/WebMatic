# H-08 Dynamic Selectors Hardening Report

## 1. Resumen ejecutivo

Se cerró H-08 con cambios en la heurística de generación de selectores en recorder, nueva cobertura unitaria específica para selectores dinámicos y validación completa de regresión (`npm test`, `verify fast`, `verify full`) en verde.

## 2. Estado inicial

- Rama de trabajo: `hardening/h08-dynamic-selectors`.
- `Recorder.buildSelector` priorizaba `id` sin discriminar si era dinámico.
- No existía suite unitaria específica de robustez de selectores (`recorder.test.js`).

## 3. Cambios realizados

1. `src/modules/recorder/recorder.js`
- Se agregó `Recorder.isLikelyDynamicValue(value)` para detectar patrones dinámicos (timestamps largos, UUID, hashes/tokens largos, sufijos numéricos largos, patrones framework).
- `buildSelector` ahora evita tomar `id` como primera opción cuando parece dinámico.
- Para IDs dinámicos prioriza atributos semánticos/estables: `data-testid`, `aria-label`, `placeholder`, `title`.
- Se preservó comportamiento de `name` único/duplicado y fallback actuales.
- Se mantuvo `gxrow + title` en grillas GeneXus con prioridad sobre `title` global.
- Fallback por texto visible ahora exige unicidad en el tag para evitar ambigüedad.

2. `accesorios/pruebas/tests/unit/recorder.test.js`
- Nueva suite unitaria con casos H-08 y no-regresión.

3. `docs/reports/h08-dynamic-selectors-plan.md`
- Plan normalizado al formato obligatorio 1..10 del prompt.

## 4. Archivos modificados

- `src/modules/recorder/recorder.js`
- `accesorios/pruebas/tests/unit/recorder.test.js`
- `docs/reports/h08-dynamic-selectors-plan.md`
- `accesorios/documentacion/docs/reports/h08-dynamic-selectors-report.md`

## 5. Tests agregados

Nueva suite:

- `accesorios/pruebas/tests/unit/recorder.test.js`

Casos agregados en esa suite:

1. prefer data-testid sobre ID dinámico
2. prefer aria-label sobre ID dinámico
3. prefer title sobre ID dinámico
4. name duplicado con contexto
5. gxrow + title
6. evitar data-reactid/data-v-* (vía fallback)
7. texto visible como fallback
8. texto duplicado no global ambiguo
9. DOM mutante con ID variable y atributo estable
10. no romper ID estable simple
11. no romper name único
12. no romper href corto
13. no romper fallback class+nth

## 6. Casos cubiertos

| Caso | Estado | Evidencia |
|---|---|---|
| A ID dinámico + data-testid | CUBIERTO | `buildSelector: prefers data-testid over dynamic id` |
| B ID dinámico + aria-label | CUBIERTO | `buildSelector: prefers aria-label over dynamic id` |
| C ID dinámico + title | CUBIERTO | `buildSelector: prefers title over dynamic id` |
| D name duplicado | CUBIERTO | `buildSelector: duplicate names use stable parent context` |
| E atributos dinámicos a evitar | CUBIERTO PARCIAL | `buildSelector: avoids dynamic data-* and falls back to visible text` |
| F gxrow | CUBIERTO | `buildSelector: gxrow + title for GeneXus row actions` |
| G texto visible | CUBIERTO | `buildSelector: avoids text fallback when duplicated and keeps controlled fallback` |
| H DOM mutante post-click | CUBIERTO | `buildSelector: dom mutation keeps stable selector` |
| I iframe same-origin | NO VERIFICADO EN ESTA RONDA | Sin test específico H-08 dedicado |
| J Shadow DOM | NO VERIFICADO EN ESTA RONDA | Sin test H-08 dedicado para shadow abierto/cerrado |

## 7. Tests ejecutados

| Comando | Resultado | Observaciones |
|---|---|---|
| `npm test` | OK | 258 pass, 0 fail |
| `npm run verify:v2:firefox:fast` | OK | pipeline fast completo en verde |
| `npm run verify:v2:firefox:full` | OK | pipeline full en verde (incluye extensión Firefox) |

## 8. Riesgos de regresión revisados

1. Prioridad de selector alterada solo para IDs detectados como dinámicos.
2. Compatibilidad protegida con tests de ID estable, name único y href corto.
3. Fallback de texto ahora evita ambigüedad por duplicación obvia en mismo tag.

## 9. Riesgos remanentes

1. Heurística de detección dinámica puede requerir ajuste fino con sitios no cubiertos.
2. Páginas muy dinámicas con semántica pobre pueden caer en fallback más genérico.

## 10. NO VERIFICADO

- `NO VERIFICADO EN ESTA RONDA`: cobertura H-08 específica para iframe same-origin.
- `NO VERIFICADO EN ESTA RONDA`: cobertura H-08 específica para Shadow DOM abierto/cerrado.

## 11. Límites explícitos

1. No se modificó Player para H-08 (no hubo evidencia de que el problema fuera resolución en playback).
2. No se tocó Background.
3. No se trabajó H-09.
4. No se trabajó IAPOS real.

## 12. Criterio de aceptación

Criterio cumplido para cierre H-08 en esta ronda:

1. Heurística mejorada de selectores dinámicos.
2. Cobertura unitaria dedicada agregada.
3. Validación completa requerida en verde.
4. Límites y no-verificados documentados sin sobredeclarar soporte.

## 13. Próximos pasos

1. Agregar test dedicado H-08 para iframe same-origin con mutación de selector.
2. Agregar test dedicado H-08 para Shadow DOM (open y closed) y documentar comportamiento final.
3. Pasar a H-09 una vez aprobada esta ronda.
