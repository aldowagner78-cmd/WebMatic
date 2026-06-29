# WebMatic rc39 - Arquitectura de motor universal

## Estado y alcance

- Base declarada: Firefox `0.2.3` firmado, manual actualizado, rama `modularizacion-base`.
- Objetivo de este documento: definir la arquitectura rc39 para maxima universalidad practica sin modificar codigo productivo en esta ronda.
- Restriccion de esta ronda: solo documentacion. No tocar `manifest.json`, `package.json`, codigo fuente, tests existentes, firma ni dependencias.

## Problema actual

WebMatic ya graba y reproduce flujos reales, pero el motor todavia depende demasiado de selectores concretos y de heuristicas locales. Eso lo vuelve fragil frente a aplicaciones modernas con DOM dinamico, componentes renderizados por frameworks, wizards, SPAs, overlays, iframes same-origin y controles custom.

Los sintomas principales son:

- Un selector que fue valido al grabar puede apuntar a otro nodo al reproducir.
- IDs generados por Angular, React, Vue, GeneXus u otras capas pueden parecer unicos pero no ser estables.
- El recorder captura suficiente para ejecutar el caso feliz, pero no siempre captura la intencion humana: "click en el boton Guardar visible del formulario actual", "escribir en el campo Email asociado a esta etiqueta", "elegir la opcion activa del combo abierto".
- El player puede resolver un elemento antes de saber si esta listo para recibir la accion humana equivalente.
- Cuando falla, el diagnostico puede ser tecnicamente correcto pero insuficiente para que el usuario final entienda que hacer.

La meta no es soportar absolutamente toda pagina posible. La meta es aumentar el techo de universalidad practica: resolver correctamente la mayoria de interfaces profesionales sin dependencias pesadas, sin acciones destructivas y sin improvisar cuando el caso no es seguro.

## Objetivo rc39

rc39 debe introducir un motor universal por capas que:

1. Grabe intencion, contexto y alternativas, no solo un selector primario.
2. Resuelva candidatos con scoring reproducible, explicable y testeable.
3. Valide visibilidad, interactuabilidad y seguridad antes de actuar.
4. Reproduzca como un usuario humano: foco, scroll, eventos, esperas cortas y verificacion posterior.
5. Distinga fallos de resolucion, de estado de UI, de datos, de navegacion y de bloqueo por overlay.
6. Mantenga compatibilidad con macros existentes.
7. Sea incremental: cada fase debe poder entrar con tests y rollback conceptual claro.

## Arquitectura propuesta

La arquitectura rc39 se organiza en seis capas:

1. **Recorder de intencion**
   - Captura el evento humano y el elemento objetivo.
   - Construye un `targetDescriptor` enriquecido con selector primario, selectores alternativos, texto, rol, labels, atributos estables, contexto visual, frame path, shadow path cuando aplique y datos de accion.
   - Normaliza datos sensibles sin guardar valores reales.

2. **Normalizador de pasos**
   - Convierte eventos crudos en pasos estables.
   - Preserva compatibilidad con campos existentes.
   - Agrega metadatos opcionales sin romper macros viejas.

3. **Element resolver universal**
   - Recibe el descriptor y devuelve candidatos ordenados.
   - Busca en documento, iframes same-origin y Shadow DOM abierto.
   - Usa scoring por evidencia, no primer match ciego.
   - Devuelve razones de score y razones de descarte.

4. **Validador pre-accion**
   - Confirma que el candidato ganador es visible, interactuable, no ambiguo y coherente con la accion.
   - Detecta overlays, elementos disabled/readonly, duplicados fuertes y cambios de pantalla.
   - Si no hay confianza suficiente, falla con diagnostico claro.

5. **Ejecutor humano**
   - Hace scroll centrado, focus, input/click/select mediante eventos compatibles con usuario real.
   - Respeta delays minimos, waits inteligentes y transiciones SPA.
   - Verifica efecto esperado cuando el paso lo permite.

