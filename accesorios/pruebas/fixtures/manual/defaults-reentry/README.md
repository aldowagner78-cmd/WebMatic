# Fixture de reproducción manual — auto-defaults recording/export

## Pasos para reproducir el bug original y verificar la corrección

### Setup

1. Abrir `pagina-a.html` en Firefox con la extensión WebMatic cargada.
2. Asegurarse de estar en la página correcta (Página A).

### Grabación

1. Iniciar grabación (botón flotante de WebMatic).
2. En Página A: editar el campo `#afiliado` (cambiar "123456" por otro valor, o dejarlo).
3. Cambiar el `#estado` a "Autorizado".
4. Marcar el checkbox `#urgente`.
5. Hacer click en "Ir a Página B" (navegar a pagina-b.html).
6. En Página B: escribir algo en `#observacion`.
7. Seleccionar un valor en `#motivo` (ej. "Auditoría").
8. Hacer click en "Volver a Página A".
9. En Página A (segunda visita): cambiar `#afiliado` de nuevo, y/o cambiar `#estado` a "Observado".
10. Detener grabación.

### Verificación post-bug-fix

El editor de script debe abrirse. Verificar:

#### Tab "Script" (txt de IIM) → Botón Copiar

1. Hacer click en el tab "Script".
2. Observar que el textarea muestra el IIM legible (sin `// WM_JSON:`).
3. Hacer click en "Copiar".
4. Pegar en un editor de texto.
5. **Verificar que el texto pegado contiene `// WM_JSON:`** ← esto estaba roto antes del fix.
6. Verificar que el WM_JSON incluye `meta.preRunReset` con los controles del formulario A.

#### Tab "Visual" → Botón Copiar

1. Volver al tab "Visual".
2. Hacer click en "Copiar".
3. Pegar en editor de texto.
4. Verificar que el texto contiene `// WM_JSON:` con `meta.preRunReset`.

### Qué NO verificar aquí

- No abrir IAPOS real.
- No ingresar credenciales reales.
- Los fixtures son completamente locales y no realizan acciones destructivas.

### Valores esperados en WM_JSON

```json
{
  "meta": {
    "preRunReset": {
      "version": 1,
      "url": "file:///...pagina-a.html",
      "controls": [
        { "selector": "#afiliado", "value": "123456" },
        { "selector": "#estado", "value": "pendiente" },
        { "selector": "#urgente", "checked": false }
      ]
    }
  }
}
```

Los valores exactos dependen del estado inicial de los campos al iniciar la grabación.
Los campos sensibles (password, token, etc.) no aparecen con valor en el WM_JSON.
