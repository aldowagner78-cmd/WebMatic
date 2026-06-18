(function initEditorMeta(globalScope) {
  function cloneMeta(meta) {
    if (!meta || typeof meta !== "object") return null;
    return JSON.parse(JSON.stringify(meta));
  }

  function normalizeResetPolicyMode(policy) {
    const raw = String(policy && typeof policy === "object" ? policy.mode : policy || "").trim().toLowerCase();
    return raw === "start_and_resume" ? "start_and_resume" : "start_only";
  }

  function normalizeStepEditorMeta(meta) {
    const out = cloneMeta(meta) || {};
    out.preRunResetPolicy = { mode: normalizeResetPolicyMode(out.preRunResetPolicy) };
    return out;
  }

  function isBaselineDefaultStep(step) {
    return !!(step && step._baselineDefault === true);
  }

  function normalizeComparableStepValue(value) {
    if (Array.isArray(value)) return value.map(normalizeComparableStepValue);
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).sort().forEach((key) => {
        if (key === "_baselineDefault" || key === "_fast") return;
        if (key.startsWith("_wm")) return;
        out[key] = normalizeComparableStepValue(value[key]);
      });
      return out;
    }
    if (typeof value === "undefined") return null;
    return value;
  }

  function hasMeaningfulStepChanges(originalStep, updatedStep) {
    const a = normalizeComparableStepValue(originalStep || {});
    const b = normalizeComparableStepValue(updatedStep || {});
    return JSON.stringify(a) !== JSON.stringify(b);
  }

  const api = {
    cloneMeta,
    normalizeResetPolicyMode,
    normalizeStepEditorMeta,
    isBaselineDefaultStep,
    normalizeComparableStepValue,
    hasMeaningfulStepChanges
  };

  globalScope.WebMaticEditorMeta = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);