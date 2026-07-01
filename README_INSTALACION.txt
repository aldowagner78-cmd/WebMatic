# Instalación y uso — WebMatic Firefox 0.2.2

## Requisitos

Para usuario final:

- Firefox instalado.
- Archivo firmado `WebMatic-Firefox-0.2.2-FIRMADO.xpi` o `041d0daa5df241fd8ad8-0.2.2.xpi`.

Para desarrollo:

- Windows con PowerShell o Linux con terminal.
- Node.js instalado.
- Proyecto en:
  - Windows: `C:\Users\usuario\Desktop\WebMatic-dev\repo-modular`
  - Linux: `~/Escritorio/WebMatic-dev/repo-modular`

## Instalación en Firefox

Ruta del XPI recomendado:

```text
C:\Users\usuario\Desktop\WebMatic-dev\backups\WebMatic-Firefox-0.2.2-FIRMADO.xpi
```

Pasos:

1. Abrir Firefox.
2. Ir a `about:addons`.
3. Abrir el menú de engranaje.
4. Elegir `Instalar complemento desde archivo...`.
5. Seleccionar el archivo `.xpi`.
6. Confirmar la instalación.

Resultado esperado:

- WebMatic aparece como extensión instalada.
- La extensión funciona sin cargarla temporalmente.
- La interfaz muestra la versión funcional `v0.2.0-modular-rc38`.

## Carga temporal para desarrollo

Ruta:

```text
C:\Users\usuario\Desktop\WebMatic-dev\repo-modular
```

Pasos:

1. Abrir Firefox.
2. Ir a `about:debugging#/runtime/this-firefox`.
3. Elegir `Load Temporary Add-on...`.
4. Seleccionar `manifest.json`.

Resultado esperado:

- WebMatic carga en modo temporal.
- Se puede probar sin reinstalar el XPI firmado.

## Uso básico

1. Abrir la página web que se quiere automatizar.
2. Abrir WebMatic desde el icono de la extensión.
3. Pulsar **Grabar**.
4. Hacer las acciones reales en la página.
5. Pulsar **Detener**.
6. Guardar la macro con un nombre claro.
7. Reproducirla desde la lista de macros.

Durante la grabación, WebMatic muestra feedback visual:
- si la página no navega, resalta brevemente el elemento;
- si la acción navega de inmediato, muestra un aviso corto en la página siguiente para confirmar que el evento fue registrado.

## Bucle

Para repetir una macro:

1. Seleccionar una macro.
2. Elegir cantidad de repeticiones.
3. Pulsar **▶▶ Bucle**.

La versión `0.2.2` conserva el bucle aunque la macro use `NAVIGATE`.

## Datos sensibles

WebMatic evita guardar valores reales de campos sensibles.

Se tratan como sensibles:

- Password.
- PIN.
- Token.
- CVV.
- Campos similares detectados por tipo, nombre, etiqueta o contexto.

En el script se representan como `SENSITIVE_INPUT` o contenido redactado.

## Exportar/importar macros

Para mover macros entre computadoras:

1. En WebMatic, abrir configuración/exportación.
2. Usar backup completo o exportar macros.
3. Copiar el archivo generado a la otra PC.
4. Instalar WebMatic.
5. Importar el backup.

Recomendación: hacer backup antes de desinstalar Firefox, borrar perfiles o limpiar datos del navegador.

## Modo demo

Este proyecto no usa base de datos propia ni datos reales incluidos.

Para probar sin datos reales se recomienda usar páginas públicas o fixtures locales de prueba. Los e2e simulados del repo cubren:

```powershell
npm run test:e2e:angular-material
npm run test:e2e:wait-for-navigate
npm run test:e2e:loop-navigate
```

## Pruebas

Ruta Windows:

```powershell
cd C:\Users\usuario\Desktop\WebMatic-dev\repo-modular
```

Pruebas completas:

```powershell
npm test
```

E2E simulados principales:

```powershell
npm run test:e2e:angular-material
npm run test:e2e:wait-for-navigate
npm run test:e2e:loop-navigate
```

Resultado esperado:

```text
fail 0
```

## Empaquetar / firmar Firefox

La versión firmada actual es `0.2.2`.

Para una futura firma:

1. Actualizar `manifest.json` a una versión nueva.
2. Crear carpeta limpia en `dist`.
3. Ejecutar `web-ext lint`.
4. Firmar con `web-ext sign --channel unlisted`.

No incluir en la firma:

```text
node_modules
.git
dist anteriores
web-ext-artifacts anteriores
accesorios
docs
chromium
```

## Problemas frecuentes

### El XPI no se instala

Verificar que sea el archivo firmado `.xpi`, no un `.zip`.

### La macro falla después de navegar

Actualizar a Firefox `0.2.2` o superior. Esta versión corrige reanudación con navegación y bucle.

### Un campo Angular Material cambia de ID

WebMatic prioriza selectores estables como `placeholder`, `aria-label`, `label` o fallbacks de `controlRef.altSelectors`.

### El password no aparece en la macro

Es correcto. Los campos sensibles se redactan para evitar guardar datos reales.

### El bucle solo ejecuta una vez

Verificar que esté instalada la versión `0.2.2`. Versiones anteriores podían perder el estado del bucle al navegar.

## ZIP / backup

Backup estable recomendado:

```text
C:\Users\usuario\Desktop\WebMatic-dev\backups\WebMatic-Firefox-0.2.2-FIRMADO.xpi
C:\Users\usuario\Desktop\WebMatic-dev\backups\WebMatic-v0.2.2-firefox.bundle
```

## Nota rc40B-3 — prueba de grabación GeneXus/IAPOS

Para validar este parche antes de firmar:

1. Cargar la extensión temporal desde `repo-modular/manifest.json`.
2. Grabar en IAPOS desde el listado `auauditcabe_ww?M,0`.
3. Verificar que el indicador rojo aparezca al registrar eventos reales.
4. Verificar que la selección de motivo se grabe como `CHOOSE_OPTION #vERROR` y no como click directo sobre `#vERROR option:nth-of-type(...)`.
5. No firmar una nueva versión hasta que la prueba real pase sin editar la macro a mano.



Nota rc40B-4:
Para validar el grabador GeneXus/IAPOS, cargar la extensión temporal desde `repo-modular\manifest.json`, grabar una macro nueva y verificar que el flash rojo desaparezca solo y que la macro contenga `WAIT_FOR #vAUTORIZAR_0001` antes de `CLICK #vAUTORIZAR_0001`, y `WAIT_FOR #vERROR` antes de `CHOOSE_OPTION #vERROR`.


## Nota técnica rc40B-6

Para pruebas de desarrollo en GeneXus/IAPOS, el feedback visual del grabador debe comportarse igual que el resaltado del reproductor: aparecer como flash temporal y limpiarse solo, incluso cuando el click produce navegación inmediata.

Verificación mínima:

```powershell
node -c src/content/content.js
node --test accesorios/pruebas/tests/unit/content-background-flow.test.js
```


Nota rc40B-7:
- El resaltado visual del grabador/reproductor es temporal y no debe quedar guardado como selector de macro.
- Al revisar macros nuevas, `controlRef.altSelectors` no debe contener selectores internos como `[data-wm-hl="1"]`.

