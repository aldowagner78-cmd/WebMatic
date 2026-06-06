# Windows Firefox Runner Fix Report

- Fecha: 2026-06-06
- Repositorio: C:/Users/usuario/Desktop/WebMatic-git

## Causa del fallo

El runner de Firefox-first detectaba Firefox solo con command -v + probe de --version.
En este entorno Windows, Firefox existe e inicia, pero firefox --version devuelve exit code 1.
Eso provocaba falso negativo (firefox=no) y abortaba npm run test:e2e:firefox-extension.

## Archivos modificados

- tests/e2e/firefox-extension-safe/run.js
- tests/unit/firefox-runner-detect.test.js

## Detección actual de Firefox en Windows

Orden aplicado:

1. Variable de entorno FIREFOX_BIN (si está definida).
2. where firefox y where firefox.exe.
3. Rutas comunes:
   - C:/Program Files/Mozilla Firefox/firefox.exe
   - C:/Program Files (x86)/Mozilla Firefox/firefox.exe
4. Validación por existencia de archivo (fs.existsSync + realpath).

Comportamiento nuevo:

- Si Firefox existe pero --version falla en Windows, no se marca como ausente.
- Se registra advertencia y se continúa usando la ruta detectada.
- Se usa ruta absoluta detectada para arrancar sesión Firefox mediante geckodriver.

## Detección actual de geckodriver

Orden aplicado:

1. Variable GECKODRIVER_BIN.
2. where geckodriver y where geckodriver.exe.
3. Fallback local de usuario:
   - %USERPROFILE%/tools/geckodriver/geckodriver.exe
4. Validación por existencia de archivo.

## Detección actual de zip

Orden aplicado:

1. Variable ZIP_BIN.
2. where zip y where zip.exe.
3. Ruta conocida de Windows:
   - C:/Program Files/MiKTeX/miktex/bin/x64/zip.exe
4. Validación por existencia de archivo.

## Resultado de npm test

- PASS
- 155 tests
- 155 pass
- 0 fail

## Resultado de npm run test:e2e

- PASS
- Runner seguro ejecutado correctamente sobre fixture local.

## Resultado de npm run test:e2e:firefox-extension

- PASS
- Tooling detectado: firefox=sí, geckodriver=sí, zip=sí
- Flujo Firefox-first completado con validación de inyección, inventario y edición visual.

## Confirmación de seguridad operativa

- IAPOS real no se abrió.
- IAPOS_E2E_REAL=1 no se habilitó.
- El runner mantiene la restricción explícita para bloquear IAPOS_E2E_REAL=1.

## Estado final de Git

- M tests/e2e/firefox-extension-safe/run.js
- ?? tests/unit/firefox-runner-detect.test.js
- ?? docs/reports/windows-fresh-clone-report.md
- ?? docs/reports/windows-firefox-extension-deps-report.md
- ?? docs/reports/windows-firefox-runner-fix-report.md

## Limitaciones pendientes

- web-ext continúa siendo opcional y no requerido por este runner.
- El comportamiento de --version de Firefox en Windows puede variar por instalación; el runner ya no depende exclusivamente de ese probe para detectar Firefox.
