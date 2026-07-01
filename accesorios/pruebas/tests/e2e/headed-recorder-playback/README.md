# WebMatic headed recorder/playback QA

Runner QA para abrir navegador visible, cargar WebMatic como extension unpacked, grabar macros, reproducirlas y guardar evidencias.

## Comando unico

Desde la raiz del repo:

```powershell
node accesorios/pruebas/tests/e2e/headed-recorder-playback/run.js
```

Si `node` no esta en el `PATH` de la terminal, en esta maquina se detecto:

```powershell
& 'C:\Program Files\nodejs\node.exe' accesorios/pruebas/tests/e2e/headed-recorder-playback/run.js
```

## Que hace

- Abre Chromium headed con `slowMo` visible.
- Carga WebMatic desde el repo sin modificar ni firmar la extension.
- Prueba la pagina externa obligatoria `https://aldowagner78-cmd.github.io/flyer-clinico-prompt-builder/`.
- Prueba un fixture local GeneXus/IAPOS simulado.
- Graba una macro por escenario desde WebMatic.
- Guarda la macro y la reproduce desde cero.
- Verifica resultado final, feedback visual de grabacion/reproduccion y ausencia de selectores temporales en la macro.
- Escribe screenshots, video Playwright si esta disponible, trace y macros bajo `accesorios/pruebas/reports/headed-recorder-playback-artifacts/`.
- Actualiza `accesorios/pruebas/reports/headed-recorder-playback-report.md`.

## Que mirar visualmente

- Que aparezca el panel de WebMatic.
- Que aparezca el feedback flotante de grabacion.
- Que el wizard externo complete institucion y profesional.
- Que el fixture local cambie a detalle, seleccione `DETALLE AUTORIZADO` y confirme.
- Que durante reproduccion aparezca el feedback flotante del player.

## Limitacion conocida

Este runner usa Chromium con extension unpacked. No carga el XPI firmado de Firefox porque Playwright no ofrece un flujo confiable para instalar y automatizar ese XPI firmado en modo headed. Para validar el XPI firmado usar un runner Firefox/geckodriver dedicado.
