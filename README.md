# WebMatic

Extension de automatizacion web modular para Firefox (Windows).

## Estado actual

- **Grabador** (recorder): captura clicks, escritura, checkboxes/radios y selects.
- **Reproductor** (player): ejecuta las macros paso a paso con reanudacion tras navegacion.
- **Editor visual** de pasos para revisar y ajustar macros, con soporte de inventario/opciones para `choose_option` y autocompletados.
- **Biblioteca** de macros guardadas con reproduccion directa desde la vista Reproducir.
- **Captura de contenido** desde Reproducir para censar campos y guardar perfiles reutilizables de metadatos de pagina.
- **Resumen de biblioteca e historial** en Reproducir: muestra macros/perfiles actuales y movimientos acumulados de importacion/exportacion.
- **Import/Export** en JSON propio y backup completo de macros/configuracion.
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

## Flujo recomendado para V2 (Firefox primero)

Ejecucion modular por fases:

```bash
npm run test:phase1:export-routes
```

Fase 1 valida rutas de guardado/exportacion y sanitizacion.

Antes de publicar, ejecutar siempre en este orden:

```bash
npm run verify:v2:firefox:fast
```

Incluye:
- tests unitarios
- e2e de fixtures (modern/legacy/GeneXus/IAPOS simulado)
- e2e seguro IAPOS

Importante: `verify:v2:firefox:fast` es una validacion rapida y no habilita release por si sola.

Para validacion completa de extension en Firefox:

```bash
npm run verify:v2:firefox:full
```

Ademas de lo anterior, agrega e2e de extension Firefox.

Release gate recomendado: considerar candidato a release unicamente cuando `verify:v2:firefox:full` este en verde.

Publicar recien cuando este flujo completo quede en verde y la validacion manual en Firefox sea correcta.

## Carga manual en Firefox

1. Abrir `about:debugging#/runtime/this-firefox`.
2. Click en "Load Temporary Add-on...".
3. Seleccionar `manifest.json`.

## Flujo manual rapido

1. En **Reproducir**, usar **Capturar contenido** si quieres censar campos/opciones de la pagina actual para reutilizarlos luego en el editor visual.
2. Grabar o abrir una macro guardada y reproducirla desde la biblioteca.
3. Exportar una macro individual o generar un backup completo desde **Configurar**.
4. Importar macros, backups o metadatos segun el tipo de contenido que necesites restaurar.
