# Fase 1 - VALUE Dropdown Validation Report

Fecha: 2026-06-07
Rama: master

## 1) Git status

```txt
 M src/modules/editor/step-editor.js
 M src/modules/inventory/page-inventory.js
 M tests/e2e/firefox-extension-safe/run.js
 M tests/unit/step-editor-inventory.test.js
 M tests/unit/step-editor.test.js
?? docs/reports/value-dropdown-phase1-implementation.md
?? docs/reports/windows-firefox-extension-deps-report.md
?? docs/reports/windows-firefox-runner-fix-commit-report.md
?? docs/reports/windows-firefox-runner-fix-push-report.md
?? docs/reports/windows-fresh-clone-report.md
?? tests/fixtures/genexus-like.html
```

## 2) Último commit y cambios pendientes

- Último commit: `38f555d (HEAD -> master, origin/master, origin/HEAD) fix(player): normalizar defaults al reproducir macros`
- Cambios pendientes: sí (listados arriba)

## 3) Tests ejecutados (post último cambio)

- `npm test` -> PASS (`tests 160`, `pass 160`, `fail 0`)
- `npm run test:e2e` -> PASS (safe local read-only; IAPOS real omitido)
- `npm run test:e2e:firefox-extension` -> PASS
  - validó VALUE en editor
  - validó `findOptionsForStep` con fixture GeneXus-like (`#vDELEGACION` -> `#vDELEGCOMBO`)

## 4) Prueba manual Firefox/IAPOS (max 8 pasos)

1. Abrí Firefox con la extensión cargada temporalmente desde este repo (modo desarrollo).
2. Entrá a IAPOS y navegá hasta la subpágina de auditoría médica (read-only, sin acciones peligrosas).
3. Iniciá grabación en WebMatic.
4. Interactuá solo con los filtros de `Delegación` y `ESPECIALIDAD` (sin autorizar/guardar/procesar).
5. Detené grabación y abrí el editor visual de pasos.
6. Editá el paso de `choose_option` o `input` para cada campo y observá el campo `VALUE`.
7. Guardá la macro y reabrila para confirmar que el cambio quedó persistido.
8. Reproducí la macro en la misma pantalla y verificá que aplica valores en esos campos.

## 5) Resultado esperado en la prueba manual

- VALUE como select: **debe** verse como `<select>` real cuando hay opciones detectables.
- Opciones reales: **debe** listar opciones reales del control relacionado (si hay metadata confiable).
- Valor manual: **debe** permitir opción manual (`✏ valor manual…`) sin romper edición.
- Guardado: **debe** persistir el valor elegido/manual al guardar y reabrir macro.
- Reproducción: **debe** aplicar el valor final esperado en la página.

## 6) Si falla (dato mínimo para diagnosticar)

Enviar solo estos 3 datos:
1. Captura del editor visual mostrando el paso y el campo `VALUE`.
2. Tipo y selector exacto del paso que falla (ej: `choose_option`, `#vDELEGACION` o `#vESPECIALIDAD`).
3. Línea `CHOOSE_OPTION`/`TYPE` correspondiente al reabrir en pestaña Script.

## 7) Archivos tocados / validación / pendiente / próximo paso

### Archivos tocados
- `src/modules/editor/step-editor.js`
- `src/modules/inventory/page-inventory.js`
- `tests/unit/step-editor.test.js`
- `tests/unit/step-editor-inventory.test.js`
- `tests/e2e/firefox-extension-safe/run.js`
- `tests/fixtures/genexus-like.html`

### Qué queda validado
- VALUE como select real en editor (automático, unit + e2e firefox fixture).
- Opción manual preservada.
- Matching cross-control en patrón GeneXus-like por inventario.
- Guardado/reapertura/reproducción en flujo e2e fixture local.

### Qué NO queda validado
- Caso real de IAPOS productivo para `Delegación` y `ESPECIALIDAD`: **no validado** (no se habilitó `IAPOS_E2E_REAL=1`, por requerimiento).
- Variaciones de backend/XHR reales de GeneXus en ambiente IAPOS: **no validado**.

### Próximo paso recomendado
- Ejecutar la prueba manual en IAPOS (read-only) con los 8 pasos anteriores y reportar los 3 datos mínimos si falla.
