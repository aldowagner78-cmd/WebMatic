(function initHighlightManager(globalScope) {
  const _hlTimers = [];

  function highlightElement(el) {
    try {
      el.setAttribute("data-wm-hl", "1");
      el.style.transition = "box-shadow 0.08s";
      el.style.outline = "2px solid #ef4444";
      el.style.boxShadow = "0 0 0 4px rgba(239,68,68,0.4)";
      const tid = setTimeout(() => {
        el.style.outline = "";
        el.style.boxShadow = "";
        el.style.transition = "";
        el.removeAttribute("data-wm-hl");
      }, 500);
      _hlTimers.push(tid);
    } catch (e) { /* ignore */ }
  }

  function getViewport(doc) {
    const view = (doc && doc.defaultView) || (typeof window !== "undefined" ? window : null);
    return {
      width: view && Number.isFinite(Number(view.innerWidth)) ? Number(view.innerWidth) : 1024,
      height: view && Number.isFinite(Number(view.innerHeight)) ? Number(view.innerHeight) : 768
    };
  }

  function isSufficientlyVisible(el, deps) {
    if (!el || typeof el.getBoundingClientRect !== "function") return true;
    const doc = (deps && deps.document) || el.ownerDocument || (typeof document !== "undefined" ? document : null);
    const viewport = getViewport(doc);
    let rect = null;
    try { rect = el.getBoundingClientRect(); } catch (_e) { rect = null; }
    if (!rect) return true;
    const width = Math.max(0, Number(rect.width) || (Number(rect.right) - Number(rect.left)) || 0);
    const height = Math.max(0, Number(rect.height) || (Number(rect.bottom) - Number(rect.top)) || 0);
    if (width <= 0 || height <= 0) return true;

    const visibleX = Math.min(rect.right, viewport.width) - Math.max(rect.left, 0);
    const visibleY = Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0);
    return visibleX >= Math.min(width, 12) && visibleY >= Math.min(height, 12);
  }

  function isCenteredEnough(el, deps) {
    if (!el || typeof el.getBoundingClientRect !== "function") return true;
    const doc = (deps && deps.document) || el.ownerDocument || (typeof document !== "undefined" ? document : null);
    const viewport = getViewport(doc);
    let rect = null;
    try { rect = el.getBoundingClientRect(); } catch (_e) { rect = null; }
    if (!rect) return true;
    const width = Math.max(0, Number(rect.width) || (Number(rect.right) - Number(rect.left)) || 0);
    const height = Math.max(0, Number(rect.height) || (Number(rect.bottom) - Number(rect.top)) || 0);
    if (width <= 0 || height <= 0) return true;

    const margin = Math.min(48, Math.max(12, Math.round(Math.min(viewport.width, viewport.height) * 0.06)));
    const fullyVisible = rect.left >= margin && rect.top >= margin && rect.right <= viewport.width - margin && rect.bottom <= viewport.height - margin;
    const centerX = rect.left + width / 2;
    const centerY = rect.top + height / 2;
    const nearCenterX = centerX >= viewport.width * 0.30 && centerX <= viewport.width * 0.70;
    const nearCenterY = centerY >= viewport.height * 0.25 && centerY <= viewport.height * 0.75;
    return fullyVisible && nearCenterX && nearCenterY;
  }

  function getVisibilityInfo(el, deps) {
    const info = {
      isSufficientlyVisible: isSufficientlyVisible(el, deps),
      isCenteredEnough: isCenteredEnough(el, deps)
    };
    info.needsScroll = !info.isSufficientlyVisible || !info.isCenteredEnough;
    info.reason = !info.isSufficientlyVisible
      ? "outside_viewport"
      : (!info.isCenteredEnough ? "near_edge" : "comfortable");
    return info;
  }

  function focusStepElement(el, deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const setTimeoutFn = options.setTimeout || (typeof setTimeout !== "undefined" ? setTimeout : null);
    const waitAfterScrollMs = Number.isFinite(Number(options.waitAfterScrollMs)) ? Math.max(0, Number(options.waitAfterScrollMs)) : 180;
    const waitAfterNearEdgeScrollMs = Number.isFinite(Number(options.waitAfterNearEdgeScrollMs)) ? Math.max(0, Number(options.waitAfterNearEdgeScrollMs)) : 120;
    const waitWhenComfortableMs = Number.isFinite(Number(options.waitWhenComfortableMs)) ? Math.max(0, Number(options.waitWhenComfortableMs)) : 80;
    if (!el || typeof el.scrollIntoView !== "function") {
      return Promise.resolve({
        didScroll: false,
        elementWasAlreadyComfortablyVisible: true,
        reason: "no_element"
      });
    }
    const visibility = getVisibilityInfo(el, options);
    const shouldCenter = visibility.needsScroll;
    let didScroll = false;

    if (shouldCenter) {
      try {
        el.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
        didScroll = true;
      } catch (_e) {
        try {
          el.scrollIntoView({ block: "center", inline: "center" });
          didScroll = true;
        } catch (__e) {
          return Promise.resolve({
            didScroll: false,
            elementWasAlreadyComfortablyVisible: false,
            reason: "scroll_failed"
          });
        }
      }
    }

    const waitMs = didScroll
      ? (visibility.reason === "near_edge" ? waitAfterNearEdgeScrollMs : waitAfterScrollMs)
      : waitWhenComfortableMs;
    const result = {
      didScroll,
      elementWasAlreadyComfortablyVisible: !shouldCenter,
      reason: visibility.reason
    };
    if (!setTimeoutFn || waitMs <= 0) return Promise.resolve(result);
    return new Promise((resolve) => setTimeoutFn(() => resolve(result), waitMs));
  }

  function clearAllHighlights(deps) {
    _hlTimers.forEach(t => clearTimeout(t));
    _hlTimers.length = 0;
    const doc = (deps && deps.document) || (typeof document !== "undefined" ? document : null);
    if (!doc) return;
    try {
      doc.querySelectorAll("[data-wm-hl]").forEach(el => {
        el.style.outline = "";
        el.style.boxShadow = "";
        el.style.transition = "";
        el.removeAttribute("data-wm-hl");
      });
    } catch (e) { /* ignore */ }
  }

  const api = {
    highlightElement,
    isSufficientlyVisible,
    isCenteredEnough,
    getVisibilityInfo,
    focusStepElement,
    clearAllHighlights
  };

  globalScope.WebMaticHighlightManager = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