6. **Diagnostico dual**
   - Mensaje final claro para usuario: que paso y que puede hacer.
   - Detalle tecnico oculto o expandible: selector, scores, candidatos, descartes, frame, overlay, estado del elemento.

## Modulos a tocar en la implementacion rc39

Estos modulos son candidatos naturales para cambios futuros. En esta ronda no deben modificarse.

- `src/common/dom/element-finder.js`
  - Evolucionar a fachada del resolver o delegar en `element-resolver`.
  - Mantener compatibilidad de `findElement(selector, opts)`.

- `src/common/selectors/selector-builder.js`
  - Reforzar generacion de selectores estables.
  - Separar selector primario de descriptor de intencion.

- `src/common/diagnostics/selector-diagnostics.js`
  - Agregar diagnosticos de scoring, visibilidad, overlay, disabled, readonly y ambiguedad.

- `src/modules/recorder/recorder.js`
  - Capturar intencion, contexto y alternativas durante el evento real.

- `src/modules/recorder/normalizer/recording-normalizer.js`
  - Persistir nuevos metadatos opcionales manteniendo macros existentes.

- `src/modules/recorder/defaults/defaults-capture.js`
  - Alinear captura de defaults con el nuevo descriptor para pre-run reset.

- `src/modules/player/player.js`
  - Integrar resolver, validador pre-accion y diagnostico sin reescribir todo el player en una sola fase.

- `src/modules/player/state/step-normalizer.js`
  - Normalizar pasos legacy y pasos rc39 a una forma comun de ejecucion.

- `src/modules/player/actions/action-click.js`
- `src/modules/player/actions/action-input-text.js`
- `src/modules/player/actions/action-input-value.js`
- `src/modules/player/actions/action-check.js`
- `src/modules/player/actions/action-autocomplete.js`
- `src/modules/player/actions/action-extract.js`
  - Consumir candidato validado y respetar reglas humanas de accion.

- `src/modules/player/actions/action-wait.js`
  - Incorporar waits por estabilidad de DOM, ruta SPA, wizard y desaparicion de overlays.

- `src/modules/player/diagnostics/highlight-manager.js`
  - Resaltar candidato ganador, candidato bloqueado u overlay bloqueante.

- `src/modules/player/navigation/navigation-analyzer.js`
- `src/modules/player/navigation/background-navigator.js`
  - Mantener coherencia con navegacion, cambios SPA y esperas post-navegacion.

- `src/modules/inventory/page-inventory.js`
  - Reutilizar el mismo modelo de descriptors para inventario y editor.

- `src/modules/editor/schema/step-definitions.js`
- `src/modules/editor/renderers/form-fields-renderer.js`
- `src/modules/editor/presentation/step-humanizer.js`
  - Mostrar campos nuevos de forma compatible, sin obligar al usuario a entender detalles tecnicos.

## Modulos que NO deben tocarse en rc39 salvo necesidad demostrada

- `manifest.json`: no cambiar permisos, version ni metadata para esta arquitectura.
- `package.json` y `package-lock.json`: no agregar dependencias; evitar scripts nuevos salvo fase posterior justificada.
- `src/background/background.js`
- `src/background/background-router.js`
- `src/background/tabs-navigation.js`
  - Solo tocar si una fase concreta requiere cambio de contrato de mensajeria o navegacion.

- `src/modules/storage/*`
  - No modificar formato de almacenamiento salvo metadatos opcionales compatibles.

- `src/modules/ui/*`, `src/popup/*`, `src/options/*`, `src/help/*`
  - No tocar para el primer corte del resolver. La UI puede mostrar mejores diagnosticos despues.

- Tests existentes
  - No editar tests actuales para "hacer pasar" rc39. Agregar tests nuevos y mantener los existentes.

## Diseno de `element resolver universal`

El resolver debe operar sobre un descriptor, pero conservar entrada legacy por selector.

Entrada conceptual:

