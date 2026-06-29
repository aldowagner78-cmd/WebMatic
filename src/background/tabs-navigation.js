(function initTabsNavigation(globalScope) {
  function urlMatches(tabUrl, desired) {
    const a = String(tabUrl || "").trim();
    const b = String(desired || "").trim();
    if (!a || !b) return false;
    return a === b || a.startsWith(b);
  }

  function isRestrictedUrl(url) {
    const u = String(url || "").trim();
    if (!u) return true;
    return /^(about:|chrome:|moz-extension:|chrome-extension:|data:|blob:)/i.test(u);
  }

  function buildPendingPlaybackState(tabId, message) {
    if (!Array.isArray(message && message.steps)) return null;
    const pending = {
      tabId,
      steps: message.steps,
      index: Number.isFinite(Number(message.index)) ? Number(message.index) : 0,
      vars: message.vars || {},
      speed: message.speed || 1,
      macroId: message.macroId || null
    };
    if (message.loopReplay && typeof message.loopReplay === "object") {
      pending.loopReplay = message.loopReplay;
    }
    return pending;
  }

  function resolveNavigationUrl(rawUrl, baseUrl) {
    const value = String(rawUrl || "").trim();
    if (!value) return { ok: false, error: "navigate_missing_url" };
    try {
      return { ok: true, url: new URL(value, String(baseUrl || "about:blank")).href };
    } catch (_e) {
      return { ok: false, error: "navigate_invalid_url" };
    }
  }

  function fileAccessHint(url) {
    if (!String(url || "").startsWith("file:")) return "";
    return " | SOLUCI\u00d3N: En Firefox ve a about:addons \u2192 WebMatic \u2192 habilitar 'Permitir acceso a URLs de archivo'. Alternativa: sirve el archivo con 'python -m http.server 8787' y usa http://127.0.0.1:8787/testindex.html";
  }

  const api = {
    urlMatches,
    isRestrictedUrl,
    buildPendingPlaybackState,
    resolveNavigationUrl,
    fileAccessHint
  };

  globalScope.WebMaticTabsNavigation = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
