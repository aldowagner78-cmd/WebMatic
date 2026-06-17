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

  const api = { findInShadow };

  globalScope.WebMaticElementFinder = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
