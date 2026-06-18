(function initPreRunResetUtils(globalScope) {
  function splitSelectorList(raw) {
    if (!raw) return [];
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function normalizePreRunResetPolicy(policy) {
    const raw = String(policy && typeof policy === "object" ? policy.mode : policy || "")
      .trim()
      .toLowerCase();

    if (raw === "start_and_resume" || raw === "resume" || raw === "all") {
      return "start_and_resume";
    }

    return "start_only";
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  function sameResetPage(preRunReset, currentHref) {
    const baselineUrl = String((preRunReset && preRunReset.url) || "").trim();
    if (!baselineUrl) return true;

    try {
      const base = new URL(baselineUrl, currentHref);
      const current = new URL(currentHref);

      return base.origin === current.origin &&
        base.pathname === current.pathname &&
        base.search === current.search;
    } catch (_e) {
      return true;
    }
  }

  function isSilentInternalStep(step) {
    return !!(
      step &&
      step._fast === true &&
      (step.type === "capture_defaults" || step._baselineDefault === true)
    );
  }

  function isBaselineDefaultStep(step) {
    return !!(step && step._baselineDefault === true);
  }

  const api = {
    splitSelectorList,
    normalizePreRunResetPolicy,
    sleep,
    sameResetPage,
    isSilentInternalStep,
    isBaselineDefaultStep
  };

  globalScope.WebMaticPreRunResetUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);