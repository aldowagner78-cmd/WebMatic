(function initRecorderEvents(globalScope) {
  function _ctor(name) {
    return globalScope && globalScope[name] ? globalScope[name] : null;
  }

  function _isInstance(value, name) {
    const Ctor = _ctor(name);
    return !!(Ctor && value instanceof Ctor);
  }

  function normalizeCaptureTarget(element) {
    if (!_isInstance(element, "Element")) return element;

    let target = element;
    const clickableOwner = target.closest("button, a[href], [role='button'], [role='link']");
    if (_isInstance(clickableOwner, "Element") && clickableOwner !== target) {
      return clickableOwner;
    }

    const svgTag = (el) => {
      const t = String(el && el.tagName ? el.tagName : "").toLowerCase();
      return t === "path" || t === "svg" || t === "g" || t === "use";
    };

    if (svgTag(target)) {
      const promoted = target.closest("button, a[href], [role='button'], [role='link'], input, textarea, select, label, [aria-label]");
      if (_isInstance(promoted, "Element")) {
        target = promoted;
      } else {
        let walker = target.parentElement;
        while (walker && svgTag(walker)) walker = walker.parentElement;
        if (_isInstance(walker, "Element")) target = walker;
      }
    }

    return target;
  }

  function isInteractableCaptureTarget(el) {
    try {
      if (!_isInstance(el, "Element")) return false;
      const view = (el.ownerDocument && el.ownerDocument.defaultView) || globalScope;
      let current = el;
      while (_isInstance(current, "Element")) {
        if (_isInstance(current, "HTMLElement") && current.hidden) return false;
        if (current.getAttribute && String(current.getAttribute("aria-hidden") || "").toLowerCase() === "true") return false;
        if (current.hasAttribute && current.hasAttribute("inert")) return false;
        const currentStyle = view && typeof view.getComputedStyle === "function"
          ? view.getComputedStyle(current)
          : null;
        if (currentStyle && (currentStyle.display === "none" || currentStyle.visibility === "hidden")) return false;
        current = current.parentElement;
      }
      const cs = view && typeof view.getComputedStyle === "function" ? view.getComputedStyle(el) : null;
      if (cs && (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none")) return false;
      if (el.getClientRects && el.getClientRects().length === 0) return false;
      return true;
    } catch (_e) {
      return false;
    }
  }

  function isTextEntryCaptureTarget(el) {
    if (_isInstance(el, "HTMLTextAreaElement")) return true;
    if (_isInstance(el, "HTMLInputElement")) {
      const t = String(el.type || "text").toLowerCase();
      return t === "" || t === "text" || t === "search" || t === "email" || t === "number" || t === "tel" || t === "url";
    }
    return false;
  }

  function isEditableKeyTarget(el) {
    if (!_isInstance(el, "Element")) return false;
    if (el.isContentEditable) return true;
    if (_isInstance(el, "HTMLSelectElement")) return true;
    return isTextEntryCaptureTarget(el);
  }

  function _labelForKeyTarget(el) {
    if (!_isInstance(el, "Element")) return "";
    const aria = String(el.getAttribute("aria-label") || "").trim();
    if (aria) return aria;
    const title = String(el.getAttribute("title") || "").trim();
    if (title) return title;
    const doc = el.ownerDocument;
    if (el.id && doc && typeof doc.querySelector === "function") {
      try {
        const label = doc.querySelector(`label[for="${String(el.id).replace(/"/g, "\\\"")}"]`);
        const text = label ? String(label.textContent || "").trim() : "";
        if (text) return text;
      } catch (_e) { /* ignore */ }
    }
    const closestLabel = typeof el.closest === "function" ? el.closest("label") : null;
    return closestLabel ? String(closestLabel.textContent || "").trim() : "";
  }

  function _cleanText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function _controlKindForTarget(el) {
    if (!_isInstance(el, "Element")) return "";
    const tag = String(el.tagName || "").toLowerCase();
    if (tag === "select") return "native-select";
    if (tag === "textarea") return "textarea";
    if (tag === "button") return "button";
    const type = String((el.getAttribute && el.getAttribute("type")) || "").toLowerCase();
    if (tag === "input") {
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "button" || type === "submit" || type === "reset") return "button";
      if (el.getAttribute && el.getAttribute("list")) return "datalist";
      const role = String((el.getAttribute && el.getAttribute("role")) || "").toLowerCase();
      if (role === "combobox" || (el.getAttribute && el.getAttribute("aria-autocomplete"))) return "autocomplete";
      return "text-input";
    }
    return "";
  }

  function _visibleTextForTarget(el) {
    if (!_isInstance(el, "Element")) return "";
    const tag = String(el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return "";
    return _cleanText(el.innerText || el.textContent || "");
  }

  function _visibleSectionTitleForTarget(el) {
    try {
      const host = el && typeof el.closest === "function"
        ? el.closest("section, article, main, aside, form, fieldset, [role='dialog'], [role='region']")
        : null;
      if (!host) return "";
      const heading = host.querySelector("legend, h1, h2, h3, h4, h5, h6, [role='heading'], [aria-label]");
      if (!heading || heading === el || (el.contains && el.contains(heading))) return "";
      return _cleanText((heading.getAttribute && heading.getAttribute("aria-label")) || heading.textContent || "");
    } catch (_e) {
      return "";
    }
  }

  function buildKeyStepForTarget(target, key, buildSelector) {
    const step = { type: "key", key };
    if (!isEditableKeyTarget(target)) return step;
    const select = typeof buildSelector === "function" ? buildSelector : null;
    const selector = select ? String(select(target) || "") : "";
    if (!selector) return step;
    const tag = String(target.tagName || "").toLowerCase();
    const type = _isInstance(target, "HTMLInputElement") ? String(target.type || "text").toLowerCase() : "";
    const controlRef = { selector, tag };
    if (type) controlRef.type = type;
    const label = _labelForKeyTarget(target);
    if (label) controlRef.label = label;
    const placeholder = _cleanText(target.getAttribute && target.getAttribute("placeholder"));
    if (placeholder) controlRef.placeholder = placeholder;
    const name = _cleanText(target.getAttribute && target.getAttribute("name"));
    if (name) controlRef.name = name;
    const role = _cleanText(target.getAttribute && target.getAttribute("role")).toLowerCase();
    if (role) controlRef.role = role;
    const controlKind = _controlKindForTarget(target);
    if (controlKind) controlRef.controlKind = controlKind;
    const text = _visibleTextForTarget(target);
    if (text) controlRef.text = text;
    const visibleSectionTitle = _visibleSectionTitleForTarget(target);
    if (visibleSectionTitle) controlRef.visibleSectionTitle = visibleSectionTitle;
    step.selector = selector;
    step.controlRef = controlRef;
    return step;
  }

  function isInsideWebMaticUi(el, opts) {
    if (!_isInstance(el, "Element")) return false;
    const options = opts && typeof opts === "object" ? opts : {};
    if (el.closest("#webmatic-panel-root")) return true;
    if (options.floating !== false) {
      if (el.closest("#webmatic-floating-recorder-global") || el.closest("#webmatic-floating-player-global")) return true;
    }
    if (options.inlinePanelId) {
      return !!el.closest("#" + String(options.inlinePanelId));
    }
    return false;
  }

  function isRequiredSelectorRecordedStep(step) {
    if (!step || typeof step !== "object") return false;
    return step.type === "click" ||
      step.type === "dblclick" ||
      step.type === "input" ||
      step.type === "text" ||
      step.type === "check" ||
      step.type === "choose_option" ||
      step.type === "wait_for" ||
      step.type === "hover" ||
      step.type === "scroll_to" ||
      step.type === "extract";
  }

  function isInvalidCapturedStep(step) {
    if (!step || typeof step !== "object") return true;
    if (isRequiredSelectorRecordedStep(step)) {
      return !String(step.selector || "").trim();
    }
    if (step.type === "drag_drop") {
      return !String(step.from || "").trim() || !String(step.to || "").trim();
    }
    return false;
  }

  function shouldPreferClickOverCheck(originalTarget, checkTarget) {
    if (!_isInstance(originalTarget, "Element") || !_isInstance(checkTarget, "HTMLInputElement")) return false;

    if (originalTarget === checkTarget) return false;

    const type = String(checkTarget.type || "").toLowerCase();
    if (type !== "checkbox" && type !== "radio") return false;

    const normalized = normalizeCaptureTarget(originalTarget);
    const explicitClickable = _isInstance(normalized, "Element")
      && !!normalized.closest("a[href], button, [role='button'], [role='link']");
    const checkIsHidden = !isInteractableCaptureTarget(checkTarget);

    return explicitClickable && checkIsHidden;
  }

  const POST_CLICK_CANDIDATE_SELECTOR = [
    "[id]",
    "[aria-label]",
    "[placeholder]",
    "[title]",
    "[name]",
    "button",
    "a[href]",
    "input",
    "select",
    "textarea",
    "[role]",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "div",
    "span",
    "section",
    "article",
    "main",
    "aside"
  ].join(",");

  function _isPostClickVisible(el) {
    try {
      if (!_isInstance(el, "Element")) return false;
      if (isInsideWebMaticUi(el)) return false;
      if (el.closest("[data-wm-flash]")) return false;
      const tag = String(el.tagName || "").toLowerCase();
      if (!tag || tag === "html" || tag === "body" || tag === "script" || tag === "style" || tag === "template") return false;
      if (_isInstance(el, "HTMLElement") && el.hidden) return false;
      const view = (el.ownerDocument && el.ownerDocument.defaultView) || globalScope;
      const cs = view && typeof view.getComputedStyle === "function" ? view.getComputedStyle(el) : null;
      if (cs && (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0")) return false;
      if (el.getClientRects && el.getClientRects().length === 0) return false;
      return true;
    } catch (_e) {
      return false;
    }
  }

  const POST_CLICK_TRANSIENT_RE = /(?:^|[^a-z0-9])(loading|loader|spinner|progress|busy|cargando|procesando)(?:$|[^a-z0-9])/i;

  function _isTransientPostClickElement(el, selector) {
    try {
      if (!_isInstance(el, "Element")) return true;
      const attrs = [
        selector,
        el.id,
        el.className,
        el.getAttribute && el.getAttribute("role"),
        el.getAttribute && el.getAttribute("aria-label"),
        el.getAttribute && el.getAttribute("title"),
        el.getAttribute && el.getAttribute("data-testid"),
        el.textContent
      ].map((v) => String(v || ""));
      const role = String(el.getAttribute && el.getAttribute("role") || "").toLowerCase();
      if (role === "progressbar") return true;
      if (String(el.getAttribute && el.getAttribute("aria-busy") || "").toLowerCase() === "true") return true;
      return attrs.some((entry) => POST_CLICK_TRANSIENT_RE.test(entry));
    } catch (_e) {
      return true;
    }
  }

  function _postClickCandidateScore(el, selector) {
    const sel = String(selector || "");
    if (!sel || _isTransientPostClickElement(el, sel)) return 0;
    if (el.id && sel === "#" + el.id) return 100;
    if (el.getAttribute && String(el.getAttribute("aria-label") || "").trim()) return 90;
    if (el.getAttribute && String(el.getAttribute("placeholder") || "").trim()) return 85;
    if (el.getAttribute && String(el.getAttribute("title") || "").trim()) return 80;
    if (el.getAttribute && String(el.getAttribute("name") || "").trim()) return 75;
    if (/\[text=/.test(sel)) return 60;
    return 30;
  }

  function _isReasonablePostClickCandidate(el) {
    if (!_isPostClickVisible(el)) return false;
    const hasStableAttr = !!(
      el.id ||
      (el.getAttribute && (
        String(el.getAttribute("aria-label") || "").trim() ||
        String(el.getAttribute("placeholder") || "").trim() ||
        String(el.getAttribute("title") || "").trim() ||
        String(el.getAttribute("name") || "").trim()
      ))
    );
    if (hasStableAttr) return true;
    const text = String(el.textContent || "").replace(/\s+/g, " ").trim();
    return text.length > 0 && text.length <= 80;
  }

  function _expandPostClickCandidateElements(node) {
    const out = [];
    const seen = new Set();
    const push = (el) => {
      if (!_isInstance(el, "Element") || seen.has(el)) return;
      seen.add(el);
      out.push(el);
    };

    if (_isInstance(node, "Element")) {
      let cur = node;
      let depth = 0;
      while (cur && depth < 4) {
        push(cur);
        cur = cur.parentElement;
        depth += 1;
      }
      try {
        node.querySelectorAll(POST_CLICK_CANDIDATE_SELECTOR).forEach(push);
      } catch (_e) { /* ignore */ }
    } else if (node && node.parentElement) {
      push(node.parentElement);
    }

    return out;
  }

  function pickPostClickWaitForCandidate(nodes, buildSelector, opts) {
    const select = typeof buildSelector === "function" ? buildSelector : null;
    if (!select) return null;
    const options = opts && typeof opts === "object" ? opts : {};
    const visibleAtClick = options.visibleAtClick && typeof options.visibleAtClick.has === "function"
      ? options.visibleAtClick
      : new Set();
    const clickedSelector = String(options.clickedSelector || "");
    const list = Array.isArray(nodes) ? nodes : [nodes];
    let best = null;

    list.forEach((node) => {
      _expandPostClickCandidateElements(node).forEach((el) => {
        if (!_isReasonablePostClickCandidate(el)) return;
        let selector = "";
        try { selector = String(select(el) || "").trim(); } catch (_e) { selector = ""; }
        if (!selector || selector === clickedSelector || visibleAtClick.has(selector)) return;
        const score = _postClickCandidateScore(el, selector);
        if (!score) return;
        if (!best || score > best.score) best = { selector, element: el, score };
      });
    });

    return best ? { selector: best.selector, element: best.element } : null;
  }

  function collectVisiblePostClickSelectors(root, buildSelector) {
    const out = new Set();
    const select = typeof buildSelector === "function" ? buildSelector : null;
    if (!root || !select) return out;
    try {
      root.querySelectorAll(POST_CLICK_CANDIDATE_SELECTOR).forEach((el) => {
        const picked = pickPostClickWaitForCandidate([el], select, { visibleAtClick: new Set() });
        if (picked && picked.selector) out.add(picked.selector);
      });
    } catch (_e) { /* ignore */ }
    return out;
  }

  const api = {
    normalizeCaptureTarget,
    isInteractableCaptureTarget,
    isTextEntryCaptureTarget,
    isEditableKeyTarget,
    buildKeyStepForTarget,
    isInsideWebMaticUi,
    isRequiredSelectorRecordedStep,
    isInvalidCapturedStep,
    shouldPreferClickOverCheck,
    pickPostClickWaitForCandidate,
    collectVisiblePostClickSelectors
  };

  globalScope.WebMaticRecorderEvents = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);