```js
{
  selector: "#legacy",
  fallbackSelectors: ["button[data-testid='save']", "button[text=\"Guardar\"]"],
  intent: {
    action: "CLICK",
    role: "button",
    tagName: "button",
    visibleText: "Guardar",
    accessibleName: "Guardar",
    labelText: "Guardar",
    placeholder: "",
    valueAtRecord: "",
    inputType: "",
    href: "",
    stableAttributes: {
      "data-testid": "save",
      "aria-label": "Guardar"
    },
    nearbyText: ["Datos personales", "Email"],
    formContext: {
      legend: "Datos personales",
      nearestHeading: "Alta de cliente"
    },
    ordinalContext: {
      indexAmongSimilarVisible: 0,
      totalSimilarVisible: 1
    },
    framePath: [],
    shadowPath: [],
    urlAtRecord: "https://example.test/clientes",
    pathAtRecord: "/clientes"
  }
}
```

Salida conceptual:

```js
{
  element,
  confidence: 0.92,
  status: "ok",
  candidates: [
    {
      element,
      score: 92,
      reasons: ["data-testid exact", "text exact", "visible", "role matches"],
      warnings: []
    }
  ],
  discarded: [
    {
      reason: "hidden",
      selector: "button[data-testid='save']"
    }
  ],
  diagnostics: {
    userMessage: "Elemento encontrado y listo.",
    technicalCode: "RESOLVER_OK"
  }
}
```

Estados posibles:

- `ok`: un candidato claro y accionable.
- `not_found`: no hay candidatos suficientes.
- `ambiguous`: hay varios candidatos con score cercano y ninguno domina.
- `not_visible`: el mejor candidato existe pero no es visible.
- `not_interactable`: existe pero no puede recibir la accion.
- `blocked_by_overlay`: un overlay o elemento superior intercepta la accion.
- `readonly_or_disabled`: el control existe pero no se puede modificar.
- `wrong_page_or_state`: la pantalla actual no coincide con el contexto grabado.

## Fuentes de candidatos

El resolver debe recolectar candidatos desde:

- Selector primario legacy.
- `fallbackSelectors`.
- Atributos estables: `data-testid`, `data-test`, `data-cy`, `aria-label`, `name`, `placeholder`, `title`, `alt`, `href` estable.
- Asociaciones de label: `label[for]`, labels envolventes, `aria-labelledby`, `aria-describedby`.
- Texto visible normalizado.
- Rol semantico o ARIA role.
- Tipo de control: input, textarea, select, button, link, checkbox, radio, combobox, option.
- Contexto cercano: formulario, fieldset, dialog, heading, row, card, toolbar.
- Posicion relativa dentro de un grupo visible cuando la evidencia semantica no alcanza.
- Iframes same-origin.
- Shadow DOM abierto.

No debe depender de:

- IDs claramente dinamicos como `mat-input-17`, `react-select-5-input`, UUIDs, hashes largos o sufijos numericos volatiles.
- Clases generadas por CSS modules, frameworks o build tools.
- Indices absolutos globales salvo ultimo recurso con diagnostico de baja confianza.

## Scoring de candidatos

El scoring debe ser determinista y auditable. Los pesos sugeridos son iniciales; la implementacion puede calibrarlos con tests, pero debe documentar cualquier cambio.

Puntajes positivos:

- Selector primario exacto y unico: `+25`.
- `data-testid`, `data-test` o `data-cy` exacto: `+35`.
- `aria-label` o accessible name exacto: `+30`.
- Label asociado exacto: `+30`.
- Texto visible exacto y normalizado: `+25`.
- Placeholder exacto: `+20`.
- `name` estable y coherente con tipo: `+18`.
- `href` estable para links: `+18`.
- Rol esperado coincide: `+15`.
- Tag esperado coincide: `+10`.
- Tipo de input coincide: `+10`.
- Contexto de formulario, dialog o heading coincide: `+15`.
- Nearby text coincide: `+8` por coincidencia fuerte, maximo `+16`.
- Ordinal visible coincide dentro de grupo similar: `+8`.
- Misma ruta SPA o path compatible: `+8`.
- Candidato visible: `+10`.
- Candidato en viewport o facilmente scrolleable: `+5`.

