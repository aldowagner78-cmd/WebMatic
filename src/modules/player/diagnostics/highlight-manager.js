(function initHighlightManager(globalScope) {
  const _hlTimers = [];

  function highlightElement(el) {
    try {
      el.setAttribute("data-wm-hl", "1");
      el.style.transition = "box-shadow 0.08s";
      el.style.outline = "2px solid #ef4444";
      el.style.boxShadow = "0 0 0 4px rgba(239,68,68,0.4)";
      const tid = setTimeout(() => {
        el.style.outline = "";
        el.style.boxShadow = "";
        el.style.transition = "";
        el.removeAttribute("data-wm-hl");
      }, 500);
      _hlTimers.push(tid);
    } catch (e) { /* ignore */ }
  }

  function clearAllHighlights(deps) {
    _hlTimers.forEach(t => clearTimeout(t));
    _hlTimers.length = 0;
    const doc = (deps && deps.document) || (typeof document !== "undefined" ? document : null);
    if (!doc) return;
    try {
      doc.querySelectorAll("[data-wm-hl]").forEach(el => {
        el.style.outline = "";
        el.style.boxShadow = "";
        el.style.transition = "";
        el.removeAttribute("data-wm-hl");
      });
    } catch (e) { /* ignore */ }
  }

  const api = {
    highlightElement,
    clearAllHighlights
  };

  globalScope.WebMaticHighlightManager = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
