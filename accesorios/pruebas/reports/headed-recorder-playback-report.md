# WebMatic headed recorder/playback QA report

- Fecha/hora: 2026-07-01T20:47:04.491Z
- Version probada: webmatic 0.2.4
- Navegador usado: Chromium headed, slowMo=500ms
- Extension usada: Chromium MV3 temporal generado en %TEMP% desde manifest/src del repo
- XPI firmado: no usado por este runner; Playwright no carga XPI firmado de Firefox de forma confiable en este flujo headed.
- Comando ejecutado: `node accesorios/pruebas/tests/e2e/headed-recorder-playback/run.js`
- Trace Playwright: accesorios/pruebas/reports/headed-recorder-playback-artifacts/headed-recorder-playback-trace.zip

## Resultado general

Estado: **passed**

## Notas de entorno
- En esta sesion node puede no estar en PATH; se puede invocar con la ruta absoluta de Node si hace falta.

## Escenarios

### Pagina externa obligatoria: flyer-clinico-prompt-builder

- Estado: passed
- Macro guardada: QA Headed External 1782938826338
- Macro capturada: accesorios/pruebas/reports/headed-recorder-playback-artifacts/external-flyer-builder-macro.iim
- Artefactos: accesorios/pruebas/reports/headed-recorder-playback-artifacts/external-flyer-builder-before-recording.png, accesorios/pruebas/reports/headed-recorder-playback-artifacts/external-flyer-builder-after-user-flow.png, accesorios/pruebas/reports/headed-recorder-playback-artifacts/external-flyer-builder-macro.iim, accesorios/pruebas/reports/headed-recorder-playback-artifacts/external-flyer-builder-after-playback.png
- Reproduccion exitosa: si
- Analisis macro: CHOOSE_OPTION=true, VALUE/TEXT/INDEX=true, WAIT_FOR=true, CLICK image=false, basura visual=false

Estado final observado:

```json
{
  "url": "https://aldowagner78-cmd.github.io/flyer-clinico-prompt-builder/",
  "title": "Flyer Clínico Prompt Builder",
  "relevantControls": [
    {
      "tag": "select",
      "type": "",
      "id": "themeColorSelector",
      "label": "Tema",
      "value": "green"
    },
    {
      "tag": "input",
      "type": "text",
      "id": "",
      "label": "Nombre completo del profesionalRecomendado",
      "value": "QA Gomez"
    },
    {
      "tag": "input",
      "type": "text",
      "id": "",
      "label": "Matrícula",
      "value": "MP 00000"
    },
    {
      "tag": "select",
      "type": "",
      "id": "",
      "label": "Especialidad o áreaRecomendadoCardiologiaClinica medicaMedicina GeneralDiabetologiaPediatriaGinecologiaObstetriciaDermat",
      "value": "Cardiologia"
    }
  ],
  "relevantPersistedValues": [
    "Clinica QA WebMatic",
    "green"
  ]
}
```

Macro grabada:

