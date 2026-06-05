# WebMatic

Extension de automatizacion web modular para Firefox (Windows).

## Estado actual

- **Grabador** (recorder): captura clicks, escritura, checkboxes/radios y selects.
- **Reproductor** (player): ejecuta las macros paso a paso con reanudacion tras navegacion.
- **Editor visual** de pasos para revisar y ajustar macros.
- **Biblioteca** de macros guardadas.
- **Import/Export** en formato `.iim` (iMacros) y JSON propio (round-trip sin perdida).
- Store central, contratos de acciones y docking/geometry manager.

### Pasos soportados (resumen)

Incluye navegacion, click/doble click, escritura, `check` (checkbox/radio), variables,
extraccion, esperas, condicionales y bucles. El paso `choose_option` selecciona una
opcion de un `<select>` por **value** y, si no coincide, por **texto visible**
(tambien admite un campo `text` explicito).

## Ejecucion de pruebas

```bash
npm test
```

## Carga manual en Firefox

1. Abrir `about:debugging#/runtime/this-firefox`.
2. Click en "Load Temporary Add-on...".
3. Seleccionar `manifest.json`.
