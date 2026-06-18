(function initPlayer(globalScope) {
  const utils = globalScope.WebMaticUtils;
  const PLAY_START_VAR = "__WEBMATIC_PLAY_START_MS__";

  // Acumulador de fallbacks aplicados durante una ejecución de play().
  // Se reinicia al inicio de play() y se entrega como summary.fallbacks en onDone().
  let _fallbackBucket = null;

  /**
   * Recursively searches for a CSS selector within a root node and any
   * attached Shadow Roots. Returns the first match or null.
   */
    function _elementFinder() {
    if (typeof WebMaticElementFinder !== "undefined") return WebMaticElementFinder;
    if (globalScope && globalScope.WebMaticElementFinder) return globalScope.WebMaticElementFinder;
    if (typeof require === "function") {
      try { return require("../../common/dom/element-finder.js"); } catch (_e) { /* ignore */ }
    }
    throw new Error("WebMaticElementFinder no está disponible");
  }

  function findInShadow(root, selector) {
    return _elementFinder().findInShadow(root, selector);
  }

  /**
   * Finds an element using a tiered selector strategy:
   * 1. CSS selector (id, name, aria-label, data-testid, nth-of-type) â€” with Shadow DOM fallback
   * 2. XPath (if selector starts with /)
   * 3. tag[text="..."] â€” searches by visible text content
   * Returns null if not found.
   */
  /**
   * Recursively searches for a CSS selector inside a document (including all
   * accessible nested iframes). Returns the first match or null.
   */
    function findInDocument(doc, selector) {
    return _elementFinder().findInDocument(doc, selector);
  }

  function _findKnownGalleryControlFallback(selector) {
    const sel = String(selector || "");
    if (!sel) return null;

    const isNext = /\[title\s*=\s*["']Next \(arrow right\)["']\]/i.test(sel)
      || /\[title\s*=\s*["']Siguiente \(flecha derecha\)["']\]/i.test(sel)
      || /gallery-next/i.test(sel);
    const isClose = /\[title\s*=\s*["']Close \(Esc\)["']\]/i.test(sel)
      || /\[title\s*=\s*["']Cerrar \(Esc\)["']\]/i.test(sel)
      || /gallery-close/i.test(sel);

    if (!isNext && !isClose) return null;

    const probes = isNext
      ? [
          "[data-testid='gallery-next']",
          "[title='Next (arrow right)']",
          "[title='Siguiente (flecha derecha)']",
          "[aria-label='Next (arrow right)']",
          "[aria-label='Siguiente (flecha derecha)']",
          "button[aria-label*='Next']",
          "button[aria-label*='Siguiente']"
        ]
      : [
          "[data-testid='gallery-close']",
          "[title='Close (Esc)']",
          "[title='Cerrar (Esc)']",
          "[aria-label='Close']",
          "[aria-label='Cerrar']",
          "button[aria-label*='Close']",
          "button[aria-label*='Cerrar']"
        ];

    for (const p of probes) {
      try {
        const list = document.querySelectorAll(p);
        const visible = Array.from(list).find((el) => _isInteractable(el));
        if (visible) return visible;
        if (list.length > 0) return list[0];
      } catch (_e) { /* ignore */ }
    }

    return null;
  }

  function _isLikelyGalleryNextSelector(selector) {
    const sel = String(selector || "");
    return /\[title\s*=\s*["']Next \(arrow right\)["']\]/i.test(sel)
      || /\[title\s*=\s*["']Siguiente \(flecha derecha\)["']\]/i.test(sel)
      || /gallery-next/i.test(sel);
  }

  function _isLikelyGalleryCloseSelector(selector) {
    const sel = String(selector || "");
    return /\[title\s*=\s*["']Close \(Esc\)["']\]/i.test(sel)
      || /\[title\s*=\s*["']Cerrar \(Esc\)["']\]/i.test(sel)
      || /gallery-close/i.test(sel);
  }

    function _textCompare() {
    if (typeof WebMaticTextCompare !== "undefined") return WebMaticTextCompare;
    if (globalScope && globalScope.WebMaticTextCompare) return globalScope.WebMaticTextCompare;
    if (typeof require === "function") {
      try { return require("../../common/dom/text-compare.js"); } catch (_e) { /* ignore */ }
    }
    throw new Error("WebMaticTextCompare no esta disponible");
  }

  function _normalizeTextForCompare(value) {
    return _textCompare().normalizeTextForCompare(value, { utils });
  }

  function _foldTextForCompare(value) {
    return _textCompare().foldTextForCompare(value, { utils });
  }

  function _findOpenLightboxNode() {
    const candidates = [
      "[role='dialog'][aria-modal='true']",
      "[role='dialog']",
      "[class*='lightbox' i]",
      "[class*='ui-pdp-gallery-modal' i]",
      "[id*='lightbox' i]",
      "[id*='ligthbox' i]"
    ];
    for (const sel of candidates) {
      try {
        const list = document.querySelectorAll(sel);
        for (const el of list) {
          if (_isInteractable(el)) return el;
        }
        if (list.length) return list[0];
      } catch (_e) { /* ignore */ }
    }
    return null;
  }

  function _findMainGalleryImageToOpen() {
    const probes = [
      "figure.ui-pdp-gallery__figure img",
      ".ui-pdp-gallery__figure img",
      "img[data-testid^='image-']",
      "[data-testid^='gallery-figure'] img",
      "[data-zoom]"
    ];
    for (const p of probes) {
      try {
        const list = document.querySelectorAll(p);
        const visible = Array.from(list).find((el) => _isInteractable(el));
        if (visible) return visible;
        if (list.length) return list[0];
      } catch (_e) { /* ignore */ }
    }
    return null;
  }

  function _dispatchKey(key, keyCode) {
    const init = { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true };
    const targets = [];
    try {
      const lb = _findOpenLightboxNode();
      if (lb) targets.push(lb);
    } catch (_e) { /* ignore */ }
    try { if (document.activeElement) targets.push(document.activeElement); } catch (_e) { /* ignore */ }
    try { if (document.body) targets.push(document.body); } catch (_e) { /* ignore */ }
    targets.push(document, window);
    for (const t of targets) {
      try {
        t.dispatchEvent(new KeyboardEvent("keydown", init));
        t.dispatchEvent(new KeyboardEvent("keyup", init));
      } catch (_e) { /* ignore */ }
    }
  }

  function _trySyntheticGalleryClick(selector) {
    const isNext = _isLikelyGalleryNextSelector(selector);
    const isClose = _isLikelyGalleryCloseSelector(selector);
    if (!isNext && !isClose) return false;

    try {
      if (isNext) {
        if (!_findOpenLightboxNode()) {
          const opener = _findMainGalleryImageToOpen();
          if (opener) {
            simulateClick(opener);
          }
        }
        _dispatchKey("ArrowRight", 39);
      } else {
        _dispatchKey("Escape", 27);
      }
      try {
        console.warn("[WebMatic][playback] synthetic gallery key fallback applied", {
          selector,
          action: isNext ? "ArrowRight" : "Escape"
        });
      } catch (_e) { /* ignore */ }
      try {
        if (Array.isArray(_fallbackBucket)) {
          _fallbackBucket.push({
            kind: "synthetic_key",
            action: isNext ? "ArrowRight" : "Escape",
            selector
          });
        }
      } catch (_e) { /* ignore */ }
      return true;
    } catch (_e) {
      return false;
    }
  }

    function findElement(selector) {
    return _elementFinder().findElement(selector, {
      document,
      normalizeTextForCompare: _normalizeTextForCompare,
      foldTextForCompare: _foldTextForCompare,
      knownFallback: _findKnownGalleryControlFallback
    });
  }

  function _selectorDiagnostics() {
    if (typeof WebMaticSelectorDiagnostics !== "undefined") return WebMaticSelectorDiagnostics;
    if (globalScope && globalScope.WebMaticSelectorDiagnostics) return globalScope.WebMaticSelectorDiagnostics;
    if (typeof require === "function") {
      try { return require("../../common/diagnostics/selector-diagnostics.js"); } catch (_e) { /* ignore */ }
    }
    throw new Error("WebMaticSelectorDiagnostics no está disponible");
  }

  function _isVisibleForDiagnostic(el) {
    return _selectorDiagnostics().isVisibleForDiagnostic(el);
  }

  function _summarizeElementForDiagnostic(el) {
    return _selectorDiagnostics().summarizeElementForDiagnostic(el);
  }

  function _collectSelectorDiagnostics(selector) {
    return _selectorDiagnostics().collectSelectorDiagnostics(selector, document);
  }

  function _logSelectorFailure(stepType, selector) {
    return _selectorDiagnostics().logSelectorFailure(stepType, selector, { document, globalScope });
  }

  function evaluateArithmeticExpression(expression) {
    const input = String(expression || "").trim();
    if (!input) throw new Error("Expresion vacia");

    const tokens = [];
    const pattern = /\s*([()+\-*/]|\d*\.?\d+)/gy;
    let match;
    let lastIndex = 0;
    while ((match = pattern.exec(input)) !== null) {
      if (match.index !== lastIndex) throw new Error("Expresion invalida");
      tokens.push(match[1]);
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex !== input.length) throw new Error("Expresion invalida");

    const output = [];
    const operators = [];
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };
    const applyOperator = () => {
      const operator = operators.pop();
      const right = output.pop();
      const left = output.pop();
      if (left == null || right == null) throw new Error("Expresion invalida");
      if (operator === "+") output.push(left + right);
      else if (operator === "-") output.push(left - right);
      else if (operator === "*") output.push(left * right);
      else if (operator === "/") output.push(left / right);
    };

    let expectValue = true;
    for (const token of tokens) {
      if (/^\d*\.?\d+$/.test(token)) {
        output.push(Number(token));
        expectValue = false;
        continue;
      }
      if (token === "(") {
        operators.push(token);
        expectValue = true;
        continue;
      }
      if (token === ")") {
        while (operators.length > 0 && operators[operators.length - 1] !== "(") {
          applyOperator();
        }
        if (operators.pop() !== "(") throw new Error("Expresion invalida");
        expectValue = false;
        continue;
      }
      if ("+-*/".includes(token)) {
        if (expectValue && token === "-") {
          output.push(0);
        } else if (expectValue) {
          throw new Error("Expresion invalida");
        }
        while (operators.length > 0 && precedence[operators[operators.length - 1]] >= precedence[token]) {
          applyOperator();
        }
        operators.push(token);
        expectValue = true;
        continue;
      }
      throw new Error("Expresion invalida");
    }

    while (operators.length > 0) {
      const operator = operators.pop();
      if (operator === "(") throw new Error("Expresion invalida");
      const right = output.pop();
      const left = output.pop();
      if (left == null || right == null) throw new Error("Expresion invalida");
      if (operator === "+") output.push(left + right);
      else if (operator === "-") output.push(left - right);
      else if (operator === "*") output.push(left * right);
      else if (operator === "/") output.push(left / right);
    }

    if (output.length !== 1 || !Number.isFinite(output[0])) throw new Error("Expresion invalida");
    return output[0];
  }

  function _isInteractable(el) {
    if (!el || !(el instanceof Element)) return false;
    const htmlEl = /** @type {HTMLElement} */ (el);
    if ("disabled" in htmlEl && htmlEl.disabled) return false;
    const view = (htmlEl.ownerDocument && htmlEl.ownerDocument.defaultView) || window;
    const cs = view && typeof view.getComputedStyle === "function"
      ? view.getComputedStyle(htmlEl)
      : { display: "", visibility: "", pointerEvents: "" };
    if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") return false;
    return htmlEl.getClientRects && htmlEl.getClientRects().length > 0;
  }

    function _actionCheck() {
    if (typeof WebMaticActionCheck !== "undefined") return WebMaticActionCheck;
    if (globalScope && globalScope.WebMaticActionCheck) return globalScope.WebMaticActionCheck;

    if (typeof require === "function") {
      return require("./actions/action-check.js");
    }

    throw new Error("WebMaticActionCheck no esta disponible");
  }
  function _allDocs(rootDoc) {
    return _actionCheck().allDocs(rootDoc || document);
  }

  function findBestCheckTarget(selector) {
    return _actionCheck().findBestCheckTarget(selector, {
      document,
      findElement,
      isInteractable: _isInteractable
    });
  }

  function _resolveLegacyDescendantFallback(step, selector) {
    const sel = String(selector || "").trim();
    if (!sel) return null;
    const m = /^(#[^\s>+~]+)\s+(input|select|textarea|button)\b/i.exec(sel);
    if (!m) return null;

    const baseSelector = m[1];
    const targetEl = findElement(baseSelector);
    if (!(targetEl instanceof Element)) return null;

    const stepType = String(step && step.type || "").toLowerCase();
    const tag = String(targetEl.tagName || "").toLowerCase();
    const type = String((targetEl.getAttribute && targetEl.getAttribute("type")) || "").toLowerCase();

    if (stepType === "check") {
      if (targetEl instanceof HTMLInputElement && (type === "checkbox" || type === "radio")) return targetEl;
      return null;
    }

    if (stepType === "input" || stepType === "text" || stepType === "choose_option") {
      if (targetEl instanceof HTMLInputElement || targetEl instanceof HTMLTextAreaElement || targetEl instanceof HTMLSelectElement) return targetEl;
      if (targetEl.isContentEditable) return targetEl;
      return null;
    }

    if (stepType === "click" || stepType === "dblclick" || stepType === "extract" || stepType === "scroll_to" || stepType === "hover") {
      if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button" || tag === "a") return targetEl;
      if (_isInteractable(targetEl)) return targetEl;
    }

    return null;
  }

  function _findAssociatedCheckInput(el) {
    return _actionCheck().findAssociatedCheckInput(el);
  }

  function _findCheckActivator(inputEl) {
    return _actionCheck().findCheckActivator(inputEl, {
      isInteractable: _isInteractable
    });
  }

  function _setCheckedNative(inputEl, desired) {
    return _actionCheck().setCheckedNative(inputEl, desired);
  }

  /**
   * Simulates a click on an element, dispatching mousedown + mouseup + click.
   */
    function _actionClick() {
    if (typeof WebMaticActionClick !== "undefined") return WebMaticActionClick;
    if (globalScope && globalScope.WebMaticActionClick) return globalScope.WebMaticActionClick;

    if (typeof require === "function") {
      return require("./actions/action-click.js");
    }

    throw new Error("WebMaticActionClick no esta disponible");
  }

  function simulateClick(el) {
    return _actionClick().simulateClick(el);
  }

  /**
   * Sets the value of an input/select/textarea and fires input + change events.
   * Simulates real keyboard events character by character for frameworks like
   * GeneXus that listen to keydown/keypress/keyup instead of just input/change.
   */
    function _actionInputValue() {
    if (typeof WebMaticActionInputValue !== "undefined") return WebMaticActionInputValue;
    if (globalScope && globalScope.WebMaticActionInputValue) return globalScope.WebMaticActionInputValue;

    if (typeof require === "function") {
      return require("./actions/action-input-value.js");
    }

    throw new Error("WebMaticActionInputValue no esta disponible");
  }

  function setInputValue(el, value) {
    return _actionInputValue().setInputValue(el, value, {
      document
    });
  }

  /**
   * Expands variables in a string:
   * {{!NOW:fmt}} â†’ formatted date
   * %VARNAME% or {{!VARNAME}} â†’ looked up in vars map
   */
    function _variableExpander() {
    if (typeof WebMaticVariableExpander !== "undefined") return WebMaticVariableExpander;
    if (globalScope && globalScope.WebMaticVariableExpander) return globalScope.WebMaticVariableExpander;

    if (typeof require === "function") {
      return require("./state/variable-expander.js");
    }

    throw new Error("WebMaticVariableExpander no esta disponible");
  }

  function expandVariables(str, vars) {
    return _variableExpander().expandVariables(str, vars, {
      utils
    });
  }

    function _navigationAnalyzer() {
    if (typeof WebMaticNavigationAnalyzer !== "undefined") return WebMaticNavigationAnalyzer;
    if (globalScope && globalScope.WebMaticNavigationAnalyzer) return globalScope.WebMaticNavigationAnalyzer;

    if (typeof require === "function") {
      return require("./navigation/navigation-analyzer.js");
    }

    throw new Error("WebMaticNavigationAnalyzer no esta disponible");
  }

  function _analyzeNavigation(currentHref, rawTargetUrl) {
    return _navigationAnalyzer().analyzeNavigation(currentHref, rawTargetUrl);
  }

    function _backgroundNavigator() {
    if (typeof WebMaticBackgroundNavigator !== "undefined") return WebMaticBackgroundNavigator;
    if (globalScope && globalScope.WebMaticBackgroundNavigator) return globalScope.WebMaticBackgroundNavigator;

    if (typeof require === "function") {
      return require("./navigation/background-navigator.js");
    }

    throw new Error("WebMaticBackgroundNavigator no esta disponible");
  }

  function _requestBackgroundNavigate(url, playbackState) {
    return _backgroundNavigator().requestBackgroundNavigate(url, playbackState, {
      chromeApi: chrome
    });
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
          if (!url || window.location.href === url) {
            resolve();
            return;
          }

          // Same-document navigations (typically hash-only changes) do not unload
          // the page, so this step must resolve to avoid freezing playback.
          const navInfo = _analyzeNavigation(window.location.href, url);
          if (navInfo.sameDocument) {
            if (navInfo.currentUrl && navInfo.targetUrlObject && navInfo.currentUrl.hash !== navInfo.targetUrlObject.hash) {
              window.location.hash = navInfo.targetUrlObject.hash || "";
            }
            resolve();
            return;
          }

          if (navInfo.mustUseBackground) {
            _requestBackgroundNavigate(navInfo.targetUrl || url, null)
              .then((resp) => {
                if (!resp || resp.ok !== true) {
                  const _errBase = (resp && resp.error) || "background_navigate_failed";
                  const _errDetail = (resp && resp.detail) ? `: ${resp.detail}` : "";
                  reject(new Error(`navigate failed: ${_errBase}${_errDetail}`));
                  return;
                }
              })
              .catch((err) => reject(err));
            return;
          }

          window.location.href = navInfo.targetUrl || url;
          // Navigation will unload the page; the promise intentionally never resolves
          // â€” the player saves state to background before calling this step.
          return;
        }

        if (step.type === "browser_back") {
          try {
            if (window.history && window.history.length > 1) {
              window.history.back();
              return;
            }
          } catch (_e) { /* ignore */ }
          resolve();
          return;
        }

        if (step.type === "browser_forward") {
          try {
            if (window.history && window.history.length > 0) {
              window.history.forward();
              return;
            }
          } catch (_e) { /* ignore */ }
          resolve();
          return;
        }

        if (step.type === "browser_history") {
          // Evento de historial sin direcciÃ³n inferida con certeza: no-op seguro.
          resolve();
          return;
        }

        if (step.type === "browser_reload") {
          try {
            window.location.reload();
            return;
          } catch (_e) { /* ignore */ }
          resolve();
          return;
        }

        if (step.type === "open_bookmark") {
          const url = expandVariables(step.url || "", vars);
          if (!url || window.location.href === url) {
            resolve();
            return;
          }
          window.location.href = url;
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
          const keySelector = expandVariables(step.selector || "", vars);
          let target = (keySelector && findElement(keySelector)) || document.activeElement || document.body;
          if (String(step.key || "") === "Enter") {
            const isBodyFocused = !target || target === document.body || target === document.documentElement;
            if (isBodyFocused) {
              const pwd = _getFirstVisiblePasswordField();
              if (pwd) target = pwd;
            }
          }
          // Foco real para que la lÃ³gica del navegador (submit por Enter, etc.)
          // funcione como cuando un humano usa el teclado.
          try { if (target && typeof target.focus === "function") target.focus(); } catch (_e) { /* ignore */ }

          const _keyName = String(step.key || "");
          const _keyCodeMap = { Enter: 13, Tab: 9, Escape: 27 };
          const _kc = _keyCodeMap[_keyName] || 0;
          const _keyInit = {
            key: _keyName,
            code: _keyName,
            keyCode: _kc,
            which: _kc,
            bubbles: true,
            cancelable: true
          };
          const _kd = new KeyboardEvent("keydown",  _keyInit);
          const _kp = new KeyboardEvent("keypress", _keyInit);
          const _ku = new KeyboardEvent("keyup",    _keyInit);
          target.dispatchEvent(_kd);
          target.dispatchEvent(_kp);
          target.dispatchEvent(_ku);

          // Comportamiento nativo del navegador: si Enter no fue preventDefault'd
          // dentro de un input de un <form>, el form se envÃ­a. Replicar eso aquÃ­
          // hace que login (IAPOS / GeneXus / cualquier form clÃ¡sico) funcione.
          if (
            _keyName === "Enter" &&
            !_kd.defaultPrevented &&
            !_kp.defaultPrevented &&
            target &&
            typeof target.closest === "function"
          ) {
            try {
              const _form = target.closest("form");
              if (_form) {
                if (typeof _form.requestSubmit === "function") _form.requestSubmit();
                else _form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
              }
            } catch (_e) { /* ignore */ }
          }
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
            else if (_shouldBypassMissingLoginStep("wait_for", wfSelector)) { resolve(); }
            else if (Date.now() - start < wfTimeout) { setTimeout(wfPoll, retryMs); }
            else {
              if (_shouldBypassMissingLoginStep("wait_for", wfSelector)) {
                resolve();
                return;
              }
              _logSelectorFailure("wait_for", wfSelector);
              reject(new Error(`wait_for: tiempo agotado esperando "${wfSelector}". Ver consola: [WebMatic][selector-diagnostic]`));
            }
          };
          wfPoll();
          return;
        }

        // set_variable: evalÃºa expresiÃ³n numÃ©rica o string y guarda en vars
        if (step.type === "set_variable") {
          if (step.variable) {
            const raw = expandVariables(step.value || "", vars);
            try {
              if (/^[-\d\s+*/.()]+$/.test(raw.trim())) {
                // eslint-disable-next-line no-new-func
                vars[step.variable] = String(evaluateArithmeticExpression(raw));
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
            else { reject(new Error(`drag_drop: elementos no encontrados: "${fromSel}" â†’ "${toSel}"`)); }
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
        // { type:"prompt", label:"Â¿CuÃ¡l es el RUT?", variable:"RUT", default:"" }
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
          _btn.textContent = "Continuar â–¶";
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

        // useCurrentValue: no tocar el campo â€” dejarlo con lo que ya tiene
        if ((step.type === "input" || step.type === "text") && step.useCurrentValue) {
          resolve();
          return;
        }

        const selector = expandVariables(step.selector || "", vars);
        let el = step.type === "check" ? findBestCheckTarget(selector) : findElement(selector);

        if (!el) {
          if (_shouldBypassMissingLoginStep(step.type, selector)) {
            resolve();
            return;
          }
          if (Date.now() - start < timeoutMs) {
            setTimeout(attempt, retryMs);
          } else {
            if (_shouldBypassMissingLoginStep(step.type, selector)) {
              resolve();
              return;
            }
            const legacyFallbackEl = _resolveLegacyDescendantFallback(step, selector);
            if (legacyFallbackEl) {
              el = legacyFallbackEl;
              try {
                if (Array.isArray(_fallbackBucket)) {
                  _fallbackBucket.push({ kind: "legacy_descendant_selector", original: selector });
                }
              } catch (_e) { /* ignore */ }
            } else if (step.type === "click" && _trySyntheticGalleryClick(selector)) {
              resolve();
              return;
            } else {
              _logSelectorFailure(step.type || "unknown", selector);
              reject(new Error(`Elemento no encontrado: ${selector}. Ver consola: [WebMatic][selector-diagnostic]`));
              return;
            }
          }
          if (!el) return;
        }

        const value = expandVariables(step.value || "", vars);
        const _silentStep = _isSilentInternalStep(step);

        if (step.type === "click") {
          if (!_silentStep) _highlightElement(el);
          simulateClick(el);
        } else if (step.type === "dblclick") {
          if (!_silentStep) _highlightElement(el);
          // Fire the full sequence: mousedown+up+click Ã—2, then dblclick
          [1, 1, 1, 2, 2, 2, 2].forEach((detail, i) => {
            const types = ["mousedown", "mouseup", "click", "mousedown", "mouseup", "click", "dblclick"];
            el.dispatchEvent(new MouseEvent(types[i], { bubbles: true, cancelable: true, detail }));
          });
        } else if (step.type === "choose_option") {
          if (!_silentStep) _highlightElement(el);
          const _resolvedValue = expandVariables(step.value || "", vars);
          const _resolvedText = expandVariables(step.text || "", vars);
          const _inputMode = String(step.inputMode || "").toLowerCase();
          const _controlKind = String(step && step.controlRef && step.controlRef.controlKind || "").toLowerCase();
          const _isSelect = el instanceof HTMLSelectElement;

          // choose_option tambiÃ©n soporta inputs con autocomplete cuando
          // el grabador promoviÃ³ input/text a choose_option (inputMode=autocomplete).
          if (!_isSelect) {
            const _autoDetected = _inputMode === "autocomplete"
              || _controlKind.indexOf("autocomplete") >= 0
              || _isLikelyAutocompleteInput(el, step);
            if (!_autoDetected) {
              reject(new Error(`choose_option requiere un <select> o inputMode=autocomplete: ${selector}`));
              return;
            }
            const _typed = _resolvedText || _resolvedValue;
            if (!_typed) {
              reject(new Error(`choose_option: falta value/text para autocomplete en ${selector}`));
              return;
            }
            el.focus();
            setInputValue(el, _typed);
            _tryClickAutocomplete(_typed).then(() => {
              try { el.blur(); } catch (_) {}
              if (step.variable) vars[step.variable] = _typed;
              resolve();
            });
            return;
          }

          // Resuelve la opción: primero por value, luego por texto visible exacto.
          const _findOption = (needle) => {
            const opts = Array.from(el.options || []);
            const byValue = opts.find((o) => String(o.value) === String(needle));
            if (byValue) return byValue;
            const target = String(needle).trim();
            return opts.find(
              (o) => (o.text || "").trim() === target || (o.innerText || "").trim() === target
            ) || null;
          };

          // Aplica la opción encontrada disparando input + change; falla controlada si no existe.
          const _selectByNeedle = (needle) => {
            const opt = _findOption(needle);
            if (!opt) {
              reject(new Error(`choose_option: opción no encontrada "${needle}" en ${selector}`));
              return;
            }
            setInputValue(el, opt.value);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            if (step.variable) vars[step.variable] = opt.value;
            resolve();
          };

          const _applyAndResolve = (v) => {
            setInputValue(el, v);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            if (step.variable) vars[step.variable] = v;
            resolve();
          };

          if (_resolvedValue) {
            _selectByNeedle(_resolvedValue);
            return;
          }

          if (_resolvedText) {
            _selectByNeedle(_resolvedText);
            return;
          }

          if (step._testValue !== undefined) {
            _applyAndResolve(String(step._testValue));
            return;
          }

          const _options = Array.from(el.options || []).filter((o) => !o.disabled);
          if (_options.length === 0) {
            reject(new Error(`choose_option sin opciones disponibles: ${selector}`));
            return;
          }

          const _overlay = document.createElement("div");
          _overlay.id = "wm-choose-option-overlay";
          _overlay.style.cssText = [
            "position:fixed;top:0;left:0;right:0;bottom:0",
            "background:rgba(0,0,0,0.45)",
            "display:flex;align-items:center;justify-content:center",
            "z-index:2147483646;font-family:system-ui,sans-serif"
          ].join(";");

          const _box = document.createElement("div");
          _box.style.cssText = [
            "background:#fff;border-radius:10px;padding:24px 28px",
            "min-width:340px;max-width:520px;width:92%",
            "box-shadow:0 8px 32px rgba(0,0,0,0.22)"
          ].join(";");

          const _lbl = document.createElement("p");
          _lbl.style.cssText = "margin:0 0 12px;font-size:14px;color:#064e3b;font-weight:600";
          _lbl.textContent = step.label || "Elige una opción:";

          const _sel = document.createElement("select");
          _sel.style.cssText = [
            "display:block;width:100%;box-sizing:border-box",
            "border:1px solid #a7f3d0;border-radius:6px",
            "padding:8px 10px;font-size:14px;margin-bottom:14px",
            "background:#fff"
          ].join(";");
          _options.forEach((opt) => {
            const _o = document.createElement("option");
            _o.value = String(opt.value ?? "");
            _o.textContent = (opt.text || opt.innerText || opt.value || "").trim();
            _sel.appendChild(_o);
          });
          _sel.value = String(el.value ?? "");

          const _btn = document.createElement("button");
          _btn.textContent = "Continuar â–¶";
          _btn.style.cssText = [
            "padding:8px 20px;background:#059669;color:#fff",
            "border:none;border-radius:6px;font-size:14px;cursor:pointer;width:100%"
          ].join(";");

          const _done = () => {
            const _chosen = _sel.value;
            try { document.body.removeChild(_overlay); } catch (e) { /* ignore */ }
            _applyAndResolve(_chosen);
          };

          _btn.addEventListener("click", _done);
          _sel.addEventListener("keydown", (e) => { if (e.key === "Enter") _done(); });

          _box.appendChild(_lbl);
          _box.appendChild(_sel);
          _box.appendChild(_btn);
          _overlay.appendChild(_box);
          document.body.appendChild(_overlay);
          setTimeout(() => { try { _sel.focus(); } catch (e) { /* ignore */ } }, 50);
          return;
        } else if (step.type === "input" || step.type === "text") {
          if (!_silentStep) _highlightElement(el);
          el.focus();
          setInputValue(el, value);
          const _keepFocusForLogin = _isLikelyLoginInputTarget(el, selector);
          // Intentar seleccionar la opción del autocomplete (GeneXus, etc.)
          // Si no aparece ningÃºn dropdown en ~400ms, sigue sin hacer nada
          _tryClickAutocomplete(value).then(clicked => {
            if (!clicked) {
              // Sin autocomplete: en login NO forzar Escape/blur para permitir Enter-submit.
              if (!_keepFocusForLogin) {
                try {
                  const esc = { key: "Escape", keyCode: 27, bubbles: true, cancelable: true };
                  el.dispatchEvent(new KeyboardEvent("keydown", esc));
                  document.dispatchEvent(new KeyboardEvent("keydown", esc));
                } catch (_) {}
              }
            }
            if (!_keepFocusForLogin) {
              try { el.blur(); } catch (_) {}
            }
            resolve();
          });
          return; // resolve() se llama dentro del .then()
        } else if (step.type === "check") {
          if (!_silentStep) _highlightElement(el);

          if (!(el instanceof HTMLInputElement)) {
            // Some imported macros may reference a visual toggle node instead of
            // the underlying input. Click it and continue.
            simulateClick(el);
            resolve();
            return;
          }

          const desired = step.checked === true || step.checked === "true";
          const elType = (el.type || "").toLowerCase();
          let _checkAttempts = 0;
          const _applyCheck = () => {
            if (el.checked === desired) {
              resolve();
              return;
            }

            const activator = _findCheckActivator(el);

            if (elType === "radio") {
              // Radio buttons: prefer real click paths to trigger group logic.
              if (desired) {
                if (_isInteractable(el)) {
                  simulateClick(el);
                } else if (activator) {
                  simulateClick(activator);
                } else {
                  _setCheckedNative(el, true);
                }
              }
            } else {
              // Checkbox: prefer real click paths, fallback to native property setter.
              if (el.checked !== desired) {
                if (_isInteractable(el)) {
                  simulateClick(el);
                } else if (activator) {
                  simulateClick(activator);
                } else {
                  _setCheckedNative(el, desired);
                }
                // If a custom handler prevented state toggle, force desired state.
                if (el.checked !== desired) {
                  _setCheckedNative(el, desired);
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
                // Retry once with activator-first path for custom widgets.
                if (activator && _isInteractable(activator)) {
                  simulateClick(activator);
                }
                _applyCheck();
                return;
              }

              // Best-effort fallback for custom visual toggles:
              // some component libraries trigger UI updates but never reflect the
              // final state in the hidden native input's .checked.
              if (
                desired === true &&
                (elType === "radio" || elType === "checkbox") &&
                (activator || !_isInteractable(el))
              ) {
                resolve();
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

  function _collectCurrentFormControls(doc, out) {
    if (!doc) return;
    try {
      const nodes = doc.querySelectorAll("input, select, textarea");
      nodes.forEach((el) => {
        try {
          if (el.closest && (el.closest("#webmatic-panel-root") || el.closest("#webmatic-floating-recorder-global") || el.closest("#webmatic-floating-player-global"))) {
            return;
          }
          const tag = String(el.tagName || "").toLowerCase();
          const type = String(el.type || "").toLowerCase();
          if (type === "hidden" || type === "submit" || type === "button" || type === "image" || type === "file" || type === "reset") return;
          out.push({
            tag,
            type,
            id: String(el.id || ""),
            name: String((el.getAttribute && el.getAttribute("name")) || "")
          });
        } catch (_e) { /* ignore */ }
      });
    } catch (_e) { /* ignore */ }

    try {
      const frames = doc.querySelectorAll("iframe, frame");
      frames.forEach((fr) => {
        try {
          _collectCurrentFormControls(fr.contentDocument || (fr.contentWindow && fr.contentWindow.document), out);
        } catch (_e) { /* cross-origin */ }
      });
    } catch (_e) { /* ignore */ }
  }

  function _setElementValueLikeUser(el, value) {
    const str = String(value == null ? "" : value);
    const proto = (el && el.constructor && el.constructor.prototype) || HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && typeof desc.set === "function") desc.set.call(el, str);
    else el.value = str;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

    function _baselineRestorer() {
    if (typeof WebMaticBaselineRestorer !== "undefined") return WebMaticBaselineRestorer;
    if (globalScope && globalScope.WebMaticBaselineRestorer) return globalScope.WebMaticBaselineRestorer;

    if (typeof require === "function") {
      return require("./defaults/baseline-restorer.js");
    }

    throw new Error("WebMaticBaselineRestorer no esta disponible");
  }

  function _restoreFormFromBaseline(preRunReset, context) {
    return _baselineRestorer().restoreFormFromBaseline(preRunReset, context, {
      document,
      findElement,
      collectCurrentFormControls: _collectCurrentFormControls,
      setCheckedNative: _setCheckedNative,
      setElementValueLikeUser: _setElementValueLikeUser
    });
  }

    function _preRunResetUtils() {
    if (typeof WebMaticPreRunResetUtils !== "undefined") return WebMaticPreRunResetUtils;
    if (globalScope && globalScope.WebMaticPreRunResetUtils) return globalScope.WebMaticPreRunResetUtils;

    if (typeof require === "function") {
      return require("./defaults/pre-run-reset-utils.js");
    }

    throw new Error("WebMaticPreRunResetUtils no esta disponible");
  }

    function _splitSelectorList(raw) {
    return _preRunResetUtils().splitSelectorList(raw);
  }

    function _modifiedSelectors() {
    if (typeof WebMaticModifiedSelectors !== "undefined") return WebMaticModifiedSelectors;
    if (globalScope && globalScope.WebMaticModifiedSelectors) return globalScope.WebMaticModifiedSelectors;

    if (typeof require === "function") {
      return require("./defaults/modified-selectors.js");
    }

    throw new Error("WebMaticModifiedSelectors no esta disponible");
  }

  function _collectModifiedSelectors(steps, startIndex) {
    return _modifiedSelectors().collectModifiedSelectors(steps, startIndex);
  }

    function _defaultSelector() {
    if (typeof WebMaticDefaultSelector !== "undefined") return WebMaticDefaultSelector;
    if (globalScope && globalScope.WebMaticDefaultSelector) return globalScope.WebMaticDefaultSelector;

    if (typeof require === "function") {
      return require("./defaults/default-selector.js");
    }

    throw new Error("WebMaticDefaultSelector no esta disponible");
  }

  function _buildSelectorForDefault(el) {
    return _defaultSelector().buildSelectorForDefault(el);
  }

    function _normalizePreRunResetPolicy(policy) {
    return _preRunResetUtils().normalizePreRunResetPolicy(policy);
  }

    function _sleep(ms) {
    return _preRunResetUtils().sleep(ms);
  }

    function _sameResetPage(preRunReset) {
    return _preRunResetUtils().sameResetPage(preRunReset, window.location.href);
  }

    function _preRunResetRunner() {
    if (typeof WebMaticPreRunResetRunner !== "undefined") return WebMaticPreRunResetRunner;
    if (globalScope && globalScope.WebMaticPreRunResetRunner) return globalScope.WebMaticPreRunResetRunner;

    if (typeof require === "function") {
      return require("./defaults/pre-run-reset-runner.js");
    }

    throw new Error("WebMaticPreRunResetRunner no esta disponible");
  }

  async function _applyPreRunReset(preRunReset, reason, delayMs) {
    return _preRunResetRunner().applyPreRunReset(preRunReset, reason, delayMs, {
      window,
      sleep: _sleep,
      sameResetPage: _sameResetPage,
      restoreFormFromBaseline: _restoreFormFromBaseline
    });
  }

    function _isSilentInternalStep(step) {
    return _preRunResetUtils().isSilentInternalStep(step);
  }

    function _isBaselineDefaultStep(step) {
    return _preRunResetUtils().isBaselineDefaultStep(step);
  }

    function _defaultStepsCollector() {
    if (typeof WebMaticDefaultStepsCollector !== "undefined") return WebMaticDefaultStepsCollector;
    if (globalScope && globalScope.WebMaticDefaultStepsCollector) return globalScope.WebMaticDefaultStepsCollector;

    if (typeof require === "function") {
      return require("./defaults/default-steps-collector.js");
    }

    throw new Error("WebMaticDefaultStepsCollector no esta disponible");
  }

  function _collectDefaultStepsFromPage(opts) {
    const options = opts && typeof opts === "object" ? opts : {};

    return _defaultStepsCollector().collectDefaultStepsFromPage({
      ...options,
      document,
      window,
      buildSelectorForDefault: _buildSelectorForDefault
    });
  }

  function _highlightManager() {
    if (typeof WebMaticHighlightManager !== "undefined") return WebMaticHighlightManager;
    if (globalScope && globalScope.WebMaticHighlightManager) return globalScope.WebMaticHighlightManager;
    if (typeof require === "function") {
      return require("./diagnostics/highlight-manager.js");
    }
    throw new Error("WebMaticHighlightManager no esta disponible");
  }

  /**
   * Espera hasta ~400ms a que aparezca un dropdown de autocompletado y hace clic
   * en la primera opción cuyo texto coincida exactamente con `value`.
   * Si no aparece ningÃºn autocomplete, resuelve sin hacer nada (non-blocking).
   */
    function _actionAutocomplete() {
    if (typeof WebMaticActionAutocomplete !== "undefined") return WebMaticActionAutocomplete;
    if (globalScope && globalScope.WebMaticActionAutocomplete) return globalScope.WebMaticActionAutocomplete;

    if (typeof require === "function") {
      return require("./actions/action-autocomplete.js");
    }

    throw new Error("WebMaticActionAutocomplete no esta disponible");
  }

  function _tryClickAutocomplete(value) {
    return _actionAutocomplete().tryClickAutocomplete(value, {
      document,
      window,
      simulateClick
    });
  }

  function _isLikelyAutocompleteInput(el, step) {
    return _actionAutocomplete().isLikelyAutocompleteInput(el, step);
  }

  function _isLikelyAutocompleteInput(el, step) {
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
    const selector = String(step && step.selector || "").toLowerCase();
    const hasTextToType = !!String((step && (step.text || step.value)) || "").trim();

    if (role === "combobox" || ariaAutocomplete || hasList) return true;
    if (/autocomplete|typeahead|select2|chosen|lookup|smart/.test(cls)) return true;
    if (/vdelegacion|vaucaespefc/.test(id) || /vdelegacion|vaucaespefc/.test(name) || /vdelegacion|vaucaespefc/.test(selector)) return true;
    // Fallback tolerante: si choose_option llega sobre input textual con texto/valor,
    // tratamos como autocomplete para no bloquear por metadata incompleta.
    return hasTextToType;
  }

  function _highlightElement(el) {
    return _highlightManager().highlightElement(el);
  }

  function _clearAllHighlights() {
    return _highlightManager().clearAllHighlights({ document });
  }

  function _stepNormalizer() {
    if (typeof WebMaticStepNormalizer !== "undefined") return WebMaticStepNormalizer;
    if (globalScope && globalScope.WebMaticStepNormalizer) return globalScope.WebMaticStepNormalizer;

    if (typeof require === "function") {
      return require("./state/step-normalizer.js");
    }

    throw new Error("WebMaticStepNormalizer no esta disponible");
  }

  function _normalizeStepsForPlayback(steps) {
    return _stepNormalizer().normalizeStepsForPlayback(steps);
  }

    function _transientRecovery() {
    if (typeof WebMaticTransientRecovery !== "undefined") return WebMaticTransientRecovery;
    if (globalScope && globalScope.WebMaticTransientRecovery) return globalScope.WebMaticTransientRecovery;

    if (typeof require === "function") {
      return require("./state/transient-recovery.js");
    }

    throw new Error("WebMaticTransientRecovery no esta disponible");
  }

  function _isTransientGallerySelector(selector) {
    return _transientRecovery().isTransientGallerySelector(selector);
  }

  function _hasNavigateSoon(steps, fromIndex, maxLookahead) {
    return _transientRecovery().hasNavigateSoon(steps, fromIndex, maxLookahead);
  }

    function _loginStepBypass() {
    if (typeof WebMaticLoginStepBypass !== "undefined") return WebMaticLoginStepBypass;
    if (globalScope && globalScope.WebMaticLoginStepBypass) return globalScope.WebMaticLoginStepBypass;

    if (typeof require === "function") {
      return require("./state/login-step-bypass.js");
    }

    throw new Error("WebMaticLoginStepBypass no esta disponible");
  }

  function _isLikelyLoginSelector(raw) {
    return _loginStepBypass().isLikelyLoginSelector(raw);
  }

  function _hasVisiblePasswordField() {
    return _loginStepBypass().hasVisiblePasswordField({
      document,
      window,
      isInteractable: _isInteractable
    });
  }

  function _getFirstVisiblePasswordField() {
    return _loginStepBypass().getFirstVisiblePasswordField({
      document,
      window,
      isInteractable: _isInteractable
    });
  }

  function _isLikelyLoginInputTarget(el, selector) {
    return _loginStepBypass().isLikelyLoginInputTarget(el, selector);
  }

  function _isAuthenticatedLikeContext() {
    return _loginStepBypass().isAuthenticatedLikeContext({
      document,
      window,
      isInteractable: _isInteractable
    });
  }

  function _shouldBypassMissingLoginStep(stepType, selector) {
    return _loginStepBypass().shouldBypassMissingLoginStep(stepType, selector, {
      document,
      window,
      isInteractable: _isInteractable
    });
  }

    function _isRecoverableTransientFailure(err, step, steps, stepIndex) {
    return _transientRecovery().isRecoverableTransientFailure(err, step, steps, stepIndex, {
      shouldBypassMissingLoginStep: _shouldBypassMissingLoginStep
    });
  }

    function _continuationSteps() {
    if (typeof WebMaticContinuationSteps !== "undefined") return WebMaticContinuationSteps;
    if (globalScope && globalScope.WebMaticContinuationSteps) return globalScope.WebMaticContinuationSteps;

    if (typeof require === "function") {
      return require("./control-flow/continuation-steps.js");
    }

    throw new Error("WebMaticContinuationSteps no esta disponible");
  }

  function _cloneDatasetRows(rows) {
    return _continuationSteps().cloneDatasetRows(rows);
  }

  function _buildForEachRowContinuationStep(step, remainingRows) {
    return _continuationSteps().buildForEachRowContinuationStep(step, remainingRows);
  }

  function _buildLoopUntilContinuationStep(step, remainingIterations) {
    return _continuationSteps().buildLoopUntilContinuationStep(step, remainingIterations);
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
     * @param {object} options â€” { speed: number (0.5â€“3), onStep, onDone, onError }
     */
    async play(steps, options = {}) {
      if (!Array.isArray(steps) || steps.length === 0) return false;
      const runtimeSteps = _normalizeStepsForPlayback(steps);
      if (!Array.isArray(runtimeSteps) || runtimeSteps.length === 0) return false;
      const speed = Math.max(0.5, Math.min(3, options.speed ?? 1));
      // Base delay between steps: 300ms at speed 1, scaled inversely
      const baseDelayMs = Math.round(300 / speed);
      const vars = options.vars || {};
      const _seedStart = Number(vars[PLAY_START_VAR]);
      const _playStartMs = Number.isFinite(_seedStart) && _seedStart > 0 ? _seedStart : Date.now();
      vars[PLAY_START_VAR] = _playStartMs;
      const startIndex = options.startIndex || 0;
      const macroId = options.macroId || null;
      const preRunResetPolicy = _normalizePreRunResetPolicy(options.preRunResetPolicy || null);
      this.isPlaying = true;
      this._abort = false;
      this._speed = speed;
      _fallbackBucket = [];

      const preRunReset = options.preRunReset && typeof options.preRunReset === "object" ? options.preRunReset : null;
      if (preRunReset) {
        await _applyPreRunReset(preRunReset, startIndex > 0 ? "play_resume" : "play_start", 0);
      }

      // Do not reset page forms implicitly: it can alter defaults not present in the recording.
      // If needed, callers can opt-in with options.autoReset=true or record an explicit reset_fields step.
      if (options.autoReset === true && startIndex === 0 && (!runtimeSteps[0] || runtimeSteps[0].type !== "reset_fields")) {
        const keepSels = runtimeSteps
          .filter(s => (s.type === "input" || s.type === "text") && s.useCurrentValue && s.selector)
          .map(s => s.selector);
        _resetPageForms(keepSels.length > 0 ? keepSels.join(", ") : null);
      }

      // Universal playback bootstrap: if macro starts with local interactions
      // (non-navigate) and we're on a different page, jump to first recorded
      // navigate URL so playback can start from anywhere.
      if (startIndex === 0 && options.bootstrapToFirstNavigate !== false) {
        const firstStep = runtimeSteps[0] || null;
        const firstNav = runtimeSteps.find((s) => s && s.type === "navigate" && s.url);
        if (firstStep && firstStep.type !== "navigate" && firstNav && firstNav.url) {
          const bootstrapUrl = expandVariables(firstNav.url, vars);
          if (bootstrapUrl && window.location.href !== bootstrapUrl) {
            const navInfo = _analyzeNavigation(window.location.href, bootstrapUrl);
            if (navInfo.mustUseBackground) {
              const resp = await _requestBackgroundNavigate(navInfo.targetUrl || bootstrapUrl, {
                steps: runtimeSteps,
                index: 0,
                vars,
                speed,
                macroId
              });
              if (!resp || resp.ok !== true) {
                const _errBase = (resp && resp.error) || "background_navigate_failed";
                const _errDetail = (resp && resp.detail) ? `: ${resp.detail}` : "";
                throw new Error(`bootstrap navigate failed: ${_errBase}${_errDetail}`);
              }
            } else {
              await new Promise((res) => {
                chrome.runtime.sendMessage({
                  type: "SAVE_PLAYBACK_STATE",
                  steps: runtimeSteps, index: 0, vars, speed, macroId
                }, () => { void chrome.runtime.lastError; res(); });
              });
              window.location.href = navInfo.targetUrl || bootstrapUrl;
            }
            return true;
          }
        }
      }

      try {
        for (let i = startIndex; i < runtimeSteps.length; i++) {
          if (this._abort) break;
          const step = runtimeSteps[i];
          if (_isBaselineDefaultStep(step)) {
            continue;
          }

          const capturePreserve = step.type === "capture_defaults"
            ? Array.from(_collectModifiedSelectors(runtimeSteps, i + 1))
            : null;
          const runnableStep = capturePreserve ? { ...step, _preserveSelectors: capturePreserve } : step;
          const _silentRuntimeStep = _isSilentInternalStep(runnableStep);
          if (typeof options.onStep === "function" && !_silentRuntimeStep) options.onStep(step, i);

          // Save resumption state BEFORE every step â€” if a navigation happens at any
          // point during this step (or any sleep/wait afterwards), the new page can
          // resume from index i+1. We only clear pending state on full completion.
            if (!_silentRuntimeStep && step.type !== "if_exists" && step.type !== "loop_until" &&
              step.type !== "try_fallback" && step.type !== "call_macro" &&
                step.type !== "for_each_row" && step.type !== "open_tab" &&
                step.type !== "switch_tab" && step.type !== "close_tab") {
            await new Promise((res) => {
              chrome.runtime.sendMessage({
                type: "SAVE_PLAYBACK_STATE",
                steps: runtimeSteps, index: i + 1, vars, speed, macroId
              }, () => { void chrome.runtime.lastError; res(); });
            });
          }

          // Pasos tecnicos internos: ejecutar sin delay ni overhead de mensajes
          if (_silentRuntimeStep) {
            await executeStep(runnableStep, vars, this.retryMs, this.timeoutMs, this._speed);
            continue;
          }

          // if_exists: ejecuta rama 'then' si el selector existe en el DOM, 'else' si no
          // { type:"if_exists", selector, then:[...pasos], else:[...pasos] }
          if (step.type === "if_exists") {
            const _ifSel = expandVariables(step.selector || "", vars);
            const _ifFound = !!findElement(_ifSel);
            const _ifBranch = _ifFound ? (step.then || []) : (step.else || []);
            if (_ifBranch.length > 0) {
              // Guardar estado de reanudaciÃ³n ANTES de ejecutar sub-pasos.
              // Si dentro del bloque ocurre una navegación (ej: submit de login),
              // la nueva pÃ¡gina retoma desde el paso SIGUIENTE al if_exists.
              await new Promise((res) => {
                chrome.runtime.sendMessage({
                  type: "SAVE_PLAYBACK_STATE",
                  steps: runtimeSteps, index: i + 1, vars, speed, macroId
                }, () => { void chrome.runtime.lastError; res(); });
              });
              await this._runSubSteps(
                _ifBranch,
                vars,
                baseDelayMs,
                runtimeSteps.slice(i + 1),
                { speed, macroId }
              );
            }
            continue;
          }

          // loop_until: repite 'steps' mientras la condicion se cumpla (cap en max_iterations)
          // condition "not_exists" (default): repite mientras selector AUSENTE
          // condition "exists": repite mientras selector PRESENTE (ej. spinner de carga)
          if (step.type === "loop_until") {
            const _luMax = Number(step.max_iterations) || 50;
            const _luCond = step.condition || "not_exists";
            const _luSel = expandVariables(step.selector || "", vars);
            if (_shouldBypassMissingLoginStep("loop_until", _luSel)) {
              continue;
            }
            for (let _luIter = 0; _luIter < _luMax; _luIter++) {
              if (this._abort) break;
              const _luEl = findElement(_luSel);
              const _luKeep = _luCond === "exists" ? !!_luEl : !_luEl;
              if (!_luKeep) break;
              if (Array.isArray(step.steps) && step.steps.length > 0) {
                const _remainingLoopIterations = Math.max(0, _luMax - (_luIter + 1));
                const _loopContinuation = _remainingLoopIterations > 0
                  ? [_buildLoopUntilContinuationStep(step, _remainingLoopIterations), ...runtimeSteps.slice(i + 1)]
                  : runtimeSteps.slice(i + 1);
                await this._runSubSteps(
                  step.steps,
                  vars,
                  baseDelayMs,
                  _loopContinuation,
                  { speed, macroId }
                );
              }
            }
            continue;
          }

          // try_fallback: ejecuta 'steps'; si alguno falla, ejecuta 'fallback' en su lugar
          // El error queda contenido â€” la macro no se detiene
          if (step.type === "try_fallback") {
            try {
              if (Array.isArray(step.steps) && step.steps.length > 0) {
                await this._runSubSteps(
                  step.steps,
                  vars,
                  baseDelayMs,
                  runtimeSteps.slice(i + 1),
                  { speed, macroId }
                );
              }
            } catch (_tfErr) {
              if (Array.isArray(step.fallback) && step.fallback.length > 0) {
                await this._runSubSteps(
                  step.fallback,
                  vars,
                  baseDelayMs,
                  runtimeSteps.slice(i + 1),
                  { speed, macroId }
                );
              }
            }
            continue;
          }

          // call_macro: ejecuta los pasos de otra macro como subrutina
          // Content.js pre-resuelve step.steps copiando los pasos de la macro referenciada
          // { type:"call_macro", macro_name:"NombreMacro", steps:[...] }
          if (step.type === "call_macro") {
            if (Array.isArray(step.steps) && step.steps.length > 0) {
              await this._runSubSteps(
                step.steps,
                vars,
                baseDelayMs,
                runtimeSteps.slice(i + 1),
                { speed, macroId }
              );
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
                const _remainingRows = _feRows.slice(_ri + 1);
                const _rowContinuation = _remainingRows.length > 0
                  ? [_buildForEachRowContinuationStep(step, _remainingRows), ...runtimeSteps.slice(i + 1)]
                  : runtimeSteps.slice(i + 1);
                await this._runSubSteps(
                  step.steps,
                  vars,
                  baseDelayMs,
                  _rowContinuation,
                  { speed, macroId }
                );
              }
            }
            continue;
          }

          // Before a navigate step: save resumption state to background, then execute
          if (step.type === "navigate") {
            const _navUrl = expandVariables(step.url || "", vars);
            if (_navUrl && window.location.href !== _navUrl) {
              const navInfo = _analyzeNavigation(window.location.href, _navUrl);
              if (navInfo.sameDocument) {
                if (navInfo.currentUrl && navInfo.targetUrlObject && navInfo.currentUrl.hash !== navInfo.targetUrlObject.hash) {
                  window.location.hash = navInfo.targetUrlObject.hash || "";
                }
              }

              if (!navInfo.sameDocument && navInfo.mustUseBackground) {
                const handoff = await _requestBackgroundNavigate(navInfo.targetUrl || _navUrl, {
                  steps: runtimeSteps,
                  index: i + 1,
                  vars,
                  speed,
                  macroId
                });
                if (!handoff || handoff.ok !== true) {
                  const _errBase = (handoff && handoff.error) || "background_navigate_failed";
                  const _errDetail = (handoff && handoff.detail) ? `: ${handoff.detail}` : "";
                  throw new Error(`navigate failed: ${_errBase}${_errDetail}`);
                }
                return true;
              }

              if (!navInfo.sameDocument) {
                // Real page unload navigation: persist and hand off to next page.
                await new Promise((res) => {
                  chrome.runtime.sendMessage({
                    type: "SAVE_PLAYBACK_STATE",
                    steps: runtimeSteps, index: i + 1, vars, speed, macroId
                  }, () => { void chrome.runtime.lastError; res(); });
                });
                window.location.href = navInfo.targetUrl || _navUrl;
                // Page is unloading â€” this promise never continues; exit play()
                return true;
              }
            }
            // URL is empty, same-document, or already current â€” reset the page now that the
            // target hash/section is active, then continue with the real user steps.
            await _applyPreRunReset(preRunReset, "after_navigate", 120);
            if (i < runtimeSteps.length - 1) await new Promise((r) => setTimeout(r, baseDelayMs));
            continue;
          }

          if (step.type === "open_tab" || step.type === "switch_tab" || step.type === "close_tab") {
            const tabStep = {
              ...step,
              url: step.url ? expandVariables(step.url, vars) : ""
            };
            const handoff = await new Promise((res) => {
              chrome.runtime.sendMessage({
                type: "PLAYBACK_TAB_ACTION",
                action: step.type,
                step: tabStep,
                steps: runtimeSteps,
                index: i + 1,
                vars,
                speed,
                macroId
              }, (resp) => {
                if (chrome.runtime.lastError) {
                  res({ ok: false, error: chrome.runtime.lastError.message || "tab_action_failed" });
                  return;
                }
                res(resp || { ok: false, error: "tab_action_no_response" });
              });
            });

            if (!handoff || handoff.ok !== true) {
              throw new Error(`tab action failed (${step.type}): ${(handoff && handoff.error) || "unknown"}`);
            }

            if (handoff.handoff) {
              // La reproducción continuarÃ¡ en la pestaÃ±a de destino via pendingPlayback.
              // Notificamos handoff para que la pestaÃ±a origen limpie su UI flotante.
              if (typeof options.onDone === "function") {
                options.onDone({
                  handoff: true,
                  fallbacks: Array.isArray(_fallbackBucket) ? _fallbackBucket.slice() : [],
                  durationMs: Math.max(0, Date.now() - _playStartMs)
                });
              }
              return true;
            }

            if (i < runtimeSteps.length - 1) await new Promise((r) => setTimeout(r, baseDelayMs));
            continue;
          }

          // Execute the step (state was already saved at the top of the loop)
          try {
            await executeStep(runnableStep, vars, this.retryMs, this.timeoutMs, this._speed);
          } catch (stepErr) {
            // Defensive runtime guard for brittle gallery controls in legacy macros:
            // if a transient click/wait_for fails but a navigate is coming right away,
            // skip this step and continue to the stable navigation state.
            if (_isRecoverableTransientFailure(stepErr, step, runtimeSteps, i)) {
              try {
                console.warn("[WebMatic][playback] step skipped as transient before navigate", {
                  index: i,
                  type: step.type,
                  selector: step.selector,
                  reason: String((stepErr && stepErr.message) || stepErr || "")
                });
              } catch (_e) { /* ignore */ }
              try {
                if (Array.isArray(_fallbackBucket)) {
                  _fallbackBucket.push({
                    kind: "transient_skip",
                    index: i,
                    type: step.type,
                    selector: step.selector || ""
                  });
                }
              } catch (_e) { /* ignore */ }
            } else {
              throw stepErr;
            }
          }

          if (i < runtimeSteps.length - 1) {
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
        // Clear pending playback state â€” playback completed normally
        try {
          chrome.runtime.sendMessage({ type: "CLEAR_PENDING_PLAYBACK" }, () => { void chrome.runtime.lastError; });
        } catch (_) {}
        const _summary = {
          fallbacks: Array.isArray(_fallbackBucket) ? _fallbackBucket.slice() : [],
          durationMs: Math.max(0, Date.now() - _playStartMs)
        };
        try { delete vars[PLAY_START_VAR]; } catch (_e) { /* ignore */ }
        if (typeof options.onDone === "function") options.onDone(_summary);
      } catch (err) {
        try { delete vars[PLAY_START_VAR]; } catch (_e) { /* ignore */ }
        try {
          chrome.runtime.sendMessage({ type: "CLEAR_PENDING_PLAYBACK" }, () => { void chrome.runtime.lastError; });
        } catch (_) {}
        if (typeof options.onError === "function") options.onError(err);
      } finally {
        this.isPlaying = false;
        _fallbackBucket = null;
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
    // Garantiza que if_exists, loop_until, etc. dentro de sub-pasos tambiÃ©n funcionen.
    async _execComplexStep(step, vars, baseDelayMs, options = {}) {
      const continuationSteps = Array.isArray(options.continuationSteps) ? options.continuationSteps : [];
      const runtimeMeta = options.runtimeMeta && typeof options.runtimeMeta === "object" ? options.runtimeMeta : null;
      if (step.type === "if_exists") {
        const _ifSel = expandVariables(step.selector || "", vars);
        const _ifFound = !!findElement(_ifSel);
        const _ifBranch = _ifFound ? (step.then || []) : (step.else || []);
        if (_ifBranch.length > 0) {
          await this._runSubSteps(_ifBranch, vars, baseDelayMs, continuationSteps, runtimeMeta);
        }
        return;
      }
      if (step.type === "loop_until") {
        const _luMax = Number(step.max_iterations) || 50;
        const _luCond = step.condition || "not_exists";
        const _luSel = expandVariables(step.selector || "", vars);
        if (_shouldBypassMissingLoginStep("loop_until", _luSel)) {
          return;
        }
        for (let _luIter = 0; _luIter < _luMax; _luIter++) {
          if (this._abort) break;
          const _luEl = findElement(_luSel);
          const _luKeep = _luCond === "exists" ? !!_luEl : !_luEl;
          if (!_luKeep) break;
          if (Array.isArray(step.steps) && step.steps.length > 0) {
            const _remainingLoopIterations = Math.max(0, _luMax - (_luIter + 1));
            const _loopContinuation = _remainingLoopIterations > 0
              ? [_buildLoopUntilContinuationStep(step, _remainingLoopIterations), ...continuationSteps]
              : continuationSteps;
            await this._runSubSteps(step.steps, vars, baseDelayMs, _loopContinuation, runtimeMeta);
          }
        }
        return;
      }
      if (step.type === "try_fallback") {
        try {
          if (Array.isArray(step.steps) && step.steps.length > 0) {
            await this._runSubSteps(step.steps, vars, baseDelayMs, continuationSteps, runtimeMeta);
          }
        } catch (_tfErr) {
          if (Array.isArray(step.fallback) && step.fallback.length > 0) {
            await this._runSubSteps(step.fallback, vars, baseDelayMs, continuationSteps, runtimeMeta);
          }
        }
        return;
      }
      if (step.type === "call_macro") {
        if (Array.isArray(step.steps) && step.steps.length > 0) {
          await this._runSubSteps(step.steps, vars, baseDelayMs, continuationSteps, runtimeMeta);
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
            const _remainingRows = _feRows.slice(_ri + 1);
            const _rowContinuation = _remainingRows.length > 0
              ? [_buildForEachRowContinuationStep(step, _remainingRows), ...continuationSteps]
              : continuationSteps;
            await this._runSubSteps(step.steps, vars, baseDelayMs, _rowContinuation, runtimeMeta);
          }
        }
        return;
      }
      if (step.type === "open_tab" || step.type === "switch_tab" || step.type === "close_tab") {
        throw new Error("tab actions inside complex sub-steps are not supported yet; move them to top-level playback steps");
      }
      // Simple step (navigate in sub-context treated as executeStep â€” no page-save needed)
      await executeStep(step, vars, this.retryMs, this.timeoutMs, this._speed);
    }

    // Ejecuta un sub-array de pasos secuencialmente.
    // Soporta pasos simples y complejos (if_exists, loop_until, etc.) de forma recursiva.
    async _runSubSteps(subSteps, vars, baseDelayMs, continuationSteps = [], runtimeMeta = null) {
      for (let _j = 0; _j < subSteps.length; _j++) {
        if (this._abort) break;
        const subStep = subSteps[_j];
        if (_isBaselineDefaultStep(subStep)) {
          continue;
        }
        const capturePreserve = subStep && subStep.type === "capture_defaults"
          ? Array.from(_collectModifiedSelectors(subSteps, _j + 1))
          : null;
        const runnableSubStep = capturePreserve ? { ...subStep, _preserveSelectors: capturePreserve } : subStep;
        const _remaining = subSteps.slice(_j + 1);
        const _continuation = _remaining.concat(Array.isArray(continuationSteps) ? continuationSteps : []);
        const _silentSubStep = _isSilentInternalStep(runnableSubStep);

        if (!_silentSubStep && runtimeMeta && _continuation.length > 0) {
          await new Promise((res) => {
            chrome.runtime.sendMessage({
              type: "SAVE_PLAYBACK_STATE",
              steps: _continuation,
              index: 0,
              vars,
              speed: runtimeMeta.speed,
              macroId: runtimeMeta.macroId || null
            }, () => { void chrome.runtime.lastError; res(); });
          });
        }

        await this._execComplexStep(runnableSubStep, vars, baseDelayMs, {
          continuationSteps: _continuation,
          runtimeMeta
        });
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



