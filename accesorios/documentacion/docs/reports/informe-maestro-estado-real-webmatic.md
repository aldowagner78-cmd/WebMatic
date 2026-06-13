# Informe Maestro - Estado Real de WebMatic (sin suposiciones)

## 1) Alcance y criterio de veracidad

Este documento consolida el estado actual del proyecto con tres reglas estrictas:

1. Solo se afirma lo que fue verificado por evidencia de codigo, comandos o reportes existentes en el repo.
2. Todo lo no verificado en esta corrida queda marcado como "Pendiente" o "No verificado".
3. No se infieren capacidades por intuicion.

## 2) Evidencia usada en esta corrida

### 2.1 Evidencia automatica ejecutada ahora


- `npm test` -> 236 tests, 236 pass, 0 fail.
- `npm run verify:v2:firefox:full` -> OK (full), incluyendo:
	- unit tests,
	- e2e fixtures-flow,
	- e2e iapos-safe,
	- e2e firefox-extension.

- `npm run verify:v2:firefox:fast` tambien en verde, pero queda explicitamente como validacion rapida.

Observacion importante:
- La etapa IAPOS real depende de variable de entorno (`IAPOS_E2E_REAL`) y no se ejecuto en esta corrida.

### 2.2 Evidencia de codigo inspeccionada

- `src/content/content.js`
- `src/modules/player/player.js`
- `src/modules/storage/iim-adapter.js`
- `src/modules/editor/step-editor.js`
- `src/modules/ui/ui-shell.js`
- `src/modules/ui/ui-shell.css`
- `src/core/store.js`
- `accesorios/pruebas/tests/unit/player.test.js`
- `accesorios/pruebas/tests/unit/iim-adapter.test.js`

### 2.3 Evidencia documental existente inventariada

- Carpeta de reportes tecnicos: `accesorios/documentacion/docs/reports/`
- Carpeta de ejercicios/manual QA: `accesorios/pruebas/docs/reports/`

## 3) Estado global del producto

### 3.1 Estado de build/test

- Verde en validacion automatica principal de esta corrida (full).
- Sin fallas abiertas en suite unitaria.

### 3.2 Estado de cambios en working tree (snapshot)

Archivos modificados detectados:

- `accesorios/pruebas/tests/unit/iim-adapter.test.js`
- `accesorios/pruebas/tests/unit/player.test.js`
- `src/content/content.js`
- `src/core/store.js`
- `src/modules/editor/step-editor.js`
- `src/modules/player/player.js`
- `src/modules/storage/iim-adapter.js`
- `src/modules/ui/ui-shell.css`
- `src/modules/ui/ui-shell.js`

Archivos/carpetas no trackeados detectados:

- `accesorios/pruebas/docs/`
- `respaldo_antes_de_retomar.patch`

## 4) Estado funcional por circuito/modo

## 4.1 Grabador (contenido de pagina)

### Verificado

- Captura eventos base (click, change/input, teclado, copy/extract, etc.) y los normaliza antes de exportar.
- Inyeccion de defaults de pagina al set final de pasos grabados mediante pasos internos marcados (`_baselineDefault`, `_fast`).
- Insercion de bootstrap navigate al inicio cuando corresponde para preservar contexto de arranque.
- Etiquetado de bloques por contexto de URL (`_wmBlockKey`, `_wmBlockStart`, `_wmBlockEnd`) para ordenar ejecucion por bloques.
- Captura de `drag_drop` en flujo grabado (listeners de `dragstart` y `drop` en modo global e inline).
- Limpieza de ruido fragil de teclado (`Tab`) en post-procesado de pasos.
- Inyeccion de `wait_for` en escenarios post-click cuando el siguiente target fue ausente al momento del click (logica de snapshot + observer).

### Pendiente / No verificado en esta corrida

- Prueba manual UX completa de grabacion en sitios reales complejos (mas alla de fixtures).
- Medicion de impacto de performance del observer post-click en paginas con mutaciones masivas.

## 4.2 Reproductor

### Verificado

- Politica de pre-run reset normalizada (`start_only` por defecto, soporte `start_and_resume`).
- Restauracion de baseline en inicio y tambien en reanudacion cuando policy lo exige.
- Pasos internos silenciosos limitados a pasos tecnicos (`capture_defaults` y/o `_baselineDefault`) para no ocultar pasos de usuario.
- Guardado de estado de reanudacion antes de pasos relevantes para retomar tras navegaciones/cambios de contexto.

### Pendiente / No verificado en esta corrida

- Ejecucion manual de stress en macros largas con multiples cambios de pestana y resume repetidos.

## 4.3 Editor Visual de pasos

### Verificado

- Soporte de metadatos de macro en editor (`setMeta/getMeta`).
- Panel de politica de reseteo visible y editable (selector de modo + hint explicativo).
- Reglas para pasos default capturados:
	- si no se editan, conservan flag de default;
	- si se editan con cambios reales, se promueven a pasos normales (se eliminan flags internos).
- Mejora visual de bloques:
	- marcado de bloques default,
	- badge `default` en filas,
	- contexto de bloque visible (host/path abreviado).

