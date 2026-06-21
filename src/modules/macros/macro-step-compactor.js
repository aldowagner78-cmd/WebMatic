(function initWebMaticMacroStepCompactor(globalScope) {
  const MAX_SAFE_AUTO_WAIT_SECONDS = 5;
  const SENSITIVE_RE = /(pass|password|passwd|pwd|token|secret|cvv|cvc|card|tarjeta|otp|pin|seguridad|security|clave|contrasen|contrasenia|api[-_]?key|authorization|auth)/i;

  function text(value) {
    return String(value == null ? "" : value);
  }

  function lower(value) {
    return text(value).trim().toLowerCase();
  }

  function controlValue(step, key) {
    return step && step.controlRef ? step.controlRef[key] : undefined;
  }

  function isWriteStep(step) {
    return !!(step && (step.type === "input" || step.type === "text") && step.selector);
  }

  function isShortAutoWait(step) {
    if (!step || step.type !== "wait") return false;
    if (step._manual === true || step.manual === true || step._significant === true || step.significant === true) return false;
    const seconds = Number(step.seconds);
    return !Number.isFinite(seconds) || seconds <= MAX_SAFE_AUTO_WAIT_SECONDS;
  }

  function fieldContext(step) {
    const keys = ["_wmBlockKey", "_wmPageKey", "pageKey", "pageUrl", "url"];
    for (const key of keys) {
      const value = text(step && step[key]).trim();
      if (value) return `${key}:${value}`;
    }
    return "";
  }

  function sameFieldContext(a, b) {
    const left = fieldContext(a);
    const right = fieldContext(b);
    if (!left && !right) return true;
    return !!left && left === right;
  }

  function sameField(a, b) {
    if (!isWriteStep(a) || !isWriteStep(b)) return false;
    if (a.selector !== b.selector) return false;
    const leftRef = text(controlValue(a, "selector")).trim();
    const rightRef = text(controlValue(b, "selector")).trim();
    if (leftRef && rightRef && leftRef !== rightRef) return false;
    return sameFieldContext(a, b);
  }

  function hasSensitiveMarker(step) {
    if (!step) return false;
    if (step.sensitive === true || step.isSensitive === true) return true;
    const ref = step.controlRef || {};
    if (ref.sensitive === true || ref.isSensitive === true) return true;
    const joined = [
      step.selector,
      step.name,
      step.id,
      step.label,
      step.autocomplete,
      ref.selector,
      ref.name,
      ref.id,
      ref.label,
      ref.autocomplete
    ].map(text).join(" ");
    return SENSITIVE_RE.test(joined);
  }

  function isDateField(step) {
    const ref = step && step.controlRef || {};
    const type = lower(step && (step.inputType || step.typeAttr || step.fieldType));
    const refType = lower(ref.type || ref.inputType || ref.fieldType);
    const kind = lower(ref.controlKind);
    return type === "date" || refType === "date" || kind.includes("date") || kind.includes("fecha");
  }

  function isBlockedControl(step) {
    const ref = step && step.controlRef || {};
    const tag = lower(ref.tag);
    const type = lower(ref.type || ref.inputType || step.inputType || step.typeAttr);
    const kind = lower(ref.controlKind);
    const role = lower(ref.role);
    const ariaAutocomplete = lower(ref.ariaAutocomplete || ref["aria-autocomplete"]);
    const inputMode = lower(ref.inputMode);
    const blockedKinds = new Set([
      "native-select",
      "select",
      "checkbox",
      "radio",
      "option",
      "choose-option",
      "choose_option",
      "combobox",
      "listbox",
      "autocomplete",
      "autocomplete-input",
      "datalist"
    ]);

    if (tag === "select") return true;
    if (["password", "date", "checkbox", "radio", "file", "hidden"].includes(type)) return true;
    if (blockedKinds.has(kind)) return true;
    if (role === "combobox" || role === "listbox" || role === "option") return true;
    if (ariaAutocomplete || inputMode === "autocomplete") return true;
    return false;
  }

  function isSafeEditableWrite(step) {
    if (!isWriteStep(step)) return false;
    if (step._baselineDefault || step._fast) return false;
    if (hasSensitiveMarker(step) || isDateField(step) || isBlockedControl(step)) return false;
    const ref = step.controlRef || null;
    if (!ref) return true;

    const tag = lower(ref.tag);
    const kind = lower(ref.controlKind);
    const contentEditable = lower(ref.contentEditable);
    const type = lower(ref.type || ref.inputType || step.inputType || step.typeAttr);
    const allowedTypes = new Set(["", "text", "search", "email", "tel", "url", "number"]);

    if (contentEditable === "true" || contentEditable === "plaintext-only") return true;
    if (tag === "textarea") return true;
    if ((!tag || tag === "input") && allowedTypes.has(type)) {
      return !kind || kind === "unknown" || kind === "text-input" || kind === "textarea" || kind === "contenteditable";
    }
    return false;
  }

  function shouldCompactRun(inputs) {
    if (!Array.isArray(inputs) || inputs.length < 2) return false;
    if (!inputs.every(isSafeEditableWrite)) return false;
    if (text(inputs[inputs.length - 1].value) === "") return false;
    for (let i = 1; i < inputs.length; i += 1) {
      if (!sameField(inputs[0], inputs[i])) return false;
    }
    return true;
  }

  function compactRedundantTextWrites(steps) {
    const list = Array.isArray(steps) ? steps : [];
    const out = [];

    for (let i = 0; i < list.length; i += 1) {
      const step = list[i];
      if (!isSafeEditableWrite(step)) {
        out.push({ ...step });
        continue;
      }

      const runItems = [step];
      const runInputs = [step];
      let j = i + 1;

      while (j < list.length) {
        const current = list[j];
        if (isShortAutoWait(current)) {
          let k = j;
          while (k < list.length && isShortAutoWait(list[k])) k += 1;
          const next = list[k];
          if (isSafeEditableWrite(next) && sameField(step, next)) {
            while (j < k) {
              runItems.push(list[j]);
              j += 1;
            }
            continue;
          }
          break;
        }

        if (isSafeEditableWrite(current) && sameField(step, current)) {
          runItems.push(current);
          runInputs.push(current);
          j += 1;
          continue;
        }

        break;
      }

      if (shouldCompactRun(runInputs)) {
        out.push({ ...runInputs[runInputs.length - 1] });
        i = j - 1;
        continue;
      }

      out.push(...runItems.map((item) => ({ ...item })));
      i = j - 1;
    }

    return out;
  }

  const api = {
    compactRedundantTextWrites,
    isSafeEditableWrite,
    isShortAutoWait
  };

  globalScope.WebMaticMacroStepCompactor = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
