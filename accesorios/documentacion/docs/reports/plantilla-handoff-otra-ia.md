# Plantilla fija para pasar a otra IA (WebMatic)

Instruccion de uso:
- Copiar y pegar este archivo completo en una sesion nueva de la otra IA.
- No agregar ni editar texto manual, salvo el bloque "Datos variables".

---

## Contexto del proyecto

- Repositorio: WebMatic
- Objetivo actual: cerrar caso real IAPOS/GeneXus con cambios minimos y costo-eficientes.
- Estado base: usar como referencia el handoff en docs/reports/handoff-ia-contexto-webmatic.md.

## Reglas obligatorias

1. No habilitar IAPOS_E2E_REAL.
2. No ejecutar acciones peligrosas.
3. No agregar features nuevas hasta cerrar el caso real.
4. Priorizar cambio minimo, localizado y reversible.
5. Diagnosticar con evidencia antes de proponer cambios.
6. Validar siempre con tests disponibles tras cada cambio.

## Forma de trabajo esperada

1. Diagnostico corto con evidencia concreta (archivo y causa).
2. Propuesta de fix minimo.
3. Implementacion localizada.
4. Validacion con tests.
5. Reporte final breve con:
- Archivos tocados.
- Que problema resolvio exactamente.
- Que NO cambio.
- Resultado de tests.

## Datos variables (completar solo si aplica)

- Caso que falla hoy:
- Selector exacto:
- Step IIM exacto:
- Captura del editor visual (VALUE):

## Entregable requerido a la IA

- Un unico reporte final breve y accionable.
- Si falta informacion, pedir solo el dato minimo indispensable.

---

## Prompt listo para pegar en otra IA

Trabaja sobre WebMatic con enfoque costo-eficiente y cambio minimo.

Reglas obligatorias:
1) No habilitar IAPOS_E2E_REAL.
2) No ejecutar acciones peligrosas.
3) No agregar features nuevas hasta cerrar el caso real.
4) Diagnosticar con evidencia antes de cambiar codigo.
5) Validar siempre con tests disponibles.

Forma de entrega:
- Diagnostico corto con causa exacta.
- Fix minimo y localizado.
- Lista de archivos tocados.
- Resultado de tests.
- Reporte final breve y accionable.

Usa como contexto base: docs/reports/handoff-ia-contexto-webmatic.md

Si vuelve a fallar manualmente, pedi solo:
1) Selector exacto,
2) Linea del step IIM,
3) Captura del paso en el editor (VALUE).
