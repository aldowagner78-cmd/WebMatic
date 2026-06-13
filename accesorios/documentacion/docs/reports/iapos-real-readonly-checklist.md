# IAPOS real read-only validation checklist

## 1. Objetivo

Validar WebMatic en entorno real IAPOS sin modificar datos.

## 2. Reglas de seguridad

- No autorizar.
- No rechazar.
- No guardar.
- No enviar formularios.
- No modificar datos reales.
- No loguear credenciales.
- No loguear datos sensibles.
- No ejecutar acciones destructivas.
- Detenerse ante cualquier duda.

## 3. Precondiciones

1. Rama hardening/h09-prerunreset-stress actualizada y validada localmente.
2. PR abierto y sin merge.
3. Confirmación explícita de ventana de prueba read-only.
4. Entorno IAPOS accesible con credenciales autorizadas por el responsable.

## 4. Variables de entorno requeridas

1. IAPOS_E2E_REAL=1 (solo con autorización explícita).
2. Credenciales y parámetros mínimos necesarios para login read-only.
3. Flags de ejecución en modo no destructivo según scripts disponibles.

## 5. Comandos permitidos

1. Comandos de verificación/diagnóstico read-only.
2. Ejecución de pruebas marcadas explícitamente como seguras.
3. Recolección de logs y evidencias sin datos sensibles.

## 6. Acciones prohibidas

1. Autorizar prestaciones.
2. Rechazar prestaciones.
3. Guardar cambios de formularios.
4. Enviar acciones de negocio con impacto persistente.
5. Exportar datos sensibles.

## 7. Evidencia a capturar

1. Comandos ejecutados y resultados.
2. Capturas/logs de flujo read-only.
3. Confirmación de ausencia de acciones destructivas.
4. Resumen de compatibilidad funcional observada.

## 8. Criterios de abortar

1. Duda sobre impacto de una acción.
2. Pantalla o flujo que implique operación transaccional.
3. Requerimiento de confirmar/guardar/autorizar/rechazar.
4. Exposición de dato sensible en salida.

## 9. Resultado esperado

1. Flujo real leído y recorrido sin modificaciones.
2. Evidencia de estabilidad básica en entorno real.
3. Cero acciones destructivas.

## 10. NO VERIFICADO

- NO VERIFICADO: ejecución real en esta ronda (no se ejecutó automáticamente).
