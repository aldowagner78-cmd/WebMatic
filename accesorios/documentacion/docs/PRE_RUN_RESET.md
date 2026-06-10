# PRE_RUN_RESET

## Objetivo

Implementar un reset inicial automatico, robusto e idempotente antes del primer paso de reproduccion de una macro.

El reset usa un baseline capturado durante la grabacion y guardado en `meta.preRunReset`.

## Como funciona

1. Al iniciar la grabacion se captura un snapshot inicial de controles del formulario:
- `input`
- `textarea`
- `select`

2. Ese snapshot se guarda en:
- `macro.meta.preRunReset`

3. Al iniciar `Player.play()` con `startIndex === 0`, si existe `options.preRunReset`, el player aplica el restore antes de ejecutar el primer paso.

4. El restore es idempotente:
- Si un control ya esta en el valor esperado, no fuerza cambios.
- Si un control no existe, no aborta la macro.
- Si hay mismatch de tag/estructura, se omite y se continua.

## Esquema de datos

Ejemplo simplificado:

```json
{
  "meta": {
    "preRunReset": {
      "version": 1,
      "capturedAt": 1736271000000,
      "url": "https://ejemplo.local/form",
      "title": "Formulario",
      "controls": [
        {
          "selector": "#delegacion",
          "tag": "input",
          "type": "text",
          "value": "CAPITAL"
        },
        {
          "selector": "#acepta",
          "tag": "input",
          "type": "checkbox",
          "checked": true
        },
        {
          "selector": "#especialidad",
          "tag": "select",
          "type": "select-one",
          "value": "23",
          "selectedIndex": 4
        }
      ]
    }
  }
}
```

## Logs de diagnostico

Durante el restore se emiten logs en consola:

- `[WebMatic][preRunReset:start]`
- `[WebMatic][preRunReset:baselineLoaded]`
- `[WebMatic][preRunReset:currentScanned]`
- `[WebMatic][preRunReset:controlRestored]`
- `[WebMatic][preRunReset:controlSkipped]`
- `[WebMatic][preRunReset:controlMismatch]`
- `[WebMatic][preRunReset:done]`

## Compatibilidad hacia atras

- Macros sin `meta.preRunReset` siguen funcionando sin cambios.
- El fallback existente de `capture_defaults` (opt-in/autoCaptureDefaults) permanece intacto.
- El parser/exportador IIM mantiene round-trip via `WM_JSON`.

## Seguridad de datos

Se sanean campos sensibles en exportacion (`iim-adapter` y `macro-json`):

- En `meta.pageInventories[*].controls[*].currentValue`
- En `meta.preRunReset.controls[*].value`

Se consideran sensibles por tipo/heuristica:

- tipo `password`
- id/name/label relacionados con password, token, secret, pin, seguridad, etc.

## Desactivacion

El restore solo corre cuando `play()` recibe `options.preRunReset`.

Si un flujo necesita deshabilitarlo, debe omitir ese option en la llamada al player.

## Limitaciones actuales

- Si un selector cambia entre grabacion y reproduccion, el control queda en `controlMismatch`.
- Shadow DOM/iframes cross-origin dependen de la capacidad de resolucion del selector actual del player.
- El baseline captura controles editables; no intenta restaurar widgets fuera de esa clase si no exponen un input/select/textarea estable.
