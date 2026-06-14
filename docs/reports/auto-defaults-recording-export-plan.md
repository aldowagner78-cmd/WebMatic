# Auto defaults recording/export plan - WebMatic

## 1. Estado actual verificado

- `Recorder.captureInitialPreRunReset` existe y es llamada al iniciar grabación.
- `recorderRuntime.preRunReset` almacena el resultado en memoria durante la sesión.
- `_recordingMeta()` incluye `preRunReset` en el objeto meta si está presente.
- `exportToIim({ steps, meta })` emite `// WM_JSON:{...}` cuando meta no es null.
- `area.dataset.wmFullScript` almacena el script completo con WM_JSON desde el momento en que se abre el editor de script.
- `seEditor.getMeta()` retorna el meta incluyendo `preRunReset`.
- La función `capturePageDefaults` inserta pasos `_baselineDefault` para campos no tocados en la página actual.

## 2. Evidencia de código revisada

- `src/content/content.js` línea 7922: `script-editor-copy`
- `src/content/content.js` línea 7897: `script-editor-tab` switch a "script" — guarda `wmFullScript` y muestra versión filtrada
- `src/content/content.js` línea 4100: `_recordingMeta()` incluye `preRunReset`
- `src/content/content.js` línea 7176: `recorderRuntime.preRunReset = _captureInitialPreRunReset()`
- `src/modules/storage/iim-adapter.js` línea 1: `_sanitizeMetaForExport` sanitiza sensibles y preserva `preRunReset`
- `src/modules/editor/step-editor.js` línea 181: `getMeta()` devuelve clon de `_macroMeta` con `preRunReset`

## 3. Brecha detectada

**Bug único confirmado**: En `script-editor-copy`, cuando el tab activo es "script":

```javascript
// BUG:
textToCopy = area ? area.value : "";
// area.value = versión visible SIN WM_JSON
// area.dataset.wmFullScript = versión completa CON WM_JSON
```

El textarea visible muestra intencionalmente el IIM filtrado (sin `// WM_JSON:`) para legibilidad.
La versión completa con WM_JSON existe en `area.dataset.wmFullScript`.
La acción de copiar usa la versión filtrada en lugar de la completa.

## 4. Hipótesis descartadas

- `exportToIim` no genera WM_JSON: DESCARTADA — sí lo genera cuando hay meta.
- `_recordingMeta()` no incluye `preRunReset`: DESCARTADA — sí lo incluye.
- La captura inicial falla: DESCARTADA — `captureInitialPreRunReset` se llama correctamente al iniciar.
- El editor visual pierde el meta: DESCARTADA — `setMeta`/`getMeta` preservan preRunReset.
- El copia desde tab visual falla: DESCARTADA — esa ruta sí usa `getMeta()` y exporta con WM_JSON.
- `_resolveEditorMetaForSteps` descarta preRunReset: DESCARTADA — preserva todos los keys no relacionados con inventarios.

## 5. Decisión técnica

Corrección mínima en `script-editor-copy`:
usar `area.dataset.wmFullScript` cuando esté disponible, con fallback a `area.value`.

No se rediseña el flujo de captura de defaults. No se toca Player, Recorder, IIM adapter ni el editor visual.

## 6. Cambios propuestos

1. `src/content/content.js`: línea del copy en "script" tab usa `wmFullScript`.
2. Nuevo test: `iim-adapter.test.js` — round-trip con meta.preRunReset conserva valores.
3. Fixtures de reproducción manual documentados.

## 7. Tests a agregar

1. Round-trip `exportToIim` → `importFromIim` con meta que contiene `preRunReset` preserva `preRunReset`.
2. Copy script en tab "script" produciría WM_JSON (documentado como prueba manual ya que content.js no tiene harness).
3. Sensibles sanitizados no aparecen en WM_JSON exportado (ya cubierto, verificar).

## 8. Riesgos de regresión

- Bajo: el cambio es una línea que solo afecta la acción de copia.
- El fallback a `area.value` preserva el comportamiento actual si `wmFullScript` no está seteado.
- No toca ningún módulo de ejecución.

## 9. Seguridad de datos sensibles

`_sanitizeMetaForExport` en iim-adapter ya sanitiza `preRunReset.controls` eliminando `value` de campos sensibles.
No se necesita cambio adicional en esa área.

## 10. Criterios de aceptación

1. Copiar desde tab "script" después de una grabación produce texto con `// WM_JSON:`.
2. El WM_JSON incluye `meta.preRunReset` cuando fue capturado al iniciar grabación.
3. Los valores sensibles no aparecen en el WM_JSON exportado.
4. Round-trip de IIM con preRunReset preserva los datos correctamente.
5. `npm test`, `verify fast` y `verify full` pasan en verde.
