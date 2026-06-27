(function initElementFinder(globalScope) {
  function findInShadow(root, selector) {
    try {
      const direct = root.querySelector(selector);
      if (direct) return direct;
    } catch (e) {
      return null;
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

  function findInDocument(doc, selector) {
    if (!doc) return null;

    try {
      const direct = findInShadow(doc, selector);
      if (direct) return direct;
    } catch (e) { /* ignore */ }

    try {
      const frames = doc.querySelectorAll("iframe, frame");
      for (const frame of frames) {
        try {
          const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
          if (!innerDoc) continue;
          const found = findInDocument(innerDoc, selector);
          if (found) return found;
        } catch (e) { /* cross-origin */ }
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  function _isVisibleEnough(el) {
    if (!el || !(el instanceof Element)) return false;
    try {
      const view = (el.ownerDocument && el.ownerDocument.defaultView) || (typeof window !== "undefined" ? window : null);
      const style = view && typeof view.getComputedStyle === "function" ? view.getComputedStyle(el) : null;
      if (style && (style.display === "none" || style.visibility === "hidden" || style.opacity === "0")) return false;
      if (typeof el.getClientRects === "function" && el.getClientRects().length > 0) return true;
      return true;
    } catch (_e) {
      return true;
    }
  }

  function _searchDocs(doc) {
    const docs = [];
    if (doc) docs.push(doc);
    try {
      const frames = doc.querySelectorAll("iframe, frame");
      for (const frame of frames) {
        try {
          const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
          if (innerDoc) docs.push(innerDoc);
        } catch (_e) { /* cross-origin */ }
      }
    } catch (_e) { /* ignore */ }
    return docs;
  }

  function _findByFallbackSelectors(doc, selectors) {
    const list = Array.isArray(selectors) ? selectors : [];
    for (const raw of list) {
      const sel = String(raw || "").trim();
      if (!sel) continue;
      const found = findInDocument(doc, sel);
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
      } catch (_e) { /* ignore */ }
    }

    return candidates.length === 1 ? candidates[0] : null;
  }

  function findElement(selector, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    const normalizeTextForCompare = options.normalizeTextForCompare;
    const foldTextForCompare = options.foldTextForCompare;
    const knownFallback = options.knownFallback;
    const fallbackSelectors = options.fallbackSelectors;

    if (!selector || !doc) return null;

    if (selector.startsWith("/") || selector.startsWith("(")) {
      try {
        const result = doc.evaluate(
          selector,
          doc,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return result.singleNodeValue || null;
      } catch (e) {
        return null;
      }
    }

    const textMatch = /^(\w+)\[text="([^"]+)"\]$/.exec(selector);
    if (textMatch) {
      const [, tagName, text] = textMatch;
      const expectedText = normalizeTextForCompare(text);
      const expectedFold = foldTextForCompare(text);
      const docsToSearch = [doc];

      try {
        const frames = doc.querySelectorAll("iframe, frame");
        for (const frame of frames) {
          try {
            const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
            if (innerDoc) docsToSearch.push(innerDoc);
          } catch (e) { /* cross-origin */ }
        }
      } catch (e) { /* ignore */ }

      for (const d of docsToSearch) {
        let foldedEqual = null;
        let foldedContains = null;

        try {
          const candidates = d.querySelectorAll(tagName);
          for (const el of candidates) {
            const elText = normalizeTextForCompare(el.textContent);
            const elFold = foldTextForCompare(el.textContent);

            if (elText === expectedText) return el;
            if (!foldedEqual && elFold === expectedFold) foldedEqual = el;
            if (!foldedContains && expectedFold && elFold.includes(expectedFold)) foldedContains = el;
          }

          if (foldedEqual) return foldedEqual;
          if (foldedContains) return foldedContains;
        } catch (e) { /* ignore */ }
      }

      return null;
    }

    const direct = findInDocument(doc, selector);
    if (direct) return direct;

    const fallback = _findByFallbackSelectors(doc, fallbackSelectors);
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
    findElement
  };

  globalScope.WebMaticElementFinder = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
