# Instalación y uso del parche WebMatic rc35

## Requisitos

- Windows con PowerShell o Linux con terminal.
- Node.js instalado.
- Proyecto WebMatic existente en:
  - Windows: C:\Users\usuario\Desktop\WebMatic-dev\repo-modular
  - Linux: ~/Escritorio/WebMatic-dev/repo-modular

## Instalación del parche

Antes de aplicar, crear copia de seguridad.

Windows PowerShell:
Ruta:
C:\Users\usuario\Desktop\WebMatic-dev

Comando:
Copy-Item .\repo-modular .\repo-modular_BACKUP_rc34 -Recurse

Luego aplicar el ZIP parche desde la raíz del proyecto.

Ruta:
C:\Users\usuario\Desktop\WebMatic-dev\repo-modular

Comando:
Expand-Archive -Path C:\Users\usuario\Desktop\WebMatic-dev\WebMatic-rc35-selector-angular-material-PARCHE.zip -DestinationPath . -Force

Linux:
Ruta:
~/Escritorio/WebMatic-dev

Comando:
cp -r repo-modular repo-modular_BACKUP_rc34

Ruta:
~/Escritorio/WebMatic-dev/repo-modular

Comando:
unzip -o ~/Escritorio/WebMatic-dev/WebMatic-rc35-selector-angular-material-PARCHE.zip -d .

## Ejecución / carga temporal en Firefox

Ruta:
C:\Users\usuario\Desktop\WebMatic-dev\repo-modular

Pasos:
1. Abrir Firefox.
2. Entrar a about:debugging#/runtime/this-firefox
3. Elegir "Load Temporary Add-on..."
4. Seleccionar manifest.json del proyecto.

Resultado esperado:
- WebMatic carga como extensión temporal.
- La versión visible interna muestra v0.2.0-modular-rc35.

## Modo demo / prueba manual sugerida

Este parche no cambia el modo demo existente.

Prueba manual recomendada:
1. Abrir una página Angular Material o Santa Fe Trámites.
2. Grabar una acción sobre un input con id dinámico tipo mat-input-N.
3. Verificar que el selector grabado prefiera placeholder/aria-label cuando exista.
4. Verificar que WAIT_FOR no use #mat-input-N si hay selector estable.
5. Reproducir la macro.

Caso esperado:
- Para el campo "Buscar Nro. de Expediente:", el selector debe ser similar a:
  input[placeholder="Buscar Nro. de Expediente:"]
  o
  input[aria-label="..."]

## Pruebas automatizadas

Ruta:
C:\Users\usuario\Desktop\WebMatic-dev\repo-modular

Instalar dependencias:
npm install

Pruebas recomendadas:
node --test accesorios/pruebas/tests/unit/recorder.test.js
node --test accesorios/pruebas/tests/unit/page-inventory.test.js
node --test accesorios/pruebas/tests/unit/build-info.test.js
node --test --test-name-pattern "controlRef.altSelectors" accesorios/pruebas/tests/unit/player.test.js

Prueba completa:
npm test

Nota:
El agente ejecutó node -c en todos los JS modificados y pruebas unitarias focalizadas. No se completó npm test completo dentro del entorno por duración/tiempo de ejecución.

## Empaquetar ZIP luego de validar

Ruta:
C:\Users\usuario\Desktop\WebMatic-dev

Comando recomendado:
Compress-Archive -Path .\repo-modular -DestinationPath .\WebMatic-repo-modular-rc35-validado.zip -Force

Antes de compartir, excluir:
- node_modules
- .git
- dist
- build
- web-ext-artifacts
- .venv
- venv
- __pycache__

## Problemas frecuentes

Si npm test falla por dependencias faltantes:
Ejecutar:
npm install

Si Firefox conserva una versión vieja:
Quitar la extensión temporal anterior y volver a cargar manifest.json.

Si una macro vieja todavía tiene #mat-input-N:
Editarla manualmente o regrabar el paso para que use placeholder/aria-label. El reproductor ahora también puede usar controlRef.altSelectors cuando la macro conserva esa metadata.
