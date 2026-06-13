# H-09 preRunReset/defaults Stress Report

## 1. Resumen ejecutivo

Se ejecutó stress formal de preRunReset/defaults sobre formularios grandes en unit tests (happy-dom), con métricas reales para 500 y 1000 controles, cobertura de sensibles/omitidos/tipos de control y validación global del repo en verde.

## 2. Estado inicial

- Punto de partida: rama hardening/h09-prerunreset-stress desde hardening/h08-dynamic-selectors.
- Captura preRunReset existente en Recorder.
- Sanitización de metadata existente en iim-adapter.
- Faltaba benchmark formal 500/1000 con métricas reportables.

## 3. Cambios realizados

1. Plan H-09 reescrito al formato obligatorio 1..10.
2. Se ampliaron tests en recorder-pre-run-reset con casos A-J.
3. Se agregó helper de restauración de baseline en tests para medición reproducible.
4. Se agregó test de no fuga de secretos sentinela en export IIM.

## 4. Archivos modificados

- docs/reports/h09-prerunreset-stress-plan.md
- accesorios/pruebas/tests/unit/recorder-pre-run-reset.test.js
- accesorios/pruebas/tests/unit/iim-adapter.test.js
- accesorios/documentacion/docs/reports/h09-prerunreset-stress-report.md

## 5. Tests agregados

En recorder-pre-run-reset.test.js:

1. H-09 Caso A: stress 500 controles text con métricas.
2. H-09 Caso B: stress 1000 controles mixtos con métricas.
3. H-09 Caso C: sensibles sin value.
4. H-09 Caso D: omitidos por tipo/estado.
5. H-09 Caso E: select value + selectedIndex.
6. H-09 Caso F: checkbox/radio checked.
7. H-09 Caso G: textarea multilínea.
8. H-09 Caso H: dedupe por selector.
9. H-09 Caso I: iframe same-origin best effort.
10. H-09 Caso J: no-regresión formulario pequeño.

En iim-adapter.test.js:

1. H-09: exportToIim no filtra secretos sentinela en texto final.

## 6. Métricas obtenidas

| Escenario | Controles | Captura ms | Restauración ms | Mismatches | Resultado |
|---|---:|---:|---:|---:|---|
| A-500-text | 500 | 119.42 | 140.15 | 0 | OK |
| B-1000-mixto | 1000 | 347.17 | 1837.73 | 0 | OK |

## 7. Campos sensibles

- Detección y tratamiento validados para password/token/pin por id/name/aria-label/type.
- En baseline preRunReset, controles sensibles se incluyen sin value.
- En export IIM/WM_JSON, se eliminan value/currentValue sensibles.
- Verificación adicional: cadenas sentinela PASSWORD_SHOULD_NOT_LEAK, TOKEN_SHOULD_NOT_LEAK y SECRET_SHOULD_NOT_LEAK no aparecen en el script exportado.

## 8. Campos omitidos

Se validó omisión de:

- hidden
- submit
- button
- image
- file
- reset
- disabled
- readOnly

## 9. Tests ejecutados

| Comando | Resultado | Observaciones |
|---|---|---|
| npm test | OK | 270 pass, 0 fail |
| npm run verify:v2:firefox:fast | OK | pipeline fast completo en verde |
| npm run verify:v2:firefox:full | OK | pipeline full completo en verde |

## 10. Riesgos de regresión revisados

1. No se alteró lógica runtime de Player ni Background.
2. Cambios concentrados en tests + documentación.
3. Se usaron umbrales amplios de performance (<5000 ms) para evitar falsos negativos por variación de máquina.

## 11. Riesgos remanentes

1. Métricas provienen de entorno unitario happy-dom; pueden diferir en navegador real para escenarios extremos.
2. Dedupe por selector puede omitir controles en colisiones de selector; queda documentado como comportamiento actual.

## 12. NO VERIFICADO

- NO VERIFICADO: benchmark dedicado de stress preRunReset en iframe same-origin dentro de navegador real (Firefox) con medición formal equivalente a A/B.

## 13. Límites explícitos

1. Esta ronda no toca H-08.
2. Esta ronda no toca IAPOS real.
3. No se modificaron src/modules/player/player.js ni src/background/background.js.
4. No se declara release listo.

## 14. Criterio de aceptación

Criterio H-09 cumplido en esta ronda:

1. Stress 500 y 1000 implementado.
2. Métricas reales capturadas y reportadas.
3. Sensibles y omitidos verificados.
4. Tipos select/checkbox/radio/textarea verificados.
5. No-regresión de formulario pequeño verificada.
6. Validación global (npm test + verify fast + verify full) en verde.

## 15. Próximos pasos

1. Si se requiere mayor representatividad, repetir A/B en un bench e2e controlado sobre navegador real con instrumentación temporal.
2. Evaluar mejora futura para colisiones de selector en dedupe sin romper compatibilidad.
3. Queda habilitado pasar a la ronda de IAPOS real cuando se autorice expresamente.
