# Ejercicio 02 - Script IIM Corregido

Copia y pega el siguiente bloque completo en el editor Script IIM:

```iim
VERSION BUILD=1000
TAB T=1
NAVIGATE URL="file:///C:/Users/usuario/Desktop/WebMatic-git/accesorios/pruebas/test-page/index.html#formulario"
WAIT SECONDS=1
// WAIT_FOR SELECTOR="#nombre" TIMEOUT=10000
TYPE SELECTOR="#nombre" CONTENT="Mario"
TYPE SELECTOR="#apellido" CONTENT="Test"
TYPE SELECTOR="#email" CONTENT="mario.test@ejemplo.com"
TYPE SELECTOR="#telefono" CONTENT="+54 9 342 1111111"
TYPE SELECTOR="#edad" CONTENT="31"
CHOOSE_OPTION SELECTOR="#pais" VALUE="AR"
CHOOSE_OPTION SELECTOR="#provincia" VALUE="SF"
CHOOSE_OPTION SELECTOR="#profesion" VALUE="docente"
TYPE SELECTOR="#notas" CONTENT="Ejercicio-02-controlado"
CHECK SELECTOR="#chk-educacion" CHECKED="true"
CHECK SELECTOR="#chk-terminos" CHECKED="true"
CLICK SELECTOR="#btn-enviar"
WAIT SECONDS=1

NAVIGATE URL="file:///C:/Users/usuario/Desktop/WebMatic-git/accesorios/pruebas/test-page/index.html#dinamico"
WAIT SECONDS=1
CLICK SELECTOR="#btn-delay"
// WAIT_FOR SELECTOR="#dyn-input" TIMEOUT=10000
TYPE SELECTOR="#dyn-input" CONTENT="DYN-OK-02"
CLICK SELECTOR="#btn-dyn-confirm"
CLICK SELECTOR="#btn-increment"
CLICK SELECTOR="#btn-increment"
CLICK SELECTOR="#btn-reset-counter"

NAVIGATE URL="file:///C:/Users/usuario/Desktop/WebMatic-git/accesorios/pruebas/test-page/index.html#interactivo"
WAIT SECONDS=1
// DBLCLICK SELECTOR="#dbl-card-2"
// HOVER SELECTOR="#hover-medicamento"

NAVIGATE URL="file:///C:/Users/usuario/Desktop/WebMatic-git/accesorios/pruebas/test-page/index.html#drag"
WAIT SECONDS=1
// DRAG_DROP FROM="#drag-2" TO="#zone-b"

NAVIGATE URL="file:///C:/Users/usuario/Desktop/WebMatic-git/accesorios/pruebas/test-page/index.html#tabs"
WAIT SECONDS=1
TYPE SELECTOR="#t1-dni" CONTENT="30111222"
TYPE SELECTOR="#t1-cuil" CONTENT="20-30111222-3"
TYPE SELECTOR="#t1-nombre" CONTENT="Test, Mario"
CLICK SELECTOR="button[text=\"Siguiente →\"]"
TYPE SELECTOR="#t2-calle" CONTENT="San Martin"
TYPE SELECTOR="#t2-numero" CONTENT="1234"
TYPE SELECTOR="#t2-ciudad" CONTENT="Santa Fe"
TYPE SELECTOR="#t2-cp" CONTENT="3000"
CLICK SELECTOR="button[text=\"Siguiente →\"]"
CHOOSE_OPTION SELECTOR="#t3-os" VALUE="iapos"
TYPE SELECTOR="#t3-nro" CONTENT="0089-0001-00234567/00"
TYPE SELECTOR="#t3-plan" CONTENT="Plan A"
TYPE SELECTOR="#t3-venc" CONTENT="2027-01-31"
CLICK SELECTOR="button[text=\"✓ Guardar ficha\"]"

NAVIGATE URL="file:///C:/Users/usuario/Desktop/WebMatic-git/accesorios/pruebas/test-page/index.html#modal"
WAIT SECONDS=1
CLICK SELECTOR="#btn-modal-delay"
WAIT SECONDS=2
TYPE SELECTOR="#modal-motivo" CONTENT="Ejercicio-02-modal"
CLICK SELECTOR="#btn-modal-confirmar"
WAIT SECONDS=1
```
