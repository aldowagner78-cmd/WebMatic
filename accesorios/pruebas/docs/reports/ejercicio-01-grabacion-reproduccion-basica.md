# Ejercicio 01 - Grabacion y reproduccion basica

Objetivo: validar flujo minimo de punta a punta (grabar, guardar, reproducir, editar y volver a reproducir).

## Preparacion
1. Abrir la pagina de prueba: `accesorios/pruebas/test-page/index.html`.
2. Abrir panel WebMatic.

## Pasos
1. Pulsar Grabar.
2. Hacer clic en un input de texto.
3. Escribir `PRUEBA-01`.
4. Hacer clic en un checkbox para activarlo.
5. Hacer clic en un boton o enlace visible.
6. Detener grabacion.
7. Guardar macro como `TEST-01-BASICO`.
8. Abrir editor de script de la macro.
9. Ir a pestana Script IIM y copiar el script completo.
10. Reproducir la macro una vez.
11. Volver al editor visual y cambiar el valor `PRUEBA-01` por `PRUEBA-01-EDIT`.
12. Guardar y reproducir nuevamente.

## Criterio de exito
1. No queda en estado "Iniciando".
2. La macro termina sin error.
3. El valor editado se aplica en la segunda corrida.
4. Al alternar Visual <-> Script IIM no desaparecen pasos.

## Plantilla de reporte (copiar y completar)
Estado: OK o FALLO

Paso exacto donde falla:
- (ejemplo: paso 10, al reproducir)

Esperado:
- (que debia pasar)

Observado:
- (que paso realmente)

Script IIM usado:
- (pegar script completo)

Consola del navegador (F12):
- (pegar errores rojos y warnings relevantes)

Evidencia visual:
- Captura 1: editor donde se ve el problema
- Captura 2: resultado final tras reproducir
