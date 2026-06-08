# Firefox Dev Storage and Backup Report

Fecha: 2026-06-07
Repositorio: WebMatic

## Flujo correcto para pruebas en Firefox

1. No usar Remove/Eliminar en about:debugging para probar cambios, porque puede perder storage local de la extensión temporal.
2. Usar Reload/Recargar en about:debugging#/runtime/this-firefox para mantener datos y probar cambios de código.
3. Exportar backup completo antes de pruebas importantes.
4. Si se pierde storage, importar backup completo para restaurar macros y configuración.

## Ruta de carga temporal

C:\Users\usuario\Desktop\WebMatic-git\manifest.json

## Recomendación operativa

- Antes de cada bloque de pruebas: exportar webmatic-full-backup-v1.json.
- Después de cambios: recargar extensión, no eliminar.
- Si algo se resetea: importar backup completo y validar estado (macros + tema/configuración).
