(function initMacroJson(globalScope) {
  const SENSITIVE_RE = /(pass|password|passwd|pwd|token|secret|cvv|cvc|card|tarjeta|otp|pin|seguridad|security)/i;

  function _isSensitiveControl(ctrl) {
    if (!ctrl || typeof ctrl !== "object") return false;
    const id = String(ctrl.id || "");
    const name = String(ctrl.name || "");
    const type = String(ctrl.type || "").toLowerCase();
    const label = String(ctrl.label || "");
    const role = String(ctrl.role || "");
    return type === "password" ||
      SENSITIVE_RE.test(id) ||
      SENSITIVE_RE.test(name) ||
      SENSITIVE_RE.test(label) ||
      SENSITIVE_RE.test(role);
  }

  function _sanitizeMeta(meta) {
    if (!meta || typeof meta !== "object") return null;
    const out = Object.assign({}, meta);
    if (Array.isArray(meta.pageInventories)) {
      out.pageInventories = meta.pageInventories.map((inv) => {
        const next = Object.assign({}, inv);
        if (Array.isArray(inv.controls)) {
          next.controls = inv.controls.map((ctrl) => {
            const c = Object.assign({}, ctrl);
            if (_isSensitiveControl(c)) delete c.currentValue;
            return c;
          });
        }
        return next;
      });
    }
    return out;
  }

  function _cleanSteps(steps) {
    const arr = Array.isArray(steps) ? steps : [];
    return arr.map((s) => {
      const c = Object.assign({}, s);
      delete c._ts;
      return c;
    });
  }

  function createMacroPayload(macro) {
    const safeMacro = {
      name: String(macro && macro.name ? macro.name : "Macro"),
      steps: _cleanSteps(macro && macro.steps),
      createdAt: Number(macro && macro.createdAt) || Date.now()
    };
    if (macro && typeof macro.script === "string" && macro.script.trim()) {
      safeMacro.script = macro.script;
    }
    const meta = _sanitizeMeta(macro && macro.meta);
    if (meta) safeMacro.meta = meta;

    return {
      version: 1,
      app: "WebMatic",
      kind: "macro",
      exportedAt: new Date().toISOString(),
      macro: safeMacro
    };
  }

  function parseMacroPayload(obj) {
    if (!obj || typeof obj !== "object") throw new Error("Formato JSON inválido.");

    // Formato principal: envelope con kind=macro
    if (obj.kind === "macro" && obj.macro && typeof obj.macro === "object") {
      const src = obj.macro;
      const out = {
        name: String(src.name || "Macro importada"),
        steps: Array.isArray(src.steps) ? src.steps : [],
        script: typeof src.script === "string" ? src.script : "",
        createdAt: Number(src.createdAt) || Date.now()
      };
      if (src.meta && typeof src.meta === "object") out.meta = src.meta;
      return out;
    }

    // Compat: JSON "plano" de macro
    if (Array.isArray(obj.steps)) {
      const out = {
        name: String(obj.name || "Macro importada"),
        steps: obj.steps,
        script: typeof obj.script === "string" ? obj.script : "",
        createdAt: Number(obj.createdAt) || Date.now()
      };
      if (obj.meta && typeof obj.meta === "object") out.meta = obj.meta;
      return out;
    }

    throw new Error("El archivo JSON no contiene una macro válida.");
  }

  function parseMacroJson(rawText) {
    let parsed;
    try {
      parsed = JSON.parse(String(rawText || ""));
    } catch (e) {
      throw new Error("JSON inválido.");
    }
    return parseMacroPayload(parsed);
  }

  const api = {
    createMacroPayload,
    parseMacroPayload,
    parseMacroJson
  };

  globalScope.WebMaticMacroJson = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
