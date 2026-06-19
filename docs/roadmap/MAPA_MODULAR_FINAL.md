# Mapa modular final - WebMatic

## Fecha de cierre

2026-06-19

## Rama

modularizacion-base

## Objetivo

Cerrar la etapa de modularizacion practica de la extension WebMatic, dejando separados los helpers y modulos seguros sin cambiar comportamiento, formato de macros, API publica, nombres de mensajes ni patron IIFE globalScope + module.exports.

## Modulos extraidos por area

### common

- src/common/selectors/selector-builder.js
- src/common/diagnostics/selector-diagnostics.js
- src/common/dom/element-finder.js
- src/common/dom/text-compare.js

### player

- src/modules/player/actions/action-autocomplete.js
- src/modules/player/actions/action-check-runner.js
- src/modules/player/actions/action-check.js
- src/modules/player/actions/action-click.js
- src/modules/player/actions/action-extract.js
- src/modules/player/actions/action-input-text.js
- src/modules/player/actions/action-input-value.js
- src/modules/player/actions/action-simple-events.js
- src/modules/player/actions/action-wait.js
- src/modules/player/control-flow/continuation-steps.js
- src/modules/player/defaults/baseline-restorer.js
- src/modules/player/defaults/default-selector.js
- src/modules/player/defaults/default-steps-collector.js
- src/modules/player/defaults/modified-selectors.js
- src/modules/player/defaults/pre-run-reset-runner.js
- src/modules/player/defaults/pre-run-reset-utils.js
- src/modules/player/diagnostics/highlight-manager.js
- src/modules/player/navigation/background-navigator.js
- src/modules/player/navigation/navigation-analyzer.js
- src/modules/player/state/login-step-bypass.js
- src/modules/player/state/step-normalizer.js
- src/modules/player/state/transient-recovery.js
- src/modules/player/state/variable-expander.js

### editor

- src/modules/editor/blocks/block-utils.js
- src/modules/editor/blocks/drag-drop-utils.js
- src/modules/editor/renderers/block-actions-renderer.js
- src/modules/editor/renderers/block-header-renderer.js
- src/modules/editor/renderers/editor-render-utils.js
- src/modules/editor/renderers/form-fields-renderer.js
- src/modules/editor/renderers/step-row-renderer.js
- src/modules/editor/schema/step-definitions.js
- src/modules/editor/state/editor-catalogs.js
- src/modules/editor/state/editor-meta.js
- src/modules/editor/state/editor-state-utils.js
- src/modules/editor/state/inline-recording-state.js
- src/modules/editor/validation/editor-validation.js

### recorder

- src/modules/recorder/defaults/defaults-capture.js
- src/modules/recorder/events/recorder-events.js
- src/modules/recorder/events/recording-lifecycle.js
- src/modules/recorder/normalizer/recording-normalizer.js

### content

- src/modules/content/message-router.js

### ui

- src/modules/ui/components/ui-components.js
- src/modules/ui/shell/ui-shell-state.js
- src/modules/ui/styles/ui-style-utils.js

### background/storage

- src/background/background-router.js
- src/background/tabs-navigation.js
- src/modules/storage/full-backup.js
- src/modules/storage/fs-handle.js
- src/modules/storage/iim-adapter.js
- src/modules/storage/macro-json.js
- src/modules/storage/macro-storage.js
- src/modules/storage/macros-global.js

## Deliberadamente sin mover

- executeStep complejo restante: conserva dependencias de reproduccion, fallbacks, navegacion y estado compartido.
- render principal completo: mantiene muchas ramas visuales y datos de estado en una sola pasada.
- drag/drop completo: los handlers siguen acoplados al DOM, a callbacks y al estado de grabacion.
- callbacks async complejos: chrome.runtime, chrome.tabs, downloads, storage y handoff mantienen orden y retorno exactos.
- handlers altamente acoplados: content/background conservan listeners completos cuando moverlos podia cambiar timing, payloads o sendResponse.

## Estado de tests

- Criterio esperado para cierre completo: npm test completo con 332 pass / 0 fail.
- Validacion real del script actual: npm test reporto 17 tests / 17 pass / 0 fail.
- La validacion completa de 332 tests no queda confirmada con el script npm test actual.

## Recomendacion futura

- No seguir refactorizando sin tests especificos por modulo.
- Agregar tests dedicados para recorder/content/background antes de nuevas extracciones.
- Mantener extracciones pequenas, con wrappers locales y validacion completa despues de cada fase.
