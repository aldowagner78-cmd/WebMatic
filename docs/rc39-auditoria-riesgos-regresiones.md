# Auditoria rc39: riesgos y regresiones WebMatic 0.2.3

Fecha de auditoria: 2026-06-29.
Alcance: lectura de modulos criticos para universalidad practica sin modificar codigo productivo.

## Resumen ejecutivo

rc39 deberia tratar la universalidad como una serie de mejoras pequeñas, verificables y reversibles. Las zonas mas fragiles no son funciones aisladas sino contratos entre grabacion, inventario, normalizacion y reproduccion: el selector que se graba, los fallbacks que se adjuntan al step, la forma en que se compactan eventos ruidosos y la manera en que `player.js` reanuda luego de navegaciones.

Los mayores riesgos de regresion estan en:

- Selectores dinamicos y fallback de resolucion en `src/common/selectors/selector-builder.js` y `src/common/dom/element-finder.js`.
- Compactacion de pasos en `src/modules/recorder/normalizer/recording-normalizer.js`.
- Inventario y asociacion `step -> controlRef` en `src/modules/inventory/page-inventory.js`.
- Reproduccion con navegacion, pending playback, pre-run reset y acciones por selector en `src/modules/player/player.js` y `src/modules/player/navigation/*`.
- Bootstrap y captura multi-frame en `src/content/content.js`.

## 1. Partes fragiles para universalidad

### `src/common/dom/element-finder.js`

- `findInDocument` busca en documento, Shadow DOM y iframes accesibles. Es clave para universalidad, pero cualquier cambio puede alterar orden de resolucion cuando hay duplicados entre main document, shadow roots e iframes.
- `findElement` mezcla XPath, pseudo-selector `tag[text="..."]`, CSS, `fallbackSelectors`, fallback Angular Material y `knownFallback`. El orden actual es parte del contrato: cambiarlo puede hacer que una macro toque otro elemento que antes no tocaba.
- `_findAngularMaterialDynamicFallback` solo devuelve elemento si hay exactamente un candidato visible. Es conservador y evita falsos positivos. Relajarlo mejora alcance pero aumenta riesgo de click/escritura en campo equivocado.
- `_isVisibleEnough` es best-effort y en entornos sin layout tiende a aceptar elementos. Esto ayuda a tests con DOM simulado, pero en sitios reales puede considerar visibles nodos que estan tapados, colapsados o fuera de viewport.
- No hay soporte profundo para iframes cross-origin; se ignoran por seguridad del navegador. Cualquier promesa de universalidad debe asumir esa limitacion.

### `src/common/selectors/selector-builder.js`

- `buildSelector` prioriza `id` salvo caso Angular Material. Esto conserva macros existentes, pero es fragil ante IDs dinamicos no detectados. Cambiar la prioridad global de `id` podria romper macros viejas que hoy dependen de `#id`.
- `isLikelyDynamicValue` contiene heuristicas de dinamismo. Es una frontera delicada: falsos positivos degradan selectores estables; falsos negativos graban selectores que no sobreviven recarga.
- `buildStableFallbackSelectors` agrega alternativas solo si resuelven al mismo elemento y son unicas. Esta validacion es una barrera anti-regresion; no conviene saltarla.
- El pseudo-selector `button[text="..."]`/`a[text="..."]` depende de texto unico y normalizacion simple. Es util, pero fragil ante traducciones, contenido dinamico o botones duplicados.
- Selectores con `nth-of-type` son necesarios como ultimo recurso, pero son muy sensibles a cambios de DOM.

### `src/modules/inventory/page-inventory.js`

