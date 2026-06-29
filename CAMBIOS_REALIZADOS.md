# Cambios realizados

## Ajuste de manual para usuario final

Fecha: 2026-06-29

## Archivos modificados

- `src/help/help.html`
- `CHANGELOG.md`
- `CAMBIOS_REALIZADOS.md`

## Qué se cambió

- Se limpió el manual integrado para que sea útil a usuarios finales.
- Se quitaron instrucciones de instalación, firma, XPI, versiones internas, estado técnico, pruebas y respaldo del proyecto.
- Se dejó el manual enfocado en el uso diario de WebMatic:
  - inicio rápido;
  - pantalla principal;
  - grabar macro;
  - reproducir macro;
  - bucle;
  - editar y corregir;
  - datos sensibles;
  - esperas y páginas dinámicas;
  - exportar/importar macros;
  - buenas prácticas;
  - problemas frecuentes.

## Por qué se cambió

- El manual integrado dentro de la extensión debe servir a quien ya tiene WebMatic instalado.
- La instalación y distribución del XPI deben ir en un instructivo separado, no dentro de la ayuda diaria de la extensión.

## Cómo probar

1. Aplicar el parche.
2. Cargar WebMatic como extensión temporal o abrir la ayuda desde el repo.
3. Abrir el manual de ayuda.
4. Confirmar que no aparezcan textos técnicos como:
   - instalación del XPI;
   - firma Firefox;
   - estado de versión;
   - `rc38`;
   - instrucciones de desarrollo;
   - pruebas o backups del proyecto.
5. Confirmar que el manual explique claramente cómo usar WebMatic.

## Cómo revertir

- Restaurar los archivos desde el commit anterior o desde el backup del proyecto.
