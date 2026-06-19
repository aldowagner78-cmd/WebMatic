# Plan de validacion automatica

Fecha: 2026-06-19
Rama: modularizacion-base

## Objetivo

Cerrar la etapa de modularizacion con pruebas locales reproducibles sobre helpers extraidos, sin continuar refactorizando ni cambiar comportamiento de la extension.

## Cobertura agregada

- Player actions: helpers de checkbox/radio, resolucion de labels, escritura de input/textarea/select/contenteditable y eventos simples hover/scroll.
- Recorder: normalizacion de pasos grabados, captura de defaults pre-run, exclusion de UI propia y validaciones de steps capturados.
- Editor: labels cortos, estado de formulario de alta, marca de movimiento y limites de bloques de ejecucion.
- Content/background/storage: helpers de routing, respuestas ok/error, navegacion de tabs y contrato de storage de macros.

## Validaciones locales

- Ejecutar `node -c` sobre los tests nuevos antes de la suite completa.
- Ejecutar `npm test` completo sin pipes, tail ni filtros.
- Si `npm test` reporta solo 17 tests, o cualquier numero distinto de 332, la suite completa requerida no queda confirmada aunque los tests existentes pasen.

## Pendiente manual real

- Grabacion real de click/input/change/contextmenu en paginas con forms nativos y controles custom.
- Reproduccion real de checkbox/radio ocultos con labels y wrappers visuales.
- Navegacion real con handoff de reproduccion entre pestanas.
- Smoke manual de UI shell, editor de pasos y almacenamiento de macros en Chrome/Firefox.

## Recomendacion

No seguir extrayendo modulos sin tests dedicados por area. Antes de nuevas extracciones, agregar pruebas especificas para recorder/content/background con escenarios de browser real o fixtures DOM representativos.