- `captureInventory` solo recorre el documento actual, no baja a iframes ni Shadow DOM como `element-finder`. Esto crea una brecha: el player puede encontrar elementos que el inventario no describe.
- `_isSensitive` protege valores sensibles por tipo, id/name/autocomplete/label. Es critico no debilitarlo. La universalidad nunca debe capturar secretos para mejorar defaults o inventario.
- El enriquecimiento GeneXus (`_extractCatalogEntriesFromGeneXusRuntime`, `_extractCatalogEntriesFromSerializedControls`, `_enrichControlsWithCatalogs`) es poderoso pero heuristico. Puede asociar catalogos erroneos si nombres, labels o paths se parecen.
- `findOptionsForStep` usa scoring por label/id/name y fallback sintetico GeneXus. Es util para autocompletes, pero es una de las zonas con mayor riesgo de mezclar opciones de campos distintos.
- `appendInventory` deduplica por `url + cantidad de controles`. Si una pantalla mantiene cantidad pero cambia identidad de controles, puede reemplazar un inventario con otro que no sea semanticamente equivalente.

### `src/modules/recorder/normalizer/recording-normalizer.js`

- `normalizeRecordedSteps` contiene muchas pasadas acopladas: dedupe de inputs, waits automaticos, inferencia de Enter, compactacion de select nativo, insercion de `wait_for` y preferencia por waits dinamicos.
- Las reglas de compactacion de escritura (`valuesLookLikeSameTypingRun`, distancia Levenshtein, prefijos) pueden borrar pasos reales si el usuario edita deliberadamente el mismo campo.
- La insercion automatica de `wait_for` despues de `navigate` y antes de `choose_option` mejora robustez, pero puede cambiar el timing de macros existentes.
- `compactNativeSelectClicks` distingue select nativo vs combobox custom por `controlRef`. Si `controlRef` falta o viene incompleto, puede compactar de mas o de menos.
- `dedupeFieldRuns` depende de `_ts` y de umbrales temporales. Cambios pequenos en umbrales modifican la semantica de filtros, borrados, pausas reales y waits.

### `src/modules/player/player.js`

- `player.js` es el punto de mayor blast radius. Concentra resolucion de selectores, acciones, variables, diagnosticos, pre-run reset, navegacion, pending playback, tabs, loops y subflujos.
- `findElement` delega a `element-finder` con fallbacks del step/controlRef. El contrato entre step grabado y fallback de reproduccion es central para rc39.
- Las acciones de `navigate` guardan estado antes de cambiar de pagina y pueden delegar al background si cambia protocolo o es `file:`. Cualquier cambio aca puede romper reanudacion.
- `preRunReset` se aplica al inicio, en reanudacion segun politica y despues de navigate. Es util para estabilidad, pero si toca controles no previstos puede borrar estado valido del usuario.
- Los fallbacks conocidos de galeria y skips transitorios son excepciones especificas. Sirven para macros legacy, pero si se generalizan pueden ocultar fallos reales.
- `_runSubSteps` y `_execComplexStep` duplican logica de flujos complejos respecto del loop principal. Esto hace facil arreglar top-level y romper subflujos.

### `src/modules/player/navigation/*`

- `navigation-analyzer.js` define `sameDocument` por origin/path/search e ignora hash para diferenciar navegacion real vs misma pagina. Es simple y testeable; no conviene mezclarlo con side effects.
- `mustUseBackground` hoy cubre `file:` y cambios de protocolo. Ampliarlo puede mejorar compatibilidad, pero debe probar pending playback y errores de background.
- `background-navigator.js` depende de `chrome.runtime.sendMessage` y de payload compatible con background. Cambios de shape rompen navegacion entre paginas/tabs aunque los unit tests de DOM pasen.

### `src/content/content.js`

- Es un bootstrap grande con dos mundos: sub-frame liviano y top-frame completo. Tocar captura, panel, storage, pending playback o mensajes tiene alto riesgo.
- La captura en sub-frame enriquece `controlRef` de forma parcial. Si se cambia `selector-builder` o `controlRef`, hay que validar main frame y sub-frame.
- Hay multiples listeners para `change`, `input`, `keydown`, `copy`, `paste`, hover y scroll. Duplicar, reordenar o debilitar guards puede producir pasos duplicados o perdida de pasos.
- La proteccion de inputs sensibles aparece tanto en content como en inventory. Deben mantenerse alineadas, pero sin extraer valores reales.
- `_resumePendingPlaybackIfAny` y los handlers de mensajes (`SHOW_FLOATING_BTN`, `FRAME_STEP_CAPTURED`, `RESUME_PENDING_PLAYBACK`) son sensibles a navegaciones y reinyeccion.

