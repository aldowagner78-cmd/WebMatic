(function initSelectorBuilder(globalScope) {
  function escapeAttr(value) {
    return String(value == null ? "" : value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function escapeCssIdent(value) {
    const raw = String(value == null ? "" : value);
    try {
      const cssApi = (typeof globalThis !== "undefined" && globalThis.CSS) ? globalThis.CSS : null;
      if (cssApi && typeof cssApi.escape === "function") return cssApi.escape(raw);
    } catch (_e) { /* ignore */ }
    return raw.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }

  function normalizeText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function resolveSelectorInDoc(doc, selector) {
    if (!doc || !selector) return { element: null, unique: false };
    const textMatch = /^(\w+)\[text="([^"]+)"\]$/.exec(selector);
    if (textMatch) {
      const [, tagName, text] = textMatch;
      const expected = normalizeText(text);
      let hits = [];
      try {
        hits = Array.from(doc.querySelectorAll(tagName)).filter((el) => normalizeText(el.textContent) === expected);
      } catch (_e) {
        hits = [];
      }
      return { element: hits[0] || null, unique: hits.length === 1 };
    }

    try {
      const found = doc.querySelector(selector);
      const all = doc.querySelectorAll(selector);
      return { element: found || null, unique: all.length === 1 };
    } catch (_e) {
      return { element: null, unique: false };
    }
  }

  function selectorResolvesToElement(doc, selector, element, opts) {
    if (!doc || !selector || !(element instanceof Element)) return false;
    const options = opts && typeof opts === "object" ? opts : {};
    const requireUnique = options.requireUnique !== false;
    const resolved = resolveSelectorInDoc(doc, selector);
    if (!resolved.element || resolved.element !== element) return false;
    if (requireUnique && !resolved.unique) return false;
    return true;
  }

  function isLikelyDynamicValue(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return false;

    const lower = raw.toLowerCase();
    const stableCommon = new Set([
      "login", "username", "password", "submit", "buscar", "autorizar", "btnguardar", "codigoafiliado"
    ]);
    if (stableCommon.has(lower)) return false;

    if (/^[0-9]{6,}$/.test(raw)) return true;
    if (/\d{10,}/.test(raw)) return true;
    if (/\b20\d{6}\b/.test(raw)) return true;
    if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(raw)) return true;
    if (/\b[a-f0-9]{16,}\b/i.test(raw)) return true;
    if (/(^|[_:-])(react|reactid|ng|vue|v)[_:-]/i.test(raw)) return true;
    if (/^(:?r\d|__next|ember|svelte|astro)/i.test(raw)) return true;
    if (/(?:[_:-])[a-z0-9]{10,}(?:[_:-]|$)/i.test(raw)) return true;
    if (/(?:[_:-])\d{5,}(?:$|[_:-])/.test(raw)) return true;

    return false;
  }

  function buildSelector(element) {
    if (!element || !(element instanceof Element)) return "";
    const E = escapeAttr;
    const EI = escapeCssIdent;
    const doc = element.ownerDocument || document;

    const accept = (selector, options) => {
      if (!selector) return "";
      return selectorResolvesToElement(doc, selector, element, options) ? selector : "";
    };

    const tag0 = element.tagName.toLowerCase();
    if ((tag0 === "img" || (tag0 === "input" && element.type === "image" && !element.id)) ) {
      const anchor = element.closest("a[href]");
      if (anchor) {
        element = anchor;
      }
    }

    const tag = element.tagName.toLowerCase();
    const elementId = String(element.id || "");
    if (elementId) {
      const byId = accept("#" + EI(elementId));
      if (byId) return byId;
    }

    if (element.dataset && element.dataset.testid) {
      const byTestId = accept(`[data-testid="${E(element.dataset.testid)}"]`);
      if (byTestId) return byTestId;
    }
    if (element.dataset && element.dataset.test) {
      const byDataTest = accept(`[data-test="${E(element.dataset.test)}"]`);
      if (byDataTest) return byDataTest;
    }
    if (element.dataset && element.dataset.cy) {
      const byDataCy = accept(`[data-cy="${E(element.dataset.cy)}"]`);
      if (byDataCy) return byDataCy;
    }

    if (element.getAttribute("aria-label")) {
      const aria = E(element.getAttribute("aria-label"));
      const byAria = accept(`${tag}[aria-label="${aria}"]`) || accept(`[aria-label="${aria}"]`);
      if (byAria) return byAria;
    }

    if (element.getAttribute("placeholder")) {
      const byPlaceholder = accept(`${tag}[placeholder="${E(element.getAttribute("placeholder"))}"]`);
      if (byPlaceholder) return byPlaceholder;
    }

    const titleAttr = element.getAttribute("title");
    if (titleAttr && titleAttr.length <= 80) {
      const gxRow = element.closest && element.closest("[gxrow]");
      if (gxRow) {
        const rowNum = gxRow.getAttribute("gxrow");
        const byRowTitle = accept(`[gxrow="${E(rowNum)}"] [title="${E(titleAttr)}"]`);
        if (byRowTitle) return byRowTitle;
      }
      const byTitle = accept(`[title="${E(titleAttr)}"]`);
      if (byTitle) return byTitle;
    }

    if (element.getAttribute("name")) {
      const nameAttr = element.getAttribute("name");
      const typeAttr = String((element.getAttribute && element.getAttribute("type")) || "").toLowerCase();
      if (tag === "input" && typeAttr) {
        const byTypeAndName = accept(`${tag}[type="${E(typeAttr)}"][name="${E(nameAttr)}"]`);
        if (byTypeAndName) return byTypeAndName;
      }
      const byTagName = accept(`${tag}[name="${E(nameAttr)}"]`);
      if (byTagName) return byTagName;

      const sameName = Array.from((element.ownerDocument || document).getElementsByTagName(tag))
        .filter((el) => el.getAttribute("name") === nameAttr).length;
      if (sameName === 1) {
        const byName = accept(`${tag}[name="${E(nameAttr)}"]`);
        if (byName) return byName;
      }

      let anc = element.parentElement;
      while (anc && !anc.id) anc = anc.parentElement;
      if (anc && anc.id && !/^(wm-|webmatic-)/.test(anc.id)) {
        const anchored = `#${EI(anc.id)} ${tag}[name="${E(nameAttr)}"]`;
        const byAnchoredName = accept(anchored);
        if (byAnchoredName) return byAnchoredName;
      }
    }

    if (tag === "a" && element.getAttribute("href")) {
      const href = element.getAttribute("href");
      if (href.length <= 80 && !href.startsWith("javascript")) {
        const byHref = accept(`a[href="${E(href)}"]`);
        if (byHref) return byHref;
      }
    }

    const stableData = Array.from(element.attributes).find((a) => {
      if (!a.name.startsWith("data-")) return false;
      if (/data-(v-|reactid|ng-|index$|key$|_)/.test(a.name)) return false;
      if (a.value.length > 80 || a.value === "") return false;
      return true;
    });
    if (stableData) {
      const byStableData = accept(`[${stableData.name}="${E(stableData.value)}"]`);
      if (byStableData) return byStableData;
    }

    const text = (element.textContent || "").replace(/\s+/g, " ").trim();
    if ((tag === "button" || tag === "a") && text && text.length <= 60) {
      const sameTextCount = Array.from((element.ownerDocument || document).querySelectorAll(tag))
        .filter((el) => ((el.textContent || "").replace(/\s+/g, " ").trim() === text)).length;
      if (sameTextCount === 1) {
        const byText = accept(`${tag}[text="${E(text)}"]`);
        if (byText) return byText;
      }
    }

    let anc = element.parentElement;
    let ancDepth = 0;
    while (anc && ancDepth < 5) {
      if (anc.id && !/^(wm-|webmatic-)/.test(anc.id)) {
        const ancChildren = Array.from(anc.children || []);
        const ancSame = ancChildren.filter((s) => s.tagName === element.tagName);
        if (ancSame.length > 1) {
          const byAncNth = accept(`#${EI(anc.id)} ${tag}:nth-of-type(${ancSame.indexOf(element) + 1})`);
          if (byAncNth) return byAncNth;
        }
        const byAncTag = accept(`#${EI(anc.id)} ${tag}`);
        if (byAncTag) return byAncTag;
      }
      anc = anc.parentElement;
      ancDepth++;
    }

    const stableClasses = Array.from(element.classList || [])
      .filter((c) => c.length <= 40 && !/^(js-|ng-|v-|__\w|\d)/.test(c))
      .slice(0, 2).join(".");
    const siblings = Array.from(element.parentElement?.children || []);
    const sameTag = siblings.filter((s) => s.tagName === element.tagName);
    const idx = sameTag.indexOf(element);
    const nth = sameTag.length > 1 ? `:nth-of-type(${idx + 1})` : "";
    if (stableClasses) {
      const byClass = accept(`${tag}.${stableClasses}${nth}`);
      if (byClass) return byClass;
    }

    if (elementId) {
      const byAnyId = accept(`#${EI(elementId)}`, { requireUnique: false });
      if (byAnyId) return byAnyId;
    }

    const byTagNth = accept(`${tag}${nth}`);
    if (byTagNth) return byTagNth;
    return "";
  }

  const api = {
    escapeAttr,
    escapeCssIdent,
    normalizeText,
    _normalizeText: normalizeText,
    resolveSelectorInDoc,
    _resolveSelectorInDoc: resolveSelectorInDoc,
    selectorResolvesToElement,
    isLikelyDynamicValue,
    buildSelector
  };

  globalScope.WebMaticSelectorBuilder = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
