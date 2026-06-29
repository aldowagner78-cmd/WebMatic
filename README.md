# WebMatic

WebMatic es una extensión de navegador para automatizar tareas web repetitivas: graba macros, las reproduce, permite editarlas visualmente, exportarlas/importarlas y repetirlas en bucle.

## Estado actual

- **Versión Firefox firmada:** `0.2.2`.
- **Versión funcional interna visible:** `v0.2.0-modular-rc38`.
- **Rama de trabajo:** `modularizacion-base`.
- **Navegador validado:** Firefox.
- **Chrome/Edge:** pendiente para etapa posterior.
- **Estado:** firmado, instalado y probado manualmente.

## Funciones principales

- Grabar navegación, clicks, escritura, checkboxes/radios, selects nativos, teclas y esperas.
- Reproducir macros con banner de progreso, stop persistente y diagnóstico claro.
- Editar macros desde editor visual y editor IIM.
- Abrir el editor desde un error y resaltar el paso fallido.
- Repetir macros con el botón **▶▶ Bucle**, incluyendo macros con `NAVIGATE`.
- Insertar esperas inteligentes:
  - `WAIT_FOR` después de `NAVIGATE` antes del primer selector accionable;
  - `WAIT_FOR` antes de `CHOOSE_OPTION`;
  - espera posterior a contenido dinámico cuando corresponde.
- Usar selectores más robustos para páginas modernas, incluyendo Angular Material.
- Proteger campos sensibles: password, PIN, token, CVV y similares se tratan como `SENSITIVE_INPUT` y no se guardan con valor real.
- Exportar/importar macros y crear backup completo.
- Capturar inventario de página para mejorar opciones del editor visual.

## Archivos importantes

```text
manifest.json
src/content/content.js
src/background/background.js
src/modules/player/player.js
src/modules/recorder/normalizer/recording-normalizer.js
src/modules/ui/build-info.js
src/help/help.html
src/help/help.js
```

## Instalación como usuario final

Usar el XPI firmado:

```text
web-ext-artifacts/041d0daa5df241fd8ad8-0.2.2.xpi
```

En Firefox:

```text
about:addons
⚙️ > Instalar complemento desde archivo...
Seleccionar el .xpi firmado
```

## Instalación temporal para desarrollo

En Firefox:

```text
about:debugging#/runtime/this-firefox
Load Temporary Add-on...
Seleccionar manifest.json
```

## Comandos de desarrollo

Ruta Windows:

```powershell
cd C:\Users\usuario\Desktop\WebMatic-dev\repo-modular
```

Instalar dependencias:

```powershell
npm install
```

Ejecutar pruebas unitarias:

```powershell
npm test
```

Ejecutar e2e simulados principales:

```powershell
npm run test:e2e:angular-material
npm run test:e2e:wait-for-navigate
npm run test:e2e:loop-navigate
```

Lint para carpeta Firefox limpia:

```powershell
npx web-ext lint --source-dir .\dist\firefox-0.2.2
```

## Firma Firefox 0.2.2

La firma final validada generó:

```text
web-ext-artifacts/041d0daa5df241fd8ad8-0.2.2.xpi
```

Antes de firmar una nueva versión:

1. Subir `manifest.json` a una versión no usada.
2. Crear carpeta limpia de distribución.
3. Correr tests.
4. Correr `web-ext lint`.
5. Firmar con `web-ext sign --channel unlisted`.

## Backups estables

Backups recomendados:

```text
backups/WebMatic-Firefox-0.2.2-FIRMADO.xpi
backups/WebMatic-v0.2.2-firefox.bundle
```

## Pendientes recomendados

- Reducir los 2 warnings de `innerHTML` reportados por `web-ext lint`.
- Validar Chrome/Edge en una etapa separada.
- Mejorar documentación avanzada de casos reales y troubleshooting.
- Mantener pruebas simuladas para cada bug corregido antes de firmar futuras versiones.
