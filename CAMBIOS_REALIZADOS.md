# Cambios realizados

## rc40B-6: feedback de grabación igual al reproductor

Fecha: 2026-07-01

## Archivos modificados

- `src/content/content.js`
- `accesorios/pruebas/tests/unit/content-background-flow.test.js`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`
- `README_INSTALACION.txt`

## Qué se cambió

- El grabador ahora usa el mismo resaltado temporal del reproductor (`WebMaticHighlightManager.highlightElement`).
- Se suma feedback visual anticipado en `pointerdown`/`mousedown` antes de que GeneXus navegue.
- Se aplica al grabador principal, grabador inline e iframes mismo origen.
- No se modificó el reproductor.
- No se modificó `choose_option`.
- No se modificó `manifest.json`.

## Por qué

En IAPOS/GeneXus los eventos `Detalles` y `Autorizar` se grababan correctamente, pero el usuario no veía el recuadro rojo porque la navegación destruía la página antes de que el flash posterior pudiera percibirse. El reproductor sí mostraba el resaltado de forma confiable porque lo aplica antes de ejecutar la acción. Esta corrección replica esa estrategia visual para grabación.

## Cómo probar

```powershell
node -c src/content/content.js
node -c src/modules/recorder/normalizer/recording-normalizer.js
node --test accesorios/pruebas/tests/unit/content-background-flow.test.js
npm test
npm run test:e2e:universal-resolution
npm run test:e2e:flyer-wizard
npm run test:e2e:angular-material
npm run test:e2e:wait-for-navigate
npm run test:e2e:loop-navigate
```

Prueba manual IAPOS:

1. Recargar extensión temporal.
2. Grabar macro mínima: `Detalles`, `Autorizar`, `DETALLE AUTORIZADO`.
3. Verificar que `Detalles` y `Autorizar` muestran flash visual antes/durante la navegación.
4. Verificar que el último select mantiene `CHOOSE_OPTION #vERROR value/text/index`.
5. Verificar que la macro reproduce sin edición manual.

## Cómo revertir

```powershell
git revert <commit_rc40B_6>
```

## rc40B-5: feedback visual de grabación entre navegaciones

Fecha: 2026-07-01

## Archivos modificados

- `src/content/content.js`
- `accesorios/pruebas/tests/unit/content-background-flow.test.js`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`
- `README_INSTALACION.txt`

## Qué se cambió

- Se agregó un aviso global corto `WebMatic: CLICK grabado` para eventos aceptados que pueden navegar inmediatamente.
- El aviso se guarda temporalmente antes de la navegación y se consume en la página siguiente.
- El flash rojo sobre el elemento sigue funcionando para acciones que no destruyen la página.
- El aviso global expira rápido para evitar feedback viejo.
- No se cambió la reproducción.
- No se modificó `choose_option`.
- No se tocó `manifest.json`.

## Por qué

En IAPOS/GeneXus, los eventos `Detalles` y `Autorizar` sí quedaban grabados, pero el recuadro rojo no se veía porque la página navegaba inmediatamente. El último campo sí mostraba feedback porque no destruía la página.

## Cómo probar

```powershell
node -c src/content/content.js
npm test
npm run test:e2e:universal-resolution
npm run test:e2e:flyer-wizard
npm run test:e2e:angular-material
npm run test:e2e:wait-for-navigate
npm run test:e2e:loop-navigate
```

Prueba manual IAPOS:

1. Cargar extensión temporal.
2. Grabar macro mínima: Detalles, Autorizar, DETALLE AUTORIZADO.
3. Verificar que:
   - `Detalles` muestra aviso visual en la transición.
   - `Autorizar` muestra aviso visual en la transición.
   - `DETALLE AUTORIZADO` muestra flash sobre el select.
   - La macro conserva `WAIT_FOR #vAUTORIZAR_0001` y `WAIT_FOR #vERROR`.

## Cómo revertir

