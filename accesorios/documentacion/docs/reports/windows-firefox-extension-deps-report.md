# Windows Firefox Extension Dependencies Report

- Fecha: 2026-06-06
- Ruta de trabajo: C:/Users/usuario/Desktop/WebMatic-git

## Dependencias faltantes detectadas al inicio

- firefox: faltaba en PATH
- geckodriver: faltaba en PATH
- zip: disponible en PATH (MiKTeX)

## Como se instalo Firefox

- Intento con winget: detectaba instalado, pero no quedaba ejecutable resoluble en PATH para el runner.
- Instalacion efectiva realizada desde instalador oficial de Mozilla (full installer):
  - URL oficial usada: https://download-installer.cdn.mozilla.net/pub/firefox/releases/137.0.1/win64/en-US/Firefox%20Setup%20137.0.1.exe
  - Instalacion silenciosa: /S
  - Resultado: EXIT=0
  - Binario detectado: C:/Program Files/Mozilla Firefox/firefox.exe

## Como se instalo geckodriver

- Instalado con winget desde fuente oficial:
  - winget install -e --id Mozilla.GeckoDriver --source winget --accept-source-agreements --accept-package-agreements
- Como alternativa local segura, se descargó el release oficial desde GitHub de mozilla/geckodriver y se extrajo en:
  - C:/Users/usuario/tools/geckodriver/geckodriver.exe

## Como se resolvio zip

- zip ya estaba disponible en:
  - C:/Program Files/MiKTeX/miktex/bin/x64/zip.exe
- No fue necesario instalar componente adicional para zip.

## Resultado de where

- where firefox:
  - C:/Program Files/Mozilla Firefox/firefox.exe
- where geckodriver:
  - C:/Users/usuario/tools/geckodriver/geckodriver.exe
  - C:/Users/usuario/AppData/Local/Microsoft/WinGet/Packages/Mozilla.GeckoDriver_Microsoft.Winget.Source_8wekyb3d8bbwe/geckodriver.exe
- where zip:
  - C:/Program Files/MiKTeX/miktex/bin/x64/zip.exe

## Resultado de npm run test:e2e:firefox-extension

- Estado: FAIL
- Salida clave:
  - Tooling detectado: firefox=no, geckodriver=sí, zip=sí
  - Detalle: firefox no encontrado en PATH
- Hallazgo técnico verificado:
  - firefox.exe --version retorna exit code 1 en este Windows.
  - El runner valida Firefox con ese probe y por eso marca firefox=no.

## Resultado de npm test

- Estado: OK
- Resumen: 150 tests, 150 pass, 0 fail.

## Resultado de npm run test:e2e

- Estado: OK
- Runner seguro ejecutado correctamente (fixture local + modo real opcional omitido por configuracion).

## Estado final de Git

- Estado antes de este reporte: ?? docs/reports/windows-fresh-clone-report.md
- Estado esperado tras generar este reporte:
  - ?? docs/reports/windows-fresh-clone-report.md
  - ?? docs/reports/windows-firefox-extension-deps-report.md

## Pendiente

- Queda pendiente que pase npm run test:e2e:firefox-extension en Windows sin cambios de código.
- Causa probable: incompatibilidad del probe de Firefox en el runner (usa --version y espera status 0).
- Siguiente paso sugerido (en cambio posterior separado): adaptar el runner para Windows (por ejemplo, fallback a invocación alternativa de Firefox en Windows en lugar de depender solo de --version).
