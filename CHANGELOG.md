# Changelog

## [2026-06-30] rc40B-2 grabacion GeneXus/IAPOS reproducible

### Agregado
- El normalizador inserta `WAIT_FOR` antes de la primera accion interactiva cuando cambia `_wmBlockKey`, cubriendo transiciones GeneXus/listado-detalle-auditar sin `NAVIGATE` visible intermedio.
- Tests unitarios para la macro IAPOS esperada con `WAIT_FOR #vAUTORIZAR_0001` y `WAIT_FOR #vERROR`.

### Modificado
- La grabacion principal de selects nativos conserva `value`, `text` visible e `index`.
- `controlRef` de selects grabados incorpora `id`, `name`, `label`, `controlKind` y `options` cuando estan disponibles.
- El flash rojo de grabacion se dispara despues de que el step fue aceptado por el buffer local/top-frame, evitando pintar intentos invalidos.

### Compatibilidad
- No se modifico `manifest.json`, README, help, dist, firma ni UI general.
- No se agregaron dependencias nuevas.
- No se inventan pasos de confirmacion no clickeados por el usuario.

## [2026-06-30] rc40A CHOOSE_OPTION robusto

### Agregado
- `CHOOSE_OPTION` en selects nativos aplica capas aditivas: `value` legacy primero, fallback por `text` exacto y fallback por `index` grabado.
- Verificacion final con diagnostico claro cuando la opcion no queda seleccionada.
- Grabacion de selects enriquecida con `value`, `text` e `index`.
- E2E simulado GeneXus/IAPOS para `#vERROR` con opcion `47` / `DETALLE AUTORIZADO`.

### Modificado
- Selects disparan `input`, `change`, `blur` y `focusout` al seleccionar.
- Normalizer compacta `CHOOSE_OPTION + CLICK option:nth-of-type(...)` redundante.
- IIM conserva `INDEX` en `CHOOSE_OPTION` sin romper `VALUE`/`TEXT` legacy.

### Compatibilidad
- No se modifico `manifest.json`, dist, firma ni UI general.
- No se agregaron dependencias nuevas.

## [2026-06-29] rc39-impl-2 intencion semantica basica y scoring contextual

### Agregado
- Inventario/controlRef agrega metadata opcional compatible: `placeholder`, `text`, `name`, `role`, `tag`, `type`, `controlKind`, `visibleSectionTitle` y conserva `altSelectors`.
- `element-finder` suma scoring contextual por placeholder, label, texto visible, role, name, controlKind y contexto cercano.
- Tests unitarios para seleccion por placeholder/texto/role, preservacion de controlRef enriquecido, campos sensibles sin valor real y player pasando metadata al resolver.

### Modificado
- El player pasa `controlRef`/`intent` al resolver sin romper `controlRef.altSelectors`.
- El grabador de teclas editables agrega metadata semantica basica al `controlRef` cuando esta disponible.

### Compatibilidad
- No se modifico `manifest.json`.
- No se cambio UI, storage/import/export ni release.
- No se agregaron dependencias nuevas.
- Macros antiguas sin metadata conservan comportamiento legacy.

### Pendiente
- Los empates peligrosos entre candidatos accionables siguen documentados como riesgo: por compatibilidad, el resolver mantiene orden legacy si el scoring no aporta evidencia suficiente.

## [2026-06-29] rc39-impl-1 motor universal visible/interactuable

### Agregado
- `element-finder` ahora expone `getCandidateElements`, checks de visibilidad/estado/editabilidad/interactuabilidad y `findBestElement`.
- Tests unitarios directos para resolver duplicados ocultos/visibles, `aria-hidden` en ancestros, `readonly`, `disabled`, selector unico visible, `fallbackSelectors`/`controlRef.altSelectors` y fallback legacy sin alternativa.

### Modificado
- `findElement` evalua todos los candidatos del selector y sus fallbacks, priorizando elementos visibles e interactuables antes de devolver un resultado.
- El player pasa `actionType` al resolver para distinguir click, escritura y esperas sin cambiar el contrato legacy.

### Compatibilidad
- No se modifico `manifest.json`.
- No se agregaron dependencias nuevas.
- No se cambio UI ni almacenamiento/import/export.

### Pendiente
- Esta capa no implementa aun grabacion por intencion, scoring semantico completo, resolucion cross-origin ni diagnostico visible nuevo para usuario final.

## [2026-06-29] Banco e2e simulado rc39 universal-resolution

### Agregado
- Nuevo runner local `test:e2e:universal-resolution` sin internet ni credenciales.
- Fixtures en `accesorios/pruebas/tests/e2e/universal-resolution/` para casos de resolucion universal: wizard con pasos ocultos, placeholder duplicado, overlay, boton disabled tardio, remount de campo, SPA diferida y selectores con varios candidatos.

