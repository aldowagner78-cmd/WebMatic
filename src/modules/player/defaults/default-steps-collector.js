(function initDefaultStepsCollector(globalScope) {
  function collectDefaultStepsFromPage(opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    const win = options.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : null);
    const buildSelectorForDefault = options.buildSelectorForDefault;

    const preserveSelectors = options.preserveSelectors || new Set();
    const explicitExcludes = options.explicitExcludes || [];
    const seenSelectors = new Set();
    const out = [];

    function isExplicitlyExcluded(el, selector) {
      if (explicitExcludes.includes(selector)) return true;

      for (const exSel of explicitExcludes) {
        try {
          if (el.matches && el.matches(exSel)) return true;
        } catch (e) { /* ignore invalid explicit selector */ }
      }

      return false;
    }

    function scanDoc(currentDoc) {
      if (!currentDoc) return;

      let fields = [];
      try {
        fields = Array.from(currentDoc.querySelectorAll("input, select, textarea"));
      } catch (e) {
        fields = [];
      }

      for (const el of fields) {
        try {
          if (
            el.closest &&
            (
              el.closest("#webmatic-panel-root") ||
              el.closest("#webmatic-floating-recorder-global") ||
              el.closest("#webmatic-floating-player-global")
            )
          ) {
            continue;
          }

          const tag = (el.tagName || "").toLowerCase();
          const type = (el.type || "").toLowerCase();

          if (
            type === "submit" ||
            type === "button" ||
            type === "image" ||
            type === "file" ||
            type === "reset" ||
            type === "hidden"
          ) {
            continue;
          }

          if (el.disabled || el.readOnly) continue;

          const view = currentDoc.defaultView || win;
          const cs = view && typeof view.getComputedStyle === "function"
            ? view.getComputedStyle(el)
            : { display: "", visibility: "" };

          const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;

          if (cs.display === "none" || cs.visibility === "hidden") continue;
          if ((!rect || (rect.width === 0 && rect.height === 0)) && type !== "radio" && type !== "checkbox") continue;

          const selector = typeof buildSelectorForDefault === "function"
            ? buildSelectorForDefault(el)
            : "";

          if (!selector || seenSelectors.has(selector)) continue;
          if (preserveSelectors.has(selector) || isExplicitlyExcluded(el, selector)) continue;

          seenSelectors.add(selector);

          if (tag === "select") {
            const optionsList = Array.from(el.options || []);
            const defaultOpt = optionsList.find((o) => o.defaultSelected) || optionsList[0] || null;
            const defaultValue = defaultOpt ? String(defaultOpt.value ?? "") : String(el.value ?? "");

            out.push({
              type: "input",
              selector,
              value: defaultValue,
              _fast: true
            });
          } else if (type === "checkbox") {
            out.push({
              type: "check",
              selector,
              checked: Boolean(el.defaultChecked),
              _fast: true
            });
          } else if (type === "radio") {
            if (el.defaultChecked) {
              out.push({
                type: "check",
                selector,
                checked: true,
                _fast: true
              });
            }
          } else {
            out.push({
              type: "input",
              selector,
              value: String(el.defaultValue ?? ""),
              _fast: true
            });
          }
        } catch (e) { /* ignore single field issues */ }
      }

      try {
        const frames = currentDoc.querySelectorAll("iframe, frame");
        for (const frame of frames) {
          try {
            const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
            if (innerDoc) scanDoc(innerDoc);
          } catch (e) { /* cross-origin */ }
        }
      } catch (e) { /* ignore */ }
    }

    scanDoc(doc);
    return out;
  }

  const api = {
    collectDefaultStepsFromPage
  };

  globalScope.WebMaticDefaultStepsCollector = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);