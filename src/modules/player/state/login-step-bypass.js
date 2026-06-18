(function initLoginStepBypass(globalScope) {
  function isLikelyLoginSelector(raw) {
    const selector = String(raw || "").toLowerCase();

    if (!selector) return false;

    return /(login|log in|signin|sign in|auth|autent|usuario|user|mail|email|clave|contras|password|passwd|pwd|ingresar|iniciar sesion|acceder|codusu|usuacod|idusu|\busu\b)/i.test(selector);
  }

  function hasVisiblePasswordField(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    const isInteractable = options.isInteractable;

    try {
      if (!doc) return false;

      const list = doc.querySelectorAll('input[type="password"]');

      return Array.from(list).some((el) => {
        return typeof isInteractable === "function" ? isInteractable(el) : true;
      });
    } catch (_e) {
      return false;
    }
  }

  function getFirstVisiblePasswordField(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    const isInteractable = options.isInteractable;

    try {
      if (!doc) return null;

      const list = doc.querySelectorAll('input[type="password"]');

      return Array.from(list).find((el) => {
        return typeof isInteractable === "function" ? isInteractable(el) : true;
      }) || null;
    } catch (_e) {
      return null;
    }
  }

  function isLikelyLoginInputTarget(el, selector) {
    if (isLikelyLoginSelector(selector || "")) return true;

    if (!el) return false;

    try {
      if (el instanceof HTMLInputElement) {
        const type = String(el.type || "").toLowerCase();
        if (type === "password") return true;
      }

      const id = String(el.id || "");
      const name = String((el.getAttribute && el.getAttribute("name")) || "");
      const aria = String((el.getAttribute && el.getAttribute("aria-label")) || "");

      return /(password|passwd|pwd|clave|contras|usuario|user|mail|email|codusu|usuacod|idusu|login|signin|ingresar|acceder)/i.test(`${id} ${name} ${aria}`);
    } catch (_e) {
      return false;
    }
  }

  function isAuthenticatedLikeContext(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const win = options.window || (typeof window !== "undefined" ? window : null);

    const href = String((win && win.location && win.location.href) || "");
    const looksLikeLoginUrl = /(login|signin|auth|oauth|sesion|session|acceso|ingresar)/i.test(href);

    if (looksLikeLoginUrl) return false;

    return !hasVisiblePasswordField(options);
  }

  function shouldBypassMissingLoginStep(stepType, selector, deps) {
    if (!isLikelyLoginSelector(selector)) return false;
    if (!isAuthenticatedLikeContext(deps)) return false;

    return [
      "wait_for",
      "click",
      "input",
      "text",
      "check",
      "choose_option",
      "loop_until"
    ].includes(String(stepType || ""));
  }

  const api = {
    isLikelyLoginSelector,
    hasVisiblePasswordField,
    getFirstVisiblePasswordField,
    isLikelyLoginInputTarget,
    isAuthenticatedLikeContext,
    shouldBypassMissingLoginStep
  };

  globalScope.WebMaticLoginStepBypass = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);