Penalizaciones:

- ID o atributo con patron dinamico: `-25`.
- Clase generada o selector basado en `nth-of-type` profundo: `-20`.
- Texto ambiguo repetido: `-15`.
- Candidato oculto: `-50`.
- `display:none`, `visibility:hidden`, `opacity:0` sin area real: `-50`.
- Fuera de DOM activo o en template/inert: `-50`.
- Disabled: `-60` para acciones de escritura/click accionable.
- Readonly: `-60` para escritura.
- Cubierto por overlay/interceptor: `-45`.
- Rol/tipo incompatible con accion: `-35`.
- Contexto de pantalla no coincide: `-25`.
- Distancia visual o DOM excesiva respecto al contexto grabado: `-10` a `-30`.

Reglas de decision:

- `ok` si el mejor candidato supera `70` y aventaja al segundo por al menos `12`.
- `ambiguous` si hay dos o mas candidatos sobre `65` con diferencia menor a `12`.
- `not_interactable` si el mejor semanticamente supera `70` pero falla validaciones de accion.
- `not_found` si ningun candidato supera `50`.
- Nunca actuar sobre un candidato con score menor a `60`, salvo acciones no destructivas de extraccion con diagnostico de baja confianza y test explicito.

## Reglas de visibilidad e interactuabilidad

Un elemento se considera visible si:

- Pertenece al documento activo o a un iframe same-origin activo.
- No esta dentro de `template`, `[hidden]`, `[inert]` o contenedor oculto.
- Su estilo computado y el de sus ancestros no tiene `display:none` ni `visibility:hidden`.
- Tiene rectangulo renderizado util o pertenece a un control que delega visualmente en otro nodo accionable.
- No esta totalmente fuera de pantalla sin posibilidad de scroll normal.

Un elemento se considera interactuable si:

- Es visible o tiene un proxy visible asociado.
- No esta disabled ni dentro de un fieldset disabled.
- Para escritura, no es readonly y acepta entrada compatible.
- Para click, el punto elegido no esta interceptado por otro elemento no descendiente.
- Puede recibir foco cuando la accion lo requiere, o el componente tiene patron conocido de delegacion.
- No esta bloqueado por modal, backdrop, loader, toast persistente, menu superior o overlay.
- La pagina esta estable: no hay navegacion pendiente, cambio SPA inmediato o animacion critica en curso.

Validaciones tecnicas recomendadas:

- `getComputedStyle`.
- `getClientRects` y `getBoundingClientRect`.
- `document.elementFromPoint` en centro y puntos alternativos.
- Chequeo de ancestros disabled/hidden/inert.
- Chequeo de `aria-disabled="true"`.
- Chequeo de `readonly` y `aria-readonly="true"`.
- Espera corta de estabilidad de layout antes de actuar.

## Manejo de casos dificiles

### Elementos ocultos

- No actuar sobre elementos ocultos salvo que sean inputs tecnicos asociados a un control visible y exista una accion especifica validada para ese patron.
- Si el selector primario apunta a oculto pero hay candidato visible equivalente, preferir el visible y registrar diagnostico tecnico.
- Si solo existe oculto, fallar con `not_visible`.

### Duplicados

- Resolver por contexto: form, dialog, row, heading, nearby text, ordinal visible y tipo de accion.
- Si dos candidatos quedan empatados, no elegir por orden DOM global.
- Diagnostico usuario: "Hay mas de un elemento posible para este paso".
- Diagnostico tecnico: listar top candidatos con score y razones.

### Disabled

- Para click, check, select y escritura, no actuar si el control o ancestro efectivo esta disabled.
- Considerar `disabled`, `aria-disabled="true"` y `fieldset[disabled]`.
- Diagnostico usuario: "El elemento existe, pero esta deshabilitado en este momento".

### Readonly

- Para escritura, no actuar si `readonly` o `aria-readonly="true"`.
- Para click no bloquear solo por readonly, salvo que el patron indique accion de edicion.
- Diagnostico usuario: "El campo existe, pero no permite escribir".