### Pendiente / No verificado en esta corrida

- QA visual manual detallado en distintos zoom/resoluciones y sitios de terceros.

## 4.4 Editor Script IIM

### Verificado

- Preservacion de script "full" con metadata WM_JSON en background, mostrando al usuario la version legible sin la linea WM_JSON.
- Hidratacion robusta del textarea cuando hay draftSteps pero script vacio.
- Layer visual para remarcar lineas correspondientes a defaults capturados en Script tab.
- Sincronizacion Visual <-> Script conservando metadata de macro al exportar/importar.

### Pendiente / No verificado en esta corrida

- QA manual fino de superposicion visual del default layer en todos los navegadores soportados y fuentes no estandar.

## 4.5 Adapter IIM (import/export, compatibilidad)

### Verificado

- Parser legacy ahora interpreta instrucciones comentadas emitidas por WebMatic (en vez de ignorarlas siempre), incluyendo:
	- `WAIT_FOR`,
	- `DBLCLICK`,
	- `SCROLL_TO`,
	- `HOVER`,
	- `SET`,
	- `DRAG_DROP`,
	- `PROMPT`,
	- `CALL_MACRO`.
- Cobertura unitaria agregada para parser legacy + round-trips relevantes.

### Pendiente / No verificado en esta corrida

- Validacion manual con corpus externo grande de scripts IIM legacy no generados por WebMatic.

## 4.6 UI Shell / Store

### Verificado

- Apertura de editor de script mas robusta cuando llega script vacio pero existen pasos (fallback a export dinamico).
- Persistencia coherente de `script`, `draftSteps` y `meta` en flujo de `SCRIPT_EDITOR_OPENED`.
- Reconciliacion de script en acciones de guardar/guardar como/importar preservando metadatos resueltos.

### Pendiente / No verificado en esta corrida

- Validacion manual de todos los caminos de UX en secuencias largas de abrir/cerrar editor + copiar/pegar + revertir.

## 5) Matriz de estado (Validado / Parcial / Pendiente)

| Area | Estado | Evidencia |
|---|---|---|
| Unit tests | Validado | `npm test` (236/236) |
| Verify Firefox fast | Validado | `npm run verify:v2:firefox:fast` OK (rapida, no release gate) |
| Verify Firefox full | Validado | `npm run verify:v2:firefox:full` OK |
| CI release gate Firefox | Validado (implementado) | `.github/workflows/firefox-release-gate.yml` |
| IAPOS real end-to-end | Pendiente (NO EJECUTADO EN ESTA CORRIDA) | Requiere `IAPOS_E2E_REAL=1` |
| Grabacion defaults + baseline | Validado | Codigo + tests player/content |
| Resume en subflujos complejos | Validado con limites explicitos | Codigo + tests en player (`if_exists`, `loop_until`, `try_fallback`, `call_macro`, `for_each_row`) y preservacion de filas/iteraciones remanentes; tab actions en subflujos complejos no soportadas en esta ronda |
| Concurrencia pending playback por tab | Validado | `background.js` (mapa por tabId) |
| Parser IIM comentarios extendidos/complejos | Validado | `iim-adapter.js` + tests de placeholders seguros |
| Marcadores `_wmBlockKey/_wmBlockStart/_wmBlockEnd` | Parcial | Recorder/content los genera y editor los consume; sin campana QA manual dedicada en esta corrida |
| UX visual fina (editor/script overlay) | Parcial | Verificado en codigo; falta recorrido manual amplio |
| Performance en paginas muy dinamicas | Pendiente (NO EJECUTADO EN ESTA CORRIDA) | No benchmark en esta corrida |

## 6) Riesgos abiertos reales (sin exagerar)

1. Riesgo de diferencias de comportamiento UI en casos de layout extremos no cubiertos por fixtures.
2. Riesgo de regresion en escenarios legacy externos no representados en test data actual.
3. Riesgo de latencia/overhead en paginas con alto volumen de mutaciones DOM por observer post-click.

## 7) Recomendaciones inmediatas y accionables

1. Ejecutar ronda manual focalizada de UX con checklist corto:
	 - grabar,
	 - editar visual,
	 - alternar a script,
	 - guardar,
	 - reproducir,
	 - reanudar tras navigate/tab switch.
2. Correr pipeline de verificacion completa (no fast) en ventana dedicada.
3. Si se habilita entorno real, correr IAPOS real y adjuntar reporte de evidencia en `accesorios/documentacion/docs/reports/`.

## 8) Conclusiones ejecutivas

1. El estado tecnico actual esta estable en pruebas automatizadas ejecutadas en esta corrida.
2. La arquitectura de defaults/preRunReset quedo alineada con metadatos de macro y con visibilidad correcta en editor.
3. La deuda principal ya no es de integridad base, sino de validacion manual avanzada en escenarios reales y performance edge.

---

Nota final de integridad: este informe no declara como "hecho" ninguna capacidad que no tenga respaldo directo en comandos ejecutados, codigo inspeccionado o reportes existentes en el repositorio.
