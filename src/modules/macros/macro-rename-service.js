(function initMacroRenameService(globalScope) {
  function normalizeMacroName(name) {
    return String(name || "").trim();
  }

  function buildRenamedMacros(macros, macroId, rawName) {
    const list = Array.isArray(macros) ? macros : [];
    const id = String(macroId || "");
    const name = normalizeMacroName(rawName);
    if (!id) {
      return { ok: false, error: "missing_macro_id", macros: list };
    }
    if (!name) {
      return { ok: false, error: "empty_macro_name", macros: list };
    }

    let found = false;
    const renamed = list.map((macro) => {
      if (!macro || macro.id !== id) {
        return macro;
      }
      found = true;
      return { ...macro, name };
    });

    if (!found) {
      return { ok: false, error: "macro_not_found", macros: list };
    }

    return { ok: true, id, name, macros: renamed };
  }

  const api = {
    normalizeMacroName,
    buildRenamedMacros
  };

  globalScope.WebMaticMacroRenameService = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
