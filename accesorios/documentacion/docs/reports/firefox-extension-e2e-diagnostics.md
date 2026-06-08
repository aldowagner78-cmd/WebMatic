# Diagnóstico E2E Firefox-first de extensión WebMatic

## 1. Objetivo

Redefinir la validación E2E de extensión como Firefox-first, sin usar Chromium como validación final.

Restricciones respetadas:

- No se abrió IAPOS real.
- No se habilitó IAPOS_E2E_REAL=1.
- No se agregaron servicios externos ni dependencias pagas.
- No se cambiaron funciones de producto (recorder/player/editor).

## 2. Por qué Chromium no sirve como validación final

- Chromium se usó para diagnóstico técnico de carga/inyección.
- Ese resultado no certifica compatibilidad objetivo del producto, que es Firefox real.
- Por política de validación de esta etapa, el criterio final se traslada a Firefox real.

## 3. Estrategia elegida para Firefox

Estrategia implementada:

- Runner nuevo Firefox-first: [tests/e2e/firefox-extension-safe/run.js](tests/e2e/firefox-extension-safe/run.js)
- Script npm: test:e2e:firefox-extension en [package.json](package.json)
- Motor de automatización: geckodriver (Marionette/WebDriver HTTP) + Firefox real.
- Carga de extensión: instalación temporal del XPI en sesión Firefox.
- Entorno de prueba: fixture local seguro [tests/fixtures/iapos-safe-page.html](tests/fixtures/iapos-safe-page.html)

## 4. Herramientas detectadas en el entorno

Detectadas:

- Firefox: sí (Mozilla Firefox 151.0.3)
- geckodriver: sí (0.36.0)
- zip: sí

No detectadas:

- web-ext: no
- selenium-webdriver (Node): no
- selenium (Python): no

## 5. Qué se probó

- web-ext run: no se pudo probar porque web-ext no está instalado.
- Perfil temporal Firefox: sí, se usó sesión temporal de geckodriver.
- Selenium/geckodriver: se probó geckodriver directamente (sin librería Selenium).
- Marionette: sí, vía endpoints WebDriver de geckodriver.

## 6. Resultado de ejecución de tests

### 6.1 npm test

Resultado: PASS (117/117).

### 6.2 npm run test:e2e

Resultado: PASS (fixture local seguro, IAPOS real omitido).

### 6.3 npm run test:e2e:firefox-extension

Resultado: PASS.

Evidencia relevante de logs:

- Extensión temporal instalada en Firefox.
- Inyección detectada: hasStyleLink=sí.
- Panel detectado: hasPanelRoot=sí.
- Sin uso de IAPOS real.

## 7. Evidencia de carga de extensión

Evidencia positiva:

- Sesión Firefox iniciada por geckodriver.
- Instalación temporal de add-on ejecutada correctamente.
- Marcadores DOM de WebMatic presentes en fixture local:
  - #webmatic-style-link
  - #webmatic-panel-root

## 8. Limitaciones actuales

- web-ext no está disponible en este host.
- El runner actual valida inyección/presencia de panel en fixture local seguro; no ejecuta flujos sobre IAPOS real (intencional por política read-only de esta etapa).

## 9. Comando manual reproducible (si faltara automatización)

No fue necesario fallback manual en este entorno porque el runner Firefox funcionó.

Referencia manual equivalente, si se quisiera revalidar:

- npm run test:e2e:firefox-extension

## 10. Próximo paso recomendado

1. Mantener Firefox-first como criterio final de extensión.
2. Dejar Chromium solo para diagnóstico adicional.
3. Extender gradualmente validaciones Firefox sobre más fixtures seguros, sin abrir IAPOS real.