Restaurar desde el ZIP previo `WebMatic-v0.2.3-rc40B-4-flash-wait-genexus.zip` o revertir los archivos modificados por este parche.


## rc40B-3 hotfix: compactación de click option sin duplicar choose_option

Fecha: 2026-07-01

## Archivos modificados

- `src/modules/recorder/normalizer/recording-normalizer.js`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`

## Qué se cambió

- Se agregó compactación de `choose_option` redundantes sobre el mismo `select`.
- Si Firefox/GeneXus emite un `click` sobre `option` después de un `choose_option` real, se conserva la selección rica (`value`, `text`, `index`) y se elimina la duplicada por índice.
- Se eliminan auto-waits intermedios redundantes asociados a esa duplicación.

## Por qué

El parche rc40B-3 resolvía el click sobre `option`, pero generaba duplicados:
`WAIT_FOR #pais`, `CHOOSE_OPTION #pais value`, `WAIT_FOR #pais`, `CHOOSE_OPTION #pais index`.

## Cómo probar

```powershell
node -c src/modules/recorder/normalizer/recording-normalizer.js
npm test
npm run test:e2e:universal-resolution
npm run test:e2e:flyer-wizard
npm run test:e2e:angular-material
npm run test:e2e:wait-for-navigate
npm run test:e2e:loop-navigate
```

## Cómo revertir

Restaurar desde el backup previo o revertir los tres archivos de este parche.


## rc40B-3: grabador visual y selects GeneXus/IAPOS

Fecha: 2026-07-01

## Archivos modificados

- `src/content/content.js`
- `src/modules/recorder/normalizer/recording-normalizer.js`
- `accesorios/pruebas/tests/unit/recorder.test.js`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`
- `README_INSTALACION.txt`

## Qué se cambió

- Se corrigió la grabación de selects nativos cuando Firefox/GeneXus emite click sobre `option` en lugar de `change` confiable.
- El click sobre `#vERROR option:nth-of-type(2)` ahora se convierte en `choose_option` sobre `#vERROR` con `index: 1`.
- Se corrigió la captura principal de selects para guardar `value`, `text` visible e `index`.
- Se reforzó el indicador rojo de evento registrado agregando fallback visual directo sobre el elemento (`outline` y `box-shadow`) además del overlay flotante.

## Por qué

La macro real de IAPOS seguía grabando:

```text
CLICK #vERROR option:nth-of-type(2)
```

en vez de:

```text
CHOOSE_OPTION #vERROR value/text/index
```

Además, el usuario reportó que el recuadro rojo de evento registrado no aparecía durante la grabación.

## Cómo probar

1. Cargar extensión temporal desde `repo-modular/manifest.json`.
2. Grabar una macro nueva en IAPOS.
3. Al elegir `DETALLE AUTORIZADO`, verificar que se registre como `choose_option` sobre `#vERROR`.
4. Verificar que el indicador rojo aparezca al registrar eventos reales.
5. Ejecutar:

```powershell
npm test
npm run test:e2e:universal-resolution
npm run test:e2e:flyer-wizard
npm run test:e2e:angular-material
npm run test:e2e:wait-for-navigate
npm run test:e2e:loop-navigate
```

## Cómo revertir

Revertir los archivos listados arriba al estado del tag `v0.2.3-rc40B-recorder-genexus-2`.


## rc40B-2: grabacion GeneXus/IAPOS reproducible

Fecha: 2026-06-30

## Archivos modificados