## 2. Partes que no deben tocarse sin tests

- Orden de prioridad en `buildSelector` y `buildStableFallbackSelectors`.
- Deteccion de valores dinamicos (`isLikelyDynamicValue`, `isLikelyAngularMaterialDynamicId`).
- Resolucion en `findElement`: XPath, texto, CSS, `fallbackSelectors`, Angular Material y `knownFallback`.
- Compactacion en `normalizeRecordedSteps`, especialmente input runs, Enter, `choose_option` y waits automaticos.
- Insercion automatica de `wait_for` despues de `navigate`.
- `findOptionsForStep` y scoring de catalogos/autocomplete GeneXus.
- `_isSensitive` y `_isSensitiveInputTarget`.
- Pending playback: `SAVE_PLAYBACK_STATE`, `PLAYBACK_NAVIGATE`, `CLEAR_PENDING_PLAYBACK`, `RESUME_PENDING_PLAYBACK`.
- `preRunReset` y defaults: captura, preservacion de selectores modificados, restauracion silenciosa.
- Captura multi-frame (`FRAME_STEP_CAPTURED`) y enriquecimiento `controlRef` en sub-frame.
- Acciones de tabs (`open_tab`, `switch_tab`, `close_tab`) y handoff.

## 3. Regresiones posibles

- Macro reproduce en el elemento equivocado por fallback demasiado amplio o cambio de prioridad de selector.
- Macro vieja deja de funcionar porque se dejo de preferir `#id` o se marca como dinamico un id antes aceptado.
- Campo dinamico moderno falla tras recarga porque se grabo un selector demasiado rigido.
- `wait_for` queda esperando un selector alternativo que existe pero no es visible/interactable.
- Inputs progresivos se compactan de mas y se pierde una busqueda intermedia o un borrado real.
- Select nativo se reproduce como click ruidoso, o combobox custom se compacta como si fuera select.
- Despues de `navigate`, la macro escribe antes de que el control este listo si falta `wait_for`, o tarda de mas si se inyecta donde no corresponde.
- Inventario asocia opciones de un autocomplete con otro campo parecido.
- Se capturan valores sensibles en inventario o grabacion.
- Pending playback se limpia antes de tiempo, se duplica o reanuda desde indice incorrecto.
- Sub-frame captura pasos sin selector/controlRef suficiente y luego el player no puede reproducirlos.
- `preRunReset` restaura controles que la macro no deberia tocar o no restaura controles tardios.
- Tests unitarios pasan, pero extension real falla por inyeccion, permisos, storage o mensajes del background.

## 4. Casos ya cubiertos por tests

Unitarios relevantes:

- `accesorios/pruebas/tests/unit/recorder.test.js`
  - Prioridad y estabilidad de selectores.
  - Angular Material `mat-input-*` con placeholder/aria.
  - Dedupe de inputs, waits automaticos, borrados reales y pausas.
  - Inferencia/conservacion de Enter.
  - Compactacion de select nativo y no compactacion de combobox custom.
  - Insercion de `wait_for` despues de `navigate` y antes de `choose_option`.
  - Pre-run reset con selectores canonicos.
- `accesorios/pruebas/tests/unit/page-inventory.test.js`
  - Captura de input/select/datalist/checkbox/button.
  - No captura de password/token/PIN/CVV.
  - Alt selectors validados.
  - Angular Material sin id dinamico como alternativa.
  - Catalogos GeneXus desde runtime.
  - `findControlForSelector`, `findOptionsForSelector`, `findOptionsForStep`, `associateSteps`, `appendInventory`.
- `accesorios/pruebas/tests/unit/player.test.js`
  - `wait_for` con `controlRef.altSelectors`.
  - Scroll/foco visual previo a click/input.
  - Enter con selector y fallback legacy sin selector.
  - `wait_for` visible vs existencia legacy.
  - Input espera visibilidad.
  - Bypass de login faltante.
  - `choose_option`, select legacy via input, autocomplete inputMode.
  - `capture_defaults` y `preRunReset`, incluyendo reanudacion y controles faltantes.
  - Checks idempotentes.
