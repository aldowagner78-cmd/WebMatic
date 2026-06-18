(function initActionInputValue(globalScope) {
  function setInputValue(el, value, deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const doc = options.document || (typeof document !== "undefined" ? document : null);

    const tag = (el.tagName || "").toLowerCase();
    const str = String(value == null ? "" : value);
    const canExecCommand = !!(doc && typeof doc.execCommand === "function");

    if (el.isContentEditable) {
      el.focus();

      if (canExecCommand) {
        doc.execCommand("selectAll", false, null);
      }

      if (!canExecCommand || !doc.execCommand("insertText", false, str)) {
        el.innerText = str;
      }

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    if (tag === "select") {
      const proto = el.constructor.prototype || HTMLSelectElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      const setV = (v) => {
        if (desc && desc.set) desc.set.call(el, v);
        else el.value = v;
      };

      setV(str);

      if (el.value !== str) {
        const opt = Array.from(el.options || []).find(
          (o) => (o.text || "").trim() === str.trim() || (o.innerText || "").trim() === str.trim()
        );

        if (opt) setV(opt.value);
      }

      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    if (el.focus) el.focus();

    try {
      el.select();
    } catch (_e) { /* ignore */ }

    if (canExecCommand && doc.execCommand("insertText", false, str)) {
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const proto = el.constructor.prototype || HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    const nativeSet = (desc && desc.set) ? desc.set.bind(el) : (v) => { el.value = v; };

    nativeSet("");
    el.dispatchEvent(new Event("input", { bubbles: true }));

    for (const char of str) {
      const kc = char.charCodeAt(0);
      const kOpts = {
        key: char,
        charCode: kc,
        keyCode: kc,
        bubbles: true,
        cancelable: true
      };

      el.dispatchEvent(new KeyboardEvent("keydown", kOpts));
      el.dispatchEvent(new KeyboardEvent("keypress", kOpts));

      nativeSet(el.value + char);

      if (typeof InputEvent !== "undefined") {
        el.dispatchEvent(new InputEvent("input", {
          data: char,
          inputType: "insertText",
          bubbles: true
        }));
      } else {
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }

      el.dispatchEvent(new KeyboardEvent("keyup", kOpts));
    }

    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const api = {
    setInputValue
  };

  globalScope.WebMaticActionInputValue = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);