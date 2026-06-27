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
