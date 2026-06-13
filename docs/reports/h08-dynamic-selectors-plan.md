# H-08 Dynamic Selectors Hardening Plan

## 1. Estado actual

- Rama de trabajo: `hardening/h08-dynamic-selectors`.
- Estado auditado antes de cambios: sin modificaciones en código H-08.
- `Recorder.buildSelector` ya implementa una prioridad concreta en `src/modules/recorder/recorder.js`.
- No existe `accesorios/pruebas/tests/unit/recorder.test.js`; solo existe `accesorios/pruebas/tests/unit/recorder-pre-run-reset.test.js`.

## 2. Evidencia de código revisada

1. Construcción y prioridad actual de selector (`src/modules/recorder/recorder.js`):
- Prioridad observada: `id` -> `name` (con manejo de duplicados) -> `a[href]` -> `aria-label` -> `placeholder` -> `data-testid` -> `gxrow+title` -> `title` -> `data-*` estable -> `text` -> `ancestor id + nth-of-type` -> `class + nth-of-type`.
- IDs se aceptan siempre si existen (`if (element.id) return "#" + element.id;`), sin filtro explícito de ID dinámico.
- `name` duplicado: evita selector global ambiguo y ancla a ancestro con id estable.
- `data-*` dinámicos: excluye `data-(v-|reactid|ng-|index$|key$|_)` y valores vacíos o muy largos.

2. Uso de selector en recorder/content/inventory:
- `src/content/content.js` consume `WebMaticRecorder.buildSelector` para grabación en top frame y subframes.
- `src/modules/inventory/page-inventory.js` usa `Recorder.buildSelector` como selector primario y arma alternativos con `id/name/aria-label/placeholder/data-testid`.

3. Resolución en playback (`src/modules/player/player.js`):
- `findElement` soporta CSS, XPath, `tag[text="..."]`, búsqueda en iframes same-origin y Shadow DOM abierto (vía `findInShadow`/`findInDocument`).
- H-08 en esta ronda se enfoca en generación de selector, no en cambiar Player salvo evidencia estricta.

4. Cobertura de tests actual:
- No hay suite unitaria dedicada de robustez de `buildSelector`.
- `recorder-pre-run-reset.test.js` prueba captura pre-run reset, no heurística dinámica de selectores.

## 3. Riesgos detectados

1. Riesgo alto de fragilidad por priorizar `id` sin discriminar IDs dinámicos.
2. `aria-label`/`title`/`data-testid` quedan detrás de `id` y `name` aunque sean más estables en sitios SPA.
3. `text` fallback no valida unicidad global antes de usarse.
4. Potenciales regresiones si se cambia prioridad sin cobertura de compatibilidad legacy.

## 4. Casos a cubrir

1. Caso A: ID dinámico con `data-testid` estable.
2. Caso B: ID dinámico con `aria-label` estable.
3. Caso C: ID dinámico con `title` estable.
4. Caso D: `name` duplicado con anclaje por contexto.
5. Caso E: evitar `data-reactid`, `data-v-*`, `data-ng-*`, `data-index`, `data-key` y patrones dinámicos de id.
6. Caso F: `gxrow + title` en grilla GeneXus.
7. Caso G: texto visible corto y no ambiguo como fallback.
8. Caso H: DOM mutante post-click con atributo estable persistente.
9. Caso I: iframe same-origin (si es viable en unit/e2e del repo).
10. Caso J: Shadow DOM: documentar `NO VERIFICADO` si no se valida explícitamente en esta ronda.

## 5. Cambios propuestos

Enfoque combinado: mejorar heurística + agregar cobertura + documentar límites.

1. Mejorar `Recorder.buildSelector` en `src/modules/recorder/recorder.js`:
- Incorporar detector explícito `isLikelyDynamicValue` para IDs/atributos dinámicos.
- Penalizar ID dinámico y preferir atributos semánticos estables (`data-testid`, `aria-label`, `placeholder`, `title`) cuando aplique.
- Mantener compatibilidad: no degradar IDs simples estables (`login`, `username`, `buscar`, etc.).
- Reforzar fallback de texto para evitar ambigüedad obvia cuando haya múltiples candidatos similares.

2. Mantener fuera de alcance (salvo evidencia):
- No tocar `src/background/background.js`.
- No tocar H-09 ni IAPOS real.
- No tocar Player si los tests demuestran que el problema está en generación y no en resolución.

## 6. Tests a agregar

1. Crear `accesorios/pruebas/tests/unit/recorder.test.js` (suite nueva).
2. Cubrir mínimo los 14 checks exigidos por el prompt:
- preferencia `data-testid` sobre ID dinámico;
- preferencia `aria-label` sobre ID dinámico;
- preferencia `title` sobre ID dinámico;
- `name` duplicado con contexto;
- `gxrow + title`;
- evitar `data-reactid`;
- evitar `data-v-*`;
- texto corto como fallback;
- texto duplicado no global ambiguo;
- DOM mutante con atributo estable;
- no romper ID estable simple;
- no romper `name` único;
- no romper `href` corto;
- no romper fallback actual (`nth-of-type`).

## 7. Límites explícitos

1. `NO VERIFICADO` en esta ronda para cross-origin iframe (por restricciones del entorno).
2. `NO VERIFICADO` para Shadow DOM cerrado.
3. No se declara soporte nuevo de playback fuera de lo ya existente.

## 8. Riesgos de regresión

1. Cambiar la prioridad puede alterar selectores ya grabados en casos legacy.
2. Filtros de dinámicos demasiado agresivos pueden descartar IDs útiles.
3. Fallback semántico incorrecto podría apuntar a elemento equivocado en formularios con etiquetas repetidas.

## 9. Estrategia anti-regresión

1. Mantener compatibilidad explícita de casos estables existentes (id simple, name único, href corto, nth-of-type).
2. Agregar tests de no-regresión junto a tests de nuevos casos dinámicos.
3. Ejecutar validación completa obligatoria al final:
- `npm test`
- `npm run verify:v2:firefox:fast`
- `npm run verify:v2:firefox:full`

## 10. Criterios de aceptación

1. Suite nueva de `recorder.test.js` creada y pasando.
2. Casos A-H cubiertos con evidencia en tests.
3. Casos I/J marcados honestamente como verificados o `NO VERIFICADO`.
4. Validaciones globales (`npm test`, `verify fast`, `verify full`) en verde.
5. Informe H-08 actualizado con límites explícitos y sin sobredeclarar soporte.