(function initElementFinder(globalScope) {
  function _ownerDocument(root) {
    if (!root) return null;
    if (root.nodeType === 9) return root;
    return root.ownerDocument || (typeof document !== "undefined" ? document : null);
  }

  function _defaultNormalizeText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function _defaultFoldText(value) {
    return _defaultNormalizeText(value).toLowerCase();
  }

  function _uniqueElements(items) {
    const out = [];
    const seen = new Set();
    for (const el of items || []) {
      if (!el || seen.has(el)) continue;
      seen.add(el);
      out.push(el);
    }
    return out;
  }

  function _querySelectorAllDeep(root, selector, out) {
    if (!root || !selector) return;
    try {
      root.querySelectorAll(selector).forEach((el) => out.push(el));
    } catch (e) {
      return;
    }

    try {
      root.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) _querySelectorAllDeep(el.shadowRoot, selector, out);
      });
    } catch (e) { /* ignore */ }
  }

  function findInShadow(root, selector) {
    try {
      const found = getCandidateElements(selector, root);
      return found[0] || null;
    } catch (e) {
      return null;
    }
  }

  function findInDocument(doc, selector) {
    if (!doc) return null;
    const found = getCandidateElements(selector, doc);
    return found[0] || null;
  }

  function _collectDocuments(doc) {
    const docs = [];
    const visit = (currentDoc) => {
      if (!currentDoc || docs.includes(currentDoc)) return;
      docs.push(currentDoc);
      try {
        const frames = currentDoc.querySelectorAll("iframe, frame");
        for (const frame of frames) {
          try {
            const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
            if (innerDoc) visit(innerDoc);
          } catch (e) { /* cross-origin */ }
        }
      } catch (e) { /* ignore */ }
    };
    visit(doc);
    return docs;
  }

  function _searchDocs(doc) {
    return _collectDocuments(doc);
  }

  function _getTextCandidates(doc, selector, options) {
    const normalizeTextForCompare = options.normalizeTextForCompare || _defaultNormalizeText;
    const foldTextForCompare = options.foldTextForCompare || _defaultFoldText;
    const textMatch = /^(\w+)\[text="([^"]+)"\]$/.exec(selector);
    if (!textMatch) return null;

    const [, tagName, text] = textMatch;
    const expectedText = normalizeTextForCompare(text);
    const expectedFold = foldTextForCompare(text);
    const exact = [];
    const foldedEqual = [];
    const foldedContains = [];

    for (const d of _collectDocuments(doc)) {
      try {
        const candidates = [];
        _querySelectorAllDeep(d, tagName, candidates);
        for (const el of candidates) {
          const elText = normalizeTextForCompare(el.textContent);
          const elFold = foldTextForCompare(el.textContent);
          if (elText === expectedText) exact.push(el);
          else if (elFold === expectedFold) foldedEqual.push(el);
          else if (expectedFold && elFold.includes(expectedFold)) foldedContains.push(el);
        }
      } catch (e) { /* ignore */ }
    }

    return _uniqueElements(exact.concat(foldedEqual, foldedContains));
  }

  function getCandidateElements(selector, root, opts) {
    const raw = String(selector || "").trim();
    const options = opts && typeof opts === "object" ? opts : {};
    const doc = _ownerDocument(root) || root || (typeof document !== "undefined" ? document : null);
    if (!raw || !doc) return [];

    if (raw.startsWith("/") || raw.startsWith("(")) {
      try {
        const xpathResult = (doc.defaultView && doc.defaultView.XPathResult) || (typeof XPathResult !== "undefined" ? XPathResult : null);
        if (!xpathResult) return [];
        const result = doc.evaluate(raw, doc, null, xpathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const out = [];
        for (let i = 0; i < result.snapshotLength; i++) {
          const node = result.snapshotItem(i);
          if (node && node.nodeType === 1) out.push(node);
        }
        return _uniqueElements(out);
      } catch (e) {
        return [];
      }
    }

    const textCandidates = _getTextCandidates(doc, raw, options);
    if (textCandidates) return textCandidates;

    const out = [];
    for (const d of _collectDocuments(doc)) {
      _querySelectorAllDeep(d, raw, out);
    }
    return _uniqueElements(out);
  }

  function _hasElementCtor(el) {
    return !!(el && el.nodeType === 1);
  }

  function _computedStyle(el) {
    try {
      const view = (el.ownerDocument && el.ownerDocument.defaultView) || (typeof window !== "undefined" ? window : null);
      return view && typeof view.getComputedStyle === "function" ? view.getComputedStyle(el) : null;
    } catch (e) {
      return null;
    }
  }

  function _hasRenderedBox(el) {
    let sawLayoutBoxApi = false;
    try {
      if (typeof el.getClientRects === "function") {
        sawLayoutBoxApi = true;
        if (el.getClientRects().length > 0) return true;
      }
      if (typeof el.getBoundingClientRect === "function") {
        sawLayoutBoxApi = true;
        const rect = el.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) return true;
      }
    } catch (e) { /* ignore */ }

    try {
      const doc = el.ownerDocument;
      const view = doc && doc.defaultView;
      const isHappyDom = !!(view && view.happyDOM);
      if (isHappyDom) return true;
    } catch (e) { /* ignore */ }

    return !sawLayoutBoxApi;
  }

  function isElementVisibleForWebMatic(el) {
    if (!_hasElementCtor(el)) return false;
    try {
      let current = el;
      while (current && current.nodeType === 1) {
        if (current.hidden || current.getAttribute("hidden") != null) return false;
        if (String(current.getAttribute("aria-hidden") || "").toLowerCase() === "true") return false;
        if (current.getAttribute("inert") != null) return false;
        const tag = String(current.tagName || "").toLowerCase();
        if (tag === "template") return false;

        const style = _computedStyle(current);
        if (style) {
          if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
          if (current === el && style.opacity === "0") return false;
        }

        current = current.parentElement;
      }

      return _hasRenderedBox(el);
    } catch (e) {
      return true;
    }
  }

  function _isVisibleEnough(el) {
    return isElementVisibleForWebMatic(el);
  }

  function isElementEnabledForWebMatic(el) {
    if (!_hasElementCtor(el)) return false;
    try {
      let current = el;
      while (current && current.nodeType === 1) {
        if (current.disabled === true) return false;
        if (String(current.getAttribute("aria-disabled") || "").toLowerCase() === "true") return false;
        if (String(current.tagName || "").toLowerCase() === "fieldset" && current.disabled === true) return false;
        current = current.parentElement;
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  function isElementEditableForWebMatic(el) {
    if (!_hasElementCtor(el)) return false;
    try {
      if (String(el.getAttribute("aria-readonly") || "").toLowerCase() === "true") return false;
      if (el.isContentEditable) return true;

      const tag = String(el.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "select") return el.readOnly !== true;
      if (tag !== "input") return false;
      if (el.readOnly === true) return false;

      const type = String(el.type || "text").toLowerCase();
      return [
        "", "text", "search", "email", "number", "tel", "url", "password",
        "date", "datetime-local", "month", "time", "week", "color", "range"
      ].includes(type);
    } catch (e) {
      return false;
    }
  }

  function _isElementUncovered(el) {
    try {
      const doc = el.ownerDocument;
      if (!doc || typeof doc.elementFromPoint !== "function" || typeof el.getBoundingClientRect !== "function") return true;
      const rect = el.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return true;
      const points = [
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + Math.min(4, rect.width / 2), rect.top + Math.min(4, rect.height / 2)],
        [rect.right - Math.min(4, rect.width / 2), rect.bottom - Math.min(4, rect.height / 2)]
      ];
      return points.some(([x, y]) => {
        const top = doc.elementFromPoint(x, y);
        return !top || top === el || el.contains(top) || top.contains(el);
      });
    } catch (e) {
      return true;
    }
  }

  function _isWriteAction(actionType) {
    const type = String(actionType || "").toLowerCase();
    return type === "input" || type === "text" || type === "type" || type === "choose_option";
  }

  function _text(value) {
    return _defaultNormalizeText(value);
  }

  function _fold(value, options) {
    const foldTextForCompare = options.foldTextForCompare || _defaultFoldText;
    return foldTextForCompare(value);
  }

  function _attr(el, name) {
    try {
      return el && el.getAttribute ? _text(el.getAttribute(name)) : "";
    } catch (_e) {
      return "";
    }
  }

  function _visibleText(el) {
    if (!el) return "";
    const tag = String(el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return "";
    return _text(el.innerText || el.textContent || "");
  }

  function _labelText(el) {
    if (!el) return "";
    try {
      if (el.getAttribute) {
        const aria = _text(el.getAttribute("aria-label"));
        if (aria) return aria;
        const labelledBy = _text(el.getAttribute("aria-labelledby"));
        if (labelledBy && el.ownerDocument) {
          const parts = labelledBy.split(/\s+/).map((id) => {
            const node = el.ownerDocument.getElementById(id);
            return node ? _text(node.textContent) : "";
          }).filter(Boolean);
          if (parts.length) return _text(parts.join(" "));
        }
      }
      if (el.labels && el.labels.length) {
        const fromLabels = Array.from(el.labels).map((label) => _text(label.textContent)).filter(Boolean).join(" ");
        if (fromLabels) return _text(fromLabels);
      }
      const doc = el.ownerDocument || (typeof document !== "undefined" ? document : null);
      if (el.id && doc && typeof doc.querySelector === "function") {
        const id = String(el.id).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        const label = doc.querySelector(`label[for="${id}"]`);
        if (label && label.textContent) return _text(label.textContent);
      }
      if (typeof el.closest === "function") {
        const parentLabel = el.closest("label");
        if (parentLabel && parentLabel.textContent) return _text(parentLabel.textContent);
      }
    } catch (_e) { /* ignore */ }
    return "";
  }

  function _controlKind(el) {
    const tag = String(el && el.tagName || "").toLowerCase();
    if (tag === "select") return "native-select";
    if (tag === "textarea") return "textarea";
    const type = _attr(el, "type").toLowerCase();
    if (tag === "button" || type === "button" || type === "submit" || type === "reset" || _attr(el, "role").toLowerCase() === "button") return "button";
    if (tag === "input") {
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (_attr(el, "list")) return "datalist";
      return "text-input";
    }
    return "";
  }

  function _contextText(el) {
    try {
      const host = el && typeof el.closest === "function"
        ? el.closest("section, article, main, aside, form, fieldset, [role='dialog'], [role='region']")
        : null;
      if (!host) return "";
      const heading = host.querySelector("legend, h1, h2, h3, h4, h5, h6, [role='heading'], [aria-label]");
      if (!heading || heading === el || (el.contains && el.contains(heading))) return "";
      return _text(heading.getAttribute && heading.getAttribute("aria-label") || heading.textContent || "");
    } catch (_e) {
      return "";
    }
  }

  function _intentFromOptions(options) {
    const raw = (options && typeof options.intent === "object" && options.intent) ||
      (options && typeof options.controlRef === "object" && options.controlRef) ||
      null;
    if (!raw) return null;
    const intent = {};
    ["role", "text", "label", "placeholder", "name", "controlKind", "contextText", "visibleSectionTitle"].forEach((key) => {
      const value = _text(raw[key]);
      if (value) intent[key] = value;
    });
    return Object.keys(intent).length ? intent : null;
  }

  function _matchTextScore(actual, expected, exactScore, equalScore, containsScore, options) {
    const a = _fold(actual, options);
    const e = _fold(expected, options);
    if (!a || !e) return 0;
    if (a === e) return exactScore;
    if (a.includes(e) || e.includes(a)) return containsScore;
    return equalScore && _text(actual) === _text(expected) ? equalScore : 0;
  }

  function _semanticScore(el, intent, options) {
    if (!intent) return { score: 0, reasons: [] };
    let score = 0;
    const reasons = [];
    const add = (points, reason) => {
      if (!points) return;
      score += points;
      reasons.push(reason);
    };

    add(_matchTextScore(_attr(el, "placeholder"), intent.placeholder, 28, 0, 12, options), "placeholder_match");
    add(_matchTextScore(_labelText(el), intent.label, 30, 0, 14, options), "label_match");
    add(_matchTextScore(_visibleText(el), intent.text, 32, 0, 12, options), "text_match");
    add(_matchTextScore(_attr(el, "name"), intent.name, 16, 0, 8, options), "name_match");
    add(_matchTextScore(_attr(el, "role"), intent.role, 18, 0, 0, options), "role_match");
    add(_matchTextScore(_controlKind(el), intent.controlKind, 12, 0, 0, options), "control_kind_match");
    add(
      Math.max(
        _matchTextScore(_contextText(el), intent.contextText, 10, 0, 5, options),
        _matchTextScore(_contextText(el), intent.visibleSectionTitle, 10, 0, 5, options)
      ),
      "context_match"
    );
    return { score, reasons };
  }

  function _hasDecisiveSemanticEvidence(candidate) {
    if (!candidate || !Array.isArray(candidate.semanticReasons)) return false;
    return candidate.semanticReasons.some((reason) => [
      "placeholder_match",
      "label_match",
      "text_match",
      "name_match",
      "context_match"
    ].includes(reason));
  }

  function _detectDangerousAmbiguity(candidates, actionType) {
    const actionable = candidates.filter((item) => item && item.actionable && item.visible);
    if (actionable.length < 2) return null;

    const best = actionable[0];
    const close = actionable.filter((item) => Math.abs((best.rankScore || 0) - (item.rankScore || 0)) <= 3);
    if (close.length < 2) return null;

    const bestHasIdentity = _hasDecisiveSemanticEvidence(best);
    const challengerWithIdentity = close.slice(1).some(_hasDecisiveSemanticEvidence);
    const semanticLead = close.reduce((lead, item) => {
      if (item === best) return lead;
      return Math.min(lead, (best.semanticScore || 0) - (item.semanticScore || 0));
    }, Infinity);

    if (bestHasIdentity && !challengerWithIdentity && semanticLead >= 12) return null;

    return {
      actionType,
      candidates: close,
      reason: "similar_actionable_candidates_without_decisive_semantics"
    };
  }

  function isElementActionableForWebMatic(el, actionType) {
    if (!isElementVisibleForWebMatic(el) || !isElementEnabledForWebMatic(el)) return false;
    if (_isWriteAction(actionType) && !isElementEditableForWebMatic(el)) return false;
    if (String(actionType || "").toLowerCase() === "click" && !_isElementUncovered(el)) return false;
    return true;
  }

  function _candidateDiagnostics(el, actionType) {
    const visible = isElementVisibleForWebMatic(el);
    const enabled = isElementEnabledForWebMatic(el);
    const editable = isElementEditableForWebMatic(el);
    const actionable = isElementActionableForWebMatic(el, actionType);
    const reasons = [];
    const discarded = [];

    if (visible) reasons.push("visible"); else discarded.push("hidden");
    if (enabled) reasons.push("enabled"); else discarded.push("disabled");
    if (_isWriteAction(actionType)) {
      if (editable) reasons.push("editable"); else discarded.push("readonly_or_not_editable");
    }
    if (actionable) reasons.push("actionable");

    return { visible, enabled, editable, actionable, reasons, discarded };
  }

  function findBestElement(selector, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    const actionType = options.actionType || "default";
    const intent = _intentFromOptions(options);
    const selectors = [selector].concat(Array.isArray(options.fallbackSelectors) ? options.fallbackSelectors : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const seenSelectors = [];
    const candidates = [];
    const seenElements = new Set();

    selectors.forEach((sel, selectorIndex) => {
      if (seenSelectors.includes(sel)) return;
      seenSelectors.push(sel);
      const list = getCandidateElements(sel, doc, options);
      list.forEach((el, candidateIndex) => {
        if (seenElements.has(el)) return;
        seenElements.add(el);
        const diagnostic = _candidateDiagnostics(el, actionType);
        const semantic = _semanticScore(el, intent, options);
        const rankScore = (diagnostic.actionable ? 100 : 0)
          + (diagnostic.visible ? 30 : -50)
          + (diagnostic.enabled ? 20 : -60)
          + (!_isWriteAction(actionType) || diagnostic.editable ? 15 : -60)
          + semantic.score
          - (selectorIndex * 5);
        const score = rankScore - candidateIndex;
        candidates.push({
          element: el,
          selector: sel,
          selectorIndex,
          candidateIndex,
          score,
          rankScore,
          semanticScore: semantic.score,
          semanticReasons: semantic.reasons,
          reasons: diagnostic.reasons.concat(semantic.reasons),
          discarded: diagnostic.discarded,
          visible: diagnostic.visible,
          enabled: diagnostic.enabled,
          editable: diagnostic.editable,
          actionable: diagnostic.actionable
        });
      });
    });

    candidates.sort((a, b) => {
      if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
      if (a.visible !== b.visible) return a.visible ? -1 : 1;
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      if (_isWriteAction(actionType) && a.editable !== b.editable) return a.editable ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      if (a.selectorIndex !== b.selectorIndex) return a.selectorIndex - b.selectorIndex;
      return a.candidateIndex - b.candidateIndex;
    });

    const ambiguity = _detectDangerousAmbiguity(candidates, actionType);
    if (ambiguity) {
      return {
        element: null,
        status: "ambiguous",
        candidates,
        ambiguity,
        discarded: candidates.filter((item) => !item.actionable).map((item) => ({
          element: item.element,
          selector: item.selector,
          reasons: item.discarded
        })),
        diagnostics: {
          technicalCode: "RESOLVER_AMBIGUOUS",
          userMessage: "No encontre un elemento unico con suficiente certeza."
        }
      };
    }

    // Compat legacy: si solo hay un candidato, incluso no accionable, se conserva
    // el fallback historico para macros antiguas sin metadata semantica.
    const best = candidates[0] || null;
    return {
      element: best ? best.element : null,
      status: best ? "ok" : "not_found",
      candidates,
      discarded: candidates.filter((item) => !item.actionable).map((item) => ({
        element: item.element,
        selector: item.selector,
        reasons: item.discarded
      })),
      diagnostics: {
        technicalCode: best ? "RESOLVER_OK" : "RESOLVER_NOT_FOUND",
        userMessage: best ? "Elemento encontrado." : "No encontre el elemento."
      }
    };
  }

  function _findByFallbackSelectors(doc, selectors, options) {
    const list = Array.isArray(selectors) ? selectors : [];
    for (const raw of list) {
      const sel = String(raw || "").trim();
      if (!sel) continue;
      const found = findBestElement(sel, { ...(options || {}), document: doc }).element;
      if (found) return found;
    }
    return null;
  }

  function _findAngularMaterialDynamicFallback(doc, selector) {
    const raw = String(selector || "").trim();
    const match = /^#?mat-(input|select|option)-\d+$/i.exec(raw);
    if (!match || !doc) return null;

    const kind = match[1].toLowerCase();
    const selectorByKind = kind === "input"
      ? 'input[id^="mat-input-"], textarea[id^="mat-input-"]'
      : kind === "select"
        ? '[id^="mat-select-"]'
        : '[id^="mat-option-"]';

    const candidates = [];
    for (const d of _searchDocs(doc)) {
      try {
        d.querySelectorAll(selectorByKind).forEach((el) => {
          if (_isVisibleEnough(el)) candidates.push(el);
        });
      } catch (e) { /* ignore */ }
    }

    return candidates.length === 1 ? candidates[0] : null;
  }

  function findElement(selector, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    const knownFallback = options.knownFallback;
    const fallbackSelectors = options.fallbackSelectors;

    if (!selector || !doc) return null;

    const best = findBestElement(selector, options);
    if (best.element) return best.element;

    const fallback = _findByFallbackSelectors(doc, fallbackSelectors, options);
    if (fallback) return fallback;

    const angularMaterialFallback = _findAngularMaterialDynamicFallback(doc, selector);
    if (angularMaterialFallback) return angularMaterialFallback;

    if (typeof knownFallback === "function") {
      return knownFallback(selector);
    }

    return null;
  }

  const api = {
    findInShadow,
    findInDocument,
    getCandidateElements,
    isElementVisibleForWebMatic,
    isElementEnabledForWebMatic,
    isElementEditableForWebMatic,
    isElementActionableForWebMatic,
    findBestElement,
    findElement
  };

  globalScope.WebMaticElementFinder = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
