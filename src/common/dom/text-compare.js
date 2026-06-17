(function initTextCompare(globalScope) {
  function normalizeTextForCompare(value, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const utils = options.utils || null;

    if (utils && typeof utils.escapeTextContent === "function") {
      return utils.escapeTextContent(String(value == null ? "" : value));
    }

    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function foldTextForCompare(value, opts) {
    return normalizeTextForCompare(value, opts)
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  const api = {
    normalizeTextForCompare,
    foldTextForCompare
  };

  globalScope.WebMaticTextCompare = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
