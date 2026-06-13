# H-09 preRunReset/defaults Stress Plan

## 1. Estado actual

1. Captura preRunReset implementada en Recorder con serialización de controles y dedupe por selector.
2. Existe cobertura básica en [accesorios/pruebas/tests/unit/recorder-pre-run-reset.test.js](accesorios/pruebas/tests/unit/recorder-pre-run-reset.test.js), pero no stress formal 500/1000 con métricas.
3. Sanitización de metadata de export ya implementada en [src/modules/storage/iim-adapter.js](src/modules/storage/iim-adapter.js).

## 2. Evidencia de código revisada

1. Captura: Recorder.captureInitialPreRunReset y Recorder.capturePreRunControlsInDoc en [src/modules/recorder/recorder.js](src/modules/recorder/recorder.js).
2. Campos sensibles: Recorder.isSensitivePreRunField bloquea value para type=password o patrones sensibles en id/name/aria-label.
3. Tipos manejados:
- input text/textarea: guarda value.
- select: guarda value y selectedIndex.
- checkbox/radio: guarda checked.
4. Omitidos por tipo/estado:
- type hidden/submit/button/image/file/reset se omiten.
- disabled y readOnly se omiten.
5. Iframes same-origin: captura recursiva en iframe/frame dentro de capturePreRunControlsInDoc.
6. Metadata/export:
- _sanitizeMetaForExport en [src/modules/storage/iim-adapter.js](src/modules/storage/iim-adapter.js) elimina currentValue/value sensible en pageInventories y preRunReset.
7. Integración en runtime:
- content captura preRunReset inicial durante recording en [src/content/content.js](src/content/content.js).
8. Cobertura actual:
- [accesorios/pruebas/tests/unit/recorder-pre-run-reset.test.js](accesorios/pruebas/tests/unit/recorder-pre-run-reset.test.js): pruebas básicas y sensible mínimo.
- [accesorios/pruebas/tests/unit/iim-adapter.test.js](accesorios/pruebas/tests/unit/iim-adapter.test.js): sanitización en export para pageInventories y preRunReset.

## 3. Riesgos detectados

1. Sin benchmark formal no hay evidencia objetiva de estabilidad de captura/restauración en 500/1000 controles.
2. Dedupe por selector puede omitir controles cuando dos campos colisionan en selector.
3. Variación de máquina puede volver frágiles umbrales estrictos de performance.
4. Entorno unitario puede limitar verificación robusta de iframe same-origin.

## 4. Casos de stress a cubrir

1. 500 controles texto.
2. 1000 controles mixtos (text/textarea/select/checkbox/radio).
3. Campos sensibles y no filtración.
4. Campos omitidos por tipo y estado.
5. select, checkbox/radio, textarea.
6. dedupe por selector.
7. no-regresión en formulario pequeño.
8. iframe same-origin si el entorno lo permite.

## 5. Métricas a capturar

1. controls_total
2. controls_captured
3. controls_restored
4. controls_omitted
5. sensitive_controls
6. mismatches
7. capture_duration_ms
8. restore_duration_ms

## 6. Cambios propuestos

Enfoque combinado: agregar tests + helper de medición + documentación de límites.

1. Extender [accesorios/pruebas/tests/unit/recorder-pre-run-reset.test.js](accesorios/pruebas/tests/unit/recorder-pre-run-reset.test.js) con escenarios A-J y helper de restore en test.
2. Extender [accesorios/pruebas/tests/unit/iim-adapter.test.js](accesorios/pruebas/tests/unit/iim-adapter.test.js) con verificación de no fuga literal de secretos sentinela en el script exportado.
3. No modificar Player ni Background.
4. No introducir dependencias nuevas.

## 7. Tests a agregar

1. Stress 500 texto con métricas y mismatches.
2. Stress 1000 mixto con métricas y mismatches.
3. Sensibles sin value y sin fuga en export.
4. Omitidos por tipo/estado.
5. select value + selectedIndex.
6. checkbox/radio checked.
7. textarea multilinea.
8. dedupe por selector.
9. no-regresión formulario pequeño.
10. iframe same-origin (si viable; si no, NO VERIFICADO).

## 8. Riesgos de regresión

1. Cambios en tests de stress podrían introducir falsos negativos por variación temporal.
2. Si se ajusta lógica runtime fuera de tests, podría cambiar semántica existente.

## 9. Límites explícitos

1. H-09 no toca H-08.
2. H-09 no toca IAPOS real.
3. No se tocan Player ni Background.
4. Si iframe same-origin no es confiable en entorno unitario: NO VERIFICADO.

## 10. Criterios de aceptación

1. Casos A-J cubiertos según prompt, con NO VERIFICADO explícito donde aplique.
2. Métricas reales registradas en tests y reportadas.
3. Verificación de sensibles y omitidos demostrada por tests.
4. npm test en verde.
5. verify fast en verde.
6. verify full en verde.