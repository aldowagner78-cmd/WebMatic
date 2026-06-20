(function initActionInputValue(globalScope) {
  function isIsoDate(value) {
    const raw = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
    const date = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return false;
    const [yyyy, mm, dd] = raw.split("-").map((part) => Number(part));
    return date.getUTCFullYear() === yyyy && (date.getUTCMonth() + 1) === mm && date.getUTCDate() === dd;
  }

  function isArgDate(value) {
    const raw = String(value || "").trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return false;
    const [dd, mm, yyyy] = raw.split("/").map((part) => Number(part));
    const date = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (Number.isNaN(date.getTime())) return false;
    return date.getUTCFullYear() === yyyy && (date.getUTCMonth() + 1) === mm && date.getUTCDate() === dd;
  }

  function isoToArgDate(value) {
    if (!isIsoDate(value)) return String(value == null ? "" : value);
    const [yyyy, mm, dd] = String(value).trim().split("-");
    return `${dd}/${mm}/${yyyy}`;
  }

  function argDateToIso(value) {
    if (!isArgDate(value)) return String(value == null ? "" : value);
    const [dd, mm, yyyy] = String(value).trim().split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

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

    if (tag === "input" && String(el.type || "").toLowerCase() === "date") {
      const normalized = isArgDate(str) ? argDateToIso(str) : str;
      const proto = el.constructor.prototype || HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      const nativeSet = (desc && desc.set) ? desc.set.bind(el) : (v) => { el.value = v; };

      nativeSet(normalized);
      el.dispatchEvent(new Event("input", { bubbles: true }));
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
    setInputValue,
    isIsoDate,
    isArgDate,
    isoToArgDate,
    argDateToIso
  };

  globalScope.WebMaticActionInputValue = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);