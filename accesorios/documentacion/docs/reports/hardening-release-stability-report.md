# Hardening release stability - WebMatic

## 1. Resumen ejecutivo

Se completó una ronda de hardening enfocada en estabilidad de release, reanudación de reproducción y trazabilidad de validación.

Resultado global de validación en esta corrida:
- `npm test`: OK (236/236).
- `npm run verify:v2:firefox:fast`: OK.
- `npm run verify:v2:firefox:full`: OK.

Se implementó release gate CI, se eliminaron skips silenciosos por defecto en e2e IAPOS, se reforzó resume en subflujos complejos del player, se endureció concurrencia de pending playback y se amplió parser legacy IIM con placeholders seguros para bloques complejos.

## 2. Cambios realizados

1. Release gate y política fast/full.
- Workflow CI nuevo para ejecutar full gate en push/PR.
- Aviso explícito de que `fast` no habilita release completo.
- README actualizado con criterio de release sobre `full`.

2. Skips de Playwright Firefox.
- `iapos-safe` ahora falla si falta Firefox Playwright.
- Solo permite skip con `ALLOW_PLAYWRIGHT_FIREFOX_SKIP=1`.

3. Resume robusto en subflujos del player.
- Se guarda estado de continuación antes de subpasos relevantes.
- Se propaga continuación recursiva en `if_exists`, `loop_until`, `try_fallback`, `call_macro`, `for_each_row`.

4. Concurrencia de pending playback.
- Cambio de singleton global a mapa por `tabId` en background.
- Limpieza por tab al cerrar o al consumir estado pendiente.

5. Parser IIM legacy para comentarios complejos.
- Soporte placeholder para `IF_EXISTS`, `LOOP_UNTIL`, `TRY_FALLBACK`, `FOR_EACH_ROW`.
- Sin inventar ramas internas: importación segura con estructuras vacías.

6. Documentación factual.
- Plan técnico de hardening de resume.
- Informe maestro actualizado con evidencia real de esta corrida y marcado explícito de no ejecutado.

## 3. Archivos modificados

- `.github/workflows/firefox-release-gate.yml`
- `README.md`
- `accesorios/herramientas/tools/verify-v2-firefox.cjs`
- `accesorios/pruebas/tests/e2e/iapos-safe/run.js`
- `src/modules/player/player.js`
- `accesorios/pruebas/tests/unit/player.test.js`
- `src/background/background.js`
- `src/modules/storage/iim-adapter.js`
- `accesorios/pruebas/tests/unit/iim-adapter.test.js`
- `docs/reports/player-resume-hardening-plan.md`
- `accesorios/documentacion/docs/reports/informe-maestro-estado-real-webmatic.md`

## 4. Hallazgos corregidos

| Hallazgo | Estado | Evidencia |
|---|---|---|
| H-01 release gate real | Corregido | workflow `.github/workflows/firefox-release-gate.yml`, `verify full` verde |
| H-02 skips silenciosos | Corregido | `accesorios/pruebas/tests/e2e/iapos-safe/run.js` |
| H-03 resume subpasos | Corregido | `src/modules/player/player.js` |
| H-04 tests subflujos | Corregido | `accesorios/pruebas/tests/unit/player.test.js` (tests resume complejos) |
| H-05 parser legacy complejos | Corregido | `src/modules/storage/iim-adapter.js` + tests |
| H-07 pendingPlayback singleton | Corregido | `src/background/background.js` (Map por tab) |
| H-10 informe factual | Corregido | `accesorios/documentacion/docs/reports/informe-maestro-estado-real-webmatic.md` |

## 5. Tests ejecutados

| Comando | Resultado | Observaciones |
|---|---|---|
| `npm test` | OK | 236 pass, 0 fail |
| `npm run verify:v2:firefox:fast` | OK | incluye aviso explícito de fast no release gate |
| `npm run verify:v2:firefox:full` | OK | incluye firefox-extension real sobre fixture local |

## 6. Riesgos remanentes

1. H-06 marcadores de bloque (`_wmBlockKey/_wmBlockStart/_wmBlockEnd`): verificación funcional amplia de recorder NO EJECUTADA EN ESTA CORRIDA.
2. H-08 robustez de selectores dinámicos en fixtures extremos: cobertura adicional dedicada NO EJECUTADA EN ESTA CORRIDA.
3. H-09 stress/benchmark formal de `preRunReset/defaults` con 500+ controles: NO EJECUTADO EN ESTA CORRIDA.
4. IAPOS real end-to-end (`IAPOS_E2E_REAL=1`): NO EJECUTADO EN ESTA CORRIDA.

## 7. Cosas no verificadas

