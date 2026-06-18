(function initTransientRecovery(globalScope) {
  function isTransientGallerySelector(selector) {
    return /(next|siguiente|prev|anterior|close|cerrar|arrow|flecha|gallery|thumbnail|overlay)/i.test(String(selector || ""));
  }

  function hasNavigateSoon(steps, fromIndex, maxLookahead) {
    if (!Array.isArray(steps)) return false;

    const start = Math.max(0, Number(fromIndex) || 0);
    const max = Math.max(1, Number(maxLookahead) || 6);

    let seen = 0;

    for (let index = start; index < steps.length && seen < max; index++) {
      const type = steps[index] && steps[index].type;

      if (!type) continue;

      if (type === "wait" || type === "hover" || type === "scroll_to") {
        seen++;
        continue;
      }

      if (type === "navigate") return true;

      if (
        type === "input" ||
        type === "text" ||
        type === "check" ||
        type === "choose_option" ||
        type === "extract" ||
        type === "click"
      ) {
        return false;
      }

      seen++;
    }

    return false;
  }

  function isRecoverableTransientFailure(err, step, steps, stepIndex, deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const shouldBypassMissingLoginStep = options.shouldBypassMissingLoginStep;

    if (
      !step ||
      (
        step.type !== "click" &&
        step.type !== "wait_for" &&
        step.type !== "hover" &&
        step.type !== "input" &&
        step.type !== "text" &&
        step.type !== "check" &&
        step.type !== "choose_option"
      )
    ) {
      return false;
    }

    const msg = String((err && err.message) || err || "");

    if (
      typeof shouldBypassMissingLoginStep === "function" &&
      shouldBypassMissingLoginStep(step.type, step.selector || "")
    ) {
      return /Elemento no encontrado|wait_for: tiempo agotado/i.test(msg);
    }

    if (step.type === "hover") {
      return /Elemento no encontrado/i.test(msg);
    }

    if (!isTransientGallerySelector(step.selector || "")) return false;
    if (!hasNavigateSoon(steps, (stepIndex || 0) + 1, 8)) return false;

    return /Elemento no encontrado|wait_for: tiempo agotado/i.test(msg);
  }

  const api = {
    isTransientGallerySelector,
    hasNavigateSoon,
    isRecoverableTransientFailure
  };

  globalScope.WebMaticTransientRecovery = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);