```iim
VERSION BUILD=1000
TAB T=1
NAVIGATE URL="https://aldowagner78-cmd.github.io/flyer-clinico-prompt-builder/"
// WAIT_FOR SELECTOR="#themeColorSelector" TIMEOUT=10000
CHOOSE_OPTION SELECTOR="#themeColorSelector" VALUE="green" TEXT="Verde" INDEX="2"
CLICK SELECTOR="#startAssistantButton"
// WAIT_FOR SELECTOR="#workflowTitle" TIMEOUT=10000
CLICK SELECTOR="#createInstitutionButton"
// WAIT_FOR SELECTOR="#clinicFields" TIMEOUT=10000
CLICK SELECTOR="[data-institution-mode=\"full\"]"
// WAIT_FOR SELECTOR="#clinicFullFields" TIMEOUT=10000
TYPE SELECTOR="[data-path=\"clinic.name\"]" CONTENT="Clinica QA WebMatic"
// WAIT_FOR SELECTOR="[data-path=\"clinic.institutionType\"]" TIMEOUT=10000
CHOOSE_OPTION SELECTOR="[data-path=\"clinic.institutionType\"]" VALUE="Clínica" TEXT="Clínica" INDEX="1"
TYPE SELECTOR="[data-path=\"clinic.name\"]" CONTENT="Clinica QA WebMatic"
TYPE SELECTOR="[data-path=\"clinic.address\"]" CONTENT="Av. QA 123"
TYPE SELECTOR="[data-path=\"clinic.primaryPhone\"]" CONTENT="3415550101"
TYPE SELECTOR="[data-path=\"clinic.email\"]" CONTENT="qa@example.test"
// WAIT_FOR SELECTOR="[data-path=\"clinic.defaultPrimaryColor\"]" TIMEOUT=10000
CHOOSE_OPTION SELECTOR="[data-path=\"clinic.defaultPrimaryColor\"]" VALUE="azul" TEXT="Azul" INDEX="6"
// WAIT_FOR SELECTOR="[data-path=\"clinic.defaultSecondaryColor\"]" TIMEOUT=10000
CHOOSE_OPTION SELECTOR="[data-path=\"clinic.defaultSecondaryColor\"]" VALUE="verdeAgua" TEXT="Verde agua" INDEX="8"
TYPE SELECTOR="[data-path=\"clinic.email\"]" CONTENT="qa@example.test"
// WAIT_FOR SELECTOR="#saveInstitutionAndContinueButton" TIMEOUT=10000
CLICK SELECTOR="#saveInstitutionAndContinueButton"
CLICK SELECTOR="[data-piece-select=\"professionalFlyer\"]"
// WAIT_FOR SELECTOR="#prestaciones" TIMEOUT=10000
TYPE SELECTOR="[data-path=\"professional.fullName\"]" CONTENT="QA Gomez"
TYPE SELECTOR="[data-path=\"professional.license\"]" CONTENT="MP 00000"
// WAIT_FOR SELECTOR="[data-path=\"specialty.primaryProfessionalSpecialty\"]" TIMEOUT=10000
CHOOSE_OPTION SELECTOR="[data-path=\"specialty.primaryProfessionalSpecialty\"]" VALUE="Cardiologia" TEXT="Cardiologia" INDEX=""
TYPE SELECTOR="[data-path=\"professional.license\"]" CONTENT="MP 00000"

```

### Fixture local GeneXus/IAPOS simulado

- Estado: passed
- Macro guardada: QA Headed IAPOS 1782938916791
- Macro capturada: accesorios/pruebas/reports/headed-recorder-playback-artifacts/local-iapos-genexus-macro.iim
- Artefactos: accesorios/pruebas/reports/headed-recorder-playback-artifacts/local-iapos-genexus-before-recording.png, accesorios/pruebas/reports/headed-recorder-playback-artifacts/local-iapos-genexus-after-user-flow.png, accesorios/pruebas/reports/headed-recorder-playback-artifacts/local-iapos-genexus-macro.iim, accesorios/pruebas/reports/headed-recorder-playback-artifacts/local-iapos-genexus-after-playback.png
- Reproduccion exitosa: si
- Analisis macro: CHOOSE_OPTION=true, VALUE/TEXT/INDEX=true, WAIT_FOR=true, CLICK image=true, basura visual=false

Estado final observado:

```json
{
  "value": "47",
  "result": "autorizado",
  "highlightCount": 0,
  "gxNotification": "gx_ajax_notification: confirmar disponible",
  "gxState": "{\"Screen\":\"DETALLE\",\"Row\":\"0001\"}"
}
```

Macro grabada:

```iim
VERSION BUILD=1000
TAB T=1
NAVIGATE URL="http://localhost:18124/iapos-genexus.html"
// WAIT_FOR SELECTOR="#vDETALLES_0001" TIMEOUT=10000
CLICK SELECTOR="#vDETALLES_0001"
WAIT SECONDS=1
NAVIGATE URL="http://localhost:18124/iapos-genexus.html#detalle-0001"
// WAIT_FOR SELECTOR="#vERROR" TIMEOUT=10000
CHOOSE_OPTION SELECTOR="#vERROR" VALUE="47" TEXT="DETALLE AUTORIZADO" INDEX="1"
CLICK SELECTOR="#vAUTORIZAR_0001"
// WAIT_FOR SELECTOR="#detail-screen div:nth-of-type(1)" TIMEOUT=10000
CLICK SELECTOR="#confirmar"
// WAIT_FOR SELECTOR="#detail-screen div:nth-of-type(1)" TIMEOUT=10000

```

## Bugs encontrados

- No se detectaron bugs bloqueantes en los escenarios ejecutados.

## Recomendaciones

- Mantener este runner fuera de scripts npm si no se aprueba modificar package.json.
- Reejecutar con una terminal que tenga node y git en PATH para reproducir exactamente los comandos esperados.
- Si se requiere validar el XPI firmado, hacerlo con runner Firefox/geckodriver dedicado y documentar diferencias frente a Chromium unpacked.

## Que no se pudo probar

- No se cargo el XPI firmado en Firefox desde Playwright en este runner.
- No se uso IAPOS real ni credenciales reales.
- No se hicieron commits, firma ni subida a GitHub.

