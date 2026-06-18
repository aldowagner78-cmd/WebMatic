(function initNavigationAnalyzer(globalScope) {
  function analyzeNavigation(currentHref, rawTargetUrl) {
    const targetRaw = String(rawTargetUrl || "").trim();

    if (!targetRaw) {
      return {
        targetUrl: "",
        sameDocument: false,
        mustUseBackground: false
      };
    }

    let currentUrl;
    let targetUrl;

    try {
      currentUrl = new URL(String(currentHref || ""));
      targetUrl = new URL(targetRaw, currentUrl.href);
    } catch (_e) {
      return {
        targetUrl: targetRaw,
        sameDocument: false,
        mustUseBackground: false
      };
    }

    const sameDocument =
      currentUrl.origin === targetUrl.origin &&
      currentUrl.pathname === targetUrl.pathname &&
      currentUrl.search === targetUrl.search;

    const mustUseBackground =
      targetUrl.protocol === "file:" ||
      currentUrl.protocol !== targetUrl.protocol;

    return {
      targetUrl: targetUrl.href,
      sameDocument,
      mustUseBackground,
      currentUrl,
      targetUrlObject: targetUrl
    };
  }

  const api = {
    analyzeNavigation
  };

  globalScope.WebMaticNavigationAnalyzer = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);