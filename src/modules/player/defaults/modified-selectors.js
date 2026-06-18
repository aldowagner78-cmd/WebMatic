(function initModifiedSelectors(globalScope) {
  function collectModifiedSelectors(steps, startIndex) {
    const out = new Set();

    if (!Array.isArray(steps)) return out;

    for (let i = Math.max(0, startIndex || 0); i < steps.length; i++) {
      const step = steps[i];

      if (!step || typeof step !== "object") continue;

      if (
        (
          step.type === "input" ||
          step.type === "text" ||
          step.type === "check" ||
          step.type === "choose_option"
        ) &&
        step.selector
      ) {
        out.add(String(step.selector));
      }

      if (Array.isArray(step.steps)) {
        collectModifiedSelectors(step.steps, 0).forEach((selector) => out.add(selector));
      }

      if (Array.isArray(step.then)) {
        collectModifiedSelectors(step.then, 0).forEach((selector) => out.add(selector));
      }

      if (Array.isArray(step.else)) {
        collectModifiedSelectors(step.else, 0).forEach((selector) => out.add(selector));
      }

      if (Array.isArray(step.fallback)) {
        collectModifiedSelectors(step.fallback, 0).forEach((selector) => out.add(selector));
      }
    }

    return out;
  }

  const api = {
    collectModifiedSelectors
  };

  globalScope.WebMaticModifiedSelectors = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);