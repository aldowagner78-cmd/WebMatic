(function initPlayer(globalScope) {
  const utils = globalScope.WebMaticUtils;

  /**
   * Recursively searches for a CSS selector within a root node and any
   * attached Shadow Roots. Returns the first match or null.
   */
  function findInShadow(root, selector) {
    try {
      const direct = root.querySelector(selector);
      if (direct) return direct;
    } catch (e) {
      return null; // invalid selector
    }
    try {
      const all = root.querySelectorAll("*");
      for (const el of all) {
        if (el.shadowRoot) {
          const found = findInShadow(el.shadowRoot, selector);
          if (found) return found;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /**
   * Finds an element using a tiered selector strategy:
   * 1. CSS selector (id, name, aria-label, data-testid, nth-of-type) — with Shadow DOM fallback
   * 2. XPath (if selector starts with /)
   * 3. tag[text="..."] — searches by visible text content
   * Returns null if not found.
   */
  /**
   * Recursively searches for a CSS selector inside a document (including all
   * accessible nested iframes). Returns the first match or null.
   */
  function findInDocument(doc, selector) {
    if (!doc) return null;
    try {
      // Shadow DOM search within this document
      const direct = findInShadow(doc, selector);
      if (direct) return direct;
    } catch (e) { /* cross-origin iframe will throw */ }
    // Recurse into same-origin iframes
    try {
      const frames = doc.querySelectorAll("iframe, frame");
      for (const frame of frames) {
        try {
          const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
          if (!innerDoc) continue;
          const found = findInDocument(innerDoc, selector);
          if (found) return found;
        } catch (e) { /* cross-origin — skip */ }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function findElement(selector) {
    if (!selector) return null;

    // XPath
    if (selector.startsWith("/") || selector.startsWith("(")) {
      try {
        const result = document.evaluate(
          selector, document, null,
          XPathResult.FIRST_ORDERED_NODE_TYPE, null
        );
        return result.singleNodeValue || null;
      } catch (e) {
        return null;
      }
    }

    // tag[text="..."] — text-based search (also searches iframes)
    const textMatch = /^(\w+)\[text="([^"]+)"\]$/.exec(selector);
    if (textMatch) {
      const [, tagName, text] = textMatch;
      const escText = utils ? utils.escapeTextContent(text) : text.trim();
      // Search in main doc + all accessible iframes
      const docsToSearch = [document];
      try {
        const frames = document.querySelectorAll("iframe, frame");
        for (const frame of frames) {
          try {
            const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
            if (innerDoc) docsToSearch.push(innerDoc);
          } catch (e) { /* cross-origin */ }
        }
      } catch (e) { /* ignore */ }
      for (const d of docsToSearch) {
        try {
          const candidates = d.querySelectorAll(tagName);
          for (const el of candidates) {
            const elText = utils
              ? utils.escapeTextContent(el.textContent)
              : el.textContent.replace(/\s+/g, " ").trim();
            if (elText === escText) return el;
          }
        } catch (e) { /* ignore */ }
      }
      return null;
    }

    // Standard CSS selector — with Shadow DOM + iframe piercing
    return findInDocument(document, selector);
  }

  function _isInteractable(el) {
    if (!el || !(el instanceof Element)) return false;
    const htmlEl = /** @type {HTMLElement} */ (el);
    if ("disabled" in htmlEl && htmlEl.disabled) return false;
    const cs = getComputedStyle(htmlEl);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") return false;
    return htmlEl.getClientRects && htmlEl.getClientRects().length > 0;
  }

  function _allDocs(rootDoc) {
    const docs = [];
    function _walk(doc) {
      if (!doc) return;
      docs.push(doc);
      try {
        const frames = doc.querySelectorAll("iframe, frame");
        for (const frame of frames) {
          try {
            const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
            if (innerDoc) _walk(innerDoc);
          } catch (e) { /* cross-origin */ }
        }
      } catch (e) { /* ignore */ }
    }
    _walk(rootDoc || document);
    return docs;
  }

  function findBestCheckTarget(selector) {
    if (!selector) return null;
    // Keep XPath / custom text selectors on existing path.
    if (selector.startsWith("/") || selector.startsWith("(") || /^\w+\[text="/.test(selector)) {
      return findElement(selector);
    }
    const matches = [];
    for (const d of _allDocs(document)) {
      try {
        const list = d.querySelectorAll(selector);
        for (const el of list) {
          if (!(el instanceof HTMLInputElement)) continue;
          const t = (el.type || "").toLowerCase();
          if (t !== "checkbox" && t !== "radio") continue;
          matches.push(el);
        }
      } catch (e) { /* invalid selector */ }
    }
    if (matches.length === 0) return findElement(selector);
    const interactable = matches.find((el) => _isInteractable(el));
    return interactable || matches[0];
  }

  /**
   * Simulates a click on an element, dispatching mousedown + mouseup + click.
   */
  function simulateClick(el) {
    const isAnchor = el.tagName && el.tagName.toLowerCase() === "a";
    // Always dispatch mousedown + mouseup (page handlers may listen to these)
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    if (isAnchor) {
      // For anchors, use the native click() which guarantees href navigation
      // AND dispatches a real "click" event that bubbles. Avoids double-click/double-submit.
      el.click();
    } else {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }
  }

  /**
   * Sets the value of an input/select/textarea and fires input + change events.
   * Simulates real keyboard events character by character for frameworks like
   * GeneXus that listen to keydown/keypress/keyup instead of just input/change.
   */
  function setInputValue(el, value) {
    const tag = (el.tagName || "").toLowerCase();
    const str = String(value == null ? "" : value);

    // contenteditable elements do not have a .value — set innerText instead
    if (el.isContentEditable) {
      el.focus();
      document.execCommand("selectAll", false, null);
      if (!document.execCommand("insertText", false, str)) {
        el.innerText = str;
      }
      el.dispatchEvent(new Event("input",  { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    // <select>: set by value then by visible text
    if (tag === "select") {
      const proto = el.constructor.prototype || HTMLSelectElement.prototype;
      const desc  = Object.getOwnPropertyDescriptor(proto, "value");
      const setV  = (v) => { if (desc && desc.set) desc.set.call(el, v); else el.value = v; };
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

    // <input> / <textarea>: simulate real typing
    el.focus && el.focus();
    try { el.select(); } catch (_) {}

    // Attempt 1: execCommand fires beforeinput/input natively in Firefox
    if (document.execCommand("insertText", false, str)) {
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    // Attempt 2: native setter + per-character keyboard events
    const proto = el.constructor.prototype || HTMLInputElement.prototype;
    const desc  = Object.getOwnPropertyDescriptor(proto, "value");
    const nativeSet = (desc && desc.set) ? desc.set.bind(el) : (v) => { el.value = v; };

    nativeSet("");
    el.dispatchEvent(new Event("input", { bubbles: true }));

    for (const char of str) {
      const kc = char.charCodeAt(0);
      const kOpts = { key: char, charCode: kc, keyCode: kc, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent("keydown",  kOpts));
      el.dispatchEvent(new KeyboardEvent("keypress", kOpts));
      nativeSet(el.value + char);
      el.dispatchEvent(new InputEvent("input", { data: char, inputType: "insertText", bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", kOpts));
    }

    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * Expands variables in a string:
   * {{!NOW:fmt}} → formatted date
   * %VARNAME% or {{!VARNAME}} → looked up in vars map
   */
  function expandVariables(str, vars) {
    if (!str) return str;
    // {{!NOW:fmt}}
    str = str.replace(/\{\{!NOW:([^}]+)\}\}/g, (_, fmt) => {
      return utils ? utils.formatDate(fmt) : new Date().toLocaleString();
    });
    // {{!VARNAME}}
    str = str.replace(/\{\{!([^}]+)\}\}/g, (_, name) => {
      return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : "";
    });
    // %VARNAME%
    str = str.replace(/%([A-Z0-9_]+)%/gi, (_, name) => {
      return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : "";
    });
    return str;
  }

  /**
   * Executes a single step. Returns a promise.
   * step: { type: "click"|"dblclick"|"input"|"key"|"text"|"wait"|"extract"|"navigate", selector?, value?, key?, ms?, variable?, url? }
   */
  function executeStep(step, vars, retryMs, timeoutMs, speed) {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      function attempt() {
        if (step.type === "reset_fields") {
          const excl = step.exclude ? expandVariables(step.exclude, vars) : null;
          _resetPageForms(excl);
          resolve();
          return;
        }

        if (step.type === "capture_defaults") {
          const excludeRaw = step.exclude ? expandVariables(step.exclude, vars) : "";
          const explicitExcludes = _splitSelectorList(excludeRaw);
          const preserveSelectors = new Set(Array.isArray(step._preserveSelectors) ? step._preserveSelectors : []);
          const defaultSteps = _collectDefaultStepsFromPage({ preserveSelectors, explicitExcludes });
          (async () => {
            for (const ds of defaultSteps) {
              await executeStep(ds, vars, retryMs, timeoutMs, speed);
            }
            resolve();
          })().catch(reject);
          return;
        }

        if (step.type === "navigate") {
          const url = expandVariables(step.url || "", vars);
          if (url && window.location.href !== url) {
            window.location.href = url;
            // Navigation will unload the page; the promise intentionally never resolves
            // — the player saves state to background before calling this step.
          } else {
            resolve();
          }
          return;
        }

        if (step.type === "wait") {
          const rawMs = step.seconds != null
            ? Math.round(Number(step.seconds) * 1000)
            : (Number(step.ms) || 500);
          // Escalar por velocidad: a speed=2 un WAIT SECONDS=1 dura solo 500ms
          const scaledMs = Math.round(rawMs / (speed || 1));
          setTimeout(resolve, scaledMs);
          return;
        }

        if (step.type === "key") {
          const target = document.activeElement || document.body;
          ["keydown", "keyup"].forEach((t) =>
            target.dispatchEvent(new KeyboardEvent(t, { key: step.key, bubbles: true, cancelable: true }))
          );
          resolve();
          return;
        }

        // wait_for: espera hasta que el selector aparezca en el DOM (timeout propio opcional)
        if (step.type === "wait_for") {
          const wfSelector = expandVariables(step.selector || "", vars);
          const wfTimeout = step.timeout != null ? step.timeout : timeoutMs;
          const wfPoll = () => {
            const found = findElement(wfSelector);
            if (found) { resolve(); }
            else if (Date.now() - start < wfTimeout) { setTimeout(wfPoll, retryMs); }
            else { reject(new Error(`wait_for: tiempo agotado esperando "${wfSelector}"`)); }
          };
          wfPoll();
          return;
        }

        // set_variable: evalúa expresión numérica o string y guarda en vars
        if (step.type === "set_variable") {
          if (step.variable) {
            const raw = expandVariables(step.value || "", vars);
            try {
              if (/^[-\d\s+*/.()]+$/.test(raw.trim())) {
                // eslint-disable-next-line no-new-func
                vars[step.variable] = String(new Function(`"use strict"; return (${raw.trim()})`)());
              } else {
                vars[step.variable] = raw;
              }
            } catch (e) {
              vars[step.variable] = raw;
            }
          }
          resolve();
          return;
        }

        // drag_drop: arrastra desde un selector hasta otro usando secuencia DragEvent
        if (step.type === "drag_drop") {
          const fromSel = expandVariables(step.from || "", vars);
          const toSel = expandVariables(step.to || "", vars);
          const fromEl = findElement(fromSel);
          const toEl = findElement(toSel);
          if (!fromEl || !toEl) {
            if (Date.now() - start < timeoutMs) { setTimeout(attempt, retryMs); }
            else { reject(new Error(`drag_drop: elementos no encontrados: "${fromSel}" → "${toSel}"`)); }
            return;
          }
          try {
            const dt = new DataTransfer();
            fromEl.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
            toEl.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
            toEl.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
            toEl.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
            fromEl.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }));
          } catch (e) { /* DragEvent no disponible en todos los entornos */ }
          resolve();
          return;
        }

        // prompt: muestra un overlay y espera que el usuario ingrese un valor antes de continuar
        // { type:"prompt", label:"¿Cuál es el RUT?", variable:"RUT", default:"" }
        // En tests usar _testValue para auto-responder sin mostrar UI
        if (step.type === "prompt") {
          if (step._testValue !== undefined) {
            if (step.variable) vars[step.variable] = String(step._testValue);
            resolve();
            return;
          }
          const _overlay = document.createElement("div");
          _overlay.id = "wm-prompt-overlay";
          _overlay.style.cssText = [
            "position:fixed;top:0;left:0;right:0;bottom:0",
            "background:rgba(0,0,0,0.45)",
            "display:flex;align-items:center;justify-content:center",
            "z-index:2147483646;font-family:system-ui,sans-serif"
          ].join(";");
          const _box = document.createElement("div");
          _box.style.cssText = [
            "background:#fff;border-radius:10px;padding:24px 28px",
            "min-width:300px;max-width:420px;width:90%",
            "box-shadow:0 8px 32px rgba(0,0,0,0.22)"
          ].join(";");
          const _lbl = document.createElement("p");
          _lbl.style.cssText = "margin:0 0 12px;font-size:14px;color:#064e3b;font-weight:600";
          _lbl.textContent = step.label || "Ingresa un valor:";
          const _inp = document.createElement("input");
          _inp.type = "text";
          _inp.value = expandVariables(step.default || "", vars);
          _inp.style.cssText = [
            "display:block;width:100%;box-sizing:border-box",
            "border:1px solid #a7f3d0;border-radius:6px",
            "padding:8px 10px;font-size:14px;margin-bottom:14px"
          ].join(";");
          const _btn = document.createElement("button");
          _btn.textContent = "Continuar ▶";
          _btn.style.cssText = [
            "padding:8px 20px;background:#059669;color:#fff",
            "border:none;border-radius:6px;font-size:14px;cursor:pointer;width:100%"
          ].join(";");
          const _done = () => {
            if (step.variable) vars[step.variable] = _inp.value;
            try { document.body.removeChild(_overlay); } catch (e) { /* ignore */ }
            resolve();
          };
          _btn.addEventListener("click", _done);
          _inp.addEventListener("keydown", (e) => { if (e.key === "Enter") _done(); });
          _box.appendChild(_lbl);
          _box.appendChild(_inp);
          _box.appendChild(_btn);
          _overlay.appendChild(_box);
          document.body.appendChild(_overlay);
          setTimeout(() => { try { _inp.focus(); } catch (e) { /* ignore */ } }, 50);
          return;
        }

        // useCurrentValue: no tocar el campo — dejarlo con lo que ya tiene
        if ((step.type === "input" || step.type === "text") && step.useCurrentValue) {
          resolve();
          return;
        }

        const selector = expandVariables(step.selector || "", vars);
        const el = step.type === "check" ? findBestCheckTarget(selector) : findElement(selector);

        if (!el) {
          if (Date.now() - start < timeoutMs) {
            setTimeout(attempt, retryMs);
          } else {
            reject(new Error(`Elemento no encontrado: ${selector}`));
          }
          return;
        }

        const value = expandVariables(step.value || "", vars);

        if (step.type === "click") {
          _highlightElement(el);
          simulateClick(el);
        } else if (step.type === "dblclick") {
          _highlightElement(el);
          // Fire the full sequence: mousedown+up+click ×2, then dblclick
          [1, 1, 1, 2, 2, 2, 2].forEach((detail, i) => {
            const types = ["mousedown", "mouseup", "click", "mousedown", "mouseup", "click", "dblclick"];
            el.dispatchEvent(new MouseEvent(types[i], { bubbles: true, cancelable: true, detail }));
          });
        } else if (step.type === "input" || step.type === "text") {
          _highlightElement(el);
          el.focus();
          setInputValue(el, value);
          // Intentar seleccionar la opción del autocomplete (GeneXus, etc.)
          // Si no aparece ningún dropdown en ~400ms, sigue sin hacer nada
          _tryClickAutocomplete(value).then(clicked => {
            if (!clicked) {
              // Sin autocomplete: cerrar con Escape + blur
              try {
                const esc = { key: "Escape", keyCode: 27, bubbles: true, cancelable: true };
                el.dispatchEvent(new KeyboardEvent("keydown", esc));
                document.dispatchEvent(new KeyboardEvent("keydown", esc));
              } catch (_) {}
            }
            try { el.blur(); } catch (_) {}
            resolve();
          });
          return; // resolve() se llama dentro del .then()
        } else if (step.type === "check") {
          _highlightElement(el);
          const desired = step.checked === true || step.checked === "true";
          const elType = (el.type || "").toLowerCase();
          let _checkAttempts = 0;
          const _applyCheck = () => {
            if (elType === "radio") {
              // Radio buttons: simulate a click to activate the radio group logic correctly
              if (!el.checked && desired) simulateClick(el);
            } else {
              // Checkbox: prefer real click (framework logic), fallback to property + change
              if (el.checked !== desired) {
                if (_isInteractable(el)) {
                  simulateClick(el);
                } else {
                  el.checked = desired;
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                }
                // If a custom handler prevented state toggle, force desired state.
                if (el.checked !== desired) {
                  el.checked = desired;
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                }
              }
            }

            // Some legacy frameworks revert checkbox/radio state asynchronously.
            setTimeout(() => {
              if (el.checked === desired) {
                resolve();
                return;
              }
              _checkAttempts += 1;
              if (_checkAttempts < 3) {
                _applyCheck();
                return;
              }
              reject(new Error(`No se pudo establecer el estado CHECK esperado en: ${selector}`));
            }, 80);
          };
          _applyCheck();
          return;
        } else if (step.type === "extract") {
          const extracted = el.value !== undefined ? el.value : (el.textContent || "").trim();
          if (step.variable) vars[step.variable] = extracted;
        } else if (step.type === "scroll_to") {
          try { el.scrollIntoView({ behavior: "instant", block: "center" }); } catch (e) { /* ignore */ }
        } else if (step.type === "hover") {
          el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: true }));
          el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
        }

        resolve();
      }

      attempt();
    });
  }

  /**
   * Resets all form fields on the page to their default state.
   * Uses native form.reset() when possible; falls back to manual reset for loose fields.
   */
  function _clearInputsInDoc(doc, excludeSelector) {
    try {
      doc.querySelectorAll("input, select, textarea").forEach((el) => {
        try {
          if (el.closest && el.closest("#webmatic-panel-root")) return;
          if (excludeSelector) {
            try { if (el.matches(excludeSelector)) return; } catch (e) { /* ignore bad selector */ }
          }
          const type = (el.type || "").toLowerCase();
          if (type === "submit" || type === "button" || type === "image" ||
              type === "file" || type === "reset" || type === "hidden") return;
          if (type === "checkbox" || type === "radio") {
            el.checked = el.defaultChecked;
            el.dispatchEvent(new Event("change", { bubbles: true }));
          } else if (el.tagName.toLowerCase() === "select") {
            el.selectedIndex = 0;
            el.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            const proto = el.constructor.prototype || HTMLInputElement.prototype;
            const desc = Object.getOwnPropertyDescriptor(proto, "value");
            if (desc && desc.set) desc.set.call(el, ""); else el.value = "";
            el.dispatchEvent(new Event("input",  { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } catch (e) { /* ignore */ }
      });
      // Recurse into same-origin iframes
      doc.querySelectorAll("iframe, frame").forEach((fr) => {
        try { _clearInputsInDoc(fr.contentDocument || fr.contentWindow.document, excludeSelector); } catch (e) { /* cross-origin */ }
      });
    } catch (e) { /* ignore */ }
  }

  function _resetPageForms(excludeSelector) {
    _clearInputsInDoc(document, excludeSelector || null);
  }

  function _splitSelectorList(raw) {
    if (!raw) return [];
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function _collectModifiedSelectors(steps, startIndex) {
    const out = new Set();
    if (!Array.isArray(steps)) return out;
    for (let i = Math.max(0, startIndex || 0); i < steps.length; i++) {
      const s = steps[i];
      if (!s || typeof s !== "object") continue;
      if ((s.type === "input" || s.type === "text" || s.type === "check") && s.selector) {
        out.add(String(s.selector));
      }
      if (Array.isArray(s.steps)) {
        _collectModifiedSelectors(s.steps, 0).forEach((sel) => out.add(sel));
      }
      if (Array.isArray(s.then)) {
        _collectModifiedSelectors(s.then, 0).forEach((sel) => out.add(sel));
      }
      if (Array.isArray(s.else)) {
        _collectModifiedSelectors(s.else, 0).forEach((sel) => out.add(sel));
      }
      if (Array.isArray(s.fallback)) {
        _collectModifiedSelectors(s.fallback, 0).forEach((sel) => out.add(sel));
      }
    }
    return out;
  }

  function _buildSelectorForDefault(el) {
    const Rec = globalScope.WebMaticRecorder;
    if (Rec && typeof Rec.buildSelector === "function") {
      return Rec.buildSelector(el);
    }
    if (el.id) return "#" + el.id;
    const tag = (el.tagName || "").toLowerCase();
    const name = el.getAttribute && el.getAttribute("name");
    if (name) return `${tag}[name="${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
    return "";
  }

  function _collectDefaultStepsFromPage(opts) {
    const preserveSelectors = opts?.preserveSelectors || new Set();
    const explicitExcludes = opts?.explicitExcludes || [];
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

    function scanDoc(doc) {
      if (!doc) return;
      let fields = [];
      try {
        fields = Array.from(doc.querySelectorAll("input, select, textarea"));
      } catch (e) {
        fields = [];
      }

      for (const el of fields) {
        try {
          if (el.closest && (el.closest("#webmatic-panel-root") || el.closest("#webmatic-floating-recorder-global") || el.closest("#webmatic-floating-player-global"))) {
            continue;
          }
          const tag = (el.tagName || "").toLowerCase();
          const type = (el.type || "").toLowerCase();
          if (type === "submit" || type === "button" || type === "image" || type === "file" || type === "reset" || type === "hidden") continue;
          if (el.disabled || el.readOnly) continue;

          const cs = (doc.defaultView || window).getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          if ((!rect || (rect.width === 0 && rect.height === 0)) && type !== "radio" && type !== "checkbox") continue;

          const selector = _buildSelectorForDefault(el);
          if (!selector || seenSelectors.has(selector)) continue;
          if (preserveSelectors.has(selector) || isExplicitlyExcluded(el, selector)) continue;
          seenSelectors.add(selector);

          if (tag === "select") {
            const options = Array.from(el.options || []);
            const defaultOpt = options.find((o) => o.defaultSelected) || options[0] || null;
            const defaultValue = defaultOpt ? String(defaultOpt.value ?? "") : String(el.value ?? "");
            out.push({ type: "input", selector, value: defaultValue, _fast: true });
          } else if (type === "checkbox") {
            out.push({ type: "check", selector, checked: Boolean(el.defaultChecked), _fast: true });
          } else if (type === "radio") {
            if (el.defaultChecked) out.push({ type: "check", selector, checked: true, _fast: true });
          } else {
            out.push({ type: "input", selector, value: String(el.defaultValue ?? ""), _fast: true });
          }
        } catch (e) { /* ignore single field issues */ }
      }

      try {
        const frames = doc.querySelectorAll("iframe, frame");
        for (const frame of frames) {
          try {
            const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
            if (innerDoc) scanDoc(innerDoc);
          } catch (e) { /* cross-origin */ }
        }
      } catch (e) { /* ignore */ }
    }

    scanDoc(document);
    return out;
  }

  // Timers activos de highlight — para cancelarlos todos al terminar la macro
  const _hlTimers = [];

  /**
   * Espera hasta ~400ms a que aparezca un dropdown de autocompletado y hace clic
   * en la primera opción cuyo texto coincida exactamente con `value`.
   * Si no aparece ningún autocomplete, resuelve sin hacer nada (non-blocking).
   */
  function _tryClickAutocomplete(value) {
    return new Promise(resolve => {
      const needle = (value || "").trim().toLowerCase();
      if (!needle) { resolve(false); return; }
      let attempts = 0;
      const poll = () => {
        attempts++;
        const candidates = document.querySelectorAll("td, li, [role='option'], [role='listitem']");
        for (const c of candidates) {
          if (!c.offsetParent) continue;
          const rect = c.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          // Solo elementos dentro de un contenedor flotante (popup de autocomplete)
          let floating = false;
          let p = c.parentElement;
          for (let d = 0; d < 8 && p && p !== document.body; d++) {
            const pos = getComputedStyle(p).position;
            if (pos === "absolute" || pos === "fixed") { floating = true; break; }
            p = p.parentElement;
          }
          if (!floating) continue;
          if (c.textContent.trim().toLowerCase() === needle) {
            simulateClick(c);
            resolve(true);
            return;
          }
        }
        if (attempts < 4) setTimeout(poll, 120);
        else resolve(false);
      };
      setTimeout(poll, 150);
    });
  }

  function _highlightElement(el) {
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

  function _clearAllHighlights() {
    _hlTimers.forEach(t => clearTimeout(t));
    _hlTimers.length = 0;
    try {
      document.querySelectorAll("[data-wm-hl]").forEach(el => {
        el.style.outline = "";
        el.style.boxShadow = "";
        el.style.transition = "";
        el.removeAttribute("data-wm-hl");
      });
    } catch (e) { /* ignore */ }
  }

  class Player {
    constructor(options) {
      this.retryMs = options?.retryMs ?? 500;
      this.timeoutMs = options?.timeoutMs ?? 10000;
      this.isPlaying = false;
      this._abort = false;
    }

    /**
     * Plays an array of steps.
     * @param {object[]} steps
     * @param {object} options — { speed: number (0.5–3), onStep, onDone, onError }
     */
    async play(steps, options = {}) {
      if (!Array.isArray(steps) || steps.length === 0) return false;
      const speed = Math.max(0.5, Math.min(3, options.speed ?? 1));
      // Base delay between steps: 300ms at speed 1, scaled inversely
      const baseDelayMs = Math.round(300 / speed);
      const vars = options.vars || {};
      const startIndex = options.startIndex || 0;
      const macroId = options.macroId || null;
      this.isPlaying = true;
      this._abort = false;
      this._speed = speed;

      // Do not reset page forms implicitly: it can alter defaults not present in the recording.
      // If needed, callers can opt-in with options.autoReset=true or record an explicit reset_fields step.
      if (options.autoReset === true && startIndex === 0 && (!steps[0] || steps[0].type !== "reset_fields")) {
        const keepSels = steps
          .filter(s => (s.type === "input" || s.type === "text") && s.useCurrentValue && s.selector)
          .map(s => s.selector);
        _resetPageForms(keepSels.length > 0 ? keepSels.join(", ") : null);
      }

      try {
        for (let i = startIndex; i < steps.length; i++) {
          if (this._abort) break;
          const step = steps[i];
          const capturePreserve = step.type === "capture_defaults"
            ? Array.from(_collectModifiedSelectors(steps, i + 1))
            : null;
          const runnableStep = capturePreserve ? { ...step, _preserveSelectors: capturePreserve } : step;
          if (typeof options.onStep === "function") options.onStep(step, i);

          // Save resumption state BEFORE every step — if a navigation happens at any
          // point during this step (or any sleep/wait afterwards), the new page can
          // resume from index i+1. We only clear pending state on full completion.
            if (!runnableStep._fast && step.type !== "if_exists" && step.type !== "loop_until" &&
              step.type !== "try_fallback" && step.type !== "call_macro" &&
              step.type !== "for_each_row") {
            await new Promise((res) => {
              chrome.runtime.sendMessage({
                type: "SAVE_PLAYBACK_STATE",
                steps, index: i + 1, vars, speed, macroId
              }, () => { void chrome.runtime.lastError; res(); });
            });
          }

          // Pasos _fast (capturePageDefaults): ejecutar sin delay ni overhead de mensajes
          if (runnableStep._fast) {
            await executeStep(runnableStep, vars, this.retryMs, this.timeoutMs, this._speed);
            continue;
          }

          // if_exists: ejecuta rama 'then' si el selector existe en el DOM, 'else' si no
          // { type:"if_exists", selector, then:[...pasos], else:[...pasos] }
          if (step.type === "if_exists") {
            const _ifSel = expandVariables(step.selector || "", vars);
            const _ifFound = !!findElement(_ifSel);
            const _ifBranch = _ifFound ? (step.then || []) : (step.else || []);
            if (_ifBranch.length > 0) await this._runSubSteps(_ifBranch, vars, baseDelayMs);
            continue;
          }

          // loop_until: repite 'steps' mientras la condicion se cumpla (cap en max_iterations)
          // condition "not_exists" (default): repite mientras selector AUSENTE
          // condition "exists": repite mientras selector PRESENTE (ej. spinner de carga)
          if (step.type === "loop_until") {
            const _luMax = Number(step.max_iterations) || 50;
            const _luCond = step.condition || "not_exists";
            const _luSel = expandVariables(step.selector || "", vars);
            for (let _luIter = 0; _luIter < _luMax; _luIter++) {
              if (this._abort) break;
              const _luEl = findElement(_luSel);
              const _luKeep = _luCond === "exists" ? !!_luEl : !_luEl;
              if (!_luKeep) break;
              if (Array.isArray(step.steps) && step.steps.length > 0) {
                await this._runSubSteps(step.steps, vars, baseDelayMs);
              }
            }
            continue;
          }

          // try_fallback: ejecuta 'steps'; si alguno falla, ejecuta 'fallback' en su lugar
          // El error queda contenido — la macro no se detiene
          if (step.type === "try_fallback") {
            try {
              if (Array.isArray(step.steps) && step.steps.length > 0) {
                await this._runSubSteps(step.steps, vars, baseDelayMs);
              }
            } catch (_tfErr) {
              if (Array.isArray(step.fallback) && step.fallback.length > 0) {
                await this._runSubSteps(step.fallback, vars, baseDelayMs);
              }
            }
            continue;
          }

          // call_macro: ejecuta los pasos de otra macro como subrutina
          // Content.js pre-resuelve step.steps copiando los pasos de la macro referenciada
          // { type:"call_macro", macro_name:"NombreMacro", steps:[...] }
          if (step.type === "call_macro") {
            if (Array.isArray(step.steps) && step.steps.length > 0) {
              await this._runSubSteps(step.steps, vars, baseDelayMs);
            }
            continue;
          }

          // for_each_row: itera sobre un dataset ejecutando sub-pasos para cada fila
          // { type:"for_each_row", columns:["COL1","COL2"], dataset:[["v1","v2"],[...]], steps:[...] }
          // Variable especial {{!_ROW_INDEX}} contiene el indice de la fila actual (base 0)
          if (step.type === "for_each_row") {
            const _feCols = Array.isArray(step.columns) ? step.columns : [];
            const _feRows = Array.isArray(step.dataset) ? step.dataset : [];
            for (let _ri = 0; _ri < _feRows.length; _ri++) {
              if (this._abort) break;
              const _feRow = Array.isArray(_feRows[_ri]) ? _feRows[_ri] : Object.values(_feRows[_ri]);
              vars["_ROW_INDEX"] = String(_ri);
              _feCols.forEach((col, ci) => {
                vars[col] = _feRow[ci] !== undefined ? String(_feRow[ci]) : "";
              });
              if (Array.isArray(step.steps) && step.steps.length > 0) {
                await this._runSubSteps(step.steps, vars, baseDelayMs);
              }
            }
            continue;
          }

          // Before a navigate step: save resumption state to background, then execute
          if (step.type === "navigate") {
            const _navUrl = expandVariables(step.url || "", vars);
            if (_navUrl && window.location.href !== _navUrl) {
              // URL differs — navigation will unload the page; save state first
              await new Promise((res) => {
                chrome.runtime.sendMessage({
                  type: "SAVE_PLAYBACK_STATE",
                  steps, index: i + 1, vars, speed, macroId
                }, () => { void chrome.runtime.lastError; res(); });
              });
              window.location.href = _navUrl;
              // Page is unloading — this promise never continues; exit play()
              return true;
            }
            // URL is empty or matches current page — treat as no-op, continue loop
            if (i < steps.length - 1) await new Promise((r) => setTimeout(r, baseDelayMs));
            continue;
          }

          // Execute the step (state was already saved at the top of the loop)
          await executeStep(runnableStep, vars, this.retryMs, this.timeoutMs, this._speed);

          if (i < steps.length - 1) {
            await new Promise((r) => setTimeout(r, baseDelayMs));
          }
        }
        // Limpiar estado visual: cancelar highlights, cerrar dropdowns y quitar foco
        _clearAllHighlights();
        const _doFinalClean = () => {
          try {
            if (document.activeElement && document.activeElement !== document.body) {
              document.activeElement.blur();
            }
            // mousedown en body: simula click afuera y cierra autocompletes de GeneXus
            document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
            const esc = { key: "Escape", keyCode: 27, bubbles: true, cancelable: true };
            document.dispatchEvent(new KeyboardEvent("keydown", esc));
            document.dispatchEvent(new KeyboardEvent("keyup", esc));
          } catch (_) {}
        };
        _doFinalClean();
        // Segundo barrido: espera a que XHRs async de GeneXus muestren su dropdown y lo cerramos
        await new Promise(r => setTimeout(r, 400));
        _clearAllHighlights();
        _doFinalClean();
        // Clear pending playback state — playback completed normally
        try {
          chrome.runtime.sendMessage({ type: "CLEAR_PENDING_PLAYBACK" }, () => { void chrome.runtime.lastError; });
        } catch (_) {}
        if (typeof options.onDone === "function") options.onDone();
      } catch (err) {
        try {
          chrome.runtime.sendMessage({ type: "CLEAR_PENDING_PLAYBACK" }, () => { void chrome.runtime.lastError; });
        } catch (_) {}
        if (typeof options.onError === "function") options.onError(err);
      } finally {
        this.isPlaying = false;
      }
      return true;
    }

    stop() {
      this._abort = true;
      this.isPlaying = false;
      try {
        chrome.runtime.sendMessage({ type: "CLEAR_PENDING_PLAYBACK" }, () => { void chrome.runtime.lastError; });
      } catch (_) {}
    }

    // Ejecuta un paso simple o complejo de forma recursiva.
    // Garantiza que if_exists, loop_until, etc. dentro de sub-pasos también funcionen.
    async _execComplexStep(step, vars, baseDelayMs) {
      if (step.type === "if_exists") {
        const _ifSel = expandVariables(step.selector || "", vars);
        const _ifFound = !!findElement(_ifSel);
        const _ifBranch = _ifFound ? (step.then || []) : (step.else || []);
        if (_ifBranch.length > 0) await this._runSubSteps(_ifBranch, vars, baseDelayMs);
        return;
      }
      if (step.type === "loop_until") {
        const _luMax = Number(step.max_iterations) || 50;
        const _luCond = step.condition || "not_exists";
        const _luSel = expandVariables(step.selector || "", vars);
        for (let _luIter = 0; _luIter < _luMax; _luIter++) {
          if (this._abort) break;
          const _luEl = findElement(_luSel);
          const _luKeep = _luCond === "exists" ? !!_luEl : !_luEl;
          if (!_luKeep) break;
          if (Array.isArray(step.steps) && step.steps.length > 0) {
            await this._runSubSteps(step.steps, vars, baseDelayMs);
          }
        }
        return;
      }
      if (step.type === "try_fallback") {
        try {
          if (Array.isArray(step.steps) && step.steps.length > 0) {
            await this._runSubSteps(step.steps, vars, baseDelayMs);
          }
        } catch (_tfErr) {
          if (Array.isArray(step.fallback) && step.fallback.length > 0) {
            await this._runSubSteps(step.fallback, vars, baseDelayMs);
          }
        }
        return;
      }
      if (step.type === "call_macro") {
        if (Array.isArray(step.steps) && step.steps.length > 0) {
          await this._runSubSteps(step.steps, vars, baseDelayMs);
        }
        return;
      }
      if (step.type === "for_each_row") {
        const _feCols = Array.isArray(step.columns) ? step.columns : [];
        const _feRows = Array.isArray(step.dataset) ? step.dataset : [];
        for (let _ri = 0; _ri < _feRows.length; _ri++) {
          if (this._abort) break;
          const _feRow = Array.isArray(_feRows[_ri]) ? _feRows[_ri] : Object.values(_feRows[_ri]);
          vars["_ROW_INDEX"] = String(_ri);
          _feCols.forEach((col, ci) => {
            vars[col] = _feRow[ci] !== undefined ? String(_feRow[ci]) : "";
          });
          if (Array.isArray(step.steps) && step.steps.length > 0) {
            await this._runSubSteps(step.steps, vars, baseDelayMs);
          }
        }
        return;
      }
      // Simple step (navigate in sub-context treated as executeStep — no page-save needed)
      await executeStep(step, vars, this.retryMs, this.timeoutMs, this._speed);
    }

    // Ejecuta un sub-array de pasos secuencialmente.
    // Soporta pasos simples y complejos (if_exists, loop_until, etc.) de forma recursiva.
    async _runSubSteps(subSteps, vars, baseDelayMs) {
      for (let _j = 0; _j < subSteps.length; _j++) {
        if (this._abort) break;
        const subStep = subSteps[_j];
        const capturePreserve = subStep && subStep.type === "capture_defaults"
          ? Array.from(_collectModifiedSelectors(subSteps, _j + 1))
          : null;
        const runnableSubStep = capturePreserve ? { ...subStep, _preserveSelectors: capturePreserve } : subStep;
        await this._execComplexStep(runnableSubStep, vars, baseDelayMs);
        if (_j < subSteps.length - 1) {
          await new Promise((r) => setTimeout(r, baseDelayMs));
        }
      }
    }
  }

  globalScope.WebMaticPlayer = Player;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Player;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
