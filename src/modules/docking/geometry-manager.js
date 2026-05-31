(function initGeometryManager(globalScope) {
  function calculateLayout(viewportWidth, viewportHeight, panelWidth, side) {
    const safePanelWidth = Math.max(200, Math.min(panelWidth, viewportWidth - 1));
    const browserWidth = viewportWidth - safePanelWidth;

    if (side === "right") {
      return {
        panel: {
          left: browserWidth,
          width: safePanelWidth,
          height: viewportHeight
        },
        browser: {
          left: 0,
          width: browserWidth,
          height: viewportHeight
        }
      };
    }

    return {
      panel: {
        left: 0,
        width: safePanelWidth,
        height: viewportHeight
      },
      browser: {
        left: safePanelWidth,
        width: browserWidth,
        height: viewportHeight
      }
    };
  }

  function validateLayout(layout, viewportWidth, viewportHeight) {
    const totalWidth = layout.panel.width + layout.browser.width;
    const sameHeight = layout.panel.height === viewportHeight && layout.browser.height === viewportHeight;
    const noGap = totalWidth === viewportWidth;

    return {
      isValid: sameHeight && noGap,
      totalWidth,
      sameHeight,
      noGap
    };
  }

  function applyLayoutToDocument(layout, side) {
    const html = document.documentElement;
    if (!html) {
      return;
    }

    if (side === "right") {
      html.style.marginRight = `${layout.panel.width}px`;
      html.style.marginLeft = "0px";
    } else {
      html.style.marginLeft = `${layout.panel.width}px`;
      html.style.marginRight = "0px";
    }
  }

  const api = Object.freeze({
    calculateLayout,
    validateLayout,
    applyLayoutToDocument
  });

  globalScope.WebMaticGeometry = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);