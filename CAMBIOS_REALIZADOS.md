# Cambios realizados

## Banco e2e simulado rc39 universal-resolution

Fecha: 2026-06-29

## Archivos modificados

- `package.json`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`
- `accesorios/pruebas/tests/e2e/universal-resolution/run.js`
- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-common.css`
- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-wizard-hidden.html`
- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-duplicates.html`
- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-overlay.html`
- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-disabled-late.html`
- `accesorios/pruebas/tests/e2e/universal-resolution/fixture-remount.html`

## Que se cambio

- Se agrego un banco e2e simulado para rc39 con servidor local y Playwright headless.
- Los fixtures reproducen problemas comunes de apps modernas y antiguas:
  - wizard con pasos ocultos y boton repetido;
  - inputs con mismo placeholder, oculto y visible;
  - boton tapado por overlay;
  - boton disabled que se habilita despues;
  - campo desmontado y montado otra vez;
  - contenido SPA que aparece despues de click;
  - selector con multiples coincidencias donde solo una es interactuable.
- Se agrego el script `test:e2e:universal-resolution`.

## Por que se cambio

- WebMatic necesita validar universalidad practica sin arreglar paginas una por una.
- El banco permite reproducir localmente patrones reales de resolucion antes de tocar logica productiva.

## Como probar

1. Ejecutar `npm run test:e2e:universal-resolution`.
2. Ejecutar `npm test`.
3. Confirmar que el runner imprime `[universal-resolution] OK` o una lista clara de pendientes.

## Ajuste de manual para usuario final

Fecha: 2026-06-29

## Archivos modificados

- `src/help/help.html`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`

## Qué se cambió

- Se limpió el manual integrado para que sea útil a usuarios finales.
- Se quitaron instrucciones de instalación, firma, XPI, versiones internas, estado técnico, pruebas y respaldo del proyecto.
- Se dejó el manual enfocado en el uso diario de WebMatic:
  - inicio rápido;
  - pantalla principal;
  - grabar macro;
  - reproducir macro;
  - bucle;
  - editar y corregir;
  - datos sensibles;
  - esperas y páginas dinámicas;
  - exportar/importar macros;
  - buenas prácticas;
  - problemas frecuentes.

## Por qué se cambió

- El manual integrado dentro de la extensión debe servir a quien ya tiene WebMatic instalado.
- La instalación y distribución del XPI deben ir en un instructivo separado, no dentro de la ayuda diaria de la extensión.

## Cómo probar

1. Aplicar el parche.
2. Cargar WebMatic como extensión temporal o abrir la ayuda desde el repo.
3. Abrir el manual de ayuda.
4. Confirmar que no aparezcan textos técnicos como:
   - instalación del XPI;
   - firma Firefox;
   - estado de versión;
   - `rc38`;
   - instrucciones de desarrollo;
   - pruebas o backups del proyecto.
5. Confirmar que el manual explique claramente cómo usar WebMatic.

## Cómo revertir

- Restaurar los archivos desde el commit anterior o desde el backup del proyecto.
