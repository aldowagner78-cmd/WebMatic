(function initActionInputText(globalScope) {
  function runInputText(ctx, deps) {
    const context = ctx && typeof ctx === "object" ? ctx : {};
    const options = deps && typeof deps === "object" ? deps : {};

    const step = context.step || {};
    const el = context.el;
    const selector = context.selector;
    const value = context.value;
    const silentStep = !!context.silentStep;

    const highlightElement = options.highlightElement;
    const setInputValue = options.setInputValue;
    const isLikelyLoginInputTarget = options.isLikelyLoginInputTarget;
    const tryClickAutocomplete = options.tryClickAutocomplete;
    const resolve = options.resolve;
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    const KeyboardEventCtor = options.KeyboardEvent || (typeof KeyboardEvent !== "undefined" ? KeyboardEvent : null);

    if (!silentStep && typeof highlightElement === "function") highlightElement(el);
    el.focus();
    setInputValue(el, value);
    const keepFocusForLogin = !!(typeof isLikelyLoginInputTarget === "function" && isLikelyLoginInputTarget(el, selector));

    tryClickAutocomplete(value).then(clicked => {
      if (!clicked) {
        if (!keepFocusForLogin) {
          try {
            const esc = { key: "Escape", keyCode: 27, bubbles: true, cancelable: true };
            if (KeyboardEventCtor) {
              el.dispatchEvent(new KeyboardEventCtor("keydown", esc));
              if (doc) doc.dispatchEvent(new KeyboardEventCtor("keydown", esc));
            }
          } catch (_) {}
        }
      }
      if (!keepFocusForLogin) {
        try { el.blur(); } catch (_) {}
      }
      if (typeof resolve === "function") resolve();
    });
  }

  const api = {
    runInputText
  };

  globalScope.WebMaticActionInputText = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
