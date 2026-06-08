# Full Backup Persistence Final Report

Fecha: 2026-06-07
Repositorio: WebMatic
Rama: master

## 1) Archivos modificados

- manifest.json
- src/content/content.js
- src/modules/storage/full-backup.js
- tests/unit/full-backup.test.js
- docs/reports/firefox-dev-storage-and-backup-report.md

## 2) Qué se revirtió

Se revirtieron cambios experimentales no confirmados relacionados con autocomplete/defaults/recorder/player/editor/tests para volver a estado base de master remoto.

Archivos revertidos:
- src/content/content.js (partes experimentales previas)
- src/modules/editor/step-editor.js
- src/modules/inventory/page-inventory.js
- src/modules/player/player.js
- src/modules/ui/ui-shell.js
- tests/e2e/firefox-extension-safe/run.js
- tests/unit/player.test.js
- tests/unit/step-editor-inventory.test.js
- tests/unit/step-editor.test.js
- tests/unit/ui-shell.test.js (eliminado)

## 3) Qué se implementó

- Backup completo versionado en formato webmatic-full-backup-v1.json.
- Incluye:
  - macros
  - settings
  - ui
  - metadata
- Importación/restauración completa:
  - valida JSON
  - detecta formato completo v1
  - pide confirmación antes de reemplazar macros/settings
  - restaura macros y settings
  - restaura claves de metadata de storage cuando existen
- Compatibilidad con backup viejo (solo macros):
  - sigue importando
  - mantiene lógica de merge para no romper flujo anterior

## 4) Claves de storage detectadas

- webmaticMacros
- webmaticSettings
- webmaticExportFolder
- webmaticHelpTheme

## 5) Backup actual conserva

- macros: sí
- steps: sí
- script: sí
- metadata de macro: sí (si viene dentro de macros)
- settings: sí
- tema/color: sí (en settings)
- preferencias UI: sí (panelSide/panelWidth y datos de ui en backup)

## 6) Tests ejecutados

- npm test: PASS (160/160)
- npm run test:e2e: PASS
- npm run test:e2e:firefox-extension: PASS
- IAPOS_E2E_REAL no habilitado

## 7) Estado final de Git

Resultado final de git status --short:
- M manifest.json
- M src/content/content.js
- ?? src/modules/storage/full-backup.js
- ?? tests/unit/full-backup.test.js
- ?? docs/reports/firefox-dev-storage-and-backup-report.md
- (además quedaron reportes locales previos sin trackear)

## 8) ¿Listo para commit?

Sí, técnicamente listo para commit cuando valides manualmente el flujo de backup/restauración en Firefox.

## 9) Qué probar manualmente

1. Exportar backup desde botón de backup.
2. Verificar nombre de archivo: webmatic-full-backup-v1.json.
3. Cambiar tema/configuración y editar macros.
4. Importar backup completo.
5. Confirmar que se restauran macros + tema/configuración.
6. Probar import de backup viejo (solo macros) y verificar merge.
