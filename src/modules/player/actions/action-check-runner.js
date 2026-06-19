(function initActionCheckRunner(globalScope) {
  function isInputElementLike(el, HTMLInputElementCtor) {
    if (!el || typeof el !== "object") return false;
    if (HTMLInputElementCtor && el instanceof HTMLInputElementCtor) return true;

    const tagName = typeof el.tagName === "string" ? el.tagName.toLowerCase() : "";
    return tagName === "input" && typeof el.checked === "boolean";
  }

  function runCheckAction(context, deps) {
    const ctx = context && typeof context === "object" ? context : {};
    const options = deps && typeof deps === "object" ? deps : {};

    const step = ctx.step || {};
    const el = ctx.el;
    const selector = ctx.selector;
    const silentStep = !!ctx.silentStep;

    const resolve = options.resolve;
    const reject = options.reject;
    const highlightElement = options.highlightElement;
    const simulateClick = options.simulateClick;
    const findCheckActivator = options.findCheckActivator;
    const setCheckedNative = options.setCheckedNative;
    const isInteractable = options.isInteractable;
    const setTimeoutFn = options.setTimeout || setTimeout;
    const HTMLInputElementCtor = options.HTMLInputElement || (typeof HTMLInputElement !== "undefined" ? HTMLInputElement : null);

    if (!silentStep && typeof highlightElement === "function") highlightElement(el);

    if (!isInputElementLike(el, HTMLInputElementCtor)) {
      simulateClick(el);
      resolve();
      return;
    }

    const desired = step.checked === true || step.checked === "true";
    const elType = (el.type || "").toLowerCase();
    let checkAttempts = 0;

    const applyCheck = () => {
      if (el.checked === desired) {
        resolve();
        return;
      }

      const activator = findCheckActivator(el);

      if (elType === "radio") {
        if (desired) {
          if (isInteractable(el)) {
            simulateClick(el);
          } else if (activator) {
            simulateClick(activator);
            if (el.checked !== true) {
              setCheckedNative(el, true);
            }
          } else {
            setCheckedNative(el, true);
          }
        }
      } else {
        if (el.checked !== desired) {
          if (isInteractable(el)) {
            simulateClick(el);
          } else if (activator) {
            simulateClick(activator);
          } else {
            setCheckedNative(el, desired);
          }
          if (el.checked !== desired) {
            setCheckedNative(el, desired);
          }
        }
      }

      setTimeoutFn(() => {
        if (el.checked === desired) {
          resolve();
          return;
        }
        checkAttempts += 1;
        if (checkAttempts < 3) {
          if (activator && isInteractable(activator)) {
            simulateClick(activator);
          }
          applyCheck();
          return;
        }

        if (
          desired === true &&
          (elType === "radio" || elType === "checkbox") &&
          (activator || !isInteractable(el))
        ) {
          resolve();
          return;
        }

        reject(new Error(`No se pudo establecer el estado CHECK esperado en: ${selector}`));
      }, 80);
    };

    applyCheck();
  }

  const api = {
    runCheckAction
  };

  globalScope.WebMaticActionCheckRunner = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
