# Cambios realizados

## Archivos modificados
- `src/common/selectors/selector-builder.js`
- `src/modules/inventory/page-inventory.js`
- `src/common/dom/element-finder.js`
- `src/modules/player/player.js`
- `src/content/content.js`
- `src/modules/ui/build-info.js`
- `accesorios/pruebas/tests/unit/recorder.test.js`
- `accesorios/pruebas/tests/unit/page-inventory.test.js`
- `accesorios/pruebas/tests/unit/player.test.js`
- `accesorios/pruebas/tests/unit/build-info.test.js`

## Archivos agregados
- `README_INSTALACION.txt`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`

## Qué se cambió
- Se agregó generación centralizada de selectores alternativos estables.
- Se evitó que Angular Material `mat-input-N`, `mat-select-N` y `mat-option-N` se usen como selector estable cuando hay mejores alternativas.
- Se corrigió la inyección de `WAIT_FOR` para no preferir `#mat-input-N` sobre el selector estable ya generado.
- Se agregó soporte para que el reproductor use `controlRef.altSelectors` si el selector primario falla.
- Se actualizó la versión visible interna de rc34 a rc35.

## Por qué se cambió
- En Santa Fe Trámites falló `WAIT_FOR #mat-input-3`.
- El selector estable `input[placeholder='Buscar Nro. de Expediente:']` funcionó manualmente.
- El objetivo de rc35 es robustecer selectores Angular Material sin tocar firma Firefox ni hacer refactor masivo.

## Cómo probar

Windows PowerShell:
Ruta:
C:\Users\usuario\Desktop\WebMatic-dev\repo-modular

Comandos:
npm install
node --test accesorios/pruebas/tests/unit/recorder.test.js
node --test accesorios/pruebas/tests/unit/page-inventory.test.js
node --test accesorios/pruebas/tests/unit/build-info.test.js
node --test --test-name-pattern "controlRef.altSelectors" accesorios/pruebas/tests/unit/player.test.js

Prueba manual:
1. Cargar extensión temporal en Firefox.
2. Grabar macro en página con Angular Material.
3. Confirmar que WAIT_FOR/TYPE usen placeholder o aria-label cuando exista.
4. Reproducir macro.
5. Confirmar que no se rompieron P1-P6.

## Resultado de pruebas ejecutadas por el agente
- `node -c` correcto en todos los JS modificados.
- `recorder.test.js`: 81 pass.
- `page-inventory.test.js`: 30 pass.
- `build-info.test.js`: 4 pass.
- `player.test.js` focalizado `controlRef.altSelectors`: 1 pass.
- `npm test` completo no se terminó dentro del entorno por duración; debe ejecutarse localmente antes de crear tag rc35 definitivo.

## Cómo revertir
- Restaurar la copia de seguridad `repo-modular_BACKUP_rc34`.
- O revertir manualmente los archivos listados arriba.
- No hace falta tocar `manifest.json`, porque este parche no lo modifica.

## Actualizacion rc35 - prueba e2e Angular Material local

Archivos agregados:
- `accesorios/pruebas/tests/e2e/angular-material-selectors/fixture.html`
- `accesorios/pruebas/tests/e2e/angular-material-selectors/run.js`

Archivos modificados:
- `package.json`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`

Que valida:
- Primera carga con `id="mat-input-3"` y placeholder estable `Buscar Nro. de Expediente:`.
- Segunda carga con `id="mat-input-99"` conservando placeholder/label.
- Generacion rc35 de selector estable por placeholder.
- Reproduccion de macro legacy con `#mat-input-3` usando `controlRef.altSelectors` para completar el input cambiado.

Comando agregado:
`npm run test:e2e:angular-material`

Resultado ejecutado:
- `npm run test:e2e:angular-material`: pass.
- `npm test`: 506 pass, 0 fail.


## Actualización rc36 - WAIT_FOR inteligente tras NAVIGATE

