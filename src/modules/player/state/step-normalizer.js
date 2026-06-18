(function initStepNormalizer(globalScope) {
  function normalizeStepsForPlayback(steps) {
    if (!Array.isArray(steps)) return [];
    const cloned = steps.map((s) => (s && typeof s === "object" ? { ...s } : s));

    return cloned.filter((step, i, arr) => {
      if (!step || !step.selector) return true;
      const selector = String(step.selector || "");
      const transientHint = /(next|siguiente|prev|anterior|close|cerrar|arrow|flecha|gallery|thumbnail|overlay)/i.test(selector);

      if (step.type === "click" && transientHint) {
        for (let k = i + 1; k < arr.length; k++) {
          const t = arr[k] && arr[k].type;
          if (t === "wait" || t === "hover" || t === "scroll_to") continue;
          if (t === "navigate") return false;
          if (t === "input" || t === "text" || t === "check" || t === "choose_option" || t === "extract" || t === "click") break;
        }
      }

      if (step.type === "hover") {
        for (let k = i + 1; k < arr.length; k++) {
          const t = arr[k] && arr[k].type;
          if (t === "wait" || t === "hover" || t === "scroll_to") continue;
          if (t === "navigate") return false;
          if (t === "input" || t === "text" || t === "check" || t === "choose_option" || t === "extract" || t === "click" || t === "wait_for") break;
        }
      }

      if (step.type !== "wait_for") return true;

      let j = i + 1;
      while (j < arr.length && arr[j] && arr[j].type === "wait") j++;
      const next = arr[j];

      if (next && next.type === "click" && next.selector === step.selector) {
        let k = j + 1;
        while (k < arr.length) {
          const t = arr[k] && arr[k].type;
          if (t === "wait" || t === "hover" || t === "scroll_to") {
            k++;
            continue;
          }
          break;
        }
        if (arr[k] && arr[k].type === "navigate") return false;
      }

      if (transientHint) {
        for (let k = i + 1; k < arr.length; k++) {
          const t = arr[k] && arr[k].type;
          if (t === "wait" || t === "hover" || t === "scroll_to") continue;
          if (t === "navigate") return false;
          if (t === "input" || t === "text" || t === "check" || t === "choose_option" || t === "extract") break;
        }
      }

      return true;
    });
  }

  const api = {
    normalizeStepsForPlayback
  };

  globalScope.WebMaticStepNormalizer = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);