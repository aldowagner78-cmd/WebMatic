(function initDefaultSelector(globalScope) {
  function buildSelectorForDefault(el) {
    const Rec = globalScope.WebMaticRecorder;

    if (Rec && typeof Rec.buildSelector === "function") {
      return Rec.buildSelector(el);
    }

    if (el.id) {
      return "#" + el.id;
    }

    const tag = (el.tagName || "").toLowerCase();
    const name = el.getAttribute && el.getAttribute("name");

    if (name) {
      return `${tag}[name="${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
    }

    return "";
  }

  const api = {
    buildSelectorForDefault
  };

  globalScope.WebMaticDefaultSelector = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);