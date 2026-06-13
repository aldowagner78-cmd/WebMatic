# H-08 Dynamic Selectors Hardening Plan

## Objetivo

Aumentar robustez de replay frente a selectores dinámicos sin romper macros estables existentes.

## Alcance técnico

- Resolver variaciones de `id` dinámico por sesión.
- Resolver `name` duplicado en formularios complejos.
- Validar interacción en `iframe` mismo origen y (solo detección) `cross-origin`.
- Validar shadow DOM abierto (y degradación explícita en shadow cerrado).
- Validar DOM mutante post-click (re-render / detach-attach).

## Fixtures requeridos

1. `dynamic-id-fixture.html`
- Controles con `id` regenerado por recarga (`#user-<rand>`).
- `data-testid` estable como fallback.

2. `duplicate-name-fixture.html`
- Múltiples inputs con mismo `name` y distinto contexto visual.
- Labels ambiguos y no ambiguos.

3. `iframe-selectors-fixture.html`
- `iframe` same-origin con formulario interno.
- `iframe` cross-origin para confirmar limitación controlada.

4. `shadow-dom-fixture.html`
- Componente con shadow open y controles internos.
- Componente con shadow closed para validar `NO VERIFICADO`/degradación.

5. `mutating-dom-fixture.html`
- Click que reemplaza nodo objetivo y conserva intención funcional.
- Flujo con carga incremental y stale element.

## Tests a crear

1. `player-dynamic-selectors.test.js`
- Reintento con selector alternativo estable (`data-testid`/role/label).
- Persistencia de diagnóstico cuando selector primario falla.

2. `e2e/fixtures-dynamic-selectors/run.js`
- Grabar y reproducir en cada fixture.
- Verificar que la acción esperada ocurre y que no se dispara acción peligrosa.

3. `step-editor-dynamic-selectors.test.js`
- Verificar que el editor prioriza selector estable cuando detecta candidatos múltiples.

## Estrategia de resolución de selectores

Orden propuesto de matching (sin reemplazar abruptamente macros legacy):

1. selector original exacto
2. selector alternativo persistido (si existe)
3. `data-testid` / `aria-label` / `role`
4. correlación por label + tipo de control
5. fallback por inventario de página (si hay evidencia fuerte)

## Criterios de aceptación

1. Todos los nuevos tests unitarios y e2e pasan en local.
2. No se incrementan falsos positivos en `safeClick`.
3. El replay mantiene compatibilidad con macros existentes.
4. Los casos cross-origin y shadow closed quedan documentados como limitación explícita.
5. `verify:v2:firefox:full` sigue verde.

## Riesgos

1. Sobreajuste de heurísticas y clicks en objetivo incorrecto.
2. Coste de performance por intentos múltiples de resolución.
3. Regresión en sitios legacy con DOM no semántico.

## Estado

Preparado para implementación incremental por lotes (unit -> fixtures -> e2e full).