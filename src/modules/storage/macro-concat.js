(function initWebMaticMacroConcat(globalScope) {
  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function stepsFromMacro(macro, iimAdapter) {
    if (Array.isArray(macro && macro.steps)) return clone(macro.steps);
    if (macro && macro.script && iimAdapter && typeof iimAdapter.importFromIim === "function") {
      const parsed = iimAdapter.importFromIim(macro.script) || {};
      return Array.isArray(parsed.steps) ? clone(parsed.steps) : [];
    }
    return [];
  }

  function tagConcatenatedMacroSegment(steps) {
    const out = Array.isArray(steps) ? clone(steps) : [];
    if (out.length > 0 && out[0] && typeof out[0] === "object") {
      out[0]._wmBlockStart = true;
      out[0]._wmCollapsed = true;
    }
    return out;
  }

  function mergeMeta(macros) {
    const out = {};
    const pageInventories = [];
    const autocompleteCatalogs = {};
    const list = Array.isArray(macros) ? macros : [];

    for (const macro of list) {
      const meta = macro && macro.meta && typeof macro.meta === "object" ? macro.meta : null;
      if (!meta) continue;
      Object.assign(out, clone(meta));
      if (Array.isArray(meta.pageInventories)) {
        meta.pageInventories.forEach((item) => pageInventories.push(clone(item)));
      }
      if (meta.autocompleteCatalogs && typeof meta.autocompleteCatalogs === "object") {
        Object.assign(autocompleteCatalogs, clone(meta.autocompleteCatalogs));
      }
    }

    if (pageInventories.length > 0) out.pageInventories = pageInventories;
    if (Object.keys(autocompleteCatalogs).length > 0) out.autocompleteCatalogs = autocompleteCatalogs;
    return Object.keys(out).length > 0 ? out : null;
  }

  function buildConcatenatedMacro(options) {
    const opts = options || {};
    const baseMacro = opts.baseMacro;
    const appendMacros = Array.isArray(opts.appendMacros) ? opts.appendMacros : [];
    const iimAdapter = opts.iimAdapter || null;
    if (!baseMacro || appendMacros.length === 0) return null;

    const macros = [baseMacro].concat(appendMacros);
    const steps = macros.flatMap((macro) => tagConcatenatedMacroSegment(stepsFromMacro(macro, iimAdapter)));
    const name = String(opts.name || "").trim() || macros.map((macro) => macro.name).filter(Boolean).join(" + ");
    const meta = mergeMeta(macros);
    const script = iimAdapter && typeof iimAdapter.exportToIim === "function"
      ? iimAdapter.exportToIim({ steps, meta })
      : "";
    const now = typeof opts.now === "function" ? opts.now() : Date.now();
    const random = typeof opts.random === "function" ? opts.random() : Math.random();

    return {
      id: `macro_${now}_${Math.floor(random * 10000)}`,
      name,
      steps,
      script,
      createdAt: now,
      ...(meta ? { meta } : {})
    };
  }

  const api = {
    stepsFromMacro,
    tagConcatenatedMacroSegment,
    mergeMeta,
    buildConcatenatedMacro
  };

  globalScope.WebMaticMacroConcat = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