- `accesorios/pruebas/tests/unit/player-actions-regression.test.js`
  - Acciones extraidas del player y regresiones de reproduccion.
- `accesorios/pruebas/tests/unit/content-background-flow.test.js`
  - Flujo content/background y storage/pending segun cobertura actual.
- `accesorios/pruebas/tests/unit/content-background-storage-regression.test.js`
  - Persistencia relacionada con content/background.
- `accesorios/pruebas/tests/unit/step-editor-inventory.test.js`
  - Uso del inventario para dropdowns del editor y casos GeneXus/autocomplete.

E2E relevantes:

- `npm run test:e2e:fixtures`: fixture local con datalist, Shadow DOM, flujos modernos/legacy.
- `npm run test:e2e:angular-material`: selector dinamico Angular Material.
- `npm run test:e2e:wait-for-navigate`: `navigate -> wait_for visible -> input`.
- `npm run test:e2e:loop-navigate`: pending playback dentro de bucle con navigate.
- `npm run test:e2e:extension`: extension safe en Chromium.
- `npm run test:e2e:tabs-floating`: grabacion flotante entre tabs.
- `npm run test:e2e:firefox-extension`: validacion amplia en Firefox.
- `npm run test:e2e`: flujo seguro IAPOS si hay entorno/credenciales apropiadas.

## 5. Casos faltantes

- Unit tests directos para `src/common/dom/element-finder.js` con Shadow DOM anidado, iframes accesibles, iframes cross-origin simulados, XPath invalido y `tag[text="..."]` con acentos/mayusculas.
- Tests de `selector-builder` fuera de `Recorder`, para fijar contrato del modulo comun.
- Inventario atravesando Shadow DOM e iframes, o documentar explicitamente que no lo hace.
- Casos de `contenteditable` en inventario, normalizador y player.
- Selectores con `aria-labelledby`, `label[for]`, texto visible asociado y roles ARIA modernos.
- Frameworks con IDs dinamicos no Angular Material: React `:r*`, Next, Ember, Svelte, Vue, grids virtualizados.
- Elementos duplicados donde solo uno es visible/interactable.
- Shadow DOM cerrado: debe quedar como limitacion conocida.
- Autocomplete custom con popup fuera del arbol del input, portales y overlays.
- Cross-origin iframe: captura/reproduccion debe fallar de forma explicable, no silenciosa.
- Navegacion con cambios solo de hash y SPAs que cambian contenido sin cambiar URL.
- Reanudacion luego de `open_tab/switch_tab/close_tab` combinada con loops/subflujos.
- `preRunReset` con controles renderizados por lotes, controles virtualizados y controls que aparecen/desaparecen manteniendo misma cantidad.
- Proteccion sensible para terminos adicionales: `clave`, `contrasena`, `api-key`, `authorization`; content tiene mas terminos que inventory.
- Pruebas de regresion para no mezclar catalogos GeneXus cuando dos campos comparten prefijo largo.
- Performance: documentos grandes con muchos nodos, shadow roots y runtime `gx` grande.

## 6. Modulos que conviene separar

- Extraer de `player.js` un `element-resolver` de reproduccion: expansion de variables, fallback selectors, diagnosticos y selector failure. Debe envolver `element-finder`, no duplicarlo.
- Extraer `playback-runner` para loop principal, substeps y continuaciones. Hoy `_execComplexStep` y el loop top-level duplican reglas.
- Extraer `playback-navigation-state`: `SAVE_PLAYBACK_STATE`, background navigation, handoff, tabs, clear pending.
- Extraer `recording-capture-listeners` desde `content.js`: click/change/input/key/copy/paste/hover/scroll para main frame y sub-frame con contratos compartidos.
- Extraer `sensitive-field-policy` comun para content e inventory, asi ambos bloquean los mismos terminos sin capturar valores.
- Extraer `inventory-catalog-matcher` para el scoring GeneXus/autocomplete y probarlo sin DOM.
- Mantener `navigation-analyzer.js` chico y puro; es buena separacion actual.

