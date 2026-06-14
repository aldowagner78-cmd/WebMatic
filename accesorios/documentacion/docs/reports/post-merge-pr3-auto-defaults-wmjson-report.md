# Post-merge PR #3 - Auto-defaults + WM_JSON

## Estado

PR #3 mergeado a master.

## Validacion

| Comando | Resultado |
|---|---|
| npm test | OK |
| npm run verify:v2:firefox:fast | OK |
| npm run verify:v2:firefox:full | OK |

## Confirmacion funcional

- El copiado desde tab Script usa el script completo con `// WM_JSON:`.
- `meta.preRunReset` se conserva.
- Sensibles siguen sanitizados.

## NO ejecutado

- IAPOS real.
- Release.