### Compatibilidad
- No se modifico `src/`.
- No se modifico `manifest.json`.
- No se agregaron dependencias nuevas.

## [2026-06-29] Ajuste de manual para usuario final

### Modificado
- `src/help/help.html` queda orientado a usuario final.
- Se eliminaron del manual integrado referencias a instalación, firma, XPI, versiones internas, estado técnico, pruebas y respaldo del proyecto.
- Se reorganizó el contenido en uso diario: inicio rápido, pantalla principal, grabar, reproducir, bucle, edición, datos sensibles, esperas, export/import y problemas frecuentes.

### Pendiente
- Mantener instrucciones de instalación/distribución fuera del manual integrado, en documentos separados cuando haga falta.

## [2026-06-29] Documentación final Firefox 0.2.2

### Agregado
- Manual de usuario actualizado para Firefox `0.2.2` / `v0.2.0-modular-rc38`.
- Instrucciones claras de instalación del XPI firmado.
- Secciones de bucle, datos sensibles, selectores robustos, `WAIT_FOR`, export/import y problemas frecuentes.

### Modificado
- `README.md` pasa a describir el estado estable firmado `0.2.2`.
- `README_INSTALACION.txt` deja de hablar de parche rc38 y pasa a documentar instalación/uso de la versión firmada.
- `src/help/help.html` se reorganiza como manual final para usuario real.

### Corregido
- Documentación desactualizada que todavía describía etapas de parche en lugar de release firmado.

### Pendiente
- Reducir los 2 warnings conocidos de `innerHTML` en renderers del editor.
- Validar Chrome/Edge en etapa separada.


## [2026-06-29] v0.2.0-modular-rc38

### Agregado
- E2E simulado local `test:e2e:loop-navigate` para validar bucle x3 con `NAVIGATE`, `WAIT_FOR` y escritura posterior sin internet ni credenciales.
- Persistencia de estado de bucle durante navegación real (`loopReplay`) para que `▶▶ Bucle` pueda continuar tras `NAVIGATE`.
- Reanudación automática de la siguiente iteración cuando la vuelta actual termina en otra página.
- Tests unitarios/source-level para preservar `loopReplay` en pending playback y reanudar bucles después de navegación.

### Modificado
- `player.js` incluye `loopReplay` en `SAVE_PLAYBACK_STATE`, `PLAYBACK_NAVIGATE` y acciones de pestañas.
- `background.js`, `tabs-navigation.js` y `background-navigator.js` transportan el estado de bucle junto con la continuación.
- `content.js` arranca la siguiente vuelta del bucle después de reanudar y completar una macro con navegación.
- Versión visible interna actualizada a `v0.2.0-modular-rc38`.

### Corregido
- Caso rc38: el botón `▶▶ Bucle` podía cortar después de la primera navegación porque el contador quedaba en la página anterior.



### Corrección de prueba rc38
- `buildPendingPlaybackState` ya no agrega `loopReplay: null` cuando no hay bucle activo, conservando el formato legacy.
- Tests ajustados para validar dos casos separados: pending playback sin bucle y con `loopReplay` real.
- Test de `navigate file://` actualizado para pasar un `loopReplay` explícito y validar que se preserve.

### Pendiente
- Firma Firefox `0.2.2` solo después de validar rc38.

### Compatibilidad
- No se modificó `manifest.json`.
- No se cambió versión firmada Firefox.
- No se agregaron dependencias nuevas.


## [2026-06-27] v0.2.0-modular-rc37

### Agregado
- Marcador seguro `SENSITIVE_INPUT` para campos sensibles cuando el usuario pega o modifica un password/token, sin guardar el valor real.
- Captura de intención de submit para botones `submit` y botones de login detectables, conservando el click antes de la navegación.
- Conservación de clicks de login/logout/submit antes de `NAVIGATE` para evitar que la macro quede como navegación directa solamente.

### Modificado
- `content.js` ya no descarta silenciosamente inputs sensibles: registra un paso redactado con `sensitive: true` y `value: ""`.
- `content.js` marca clicks de submit con `_wmSubmitIntent` y evita duplicados entre `click` y `submit`.
- La limpieza de pasos mantiene clicks de autenticación/logout cuando la acción real dispara navegación.
- Versión visible interna actualizada a `v0.2.0-modular-rc37`.

### Corregido
- Caso rc37: password pegado no queda perdido ni filtra el secreto.
- Caso rc37: login/logout dejan evidencia de acción real y no solo `NAVIGATE` directo.

