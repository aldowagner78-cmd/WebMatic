# Manual IAPOS test ready report - WebMatic

## Estado

Master preparado para prueba manual.

## Validacion local

| Comando | Resultado |
|---|---|
| npm test | OK |
| npm run verify:v2:firefox:fast | OK |
| npm run verify:v2:firefox:full | OK |

## CI remoto master

OK

- RUN_ID: 27511031724
- Workflow: Firefox Release Gate
- URL: https://github.com/aldowagner78-cmd/WebMatic/actions/runs/27511031724

## Paquete generado

- Carpeta preparada: dist/manual-iapos-test-89f7234
- ZIP preparado: dist/manual-iapos-test-89f7234.zip

## Como cargar en Firefox

1. Abrir about:debugging.
2. Ir a "Este Firefox".
3. Cargar complemento temporal.
4. Seleccionar manifest.json de la carpeta preparada, o instalar/cargar el ZIP si aplica segun Firefox.
5. Confirmar que WebMatic aparece activo.

## Prueba manual recomendada antes de IAPOS

1. Repetir fixture local pagina-a.html.
2. Confirmar // WM_JSON:.
3. Confirmar meta.preRunReset.
4. Confirmar bloques A -> B -> A con reingreso.
5. Recien despues abrir IAPOS manualmente.

## Reglas para IAPOS manual

- No autorizar.
- No rechazar.
- No guardar.
- No enviar formularios.
- No modificar datos reales.
- No ejecutar reproduccion destructiva.
- Primero solo grabar/navegar/capturar/exportar.
- Si aparece duda, detenerse.

## NO ejecutado

- IAPOS real automatizado.
- Release/tag.
