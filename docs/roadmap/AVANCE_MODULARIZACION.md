# Avance de modularización

## Rama

modularizacion-base

## Commits realizados

- ad6c0ad docs: registrar linea base de pruebas
- 1a5c12e chore: preparar estructura modular inicial
- dfb50e7 refactor(recorder): extraer selector builder
- 6653c70 refactor(player): extraer diagnostico de selectores

## Módulos extraídos

### Selector builder

Nuevo archivo:

src/common/selectors/selector-builder.js

Extraído desde:

src/modules/recorder/recorder.js

Estado:

- Tests pasados: 328/328
- Comportamiento conservado

### Selector diagnostics

Nuevo archivo:

src/common/diagnostics/selector-diagnostics.js

Extraído desde:

src/modules/player/player.js

Estado:

- Tests pasados: 328/328
- Comportamiento conservado

## Próximas extracciones candidatas

1. element-finder desde player.js
2. action-check desde player.js
3. pre-run-reset desde player.js
4. block-engine desde step-editor.js
5. step-schema desde step-editor.js

## Advertencias

- No hacer extracciones grandes.
- Validar con npm test después de cada cambio.
- Mantener carga en manifest.json en orden correcto.
- Evitar reescrituras de archivo que rompan acentos.