- `src/content/content.js`
- `src/modules/recorder/normalizer/recording-normalizer.js`
- `accesorios/pruebas/tests/unit/recorder.test.js`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`

## Que se cambio

- El normalizador detecta cambios de `_wmBlockKey` entre acciones reales y agrega `WAIT_FOR` antes de la primera accion interactiva del nuevo bloque.
- La regla cubre `click`, `input`, `text`, `choose_option` y `check`, y no duplica waits si ya existe uno equivalente pegado antes.
- La grabacion principal de select nativo ahora guarda `value`, `text` visible e `index`.
- El `controlRef` de selects grabados conserva metadata de intencion y opciones (`id`, `name`, `label`, `controlKind`, `options`) cuando estan disponibles.
- El flash rojo de grabacion se mueve despues de la aceptacion del step en el buffer/local top-frame.
- En iframes, si no se puede confirmar aceptacion de vuelta desde background, no se muestra falso exito.

## Tests agregados

- Macro GeneXus/IAPOS con `WAIT_FOR #vAUTORIZAR_0001` antes del click.
- Macro GeneXus/IAPOS con `WAIT_FOR #vERROR` antes de `CHOOSE_OPTION`.
- No duplicacion de `WAIT_FOR` al cambiar de bloque si ya existia.

## Compatibilidad

- No se modifico `manifest.json`.
- No se toco README, help, dist, firma ni web-ext-artifacts.
- No se agregaron dependencias.
- rc40A `CHOOSE_OPTION` robusto se mantiene.

## rc40A: CHOOSE_OPTION robusto y aditivo

Fecha: 2026-06-30

## Archivos modificados

- `src/modules/player/actions/action-input-value.js`
- `src/modules/player/player.js`
- `src/content/content.js`
- `src/modules/storage/iim-adapter.js`
- `src/modules/recorder/normalizer/recording-normalizer.js`
- `accesorios/pruebas/tests/unit/player.test.js`
- `accesorios/pruebas/tests/unit/iim-adapter.test.js`
- `accesorios/pruebas/tests/unit/recorder.test.js`
- `accesorios/pruebas/tests/e2e/universal-resolution/run.js`
- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-genexus-select.html`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`

## Que se cambio

- `CHOOSE_OPTION` mantiene la logica legacy por `value` como primera capa.
- Si el select no queda seleccionado, reintenta por `text` exacto y luego por `index`.
- La seleccion final se verifica y, si falla, devuelve un diagnostico con value/text/index actual e intentos aplicados.
- Se disparan `input`, `change`, `blur` y `focusout` para selects nativos/GeneXus.
- La grabacion de selects guarda `value`, `text` e `index`.
- El normalizer elimina clicks redundantes sobre `option:nth-of-type(...)` cuando ya existe el `CHOOSE_OPTION` del mismo select.
- El adapter IIM exporta/importa `INDEX` de forma aditiva.

## Compatibilidad

- No se modifico `manifest.json`.
- No se toco `dist`, firma, web-ext-artifacts ni UI general.
- No se agregaron dependencias.

## rc39-impl-1: motor universal visible/interactuable

Fecha: 2026-06-29

## Archivos modificados

