(function initEditorValidation(globalScope) {
  function normalizeEditedStep(updated, previousStep) {
    const next = updated && typeof updated === "object" ? updated : {};
    const prev = previousStep && typeof previousStep === "object" ? previousStep : {};

    if (next.type === "wait") {
      const n = Number(next.seconds);
      next.seconds = Number.isFinite(n) && n > 0 ? n : 1;
    }
    if (next.type === "check") {
      next.checked = next.checked === "true";
    }
    if (next.type === "if_exists") {
      next.then = prev.then || [];
      next.else = prev.else || [];
    }
    if (next.type === "loop_until") {
      next.max_iterations = Number(next.max_iterations) || 50;
      next.steps = prev.steps || [];
    }
    if (next.type === "for_each_row") {
      next.columns = String(next.columns || "").split(/,\s*/).map((c) => c.trim()).filter(Boolean);
      next.dataset = prev.dataset || [];
      next.steps = prev.steps || [];
    }

    return next;
  }

  function normalizeNewStep(step) {
    const next = step && typeof step === "object" ? step : {};

    if (next.type === "wait") {
      const n = Number(next.seconds);
      next.seconds = Number.isFinite(n) && n > 0 ? n : 1;
    }
    if (next.type === "check") {
      next.checked = next.checked === "true";
    }
    if (next.type === "if_exists") {
      next.then = [];
      next.else = [];
    }
    if (next.type === "loop_until") {
      next.max_iterations = Number(next.max_iterations) || 50;
      next.steps = [];
    }
    if (next.type === "for_each_row") {
      next.columns = String(next.columns || "").split(/,\s*/).map((c) => c.trim()).filter(Boolean);
      next.dataset = [];
      next.steps = [];
    }

    return next;
  }

  const api = {
    normalizeEditedStep,
    normalizeNewStep
  };

  globalScope.WebMaticEditorValidation = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);