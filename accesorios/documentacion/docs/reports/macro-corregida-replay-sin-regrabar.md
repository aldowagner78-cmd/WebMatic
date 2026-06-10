# Macro corregida para reemplazo rapido

Usa este script completo para reemplazar la macro actual y probar sin regrabar.

```iim
VERSION BUILD=1000
TAB T=1
// WM_JSON:{"version":2,"steps":[{"type":"input","selector":"#APjFqb","value":"hola, quien eres? responde en una sola línea"},{"type":"click","selector":"span[text=\"Modo IA\"]"},{"type":"navigate","url":"https://www.google.com/search?q=hola%2C+quien+eres%3F+responde+en+una+sola+l%C3%ADnea&udm=50"},{"type":"wait_for","selector":"textarea[placeholder=\"Haz una pregunta\"]","timeout":10000},{"type":"text","selector":"textarea[placeholder=\"Haz una pregunta\"]","value":"eres idiota? dame el vinculo!"},{"type":"key","key":"Enter"},{"type":"wait_for","selector":"[data-sfc-root=\"c\"]","timeout":10000},{"type":"click","selector":"[data-sfc-root=\"c\"]"},{"type":"extract","selector":"[data-sfc-root=\"c\"]","variable":"VAR1"},{"type":"wait","seconds":1},{"type":"navigate","url":"https://www.mercadolibre.com.ar/"},{"type":"wait_for","selector":"#cb1-edit","timeout":10000},{"type":"click","selector":"#cb1-edit"},{"type":"input","selector":"#cb1-edit","value":"taladro electrico"},{"type":"key","key":"Enter"},{"type":"navigate","url":"https://listado.mercadolibre.com.ar/taladro-electrico"},{"type":"wait_for","selector":"a[href*=\"/p/MLA\"]","timeout":10000},{"type":"click","selector":"a[href*=\"/p/MLA\"]"},{"type":"wait","seconds":1},{"type":"wait_for","selector":"[id^=\"gallery-thumbnail-\"]","timeout":10000},{"type":"click","selector":"(//label[starts-with(@for,'gallery-thumbnail-')])[1]"},{"type":"wait","seconds":1},{"type":"click","selector":"(//label[starts-with(@for,'gallery-thumbnail-')])[2]"},{"type":"wait","seconds":1},{"type":"click","selector":"(//label[starts-with(@for,'gallery-thumbnail-')])[3]"},{"type":"wait","seconds":1},{"type":"wait_for","selector":"(//*[@title='Next (arrow right)']|//*[@title='Siguiente (flecha derecha)']|//*[@aria-label='Next (arrow right)']|//*[@aria-label='Siguiente (flecha derecha)']|//*[@data-testid='gallery-next'])[1]","timeout":10000},{"type":"click","selector":"(//*[@title='Next (arrow right)']|//*[@title='Siguiente (flecha derecha)']|//*[@aria-label='Next (arrow right)']|//*[@aria-label='Siguiente (flecha derecha)']|//*[@data-testid='gallery-next'])[1]"},{"type":"wait","seconds":1},{"type":"click","selector":"(//*[@title='Next (arrow right)']|//*[@title='Siguiente (flecha derecha)']|//*[@aria-label='Next (arrow right)']|//*[@aria-label='Siguiente (flecha derecha)']|//*[@data-testid='gallery-next'])[1]"},{"type":"wait","seconds":1},{"type":"wait_for","selector":"(//*[@title='Close (Esc)']|//*[@title='Cerrar (Esc)']|//*[@aria-label='Close']|//*[@aria-label='Cerrar']|//*[@data-testid='gallery-close'])[1]","timeout":10000},{"type":"click","selector":"(//*[@title='Close (Esc)']|//*[@title='Cerrar (Esc)']|//*[@aria-label='Close']|//*[@aria-label='Cerrar']|//*[@data-testid='gallery-close'])[1]"}]}
TYPE SELECTOR="#APjFqb" CONTENT="hola, quien eres? responde en una sola línea"
CLICK SELECTOR="span[text=\"Modo IA\"]"
NAVIGATE URL="https://www.google.com/search?q=hola%2C+quien+eres%3F+responde+en+una+sola+l%C3%ADnea&udm=50"
// WAIT_FOR SELECTOR="textarea[placeholder=\"Haz una pregunta\"]" TIMEOUT=10000
TYPE SELECTOR="textarea[placeholder=\"Haz una pregunta\"]" CONTENT="eres idiota? dame el vinculo!"
KEY CODE="Enter"
// WAIT_FOR SELECTOR="[data-sfc-root=\"c\"]" TIMEOUT=10000
CLICK SELECTOR="[data-sfc-root=\"c\"]"
EXTRACT SELECTOR="[data-sfc-root=\"c\"]" VAR="VAR1"
WAIT SECONDS=1
NAVIGATE URL="https://www.mercadolibre.com.ar/"
// WAIT_FOR SELECTOR="#cb1-edit" TIMEOUT=10000
CLICK SELECTOR="#cb1-edit"
TYPE SELECTOR="#cb1-edit" CONTENT="taladro electrico"
KEY CODE="Enter"
NAVIGATE URL="https://listado.mercadolibre.com.ar/taladro-electrico"
// WAIT_FOR SELECTOR="a[href*=\"/p/MLA\"]" TIMEOUT=10000
CLICK SELECTOR="a[href*=\"/p/MLA\"]"
WAIT SECONDS=1
// WAIT_FOR SELECTOR="[id^=\"gallery-thumbnail-\"]" TIMEOUT=10000
CLICK SELECTOR="(//label[starts-with(@for,'gallery-thumbnail-')])[1]"
WAIT SECONDS=1
CLICK SELECTOR="(//label[starts-with(@for,'gallery-thumbnail-')])[2]"
WAIT SECONDS=1
CLICK SELECTOR="(//label[starts-with(@for,'gallery-thumbnail-')])[3]"
WAIT SECONDS=1
// WAIT_FOR SELECTOR="(//*[@title='Next (arrow right)']|//*[@title='Siguiente (flecha derecha)']|//*[@aria-label='Next (arrow right)']|//*[@aria-label='Siguiente (flecha derecha)']|//*[@data-testid='gallery-next'])[1]" TIMEOUT=10000
CLICK SELECTOR="(//*[@title='Next (arrow right)']|//*[@title='Siguiente (flecha derecha)']|//*[@aria-label='Next (arrow right)']|//*[@aria-label='Siguiente (flecha derecha)']|//*[@data-testid='gallery-next'])[1]"
WAIT SECONDS=1
CLICK SELECTOR="(//*[@title='Next (arrow right)']|//*[@title='Siguiente (flecha derecha)']|//*[@aria-label='Next (arrow right)']|//*[@aria-label='Siguiente (flecha derecha)']|//*[@data-testid='gallery-next'])[1]"
WAIT SECONDS=1
// WAIT_FOR SELECTOR="(//*[@title='Close (Esc)']|//*[@title='Cerrar (Esc)']|//*[@aria-label='Close']|//*[@aria-label='Cerrar']|//*[@data-testid='gallery-close'])[1]" TIMEOUT=10000
CLICK SELECTOR="(//*[@title='Close (Esc)']|//*[@title='Cerrar (Esc)']|//*[@aria-label='Close']|//*[@aria-label='Cerrar']|//*[@data-testid='gallery-close'])[1]"
```

## Cambio clave aplicado

- Se reemplazaron los pasos CHECK de thumbnails por CLICK sobre labels visibles con for^="gallery-thumbnail-" para evitar bloqueo por checked no reflejado en inputs ocultos/dinámicos.
