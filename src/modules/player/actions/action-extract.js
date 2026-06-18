(function initActionExtract(globalScope) {
  function extract(step, el, vars) {
    const extracted = el.value !== undefined ? el.value : (el.textContent || "").trim();
    if (step.variable) vars[step.variable] = extracted;
  }

  const api = {
    extract
  };

  globalScope.WebMaticActionExtract = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
