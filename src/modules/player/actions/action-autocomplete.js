(function initActionAutocomplete(globalScope) {
  function tryClickAutocomplete(value, deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    const win = options.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : null);
    const simulateClick = options.simulateClick;

    return new Promise((resolve) => {
      const needle = (value || "").trim().toLowerCase();

      if (!needle || !doc) {
        resolve(false);
        return;
      }

      let attempts = 0;

      const poll = () => {
        attempts++;

        const candidates = doc.querySelectorAll("td, li, [role='option'], [role='listitem']");

        for (const candidate of candidates) {
          if (!candidate.offsetParent) continue;

          const rect = candidate.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          let floating = false;
          let parent = candidate.parentElement;

          for (let depth = 0; depth < 8 && parent && parent !== doc.body; depth++) {
            const style = win && typeof win.getComputedStyle === "function"
              ? win.getComputedStyle(parent)
              : { position: "" };

            const position = style.position;

            if (position === "absolute" || position === "fixed") {
              floating = true;
              break;
            }

            parent = parent.parentElement;
          }

          if (!floating) continue;

          if (candidate.textContent.trim().toLowerCase() === needle) {
            if (typeof simulateClick === "function") {
              simulateClick(candidate);
            } else {
              candidate.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            }

            resolve(true);
            return;
          }
        }

        if (attempts < 4) {
          setTimeout(poll, 120);
        } else {
          resolve(false);
        }
      };

      setTimeout(poll, 150);
    });
  }

  function isLikelyAutocompleteInput(el, step) {
    if (!el) return false;

    const tag = String(el.tagName || "").toLowerCase();
    const type = String(el.type || "").toLowerCase();

    if (tag !== "input" && tag !== "textarea") return false;
    if (tag === "input" && type && !["text", "search", ""].includes(type)) return false;

    const role = String((el.getAttribute && el.getAttribute("role")) || "").toLowerCase();
    const ariaAutocomplete = String((el.getAttribute && el.getAttribute("aria-autocomplete")) || "").toLowerCase();
    const hasList = !!(el.getAttribute && el.getAttribute("list"));
    const cls = String(el.className || "").toLowerCase();
    const id = String(el.id || "").toLowerCase();
    const name = String((el.getAttribute && el.getAttribute("name")) || "").toLowerCase();
    const selector = String((step && step.selector) || "").toLowerCase();
    const hasTextToType = !!String((step && (step.text || step.value)) || "").trim();

    if (role === "combobox" || ariaAutocomplete || hasList) return true;
    if (/autocomplete|typeahead|select2|chosen|lookup|smart/.test(cls)) return true;
    if (/vdelegacion|vaucaespefc/.test(id)) return true;
    if (/vdelegacion|vaucaespefc/.test(name)) return true;
    if (/vdelegacion|vaucaespefc/.test(selector)) return true;

    return hasTextToType;
  }

  const api = {
    tryClickAutocomplete,
    isLikelyAutocompleteInput
  };

  globalScope.WebMaticActionAutocomplete = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);