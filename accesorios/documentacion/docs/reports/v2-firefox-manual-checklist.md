# V2 Firefox Manual Checklist

Objetivo: validar comportamiento funcional y UX antes de publicar.

## 1) Carga temporal en Firefox

1. Abrir about:debugging#/runtime/this-firefox
2. Click en Load Temporary Add-on
3. Seleccionar manifest.json del repo

## 2) UX de modos (panel)

1. Abrir panel WebMatic
2. Click en Reproducir y verificar estado visual activo claro del botón
3. Click en Configurar y verificar estado visual activo claro del botón
4. Cambiar entre Reproducir/Configurar/Grabar y verificar que el activo siempre se distingue

## 3) Tema y swatches

1. Ir a Configurar
2. Verificar que los 4 círculos de tema se ven con color
3. Verificar que los swatches NO tengan borde por defecto
4. Seleccionar cada color y verificar que solo el seleccionado muestra borde
5. Activar/desactivar modo oscuro y repetir validación de swatches

## 4) Flujo funcional principal

1. Grabar macro simple con select/input/click
2. Detener grabación y abrir editor visual
3. Confirmar dropdown VALUE cuando corresponde
4. Guardar macro
5. Reproducir macro y confirmar resultado esperado en página

## 5) Persistencia

1. Guardar cambios de configuración
2. Cerrar y reabrir panel
3. Confirmar que tema/posición/ajustes se mantienen
4. Exportar e importar macro JSON de prueba

## 6) Criterio de pase para publicar

- verify:v2:firefox:full en verde
- Checklist manual completa en verde
- Sin regresiones visibles en panel, edición y reproducción