### Pendiente
- Validación e2e simulada con Codex/Playwright para login/password/submit/logout.
- Actualización completa del manual de usuario antes de firma Firefox 0.2.2.

### Compatibilidad
- No se modificó `manifest.json`.
- No se cambió versión firmada Firefox.
- No se agregaron dependencias nuevas.

## [2026-06-27] v0.2.0-modular-rc36

### Agregado
- `WAIT_FOR` automático y visible para el primer selector accionable después de `NAVIGATE`.
- Tests unitarios para navegación seguida de input/click, espera automática reemplazada por `WAIT_FOR`, no duplicación de `WAIT_FOR` y respeto de espera manual.

### Modificado
- `recording-normalizer` reemplaza esperas automáticas fijas entre `NAVIGATE` y la primera acción con selector por un `wait_for` estable.
- `content.js` replica la limpieza de guardado para que las macros grabadas queden listas para reproducir sin depender de delays fijos.
- Versión visible interna actualizada a `v0.2.0-modular-rc36`.

### Corregido
- Caso rc36: macros que empiezan con `NAVIGATE` y luego interactúan con un selector ya no arrancan la acción sin esperar a que el elemento exista/sea visible.
- Se mantiene el `WAIT_FOR` dinámico posterior a clicks que abren contenido demorado.

### Pendiente
- Validación e2e simulada con Playwright para flujo NAVIGATE -> contenido demorado -> primer selector.
- Captura de password pegado y submit/logout reales.
- Actualización completa del manual de usuario antes de firma Firefox 0.2.2.

### Compatibilidad
- No se modificó `manifest.json`.
- No se cambió versión firmada Firefox.
- No se agregaron dependencias nuevas.

## [2026-06-27] v0.2.0-modular-rc35

### Agregado
- Fallbacks estables centralizados para selectores.
- Soporte de reproducción con `controlRef.altSelectors` cuando el selector primario falla.
- Tests unitarios para selector Angular Material, inventario y fallback de reproducción.

### Modificado
- `selector-builder` ahora expone `buildStableFallbackSelectors`.
- `page-inventory` usa el selector builder compartido incluso en entorno Node/test.
- `content.js` evita generar `WAIT_FOR #mat-input-N` para IDs dinámicos Angular Material cuando existe selector estable.
- `content.js` adjunta `controlRef` con alternativas estables a pasos grabados cuando puede asociar el elemento.
- `element-finder` prueba fallbacks declarados antes de fallar.
- Versión visible interna actualizada a `v0.2.0-modular-rc35`.

### Corregido
- Caso rc35: selectores dinámicos Angular Material tipo `#mat-input-3` ya no se priorizan como espera automática si hay `placeholder` o `aria-label`.
- Mejora de robustez para macros con metadata `controlRef.altSelectors`.

### Pendiente
- Validación manual real en Santa Fe Trámites.
- WAIT_FOR inteligente posterior a acciones dinámicas.
- Captura de password pegado y submit/logout reales.
- Actualización completa del manual de usuario antes de firma Firefox 0.2.2.

### Compatibilidad
- No se modificó `manifest.json`.
- No se cambió versión firmada Firefox.
- No se agregaron dependencias nuevas.

## [2026-06-27] rc35 - validacion e2e Angular Material local

### Agregado
- Prueba e2e simulada con Playwright: `npm run test:e2e:angular-material`.
- Fixture local en `accesorios/pruebas/tests/e2e/angular-material-selectors/` que simula un campo Angular Material con `#mat-input-3` y segunda carga como `#mat-input-99`.

### Validado
- El selector estable `input[placeholder="Buscar Nro. de Expediente:"]` queda disponible para macro/controlRef.
- La reproduccion completa el input aunque el selector primario legacy `#mat-input-3` ya no exista.
- No usa internet, pagina real, login, credenciales ni datos reales.

## [2026-06-27] rc36 - validacion e2e WAIT_FOR tras NAVIGATE

### Agregado
- Prueba e2e simulada con Playwright: `npm run test:e2e:wait-for-navigate`.
- Fixture local en `accesorios/pruebas/tests/e2e/wait-for-after-navigate/` con input creado de forma demorada despues de cargar la pagina.

### Validado
- Una macro `NAVIGATE` + `TYPE` se normaliza como `NAVIGATE` -> `WAIT_FOR visible` -> `TYPE`.
- El `WAIT_FOR` usa `#busqueda-expediente` antes de escribir `EE-2026-00014539`.
- La reproduccion empieza antes de que exista el input y escribe solo despues de su creacion.
- No usa internet, pagina real, login, credenciales ni datos reales.