- `src/common/dom/element-finder.js`
- `src/modules/player/player.js`
- `accesorios/pruebas/tests/unit/element-finder.test.js`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`

## Que se cambio

- Se agrego una primera capa incremental del resolver universal en `element-finder`.
- `getCandidateElements` devuelve todos los candidatos posibles para CSS, XPath y pseudo-selector `tag[text="..."]`, incluyendo Shadow DOM abierto e iframes accesibles como antes.
- `findBestElement` ordena candidatos y prioriza elementos visibles, habilitados y accionables.
- Se agregaron validadores:
  - `isElementVisibleForWebMatic`;
  - `isElementEnabledForWebMatic`;
  - `isElementEditableForWebMatic`;
  - `isElementActionableForWebMatic`.
- `findElement` mantiene el contrato legacy (`Element|null`) pero ya no devuelve ciegamente el primer match cuando hay un candidato visible/interactuable mejor.
- `player.js` pasa `actionType` al resolver para diferenciar click, escritura, check, choose_option y wait_for sin reescribir acciones.

## Tests agregados

- `element-finder: si dos elementos coinciden, elige el visible sobre el hidden`.
- `element-finder: descarta candidato con ancestro aria-hidden cuando hay alternativa visible`.
- `element-finder: para TYPE prefiere input editable sobre readonly`.
- `element-finder: para CLICK prefiere boton enabled sobre disabled`.
- `element-finder: selector unico visible conserva comportamiento esperado`.
- `element-finder: fallbackSelectors conserva altSelectors cuando el primario no existe`.
- `element-finder: caso legacy sin alternativa devuelve el unico candidato aunque no sea accionable`.

## Como se probo

1. `node -c src/common/dom/element-finder.js`
2. `node -c src/modules/player/player.js`
3. `node --test accesorios/pruebas/tests/unit/element-finder.test.js`
4. `npm test`
5. `npm run test:e2e:universal-resolution`
6. `npm run test:e2e:angular-material`
7. `npm run test:e2e:wait-for-navigate`
8. `npm run test:e2e:loop-navigate`

## Pendiente / limites conocidos

- Esta implementacion no agrega todavia grabacion por intencion ni target descriptors enriquecidos.
- El scoring es una primera priorizacion por estado visible/interactuable; no resuelve aun contexto semantico completo, texto cercano, labels, wizard o formularios duplicados complejos.
- Cross-origin iframes siguen limitados por el navegador.
- Shadow DOM cerrado sigue fuera de alcance.
- El fallback legacy conserva el unico candidato aunque no sea accionable para no romper macros antiguas; casos futuros deberian diagnosticar esto con mas claridad antes de ejecutar.

## Banco e2e simulado rc39 universal-resolution

Fecha: 2026-06-29

## Archivos modificados

- `package.json`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`
- `accesorios/pruebas/tests/e2e/universal-resolution/run.js`
## rc39-impl-2 intencion semantica basica + scoring contextual

Fecha: 2026-06-29

## Archivos modificados

- `src/common/dom/element-finder.js`
- `src/modules/inventory/page-inventory.js`
- `src/modules/recorder/events/recorder-events.js`
- `src/modules/player/player.js`
- `accesorios/pruebas/tests/unit/element-finder.test.js`
- `accesorios/pruebas/tests/unit/page-inventory.test.js`
- `accesorios/pruebas/tests/unit/recorder.test.js`
- `accesorios/pruebas/tests/unit/player.test.js`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`

## Que se cambio

- El inventario captura metadata opcional de intencion: `role`, `text`, `label`, `placeholder`, `name`, `controlKind`, `tag`, `type` y `visibleSectionTitle` cuando se puede calcular de forma segura.
- `buildControlRef` conserva esa metadata y mantiene `altSelectors` para no degradar resoluciones con IDs dinamicos.
- El grabador de teclas editables agrega metadata semantica basica al `controlRef`.
- El player pasa `controlRef`/`intent` al resolver.
- `element-finder` incorpora scoring contextual por placeholder, label, texto visible, role, name, controlKind y contexto cercano, manteniendo prioridad de visible/interactuable/editable.

## Seguridad y compatibilidad

- No se guarda el valor real de campos sensibles.
- Macros antiguas sin metadata siguen resolviendo por selector/fallback legacy.
- No se modifico `manifest.json`.
- No se cambio UI ni storage/import/export.
- No se agregaron dependencias nuevas.

## Pruebas ejecutadas

- `node -c src/common/dom/element-finder.js`
- `node -c src/modules/inventory/page-inventory.js`
- `node -c src/modules/recorder/events/recorder-events.js`
- `node -c src/modules/recorder/normalizer/recording-normalizer.js`
- `node -c src/modules/player/player.js`
- `node --test accesorios/pruebas/tests/unit/element-finder.test.js accesorios/pruebas/tests/unit/page-inventory.test.js accesorios/pruebas/tests/unit/recorder.test.js accesorios/pruebas/tests/unit/player.test.js`
- `npm test`
- `npm run test:e2e:universal-resolution`
- `npm run test:e2e:angular-material`
- `npm run test:e2e:wait-for-navigate`
- `npm run test:e2e:loop-navigate`

## Riesgos pendientes

- Si varios candidatos son accionables y tienen la misma evidencia semantica, el resolver conserva el desempate legacy por orden de selector/candidato. Queda pendiente una politica explicita de "empate peligroso" para no elegir cuando no haya evidencia suficiente.
- `visibleSectionTitle` es best-effort y depende de headings/legend/aria-label cercanos; en paginas sin estructura semantica puede omitirse.

- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-common.css`
- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-wizard-hidden.html`
- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-duplicates.html`
- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-overlay.html`
- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-disabled-late.html`
- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-remount.html`

## Que se cambio

- Se agrego un banco e2e simulado para rc39 con servidor local y Playwright headless.
- Los fixtures reproducen problemas comunes de apps modernas y antiguas:
  - wizard con pasos ocultos y boton repetido;
  - inputs con mismo placeholder, oculto y visible;
  - boton tapado por overlay;
  - boton disabled que se habilita despues;
  - campo desmontado y montado otra vez;
  - contenido SPA que aparece despues de click;
  - selector con multiples coincidencias donde solo una es interactuable.
- Se agrego el script `test:e2e:universal-resolution`.

## Por que se cambio

- WebMatic necesita validar universalidad practica sin arreglar paginas una por una.
- El banco permite reproducir localmente patrones reales de resolucion antes de tocar logica productiva.

## Como probar

1. Ejecutar `npm run test:e2e:universal-resolution`.
2. Ejecutar `npm test`.
3. Confirmar que el runner imprime `[universal-resolution] OK` o una lista clara de pendientes.

## Ajuste de manual para usuario final

Fecha: 2026-06-29

## Archivos modificados

- `src/help/help.html`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`