### Overlays

- Detectar interceptores con `elementFromPoint`.
- Identificar modales, backdrops, loaders y banners sticky que cubren el punto de accion.
- Esperar desaparicion si el overlay parece transitorio.
- Si persiste, fallar con `blocked_by_overlay` y resaltar overlay si es posible.

### Wizard

- Guardar paso de wizard cuando sea detectable: heading, stepper activo, breadcrumb, dialog title.
- Antes de actuar, validar que el wizard esta en el paso esperado.
- Si no coincide, diagnosticar `wrong_page_or_state` y evitar acciones en otro paso.

### SPA

- Despues de click o navegacion interna, esperar estabilidad por URL, path, heading, root mutation y ausencia de loaders.
- No asumir que `load` o `DOMContentLoaded` indican que la pantalla ya esta lista.
- El resolver debe poder reintentar durante una ventana corta con backoff.

### Iframes y Shadow DOM

- Buscar en iframes same-origin manteniendo `framePath` para diagnostico.
- No prometer soporte cross-origin; diagnosticar cuando el navegador impida acceso.
- Buscar en Shadow DOM abierto.
- Shadow DOM cerrado queda fuera de alcance salvo integraciones especificas futuras.

## Datos que debe guardar recorder como intencion

Cada paso nuevo deberia poder incluir, de forma opcional y compatible, un bloque `target` o equivalente con:

- Accion humana: `CLICK`, `INPUT_TEXT`, `CHOOSE_OPTION`, `CHECK`, `EXTRACT`, etc.
- Selector primario actual.
- Selectores alternativos ordenados.
- Tag, rol, tipo de input y estado checkable.
- Texto visible normalizado.
- Accessible name.
- Label asociado.
- Placeholder, title, alt.
- Atributos estables permitidos.
- Atributos descartados por dinamicos, solo como diagnostico si no aumenta ruido.
- Valor al grabar cuando no sea sensible y sea util para validacion.
- Contexto de form, fieldset, dialog, row/card, heading cercano.
- Nearby text corto y estable.
- Ordinal entre elementos similares visibles.
- Frame path same-origin.
- Shadow path cuando sea describible.
- URL y path al grabar, con query sanitizada si contiene datos sensibles.
- Estado esperado posterior minimo, cuando aplique: cambio de valor, checkbox marcado, opcion elegida, navegacion iniciada, dialog abierto/cerrado.

Datos que no debe guardar:

- Passwords, PIN, tokens, CVV u otros secretos.
- Cookies, storage, headers privados o datos de sesion.
- HTML completo de la pagina.
- Capturas visuales pesadas.
- Dependencias de framework que obliguen a librerias externas.

## Que debe validar player antes de actuar

Antes de ejecutar una accion, el player debe validar:

1. El paso esta normalizado y sus variables fueron expandidas.
2. La pagina o contexto actual es compatible con el paso.
3. El resolver encontro candidato con confianza suficiente.
4. No hay ambiguedad peligrosa.
5. El elemento es visible o tiene proxy accionable validado.
6. El elemento es compatible con la accion.
7. No esta disabled, readonly cuando aplica, ni inert.
8. No hay overlay interceptando.
9. El elemento puede recibir foco o click humano.
10. La pantalla esta estable o dentro de una espera controlada.
11. La accion no requiere dato sensible ausente.
12. La verificacion posterior esperada es posible o se reporta como no verificable.

Si cualquiera de estas condiciones falla, el player debe abortar el paso con diagnostico. No debe "probar" acciones alternativas destructivas.

## Diagnosticos esperados

Los diagnosticos deben tener dos niveles.

Mensajes para usuario final:

- "No encontre el elemento de este paso en la pantalla actual."
- "Encontre varios elementos posibles. WebMatic no eligio para evitar una accion incorrecta."
- "El elemento existe, pero esta oculto."
- "El elemento existe, pero esta deshabilitado."
- "El campo existe, pero no permite escribir."
- "Un panel o cargador esta bloqueando el elemento."
- "La pantalla actual no parece ser el paso esperado del asistente."
- "La pagina cambio despues de grabar la macro. Regraba este paso o ajusta el selector."

