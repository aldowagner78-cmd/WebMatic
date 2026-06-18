(function initTransientRecovery(globalScope) {
  function isTransientGallerySelector(selector) {
    return /(next|siguiente|prev|anterior|close|cerrar|arrow|flecha|gallery|thumbnail|overlay)/i.test(String(selector || ""));
  }

  function hasNavigateSoon(steps, fromIndex, maxLookahead) {
    if (!Array.isArray(steps)) return false;

    const start = Math.max(0, Number(fromIndex) || 0);
    const max = Math.max(1, Number(maxLookahead) || 6);

    let seen = 0;

    for (let index = start; index < steps.length && seen < max; index++) {
      const type = steps[index] && steps[index].type;

      if (!type) continue;

      if (type === "wait" || type === "hover" || type === "scroll_to") {
        seen++;
        continue;
      }

      if (type === "navigate") return true;

      if (
        type === "input" ||
        type === "text" ||
        type === "check" ||
        type === "choose_option" ||
        type === "extract" ||
        type === "click"
      ) {
        return false;
      }

      seen++;
    }

    return false;
  }

  const api = {
    isTransientGallerySelector,
    hasNavigateSoon
  };

  globalScope.WebMaticTransientRecovery = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);