(function initMacrosGlobal(globalScope) {
  function _macroStorage() {
    if (globalScope && globalScope.WebMaticMacroStorage) return globalScope.WebMaticMacroStorage;
    if (typeof require === "function") {
      try { return require("./macro-storage.js"); } catch (_e) { /* ignore */ }
    }
    throw new Error("WebMaticMacroStorage no está disponible");
  }

  function getMacrosStorageKey() {
    return _macroStorage().getMacrosStorageKey();
  }

  function buildMacrosStoragePatch(macros) {
    return _macroStorage().buildMacrosStoragePatch(macros);
  }

  function readMacrosFromStorageSnapshot(snapshot) {
    return _macroStorage().readMacrosFromStorageSnapshot(snapshot);
  }

  function extractMacrosFromStorageChange(changes, areaName) {
    return _macroStorage().extractMacrosFromStorageChange(changes, areaName);
  }

  const api = {
    getMacrosStorageKey,
    buildMacrosStoragePatch,
    readMacrosFromStorageSnapshot,
    extractMacrosFromStorageChange
  };

  globalScope.WebMaticMacrosGlobal = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
