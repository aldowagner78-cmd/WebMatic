# Cambios realizados

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
