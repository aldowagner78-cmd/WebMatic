(function initSelectorDiagnostics(globalScope) {
  const SENSITIVE_DIAGNOSTIC_RE = /(password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|api[_-]?key|apikey|secret|pin|cvv|cvc|authorization|bearer)/i;
  const SENSITIVE_VALUE_RE = /(bearer\s+[a-z0-9._~+/-]+=*|api[_-]?key\s*[:=]\s*[^,\s]+|token\s*[:=]\s*[^,\s]+|password\s*[:=]\s*[^,\s]+|pin\s*[:=]\s*[^,\s]+|cvv\s*[:=]\s*[^,\s]+)/i;
  const REDACTED = "[redacted-sensitive]";

  function normalizeDiagnosticText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function sanitizeDiagnosticValue(name, value, maxLength) {
    const attrName = normalizeDiagnosticText(name);
    const attrValue = normalizeDiagnosticText(value);
    if (!attrValue) return "";
    if (SENSITIVE_DIAGNOSTIC_RE.test(attrName) || SENSITIVE_DIAGNOSTIC_RE.test(attrValue) || SENSITIVE_VALUE_RE.test(attrValue)) {
      return REDACTED;
    }
    return attrValue.slice(0, maxLength || 120);
  }

  function isVisibleForDiagnostic(el) {
    if (!el || !(el instanceof Element)) return false;
    const htmlEl = /** @type {HTMLElement} */ (el);
    try {
      const view = (htmlEl.ownerDocument && htmlEl.ownerDocument.defaultView) || window;
      const cs = view && typeof view.getComputedStyle === "function"
        ? view.getComputedStyle(htmlEl)
        : { display: "", visibility: "", opacity: "", pointerEvents: "" };
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0" || cs.pointerEvents === "none") return false;
      return !!(htmlEl.getClientRects && htmlEl.getClientRects().length > 0);
    } catch (_e) {
      return false;
    }
  }

  function summarizeElementForDiagnostic(el) {
    if (!el || !(el instanceof Element)) return null;
    const tag = String(el.tagName || "").toLowerCase();
    const attrs = {
      id: sanitizeDiagnosticValue("id", el.id || ""),
      className: sanitizeDiagnosticValue("class", typeof el.className === "string" ? el.className : ""),
      role: sanitizeDiagnosticValue("role", el.getAttribute && el.getAttribute("role") || ""),
      title: sanitizeDiagnosticValue("title", el.getAttribute && el.getAttribute("title") || ""),
      ariaLabel: sanitizeDiagnosticValue("aria-label", el.getAttribute && el.getAttribute("aria-label") || ""),
      dataTestid: sanitizeDiagnosticValue("data-testid", el.getAttribute && el.getAttribute("data-testid") || ""),
      name: sanitizeDiagnosticValue("name", el.getAttribute && el.getAttribute("name") || ""),
      type: sanitizeDiagnosticValue("type", el.getAttribute && el.getAttribute("type") || "")
    };
    const text = tag === "input" || tag === "textarea" || tag === "select"
      ? ""
      : sanitizeDiagnosticValue("text", el.textContent || "", 120);
    return {
      tag,
      visible: isVisibleForDiagnostic(el),
      attrs,
      text
    };
  }

  function collectSelectorDiagnostics(selector, rootDocument) {
    const doc = rootDocument || (typeof document !== "undefined" ? document : null);
    const out = {
      selector,
      mode: "css",
      matchedCount: 0,
      topMatches: [],
      nearbyGalleryControls: []
    };

    if (!selector || !doc) return out;

    try {
      if (selector.startsWith("/") || selector.startsWith("(")) {
        out.mode = "xpath";
        const xpathResult = doc.evaluate(
          selector,
          doc,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );
        out.matchedCount = xpathResult.snapshotLength;
        const top = [];
        for (let i = 0; i < Math.min(5, xpathResult.snapshotLength); i++) {
          const node = xpathResult.snapshotItem(i);
          const summary = summarizeElementForDiagnostic(node);
          if (summary) top.push(summary);
        }
        out.topMatches = top;
      } else {
        const nodeList = doc.querySelectorAll(selector);
        out.matchedCount = nodeList.length;
        out.topMatches = Array.from(nodeList)
          .slice(0, 5)
          .map((n) => summarizeElementForDiagnostic(n))
          .filter(Boolean);
      }
    } catch (e) {
      out.error = String((e && e.message) || e || "error");
    }

    try {
      if (/(next|siguiente|close|cerrar|arrow|flecha|gallery)/i.test(String(selector))) {
        const probeSelectors = [
          "[data-testid*='gallery']",
          "[title*='Next']",
          "[title*='Siguiente']",
          "[aria-label*='Next']",
          "[aria-label*='Siguiente']",
          "[title*='Close']",
          "[title*='Cerrar']",
          "[aria-label*='Close']",
          "[aria-label*='Cerrar']"
        ];
        const probes = [];
        for (const ps of probeSelectors) {
          try {
            const list = doc.querySelectorAll(ps);
            if (list.length === 0) continue;
            probes.push({
              probe: ps,
              count: list.length,
              top: Array.from(list).slice(0, 3).map((n) => summarizeElementForDiagnostic(n)).filter(Boolean)
            });
          } catch (_e) { /* ignore */ }
        }
        out.nearbyGalleryControls = probes;
      }
    } catch (_e) { /* ignore */ }

    return out;
  }

  function logSelectorFailure(stepType, selector, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    const targetGlobal = options.globalScope || globalScope;
    const diag = collectSelectorDiagnostics(selector, doc);

    try {
      console.groupCollapsed(`[WebMatic][selector-diagnostic] ${stepType} -> ${selector}`);
      console.log(diag);
      console.groupEnd();
      targetGlobal.__WEBMATIC_LAST_SELECTOR_DIAGNOSTIC__ = {
        at: new Date().toISOString(),
        stepType,
        diagnostic: diag
      };
    } catch (_e) { /* ignore */ }

    return diag;
  }

  const api = {
    isVisibleForDiagnostic,
    _isVisibleForDiagnostic: isVisibleForDiagnostic,
    sanitizeDiagnosticValue,
    _sanitizeDiagnosticValue: sanitizeDiagnosticValue,
    summarizeElementForDiagnostic,
    _summarizeElementForDiagnostic: summarizeElementForDiagnostic,
    collectSelectorDiagnostics,
    _collectSelectorDiagnostics: collectSelectorDiagnostics,
    logSelectorFailure,
    _logSelectorFailure: logSelectorFailure
  };

  globalScope.WebMaticSelectorDiagnostics = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
