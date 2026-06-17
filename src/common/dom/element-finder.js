(function initElementFinder(globalScope) {
  function findInShadow(root, selector) {
    try {
      const direct = root.querySelector(selector);
      if (direct) return direct;
    } catch (e) {
      return null;
    }

    try {
      const all = root.querySelectorAll("*");
      for (const el of all) {
        if (el.shadowRoot) {
          const found = findInShadow(el.shadowRoot, selector);
          if (found) return found;
        }
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  function findInDocument(doc, selector) {
    if (!doc) return null;

    try {
      const direct = findInShadow(doc, selector);
      if (direct) return direct;
    } catch (e) { /* cross-origin iframe will throw */ }

    try {
      const frames = doc.querySelectorAll("iframe, frame");
      for (const frame of frames) {
        try {
          const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
          if (!innerDoc) continue;

          const found = findInDocument(innerDoc, selector);
          if (found) return found;
        } catch (e) { /* cross-origin — skip */ }
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  const api = {
    findInShadow,
    findInDocument
  };

  globalScope.WebMaticElementFinder = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);