## 7. Orden de implementacion que minimiza dano

1. Congelar linea base: ejecutar unitarios relevantes y e2e de fixtures/Angular/navigate antes de tocar codigo.
2. Agregar tests faltantes para el cambio puntual. Primero tests del modulo comun (`element-finder`/`selector-builder`) y luego integracion recorder/player.
3. Cambiar solo un contrato por vez: primero selector generation, despues resolver/fallback, despues normalizacion, despues player/content.
4. Preferir fallbacks conservadores: aplicar solo cuando hay unicidad, visibilidad o evidencia fuerte.
5. No cambiar prioridades globales de selectores sin mantener compatibilidad legacy.
6. Si se mejora inventario, no usar sus datos para reproducir automaticamente hasta tener tests contra mezcla de controles.
7. Validar con `npm test` completo y e2e especifico del area.
8. Repetir con e2e de extension solo cuando los unitarios y fixtures pasen.
9. Recien al final correr validacion amplia Firefox/Chromium y checklist manual rc39.

## 8. Comandos de prueba obligatorios

Para esta auditoria documental no se requiere ejecutar tests. Para cualquier implementacion rc39 posterior, minimo obligatorio:

```powershell
npm test
npm run test:e2e:fixtures
npm run test:e2e:angular-material
npm run test:e2e:wait-for-navigate
npm run test:e2e:loop-navigate
```

Si se toca `content.js`, background, manifest de inyeccion, pending playback, tabs o extension real:

```powershell
npm run test:e2e:extension
npm run test:e2e:tabs-floating
npm run test:e2e:firefox-extension
```

Si se toca seguridad, IAPOS/GeneXus, autocompletes reales o catalogos:

```powershell
npm run test:e2e
```

Si se toca navegacion o compatibilidad Firefox:

```powershell
npm run verify:v2:firefox:fast
```

Antes de cerrar cualquier cambio:

```powershell
git status --short
```

## 9. Checklist de aceptacion rc39

- [ ] No hay cambios en `manifest.json`, `package.json` ni dependencias salvo decision explicita y testeada.
- [ ] `npm test` pasa completo.
- [ ] E2E de fixtures, Angular Material, wait-for-navigate y loop-navigate pasan.
- [ ] Si se toca content/background/tabs, pasan e2e de extension y tabs-floating.
- [ ] Si se toca Firefox o inyeccion, pasa e2e Firefox o verificacion equivalente.
- [ ] Selectores estables siguen prefiriendo `#id` cuando corresponde y evitan `mat-*` dinamico.
- [ ] Fallbacks nuevos solo actuan con evidencia fuerte y no cambian elementos cuando hay duplicados ambiguos.
- [ ] `controlRef.altSelectors` se conserva desde grabacion hasta reproduccion.
- [ ] `normalizeRecordedSteps` no elimina borrados reales, pausas manuales, Enter ni combobox custom.
- [ ] `choose_option` sigue siendo atomico para select nativo y no rompe autocompletes custom.
- [ ] `navigate` siempre queda protegido por `wait_for` cuando el siguiente paso requiere selector.
- [ ] Pending playback reanuda con indice, vars, macroId y loopReplay correctos.
- [ ] `preRunReset` restaura silenciosamente solo lo esperado y tolera controles faltantes.
- [ ] No se capturan valores sensibles en grabacion ni inventario.
- [ ] Sub-frame y main frame graban pasos compatibles.
- [ ] Los errores de selector siguen diagnosticables; no se silencian fallos reales con skips genericos.
- [ ] El diff final contiene solo cambios intencionales y revisables.

## Decision recomendada para rc39

Avanzar con rc39 solo con cambios incrementales y testeados alrededor de una hipotesis concreta de universalidad. La primera mejora segura deberia ser ampliar cobertura de tests de `element-finder`/`selector-builder` y documentar limites actuales. Cambios mas profundos en `content.js` o `player.js` deberian quedar para despues de separar responsabilidades o, como minimo, despues de agregar tests especificos de pending playback, sub-frame y sensibilidad.
