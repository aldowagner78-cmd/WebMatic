(function initPreRunResetRunner(globalScope) {
  async function applyPreRunReset(preRunReset, reason, delayMs, deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const win = options.window || (typeof window !== "undefined" ? window : null);
    const sleep = options.sleep;
    const sameResetPage = options.sameResetPage;
    const restoreFormFromBaseline = options.restoreFormFromBaseline;

    if (!preRunReset || typeof preRunReset !== "object") return null;

    if (delayMs && typeof sleep === "function") {
      await sleep(delayMs);
    }

    const isSamePage = typeof sameResetPage === "function"
      ? sameResetPage(preRunReset)
      : true;

    if (!isSamePage) {
      try {
        console.info("[WebMatic][preRunReset:skippedPage]", {
          reason: String(reason || ""),
          baselineUrl: String(preRunReset.url || ""),
          currentUrl: String((win && win.location && win.location.href) || "")
        });
      } catch (_e) { /* ignore */ }

      return null;
    }

    if (typeof restoreFormFromBaseline !== "function") {
      throw new Error("restoreFormFromBaseline no esta disponible");
    }

    return restoreFormFromBaseline(preRunReset, { reason });
  }

  const api = {
    applyPreRunReset
  };

  globalScope.WebMaticPreRunResetRunner = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);