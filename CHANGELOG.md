# Changelog

## [2026-06-27] v0.2.0-modular-rc35

### Agregado
- Fallbacks estables centralizados para selectores.
- Soporte de reproducción con `controlRef.altSelectors` cuando el selector primario falla.
- Tests unitarios para selector Angular Material, inventario y fallback de reproducción.

### Modificado
- `selector-builder` ahora expone `buildStableFallbackSelectors`.
- `page-inventory` usa el selector builder compartido incluso en entorno Node/test.
- `content.js` evita generar `WAIT_FOR #mat-input-N` para IDs dinámicos Angular Material cuando existe selector estable.
- `content.js` adjunta `controlRef` con alternativas estables a pasos grabados cuando puede asociar el elemento.
- `element-finder` prueba fallbacks declarados antes de fallar.
- Versión visible interna actualizada a `v0.2.0-modular-rc35`.

### Corregido
- Caso rc35: selectores dinámicos Angular Material tipo `#mat-input-3` ya no se priorizan como espera automática si hay `placeholder` o `aria-label`.
- Mejora de robustez para macros con metadata `controlRef.altSelectors`.

### Pendiente
- Validación manual real en Santa Fe Trámites.
- WAIT_FOR inteligente posterior a acciones dinámicas.
- Captura de password pegado y submit/logout reales.
- Actualización completa del manual de usuario antes de firma Firefox 0.2.2.

### Compatibilidad
- No se modificó `manifest.json`.
- No se cambió versión firmada Firefox.
- No se agregaron dependencias nuevas.