## Qué se cambió

- Se limpió el manual integrado para que sea útil a usuarios finales.
- Se quitaron instrucciones de instalación, firma, XPI, versiones internas, estado técnico, pruebas y respaldo del proyecto.
- Se dejó el manual enfocado en el uso diario de WebMatic:
  - inicio rápido;
  - pantalla principal;
  - grabar macro;
  - reproducir macro;
  - bucle;
  - editar y corregir;
  - datos sensibles;
  - esperas y páginas dinámicas;
  - exportar/importar macros;
  - buenas prácticas;
  - problemas frecuentes.

## Por qué se cambió

- El manual integrado dentro de la extensión debe servir a quien ya tiene WebMatic instalado.
- La instalación y distribución del XPI deben ir en un instructivo separado, no dentro de la ayuda diaria de la extensión.

## Cómo probar

1. Aplicar el parche.
2. Cargar WebMatic como extensión temporal o abrir la ayuda desde el repo.
3. Abrir el manual de ayuda.
4. Confirmar que no aparezcan textos técnicos como:
   - instalación del XPI;
   - firma Firefox;
   - estado de versión;
   - `rc38`;
   - instrucciones de desarrollo;
   - pruebas o backups del proyecto.
5. Confirmar que el manual explique claramente cómo usar WebMatic.

## Cómo revertir

- Restaurar los archivos desde el commit anterior o desde el backup del proyecto.


## rc40B-4 — Flash de grabación temporal y waits entre bloques GeneXus

Archivos modificados:
- `src/content/content.js`
- `src/modules/recorder/normalizer/recording-normalizer.js`
- `accesorios/pruebas/tests/unit/recorder.test.js`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`
- `README_INSTALACION.txt`

Qué cambió:
- El flash rojo de grabación ahora usa limpieza garantizada por elemento para evitar que el borde quede fijo.
- Se preservan los `WAIT_FOR` automáticos creados para la primera acción de una nueva pantalla/bloque GeneXus.
- Se agregó test unitario para evitar que `sanitizePageContextSteps` elimine `WAIT_FOR #vAUTORIZAR_0001` y `WAIT_FOR #vERROR` cuando preparan una acción real del nuevo bloque.

Cómo probar:
- `node -c src/content/content.js`
- `node -c src/modules/recorder/normalizer/recording-normalizer.js`
- `npm test`
- e2e principales.

Cómo revertir:
- Restaurar los archivos de este parche desde el ZIP previo o revertir el commit rc40B-4.
