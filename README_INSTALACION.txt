# Instalación y uso del parche WebMatic rc38

## Requisitos

- Windows con PowerShell o Linux con terminal.
- Node.js instalado.
- Proyecto WebMatic existente en:
  - Windows: C:\Users\usuario\Desktop\WebMatic-dev\repo-modular
  - Linux: ~/Escritorio/WebMatic-dev/repo-modular

## Instalación del parche

Antes de aplicar, crear copia de seguridad limpia, sin `node_modules`, `.git`, `dist`, `build` ni `web-ext-artifacts`.

Windows PowerShell:
Ruta:
C:\Users\usuario\Desktop\WebMatic-dev\repo-modular

Comando:
Expand-Archive -Path C:\Users\usuario\Desktop\WebMatic-dev\WebMatic-rc38-loop-navigate-PARCHE.zip -DestinationPath . -Force

Linux:
Ruta:
~/Escritorio/WebMatic-dev/repo-modular

Comando:
unzip -o ~/Escritorio/WebMatic-dev/WebMatic-rc38-loop-navigate-PARCHE.zip -d .

## Ejecución / carga temporal en Firefox

Ruta:
C:\Users\usuario\Desktop\WebMatic-dev\repo-modular

Pasos:
1. Abrir Firefox.
2. Entrar a `about:debugging#/runtime/this-firefox`.
3. Elegir "Load Temporary Add-on...".
4. Seleccionar `manifest.json`.

Resultado esperado:
- WebMatic carga como extensión temporal.
- La versión visible interna muestra `v0.2.0-modular-rc38`.

## Modo demo / prueba manual sugerida

Este parche no cambia datos demo ni firma Firefox.

Prueba manual recomendada:
1. Crear o usar una macro con `NAVIGATE` y al menos una acción posterior.
2. Reproducirla con el botón `▶▶ Bucle` en 2 o 3 repeticiones.
3. Verificar que después de cada navegación la reproducción continúe y arranque la siguiente vuelta.
4. Confirmar que `Detener` corta el bucle.

Resultado esperado:
- El bucle no queda detenido después de la primera navegación.
- Se conserva el estado de repetición entre páginas.

## Pruebas automatizadas

Ruta:
C:\Users\usuario\Desktop\WebMatic-dev\repo-modular

Comandos:
node --test accesorios/pruebas/tests/unit/content-background-storage-regression.test.js
node --test accesorios/pruebas/tests/unit/content-playback-banner.test.js
node --test accesorios/pruebas/tests/unit/build-info.test.js
node --test --test-name-pattern "navigate: hacia file" accesorios/pruebas/tests/unit/player.test.js
npm test

Resultado esperado:
- Todas las pruebas pasan.
- `npm test` finaliza con `fail 0`.

## Empaquetar ZIP limpio

Windows PowerShell:
Ruta:
C:\Users\usuario\Desktop\WebMatic-dev

Comando:
robocopy .\repo-modular .\_zip_temp\repo-modular /E /XD node_modules .git dist build web-ext-artifacts .venv venv __pycache__ /XF *.pyc
Compress-Archive -Path .\_zip_temp\repo-modular -DestinationPath .\WebMatic-repo-modular-rc38-LIMPIO.zip -Force
Remove-Item .\_zip_temp -Recurse -Force

## Problemas frecuentes

- Si `Copy-Item` falla por rutas largas, usar ZIP limpio con `robocopy`.
- Si `player.test.js` falla por `happy-dom`, ejecutar `npm install` primero.
- No firmar Firefox todavía si falta validación manual/e2e del bucle.
