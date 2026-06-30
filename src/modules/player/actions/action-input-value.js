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

  function _eventCtor(el, name) {
    const view = (el && el.ownerDocument && el.ownerDocument.defaultView) || globalThis;
    if (view && typeof view.Event === "function") return new view.Event(name, { bubbles: true, cancelable: true });
    return new Event(name, { bubbles: true, cancelable: true });
  }

  function _dispatchSelectEvents(el) {
    ["input", "change"].forEach((name) => {
      try { el.dispatchEvent(_eventCtor(el, name)); } catch (_e) { /* ignore */ }
    });

    try { if (typeof el.blur === "function") el.blur(); } catch (_e) { /* ignore */ }
    try { el.dispatchEvent(_eventCtor(el, "blur")); } catch (_e) { /* ignore */ }
    try { el.dispatchEvent(_eventCtor(el, "focusout")); } catch (_e) { /* ignore */ }
  }

  function _optionText(option) {
    return String((option && (option.text || option.innerText || option.textContent)) || "").trim();
  }

  function _selectDiagnostic(el, expectedValue, expectedText, expectedIndex, attempts) {
    const selected = el && el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
    return {
      ok: false,
      expectedValue: String(expectedValue == null ? "" : expectedValue),
      expectedText: String(expectedText == null ? "" : expectedText),
      expectedIndex: Number.isFinite(expectedIndex) ? expectedIndex : null,
      actualValue: String(el && el.value == null ? "" : el.value),
      actualText: _optionText(selected),
      actualIndex: el && typeof el.selectedIndex === "number" ? el.selectedIndex : -1,
      attempts: attempts.slice()
    };
  }

  function _setSelectOption(el, value, deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const str = String(value == null ? "" : value);
    const text = String(options.optionText == null ? "" : options.optionText).trim();
    const indexRaw = options.optionIndex != null ? Number(options.optionIndex) : NaN;
    const index = Number.isInteger(indexRaw) && indexRaw >= 0 ? indexRaw : NaN;
    const opts = () => Array.from(el.options || []);
    const proto = el.constructor.prototype || HTMLSelectElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    const setV = (v) => {
      if (desc && desc.set) desc.set.call(el, v);
      else el.value = v;
    };
    const attempts = [];

    const findByValue = (needle) => opts().find((o) => String(o.value) === String(needle)) || null;
    const findByText = (needle) => {
      const target = String(needle == null ? "" : needle).trim();
      if (!target) return null;
      return opts().find((o) => _optionText(o) === target) || null;
    };
    const findByIndex = (idx) => {
      const list = opts();
      return Number.isInteger(idx) && idx >= 0 && idx < list.length ? list[idx] : null;
    };

    const applyOption = (opt, method) => {
      if (!opt) return false;
      attempts.push(method);
      try { if (typeof el.focus === "function") el.focus(); } catch (_e) { /* ignore */ }
      try { opt.selected = true; } catch (_e) { /* ignore */ }
      try { el.selectedIndex = opts().indexOf(opt); } catch (_e) { /* ignore */ }
      setV(opt.value);
      _dispatchSelectEvents(el);
      return el.value === String(opt.value);
    };

    const valueOption = str ? findByValue(str) : null;
    if (valueOption && applyOption(valueOption, "value")) {
      return { ok: true, value: el.value, selectedIndex: el.selectedIndex, matchedBy: "value" };
    }

    const textNeedles = [];
    if (text) textNeedles.push(text);
    if (str && !textNeedles.includes(str)) textNeedles.push(str);
    if (valueOption) {
      const valueText = _optionText(valueOption);
      if (valueText && !textNeedles.includes(valueText)) textNeedles.push(valueText);
    }
    for (const needle of textNeedles) {
      const opt = findByText(needle);
      if (opt && applyOption(opt, "text")) {
        return { ok: true, value: el.value, selectedIndex: el.selectedIndex, matchedBy: "text", text: _optionText(opt) };
      }
    }

    if (Number.isInteger(index)) {
      const opt = findByIndex(index);
      if (opt && applyOption(opt, "index")) {
        return { ok: true, value: el.value, selectedIndex: el.selectedIndex, matchedBy: "index", text: _optionText(opt) };
      }
    }

    return _selectDiagnostic(el, str, text, index, attempts);
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

    if (tag === "select") return _setSelectOption(el, str, options);

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
