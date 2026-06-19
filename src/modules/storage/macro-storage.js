(function initMacroStorage(globalScope) {
  const MACROS_STORAGE_KEY = "webmaticMacros";

  function normalizeMacros(value) {
    return Array.isArray(value) ? value : [];
  }

  function getMacrosStorageKey() {
    return MACROS_STORAGE_KEY;
  }

  function buildMacrosStoragePatch(macros) {
    return { [MACROS_STORAGE_KEY]: normalizeMacros(macros) };
  }

  function readMacrosFromStorageSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return [];
    return normalizeMacros(snapshot[MACROS_STORAGE_KEY]);
  }

  function extractMacrosFromStorageChange(changes, areaName) {
    if (areaName !== "local" || !changes || typeof changes !== "object") return null;
    if (!Object.prototype.hasOwnProperty.call(changes, MACROS_STORAGE_KEY)) return null;
    const change = changes[MACROS_STORAGE_KEY] || {};
    return normalizeMacros(change.newValue);
  }

  const api = {
    getMacrosStorageKey,
    normalizeMacros,
    buildMacrosStoragePatch,
    readMacrosFromStorageSnapshot,
    extractMacrosFromStorageChange
  };

  globalScope.WebMaticMacroStorage = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