### Archivos modificados
- `src/modules/recorder/normalizer/recording-normalizer.js`
- `src/content/content.js`
- `src/modules/ui/build-info.js`
- `accesorios/pruebas/tests/unit/recorder.test.js`
- `accesorios/pruebas/tests/unit/build-info.test.js`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`
- `README_INSTALACION.txt`

### Qué se cambió
- Se agrega `wait_for` automático visible para el primer paso con selector después de `navigate`.
- Se reemplazan esperas automáticas fijas entre `navigate` y la primera acción con selector por un `wait_for` más robusto.
- Se evita duplicar `wait_for` si ya existe.
- Se respeta `WAIT` manual del usuario.
- Se actualiza versión visible interna de rc35 a rc36.

### Por qué se cambió
- En pruebas públicas quedó pendiente que el primer selector después de `NAVIGATE` tuviera espera automática.
- Los delays fijos pueden fallar en páginas lentas, SPA o contenido dinámico.
- `WAIT_FOR` permite esperar el elemento real sin depender de segundos arbitrarios.

### Cómo probar

Windows PowerShell:
Ruta:
`C:\Users\usuario\Desktop\WebMatic-dev\repo-modular`

Comandos:
```powershell
npm install
node --test accesorios/pruebas/tests/unit/recorder.test.js
node --test accesorios/pruebas/tests/unit/build-info.test.js
npm test
```

Validación esperada:
- `recorder.test.js`: pass.
- `build-info.test.js`: pass.
- `npm test`: fail 0.
- Una macro nueva con `NAVIGATE` seguido de `CLICK`, `TYPE`, `CHECK` o `CHOOSE_OPTION` debe incluir `WAIT_FOR` antes del primer selector.

### Resultado de pruebas ejecutadas por el agente
- `node -c` correcto en JS modificados.
- `recorder.test.js`: 85 pass, 0 fail.
- No se completó `npm test` entero dentro del entorno del agente; debe ejecutarse localmente antes de commit/tag rc36.

### Cómo revertir
- Restaurar backup anterior al parche rc36.
- O revertir el commit rc36.
- No hace falta tocar `manifest.json`, porque este parche no lo modifica.

## Actualizacion rc36 - prueba e2e WAIT_FOR tras NAVIGATE

Archivos agregados:
- `accesorios/pruebas/tests/e2e/wait-for-after-navigate/fixture.html`
- `accesorios/pruebas/tests/e2e/wait-for-after-navigate/run.js`

Archivos modificados:
- `package.json`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`

Que valida:
- Fixture local con input `#busqueda-expediente` creado despues de un retardo corto.
- Macro base `navigate` + `input` normalizada como `navigate` -> `wait_for` visible -> `input`.
- El `wait_for` queda antes del primer selector accionable despues de `navigate`.
- La reproduccion empieza antes de que el input exista y escribe `EE-2026-00014539` solo despues de la creacion del input.

Comando agregado:
`npm run test:e2e:wait-for-navigate`

Resultado ejecutado:
- `npm run test:e2e:wait-for-navigate`: pass.
- `npm test`: 510 pass, 0 fail.


## Actualizacion rc37 - login, datos sensibles y submit real

### Archivos modificados
- `src/content/content.js`
- `src/modules/ui/build-info.js`
- `accesorios/pruebas/tests/unit/build-info.test.js`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`
- `README_INSTALACION.txt`

### Qué se cambió
- Se registra un marcador seguro para campos sensibles (`sensitive: true`, `value: ""`) en lugar de ignorarlos.
- Se cubre el caso de password pegado sin guardar el valor real.
- Se marca la intención de submit en botones de login/enviar.
- Se evita que la limpieza elimine clicks de login/logout/submit cuando van seguidos de navegación.
- Se evita duplicar el submit cuando el navegador dispara `click` y luego `submit`.
- Se actualiza la versión visible interna a `v0.2.0-modular-rc37`.

### Por qué se cambió
- En pruebas públicas el login funcionaba, pero el password pegado podía no quedar representado como sensible.
- El click de Login/Logout podía limpiarse y quedar reemplazado por un `NAVIGATE`, perdiendo la acción real.
- El objetivo de rc37 es mejorar autenticación y datos sensibles sin guardar secretos ni tocar la firma Firefox.

### Cómo probar

Windows PowerShell:
Ruta:
`C:\Users\usuario\Desktop\WebMatic-dev\repo-modular`

Comandos:
```powershell
node --test accesorios/pruebas/tests/unit/build-info.test.js
node --test accesorios/pruebas/tests/unit/iim-adapter.test.js
npm test
```

Validación esperada:
- `build-info.test.js`: pass.
- `iim-adapter.test.js`: pass.
- `npm test`: fail 0.
- Una macro de login debe conservar click real de submit/login si dispara navegación.
- Un password pegado debe quedar como `SENSITIVE_INPUT` redactado, sin valor real.

### Cómo revertir
- Restaurar backup anterior al parche rc37.
- O revertir el commit rc37.
- No hace falta tocar `manifest.json`, porque este parche no lo modifica.
