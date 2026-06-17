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
    } catch (e) { /* cross-origin iframe will throw */ }

    try {
      const frames = doc.querySelectorAll("iframe, frame");
      for (const frame of frames) {
        try {
          const innerDoc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
          if (!innerDoc) continue;

          const found = findInDocument(innerDoc, selector);
          if (found) return found;
        } catch (e) { /* cross-origin - skip */ }
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  function findElement(selector, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    const normalizeTextForCompare = options.normalizeTextForCompare;
    const foldTextForCompare = options.foldTextForCompare;
    const knownFallback = options.knownFallback;

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