- Campaña manual de QA visual completa en sitios reales de terceros.
- Medición de performance en páginas con mutaciones DOM masivas.
- Escenario de concurrencia multi-reproducción en uso real con usuarios simultáneos.

## 8. Recomendaciones siguientes

1. Crear una ronda puntual H-08 con fixtures de selectores dinámicos agresivos y tests de replay.
2. Crear prueba de estrés H-09 (500/1000 controles) y registrar métricas de captura/restauración.
3. Ejecutar corrida controlada con `IAPOS_E2E_REAL=1` y adjuntar reporte técnico separado.

## 9. Criterio de release

Un candidato a release se considera apto solo si:

1. `npm test` está en verde.
2. `npm run verify:v2:firefox:fast` está en verde.
3. `npm run verify:v2:firefox:full` está en verde.
4. CI de `firefox-release-gate` está en verde.
5. Cualquier omisión queda explícitamente marcada como `NO EJECUTADO EN ESTA CORRIDA`.

## 10. Verificación post-hardening

### Estado del repo

- Rama actual: `hardening/release-stability`.
- Último commit visible en HEAD: `bc0ac67 feat: robustecer recorder/player/editor iim y agregar informe maestro`.
- Estado de trabajo: con cambios pendientes (modificados y no trackeados).

### Comandos ejecutados

1. `git status`
2. `git log --oneline -5`
3. `npm test`
4. `npm run verify:v2:firefox:fast`
5. `npm run verify:v2:firefox:full`

### Resultado de CI/local

- Local `npm test`: OK (236/236, `fail=0`, `skipped=0`, `duration_ms` ~40.4s).
- Local `verify:v2:firefox:fast`: OK.
	- Incluye aviso explícito: fast no es release gate completo.
	- Ejecuta `npm test`, `test:e2e:fixtures`, `test:e2e`.
- Local `verify:v2:firefox:full`: OK.
	- Ejecuta `npm test`, `test:e2e:fixtures`, `test:e2e`, `test:e2e:firefox-extension`.
- CI `firefox-release-gate`: workflow presente y coherente con gate de release.
	- Instala dependencias (`npm ci`).
	- Instala Firefox/Geckodriver/zip.
	- Instala runtime Playwright Firefox.
	- Ejecuta `npm test`, `verify:v2:firefox:fast`, `verify:v2:firefox:full`.
	- Cualquier fallo crítico rompe el job (sin `continue-on-error`).

### Regresiones revisadas

1. Player resume top-level y limpieza de pending.
	- Persistencia previa a `navigate` en flujo principal.
	- `CLEAR_PENDING_PLAYBACK` en finalización normal, error y stop.
2. Player resume en subflujos complejos.
	- Verificado para `if_exists`, `loop_until`, `try_fallback`, `call_macro`, `for_each_row` con tests unitarios.
3. Navegación por pestañas.
	- `open_tab`, `switch_tab`, `close_tab` auditados en player/background y con tests unitarios.
4. pending playback por tab.
	- `SAVE_PLAYBACK_STATE`, `QUERY_PENDING_PLAYBACK`, `CLEAR_PENDING_PLAYBACK`, limpieza en `tabs.onRemoved` y consumo one-shot verificados.
5. IIM adapter.
	- Round-trip por `WM_JSON`, parser legacy sin `WM_JSON`, comentarios extendidos, placeholders seguros para `IF_EXISTS`, `LOOP_UNTIL`, `TRY_FALLBACK`, `FOR_EACH_ROW`.
6. Marcadores de bloque H-06.
	- Generación en recorder/content (`captureStep` y bootstrap de recording).
	- Consumo en editor (`_stepBlockKey`, `_isExecutionBlockBoundaryStep`, colapsado por bloque).
	- Conclusión: no son exclusivos del editor; el recorder sí los emite.

### Riesgos remanentes

1. Cobertura manual amplia de UX en sitios reales no ejecutada en esta corrida.
2. Benchmark formal de performance extrema en páginas con mutación masiva pendiente.
3. IAPOS real (`IAPOS_E2E_REAL=1`) pendiente.

### NO VERIFICADO

1. Campaña manual dedicada H-06 en sitios reales de terceros.
2. Implementación y corrida de testbench H-08 de selectores dinámicos agresivos.
3. Implementación y corrida de benchmark H-09 con 500/1000 controles en entorno controlado.
4. Corrida read-only en entorno IAPOS real (`IAPOS_E2E_REAL=1`).

### Conclusión técnica

El hardening incrementa estabilidad de reproducción y trazabilidad de release con evidencia reproducible en local y gate CI coherente. A la fecha de esta verificación, no hay evidencia de regresión crítica en los circuitos auditados (player/background/iim). No corresponde declarar "release listo" para todos los entornos hasta cerrar los puntos `NO VERIFICADO`.
