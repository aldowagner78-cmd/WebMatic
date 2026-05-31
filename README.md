# WebMatic

Scaffold de Iteracion 1 para una extension de automatizacion web modular en Firefox (Windows).

## Estado actual

- Estructura base modular creada.
- Shell con 3 modos visibles: Grabar, Reproducir y Configurar.
- Store central y contratos de acciones.
- Docking/geometry manager inicial con validaciones de layout.
- Pruebas unitarias minimas para Store y Geometry.

## Ejecucion de pruebas

```bash
npm test
```

## Carga manual en Firefox

1. Abrir `about:debugging#/runtime/this-firefox`.
2. Click en "Load Temporary Add-on...".
3. Seleccionar `manifest.json`.

## Nota de Iteracion 1

Esta iteracion prioriza estructura comprobable. La logica completa de recorder/player y persistencia .iim se implementa en fases siguientes.