Detalle tecnico oculto o expandible:

- Codigo: `RESOLVER_NOT_FOUND`, `RESOLVER_AMBIGUOUS`, `ELEMENT_HIDDEN`, `ELEMENT_DISABLED`, `ELEMENT_READONLY`, `OVERLAY_BLOCKED`, `WRONG_PAGE_STATE`, `CROSS_ORIGIN_FRAME_BLOCKED`.
- Selector primario.
- Fallback selectors usados.
- Top candidatos con score.
- Razones positivas y penalizaciones.
- Razones de descarte.
- Frame path y shadow path.
- Rect del elemento y rect del overlay.
- Accion solicitada.
- Tiempo de espera consumido.

## Riesgos

- Sobrescoring: elegir un candidato incorrecto con demasiada confianza.
- Subscoring: fallar pasos que antes funcionaban.
- Cambiar timing del player y generar regresiones en macros existentes.
- Aumentar demasiado el payload de macros.
- Hacer diagnosticos demasiado tecnicos para usuario final.
- Soportar patrones custom de framework con heuristicas demasiado especificas.
- Romper compatibilidad IIM/export/import si se agregan campos sin normalizacion.
- Confundir visibilidad real con elementos tecnicos usados por componentes custom.

Mitigaciones:

- Mantener entrada legacy.
- Agregar metadatos opcionales.
- Introducir resolver detras de feature flag interna o ruta gradual si el codigo actual lo permite.
- Tests unitarios de scoring y e2e simulados antes de activar por defecto.
- Diagnostico conservador: si no hay confianza, no actuar.

## Plan incremental de implementacion

### Fase 0 - Baseline

- Confirmar tests actuales en verde en la rama de implementacion.
- Documentar comportamiento actual de `element-finder`, `selector-builder`, recorder y acciones principales.
- No cambiar comportamiento.

### Fase 1 - Modelo de descriptor

- Definir estructura de `targetDescriptor` en modulo comun.
- Adaptar normalizador para aceptar descriptors opcionales.
- Garantizar que macros viejas siguen funcionando sin descriptor.
- Tests unitarios de normalizacion y compatibilidad.

### Fase 2 - Recorder enriquecido

- Capturar atributos estables, label, accessible name, contexto, ordinal y fallback selectors.
- Filtrar datos sensibles.
- Mantener selector primario actual para compatibilidad.
- Tests unitarios de captura.

### Fase 3 - Resolver universal en modo sombra

- Implementar resolver y scoring sin cambiar aun la accion final.
- Comparar resultado nuevo contra `findElement` actual y registrar diagnostico tecnico.
- Tests unitarios de candidatos, scoring y descartes.

### Fase 4 - Activacion por acciones no destructivas

- Usar resolver para `EXTRACT` y esperas.
- Activar para click/input solo cuando score sea alto y el selector legacy coincida o sea claramente peor.
- Tests e2e simulados con DOM dinamico.

### Fase 5 - Validacion pre-accion completa

- Integrar visibilidad, interactuabilidad, overlay, disabled, readonly y estabilidad de pantalla.
- Unificar diagnosticos.
- Tests e2e de fallos seguros.

### Fase 6 - Player humano y verificacion posterior

- Alinear acciones con flujo humano: scroll, focus, evento, verificacion.
- Esperas SPA/wizard.
- Tests de regresion de macros legacy.

### Fase 7 - Editor e inventario

- Mostrar descriptors de forma simple.
- Permitir ver diagnostico tecnico sin obligar al usuario a editarlo.
- Reutilizar inventario de pagina para sugerir mejores targets.

## Criterios de aceptacion rc39

