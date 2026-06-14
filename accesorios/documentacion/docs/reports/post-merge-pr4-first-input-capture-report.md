# Post-merge PR #4 - First input capture

## Estado

PR #4 mergeado a master.

## Validacion

| Comando | Resultado |
|---|---|
| npm test | OK |
| npm run verify:v2:firefox:fast | OK |
| npm run verify:v2:firefox:full | OK |

## Confirmacion funcional

- El primer input editado tras iniciar grabación queda capturado.
- Ediciones posteriores del mismo selector no borran la primera.
- WM_JSON y preRunReset siguen presentes.
- Flujo A -> B -> A sigue funcionando.

## Paquete generado

- Carpeta: dist/manual-testindex-suite-d4fbf4b
- ZIP: dist/manual-testindex-suite-d4fbf4b.zip

## NO ejecutado

- IAPOS real.
- Release.
