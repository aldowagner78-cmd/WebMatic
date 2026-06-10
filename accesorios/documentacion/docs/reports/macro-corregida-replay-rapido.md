# Macro corregida para prueba rapida

## Respuestas directas (SI/NO)
- ¿En tu script se ve que hubo captura de copia? SI.
- ¿Se graba copiar con Ctrl+C y menu contextual (en contenido de pagina)? SI, porque se escucha el evento copy.
- ¿Se graba pegar con Ctrl+V y menu contextual como evento explicito paste? NO.
- ¿Aun asi puede reflejarse el pegado en campos de pagina? SI, como input/change (y con sustitucion por variable si coincide con lo copiado).
- ¿Copiar/pegar en la barra de direcciones del navegador queda grabado? NO.
- ¿Otros comandos del menu contextual (cortar, copiar imagen, imprimir, etc.) estan contemplados como comandos de macro? NO.

## Script corregido (listo para pegar y reemplazar)

```iim
VERSION BUILD=1000
TAB T=1
TYPE SELECTOR="#APjFqb" CONTENT="hola, quien eres? responde en una sola línea"
CLICK SELECTOR="span[text=\"Modo IA\"]"
NAVIGATE URL="https://www.google.com/search?q=hola%2C+quien+eres%3F+responde+en+una+sola+l%C3%ADnea&udm=50"
WAIT_FOR SELECTOR="div.pIIIbd:nth-of-type(3)" TIMEOUT=10000
CLICK SELECTOR="div.pIIIbd:nth-of-type(3)"
WAIT SECONDS=1
KEY CODE="Enter"
WAIT_FOR SELECTOR="textarea[placeholder=\"Haz una pregunta\"]" TIMEOUT=10000
TYPE SELECTOR="textarea[placeholder=\"Haz una pregunta\"]" CONTENT="eres idiota? dame el vinculo!"
KEY CODE="Enter"
WAIT_FOR SELECTOR="[data-sfc-root=\"c\"]" TIMEOUT=10000
CLICK SELECTOR="[data-sfc-root=\"c\"]"
EXTRACT SELECTOR="[data-sfc-root=\"c\"]" VAR="VAR1"
WAIT SECONDS=1
NAVIGATE URL="https://www.mercadolibre.com.ar/"
WAIT_FOR SELECTOR="#cb1-edit" TIMEOUT=10000
CLICK SELECTOR="#cb1-edit"
CLICK SELECTOR="div.nav-bounds.nav-bounds-with-cart"
WAIT SECONDS=1
NAVIGATE URL="https://listado.mercadolibre.com.ar/taladro-electrico"
WAIT_FOR SELECTOR="#_R_8tlcjae_ a" TIMEOUT=10000
CLICK SELECTOR="#_R_8tlcjae_ a"
WAIT SECONDS=1
NAVIGATE URL="https://www.mercadolibre.com.ar/multiherramienta-inalambrico-matrix-5-en-1-intercambiable-taladro-amoladora-hidro-llave-de-impacto/p/MLA58510023"
WAIT_FOR SELECTOR="[data-testid=\"image-996390-MLA97918003672_112025\"]" TIMEOUT=10000
HOVER SELECTOR="[data-testid=\"image-996390-MLA97918003672_112025\"]"
CLICK SELECTOR="#gallery-thumbnail-971403-MLA93418916518_092025"
WAIT SECONDS=1
CLICK SELECTOR="#gallery-thumbnail-772548-MLA93838255199_092025"
CLICK SELECTOR="#gallery-thumbnail-834084-MLA93838106727_092025"
WAIT_FOR SELECTOR="(//*[@title='Next (arrow right)']|//*[@title='Siguiente (flecha derecha)']|//*[@aria-label='Next (arrow right)']|//*[@aria-label='Siguiente (flecha derecha)']|//*[@data-testid='gallery-next'])[1]" TIMEOUT=10000
CLICK SELECTOR="(//*[@title='Next (arrow right)']|//*[@title='Siguiente (flecha derecha)']|//*[@aria-label='Next (arrow right)']|//*[@aria-label='Siguiente (flecha derecha)']|//*[@data-testid='gallery-next'])[1]"
CLICK SELECTOR="(//*[@title='Next (arrow right)']|//*[@title='Siguiente (flecha derecha)']|//*[@aria-label='Next (arrow right)']|//*[@aria-label='Siguiente (flecha derecha)']|//*[@data-testid='gallery-next'])[1]"
WAIT_FOR SELECTOR="(//*[@title='Close (Esc)']|//*[@title='Cerrar (Esc)']|//*[@aria-label='Close']|//*[@aria-label='Cerrar']|//*[@data-testid='gallery-close'])[1]" TIMEOUT=10000
CLICK SELECTOR="(//*[@title='Close (Esc)']|//*[@title='Cerrar (Esc)']|//*[@aria-label='Close']|//*[@aria-label='Cerrar']|//*[@data-testid='gallery-close'])[1]"
```

## Nota minima
- Este script corrige el bloqueo del paso CHECK en miniaturas cambiando esas acciones a CLICK.
- Ya hay fix en codigo para que CHECK custom no frene macro, pero este parche te deja probar ya mismo sin regrabar.
