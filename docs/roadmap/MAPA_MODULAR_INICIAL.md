# Mapa modular inicial - WebMatic

## Objetivo

Preparar el proyecto para modularización progresiva sin romper funcionalidad existente.

## Regla principal

Primero se crean módulos vacíos y puntos de destino.
Luego se extraen funciones pequeñas.
Después se validan tests.
Nunca se mueven archivos gigantes completos de una vez.

## Áreas objetivo

### Common

- selectors
- dom
- diagnostics
- events

### Recorder

- events
- normalizer
- defaults
- inventory
- blocks

### Player

- actions
- navigation
- control-flow
- defaults
- state
- diagnostics

### Editor

- blocks
- schema
- renderers
- state
- validation

### UI

- shell
- components
- styles

## Prioridad funcional

1. Modularizar sin cambiar comportamiento.
2. Blindar checkbox idempotente.
3. Separar grabador.
4. Separar reproductor.
5. Separar editor visual.
6. Mejorar validaciones y UX.
