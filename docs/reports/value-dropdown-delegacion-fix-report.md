# Reporte: Fix VALUE Dropdown (Delegación GeneXus-like)

**Fecha:** 2026-06-06  
**Branch:** master  
**Constraint:** No se abrió IAPOS real. `IAPOS_E2E_REAL=1` no habilitado.

---

## Causa raíz

El campo VALUE en el editor de pasos (`choose_option`/`input`/`text`) era un `<input type="text">` simple, sin triángulo desplegable. El método `_syncOptionPicker` insertaba un `<select data-wm-optcombo>` SEPARADO debajo del campo selector, pero no reemplazaba el campo VALUE real. El usuario veía dos controles distintos y el guardado del paso leía el `<input>` original (vacío), no el combo de opciones.

---

## Bugs específicos corregidos

### Bug 1 — VALUE no era un `<select>` real
`_syncOptionPicker` ahora **reemplaza** el `<input data-field="value">` por un `<select data-field="value" data-wm-optcombo="1">`. El triángulo desplegable aparece porque el campo ES un `<select>` nativo del navegador.

### Bug 2 — Sin cross-control para autocomplete GeneXus-like
Caso: paso con selector `#vDELEGACION` (input autocomplete visible) cuyas opciones viven en `#vDELEGCOMBO` (native select oculto). La función `findOptionsForStep` busca opciones en 4 niveles:
1. Selector exacto del paso
2. `step.controlRef.selector`
3. `step.controlRef.altSelectors`
4. **Cross-control**: si el control es text-input/autocomplete, busca native-select relacionado por **mismo label** o **prefijo de ID común** (mínimo 4 chars o 50% del ID más corto)

### Bug 3 — `isManualInit` falso positivo (causa inmediata del último test fallido)
La lógica de preselección hacía `pre = options.find(o => o.selected)` incluso cuando `curVal = "ZZ"` no coincidía con ninguna opción. Como el primer `<option>` del DOM tiene `selected=true` por defecto, `pre` quedaba no-nulo → `isManualInit = false` → `manualOpt.value = ""` en lugar de `"ZZ"`.

**Fix:** El fallback `selected` solo aplica cuando no hay `curVal`:
```javascript
if (!pre && !curVal) pre = options.find((o) => o.selected);
```

### Bug 4 — happy-dom resetea `.value` al conectar al DOM
Los valores de `<option>` y `<input>` asignados antes de `appendChild`/`replaceChild` se pierden en happy-dom (y en algunos browsers). Fix: asignar `manualOpt.value` y `manualInput.value` **después** de insertar en el DOM.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/modules/editor/step-editor.js` | `_syncOptionPicker` reescrito: VALUE se reemplaza por `<select>`, lógica `isManualInit` corregida, valores asignados post-DOM-insertion |
| `src/modules/inventory/page-inventory.js` | Funciones `findOptionsForStep`, `_commonPrefixLen`, `_idFromSelector` agregadas; `api` exporta `findOptionsForStep` |
| `tests/unit/step-editor.test.js` | `buildFields` corregido (valores post-`appendChild`); tests nuevos: VALUE es `<select>`, opción manual preserva valor previo |
| `tests/unit/step-editor-inventory.test.js` | Reescrito completo con 14 tests: cross-control por prefijo/label, findOptionsForStep, integración editor+inventario |
| `tests/e2e/firefox-extension-safe/run.js` | Checks `valueIsSelectElement` y `delegacionInventoryFindOptionsForStep`; sección Delegación GeneXus-like |
| `tests/fixtures/genexus-like.html` | Fixture nuevo: `#vDELEGACION` (input autocomplete) + `#vDELEGCOMBO` (hidden select, 4 opciones) |

---

## Resultados de tests

### `npm test` — Tests unitarios
```
# tests 164
# pass  164
# fail    0
```

### `npm run test:e2e` — IAPOS safe (fixture local)
```
[iapos-safe-e2e] OK: safeFill permite input de filtro
[iapos-safe-e2e] OK: safeSelectOption permite select de filtro
[iapos-safe-e2e] OK: safeClick permite Buscar
[iapos-safe-e2e] OK: safeClick bloquea Autorizar
[iapos-safe-e2e] OK: inventario técnico sanitizado se genera
[iapos-safe-e2e] REAL_IAPOS: omitido (setear IAPOS_E2E_REAL=1 para habilitar)
```

### `npm run test:e2e:firefox-extension` — Firefox extension real
```
[iapos-safe-e2e] OK: inyección detectada hasStyleLink=sí hasPanelRoot=sí
[iapos-safe-e2e] OK: inventario capturó 13 controles; opciones de #filtro-modalidad=[1, 2]
[iapos-safe-e2e] OK: findOptionsForStep Delegación → ["Seleccionar","IAPOS SANTA FE","ROSARIO","RAFAELA"]
[iapos-safe-e2e] OK: validación Firefox-first completada sobre fixture local (sin IAPOS real)
```

---

## Confirmaciones de seguridad

- ✅ No se abrió IAPOS real en ninguna etapa
- ✅ `IAPOS_E2E_REAL=1` no habilitado
- ✅ No se hizo push ni commit
- ✅ Todos los tests E2E operan sobre fixtures locales
