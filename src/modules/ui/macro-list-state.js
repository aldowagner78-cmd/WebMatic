(function initMacroListState(globalScope) {
  function normalizeQuery(query) {
    return String(query || "").trim().toLowerCase();
  }

  function filterMacros(macros, query) {
    const list = Array.isArray(macros) ? macros : [];
    const q = normalizeQuery(query);
    if (!q) {
      return list;
    }

    const prefix = list.filter((macro) => String(macro && macro.name || "").toLowerCase().startsWith(q));
    if (prefix.length > 0) {
      return prefix;
    }
    return list.filter((macro) => String(macro && macro.name || "").toLowerCase().includes(q));
  }

  function getMacroVisibleSignature(macro) {
    if (!macro || typeof macro !== "object") {
      return "";
    }
    const stepCount = Array.isArray(macro.steps) ? macro.steps.length : 0;
    return [
      String(macro.id || ""),
      String(macro.name || ""),
      String(stepCount)
    ].join("\u001f");
  }

  function getVisibleSignature(macros) {
    return (Array.isArray(macros) ? macros : [])
      .map(getMacroVisibleSignature)
      .join("\u001e");
  }

  function shouldRebuildMacroList(currentSignature, nextMacros) {
    return String(currentSignature || "") !== getVisibleSignature(nextMacros);
  }

  const api = {
    filterMacros,
    getMacroVisibleSignature,
    getVisibleSignature,
    shouldRebuildMacroList
  };

  globalScope.WebMaticMacroListState = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
