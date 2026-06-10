# V2 Firefox Plan Modular

Orden de trabajo acordado:

1. Rutas de guardado y exportacion
2. Modulo extractor
3. Modulo grabador
4. Modulo reproductor

## Fase 1 - Rutas de guardado/exportacion

Objetivo:
- Garantizar que subcarpeta y filename de exportacion sean seguros y predecibles.

Entregables:
- Sanitizacion centralizada en fs-handle.
- Uso de sanitizacion en background (EXPORT_FILE).
- Uso de sanitizacion en opciones al guardar subcarpeta.
- Fixture manual dedicada: export-routes.html.
- Tests unitarios dedicados de rutas de exportacion.

Criterio de pase:
- npm test en verde.
- Verificacion manual en Firefox con fixture export-routes.html.

## Fase 2 - Extractor

Objetivo:
- Validar recoleccion de catalogos y metadatos sin ruido en UX.

Entregables esperados:
- Fixtures modernas/legacy con autocompletados reales.
- Tests de parseo y captura de catalogos por XHR/fetch.
- Checklist de no regresion en captura profunda/rapida.

## Fase 3 - Grabador

Objetivo:
- Confirmar grabacion robusta (inputs, selects, choose_option, subpaginas).

Entregables esperados:
- Fixtures con flujo de navegacion y campos mixtos.
- Pruebas de grabacion y edicion visual posterior.

## Fase 4 - Reproductor

Objetivo:
- Confirmar ejecucion estable y deterministica.

Entregables esperados:
- Pruebas de playback end-to-end sobre macros representativas.
- Validacion de waits, fallbacks y estado final esperado.
