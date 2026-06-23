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
      if (_isInstance(el, "HTMLElement") && el.hidden) return false;
      const view = (el.ownerDocument && el.ownerDocument.defaultView) || globalScope;
      const cs = view && typeof view.getComputedStyle === "function"
        ? view.getComputedStyle(el)
        : null;
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

  function _postClickCandidateScore(el, selector) {
    const sel = String(selector || "");
    if (!sel) return 0;
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