- Macros existentes siguen reproduciendose.
- Macros nuevas guardan intencion y selectores alternativos sin exponer secretos.
- El resolver devuelve score, razones y descartes de forma testeable.
- El player no actua cuando el candidato es ambiguo, oculto, disabled, readonly o bloqueado por overlay.
- Los diagnosticos son comprensibles para usuario final y utiles para soporte tecnico.
- No se agregan dependencias pesadas.
- No se requiere permiso nuevo de extension para el primer corte.
- Shadow DOM abierto e iframes same-origin quedan cubiertos o documentados con limites.
- Cross-origin frames y Shadow DOM cerrado no se sobredeclaran.
- Tests unitarios y e2e nuevos cubren casos positivos y fallos seguros.

## Tests unitarios requeridos

Resolver y scoring:

- Encuentra por `data-testid` estable aunque exista ID dinamico.
- Encuentra por `aria-label` estable aunque exista ID dinamico.
- Encuentra por label asociado `for`.
- Encuentra por label envolvente.
- Encuentra por placeholder.
- Encuentra por texto visible exacto.
- Penaliza texto duplicado.
- Penaliza ID dinamico tipo Angular Material.
- Penaliza UUID/hash largo.
- Penaliza clases generadas.
- Prefiere contexto de formulario correcto entre dos campos iguales.
- Prefiere dialog activo frente a fondo inactivo.
- Usa ordinal visible solo como desempate.
- Devuelve `ambiguous` cuando dos candidatos tienen score cercano.
- Devuelve `not_found` sin candidato suficiente.
- Devuelve razones de score y descartes.

Visibilidad e interactuabilidad:

- Descarta `display:none`.
- Descarta `visibility:hidden`.
- Descarta `[hidden]`.
- Descarta ancestro oculto.
- Detecta `disabled`.
- Detecta `fieldset[disabled]`.
- Detecta `aria-disabled`.
- Detecta `readonly` para input.
- Detecta `aria-readonly`.
- Detecta elemento cubierto por overlay con `elementFromPoint`.
- Permite elemento visible despues de scroll.
- Espera estabilidad de layout antes de actuar.

Recorder:

- Guarda selector primario legacy.
- Guarda fallback selectors.
- Guarda accessible name.
- Guarda label asociado.
- Guarda contexto de heading/form/dialog.
- Guarda ordinal entre similares visibles.
- No guarda valores sensibles.
- Sanitiza URL o evita query sensible.
- Mantiene compatibilidad con pasos sin descriptor.

Player:

- Normaliza paso legacy.
- Normaliza paso rc39.
- No actua con `ambiguous`.
- No actua con `blocked_by_overlay`.
- No escribe en readonly.
- No clickea disabled.
- Reporta codigo tecnico correcto.
- Mantiene fallback legacy cuando no hay descriptor.

## Tests e2e requeridos

- Formulario simple con ID estable.
- Formulario con ID dinamico y `data-testid` estable.
- Campo con label visible repetido en dos formularios; debe elegir por contexto.
- Boton `Guardar` duplicado en pagina y modal; debe elegir modal activo.
- Wizard de tres pasos; no debe actuar si esta en paso equivocado.
- SPA con cambio de vista sin reload; debe esperar pantalla lista.
- Overlay loader transitorio; debe esperar y luego actuar.
- Overlay persistente; debe fallar con `blocked_by_overlay`.
- Campo disabled; debe fallar sin modificar.
- Campo readonly; debe fallar sin escribir.
- Select nativo.
- Combobox custom/autocomplete existente.
- Checkbox y radio.
- Link con href estable.
- Tabla/grilla con filas duplicadas y accion por fila.
- Iframe same-origin.
- Shadow DOM abierto.
- Macro legacy sin descriptor.
- Macro nueva export/import conservando descriptor.
- Diagnostico visible para usuario y detalle tecnico disponible.

## Decision final de arquitectura

rc39 debe tratar cada paso como una intencion humana verificable. El selector deja de ser la unica verdad y pasa a ser una evidencia mas dentro de un descriptor. El player solo debe actuar cuando la resolucion, el estado visual y la accion esperada son coherentes. Cuando no lo son, WebMatic debe fallar temprano, explicar bien y proteger al usuario de una accion equivocada.
