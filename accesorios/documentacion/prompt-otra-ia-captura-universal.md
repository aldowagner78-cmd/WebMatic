# Prompt para otra IA: Captura universal de campos censables (prioridad autocompletes)

## 1) Contexto real y problema
Estoy desarrollando una extensión de automatización web. Necesito que el capturador de metadatos detecte y cense correctamente los campos útiles para edición/reproducción de macros, con prioridad en campos de autocompletado.

El problema actual es que la lógica falla en algunos casos: a veces no captura autocompletes clave (por ejemplo Delegación), o captura campos que explícitamente deberían excluirse.

No quiero una solución puntual para una sola subpágina. Quiero una solución universal que funcione en cualquier web, incluyendo GeneXus/IAPOS y también otras plataformas.

## 2) Lista exacta acordada para la subpágina de referencia (IAPOS auditoría médica)
Esta lista es la verdad funcional para validar comportamiento:

Campos que SI deben censarse:
1. Ver
2. Tipo Autorización
3. Estado
4. Cobertura
5. Tiene archivo adjunto
6. Modalidad
7. Delegación (autocomplete)
8. Especialidad (autocomplete)
9. Ver Bajas (checkbox)
10. Requiere Compra (checkbox)

Campos que NO deben censarse:
1. N° de Autorización
2. Ord. Int.
3. N° Afiliado
4. Nombre y Apellido
5. Entidad Efect. / Razón Social
6. Matrícula
7. Razón Social (médico efector)
8. Buscar
9. Rol
10. Campos técnicos de paginación, grilla o estado interno

Importante: en esta página, si hay conflicto, se prioriza capturar Delegación y Especialidad.

## 3) Objetivo universal (no hardcode frágil)
Diseñar una clasificación universal por tipo de campo y evidencia funcional:

A. Siempre incluir:
1. Select nativo con opciones reales
2. Checkbox y radio
3. Autocompletes detectados por evidencia real

B. Excluir por defecto:
1. Inputs ocultos
2. Botones submit/reset/image/file/password
3. Campos técnicos de grilla/paginación/search interno
4. Campos de texto libre sin evidencia de catálogo

C. Prioridad máxima:
1. Campos con evidencia de autocomplete/catálogo, aunque no sean select nativo
2. Si un campo tiene perfil conocido o firma de catálogo, debe entrar

## 4) Requisitos técnicos de detección de autocomplete (universales)
No depender solo de etiquetas visibles. Combinar señales:

1. Señales de DOM:
- datalist asociado
- aria-autocomplete
- role combobox/listbox
- atributos data- o clases típicas de select inteligente
- inputs con companion hidden o estructuras espejo

2. Señales de runtime:
- al escribir término mínimo, aparecen opciones en popup/listado
- existe respuesta de red con lista de opciones
- existe parseo de payload con pares código-texto

3. Señales de perfil conocido:
- mapa de perfiles por selector/id/name (cuando exista)
- si coincide perfil conocido, se fuerza inclusión

4. Señales negativas:
- texto libre puro sin evidencia de catálogo
- campos derivados masivos (ejemplo nombre que se completa desde DNI) si no aportan catálogo útil

## 5) Pipeline deseado
Implementar pipeline en dos etapas:

Etapa 1: Clasificación
1. Recolectar todos los controles visibles del formulario principal
2. Clasificar por tipo: select, check/radio, autocomplete, texto libre, técnico
3. Aplicar reglas de exclusión
4. Generar lista final censable y lista excluida con motivo

Etapa 2: Captura
1. Capturar selects directos del DOM
2. Capturar estado default de checkboxes/radios
3. Capturar autocompletes con estrategia escalonada:
- perfil conocido primero
- luego método adaptativo genérico
4. Guardar defaults para restauración silenciosa en playback

## 6) Requisitos UX
1. Mostrar resumen limpio de cantidad de campos censados por tipo
2. Permitir opcionalmente ver detalle de incluidos/excluidos con motivo
3. No mostrar pasos internos de captura durante grabación/reproducción
4. Mantener proceso silencioso para usuario final

## 7) Restricciones de calidad
1. No romper flujos existentes de grabación/reproducción
2. No perder macros existentes al importar backups
3. Mantener compatibilidad con perfiles anteriores
4. Evitar hardcode excesivo por página; usar reglas universales con posibilidad de perfiles específicos

## 8) Criterios de aceptación
La solución se considera correcta si cumple todo esto:

1. En IAPOS auditoría médica captura exactamente la lista de SI y excluye la lista de NO
2. Siempre incluye Delegación y Especialidad cuando existen como autocompletes
3. En páginas nuevas, detecta y prioriza autocompletes reales aunque no haya perfil previo
4. No censa campos técnicos o de búsqueda no deseados
5. Mantiene restauración de defaults antes de playback
6. Pasa pruebas unitarias existentes y agrega pruebas nuevas de clasificación y exclusión

## 9) Entregables solicitados a la otra IA
1. Diseño de algoritmo de clasificación universal
2. Cambios de código concretos por módulos
3. Pruebas unitarias nuevas y cobertura de regresión
4. Resumen de riesgos y mitigaciones
5. Plan de fallback cuando no se puede confirmar autocomplete

## 10) Instrucción final para la otra IA
No resuelvas esto con un parche frágil para una sola URL. Construye un clasificador universal basado en evidencia de campo y conserva una capa de perfiles específicos solo como acelerador, no como dependencia única.