(function initEditorCatalogs(globalScope) {
  function catalogOptionsForSelector(catalogs, selector) {
    if (!selector) return null;
    const bag = catalogs && typeof catalogs === "object" ? catalogs : {};

    const keys = [selector.trim()];
    const idMatch = selector.trim().match(/^#([\w-]+)$/);
    if (idMatch) {
      keys.push(`#${idMatch[1]}`);
      keys.push(`input[name="${idMatch[1]}"]`);
    }

    for (const key of keys) {
      const arr = bag[key];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      return arr.map((o, idx) => ({
        index: idx,
        value: String(o && o.value != null ? o.value : ""),
        text: String(o && o.text != null ? o.text : ""),
        selected: !!(o && o.selected),
        disabled: !!(o && o.disabled)
      })).filter((o) => o.value || o.text);
    }
    return null;
  }

  const api = {
    catalogOptionsForSelector
  };

  globalScope.WebMaticEditorCatalogs = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);