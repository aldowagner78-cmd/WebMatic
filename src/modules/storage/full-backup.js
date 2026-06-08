(function initFullBackup(globalScope) {
  function safeParseJson(rawText) {
    const text = String(rawText || "").trim();
    if (!text) throw new Error("Archivo vacío");
    return JSON.parse(text);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function ensureArray(value) {
    return Array.isArray(value) ? clone(value) : [];
  }

  function ensureObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? clone(value) : {};
  }

  function createFullBackupPayload(input) {
    const src = input || {};
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "WebMatic",
      macros: ensureArray(src.macros),
      settings: ensureObject(src.settings),
      ui: ensureObject(src.ui),
      metadata: ensureObject(src.metadata)
    };
  }

  function parseBackupObject(parsed) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Formato de backup inválido");
    }

    if (parsed.version === 1 && String(parsed.app || "") === "WebMatic") {
      if (!Array.isArray(parsed.macros)) {
        throw new Error("Backup completo inválido: macros faltante o inválido");
      }
      if (!parsed.settings || typeof parsed.settings !== "object" || Array.isArray(parsed.settings)) {
        throw new Error("Backup completo inválido: settings faltante o inválido");
      }
      return {
        kind: "full",
        data: {
          version: 1,
          app: "WebMatic",
          exportedAt: String(parsed.exportedAt || ""),
          macros: ensureArray(parsed.macros),
          settings: ensureObject(parsed.settings),
          ui: ensureObject(parsed.ui),
          metadata: ensureObject(parsed.metadata)
        }
      };
    }

    if (Array.isArray(parsed.macros)) {
      return {
        kind: "macros-only",
        data: {
          version: Number(parsed.version || 0),
          exportedAt: String(parsed.exportedAt || ""),
          macros: ensureArray(parsed.macros)
        }
      };
    }

    throw new Error("Formato de backup no soportado");
  }

  const api = Object.freeze({
    safeParseJson,
    createFullBackupPayload,
    parseBackupObject
  });

  globalScope.WebMaticFullBackup = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
