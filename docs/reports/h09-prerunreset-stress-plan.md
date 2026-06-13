# H-09 preRunReset/defaults Stress Plan

## Objetivo

Medir estabilidad y costo de `preRunReset/defaults` con escenarios de 500 y 1000 controles.

## Escenarios

1. Baseline 500 controles mixtos
- 300 text inputs
- 100 selects
- 100 checkboxes/radios

2. Baseline 1000 controles mixtos
- 600 text inputs
- 200 selects
- 200 checkboxes/radios

3. Variantes
- 20% controles faltantes al restaurar
- 20% controles con selector mutado (mismatch)
- 10% campos sensibles (password/token/pin/cvv)

## Métricas requeridas

1. Tiempo de captura (`capture_defaults`) por corrida.
2. Tiempo de restauración (`preRunReset`) por corrida.
3. Conteo de controles restaurados.
4. Conteo de controles omitidos (`skipped`).
5. Conteo de mismatch.
6. Verificación de no fuga de valores en campos sensibles.

## Implementación propuesta

1. Fixture sintético `prerunreset-stress-fixture.html`
- Generador determinístico de N controles.

2. Test unitario/performance controlado
- `accesorios/pruebas/tests/unit/player-prerunreset-stress.test.js`
- Ejecutar escenarios N=500 y N=1000.
- Capturar métricas de logs `[preRunReset:*]` y tiempos de pared.

3. Runner e2e opcional
- `accesorios/pruebas/tests/e2e/prerunreset-stress/run.js`
- Validar que en Firefox real no hay errores de ejecución.

## Criterios de aceptación

1. 500 controles: restauración completa sin error fatal.
2. 1000 controles: sin crash ni bloqueo del flujo de macro.
3. Campos sensibles: sin persistencia de valores sensibles en metadata exportada.
4. Métricas publicadas en reporte con tabla comparativa.
5. `npm test` y `verify:v2:firefox:full` permanecen verdes.

## Formato de reporte esperado

- Tabla por escenario: `N`, `capture_ms`, `restore_ms`, `restored`, `skipped`, `mismatch`, `sensitive_leaks`.
- Conclusión: apto/no apto para uso intensivo.

## Estado

Plan preparado. Implementación de benchmark formal: NO VERIFICADO en esta corrida.