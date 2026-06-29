(function initActionabilityDiagnostics(globalScope) {
  const SENSITIVE_NAME_RE = /(password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|api[_-]?key|apikey|secret|pin|cvv|cvc|card[_-]?code|authorization|bearer)/i;
  const SENSITIVE_VALUE_RE = /(bearer\s+[a-z0-9._~+/-]+=*|api[_-]?key\s*[:=]\s*[^,\s]+|token\s*[:=]\s*[^,\s]+|password\s*[:=]\s*[^,\s]+|pin\s*[:=]\s*[^,\s]+|cvv\s*[:=]\s*[^,\s]+)/i;
  const REDACTED = "[redacted-sensitive]";

  function _isElement(el) {
    return !!(el && el.nodeType === 1);
  }

  function normalizeText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function looksSensitive(value) {
    const text = normalizeText(value);
    return !!(text && (SENSITIVE_NAME_RE.test(text) || SENSITIVE_VALUE_RE.test(text)));
  }

  function sanitizeDiagnosticText(value) {
    const text = normalizeText(value);
    if (!text) return "";
    return looksSensitive(text) ? REDACTED : text.slice(0, 160);
  }

  function sanitizeAttributeValue(name, value) {
    const attrName = normalizeText(name);
    const attrValue = normalizeText(value);
    if (!attrValue) return "";
    if (looksSensitive(attrName) || looksSensitive(attrValue)) return REDACTED;
    return attrValue.slice(0, 120);
  }

  function _computedStyle(el) {
    try {
      const view = (el.ownerDocument && el.ownerDocument.defaultView) || (typeof window !== "undefined" ? window : null);
      return view && typeof view.getComputedStyle === "function" ? view.getComputedStyle(el) : null;
    } catch (_e) {
      return null;
    }
  }

  function _attribute(el, name) {
    try {
      return el && el.getAttribute ? el.getAttribute(name) : "";
    } catch (_e) {
      return "";
    }
  }

  function _isWriteAction(actionType) {
    const type = String(actionType || "").toLowerCase();
    return type === "input" || type === "text" || type === "type" || type === "choose_option" || type === "write";
  }

  function _isReadonlyForWrite(el) {
    try {
      if (String(_attribute(el, "aria-readonly") || "").toLowerCase() === "true") return true;
      if (el.isContentEditable) return false;
      const tag = String(el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return el.readOnly === true || _attribute(el, "readonly") != null;
      return false;
    } catch (_e) {
      return false;
    }
  }

  function _isHappyDom(el) {
    try {
      const view = el && el.ownerDocument && el.ownerDocument.defaultView;
      return !!(view && view.happyDOM);
    } catch (_e) {
      return false;
    }
  }

  function _rectDiagnostic(el, options) {
    if (!_isElement(el)) return null;
    if (_isHappyDom(el) && !(options && options.strictGeometry)) return null;
    try {
      if (typeof el.getBoundingClientRect !== "function") return null;
      const rect = el.getBoundingClientRect();
      if (!rect) return null;
      const width = Number(rect.width || 0);
      const height = Number(rect.height || 0);
      if (width <= 0 || height <= 0) {
        return { code: "rect_0x0", message: "El candidato tiene un rectangulo renderizado de 0x0.", severity: "blocker" };
      }
    } catch (_e) { /* ignore */ }
    return null;
  }

  function _isRelatedCover(top, el) {
    return !top || top === el || (el.contains && el.contains(top)) || (top.contains && top.contains(el));
  }

  function _overlayDiagnostic(el) {
    try {
      const doc = el.ownerDocument;
      if (!doc || typeof doc.elementFromPoint !== "function" || typeof el.getBoundingClientRect !== "function") return null;
      const rect = el.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const top = doc.elementFromPoint(x, y);
      if (_isRelatedCover(top, el)) return null;
      const topStyle = _computedStyle(top);
      if (topStyle && topStyle.pointerEvents === "none") return null;
      return {
        code: "covered_by_overlay",
        message: "El punto central del candidato esta cubierto por otro elemento.",
        severity: "blocker",
        evidence: summarizeElementForActionability(top)
      };
    } catch (_e) {
      return null;
    }
  }

  function summarizeElementForActionability(el) {
    if (!_isElement(el)) return null;
    const tag = String(el.tagName || "").toLowerCase();
    const attrs = {
      id: sanitizeAttributeValue("id", el.id || ""),
      className: sanitizeAttributeValue("class", typeof el.className === "string" ? el.className : ""),
      role: sanitizeAttributeValue("role", _attribute(el, "role")),
      title: sanitizeAttributeValue("title", _attribute(el, "title")),
      ariaLabel: sanitizeAttributeValue("aria-label", _attribute(el, "aria-label")),
      dataTestid: sanitizeAttributeValue("data-testid", _attribute(el, "data-testid")),
      name: sanitizeAttributeValue("name", _attribute(el, "name")),
      type: sanitizeAttributeValue("type", _attribute(el, "type")),
      placeholder: sanitizeAttributeValue("placeholder", _attribute(el, "placeholder"))
    };
    const text = tag === "input" || tag === "textarea" || tag === "select"
      ? ""
      : sanitizeDiagnosticText(el.textContent || "");
    return { tag, attrs, text };
  }

  function _push(reasons, code, message, severity, evidence) {
    const item = { code, message, severity: severity || "blocker" };
    if (evidence) item.evidence = evidence;
    reasons.push(item);
  }

  function diagnoseCandidateActionability(el, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const actionType = options.actionType || "click";
    const reasons = [];

    if (!_isElement(el)) {
      _push(reasons, "invalid_candidate", "El candidato no es un elemento DOM valido.", "blocker");
      return {
        actionable: false,
        actionType,
        summary: null,
        reasons,
        codes: reasons.map((reason) => reason.code),
        developerMessage: "Candidato no confiable: no es un elemento DOM valido."
      };
    }

    let current = el;
    while (current && current.nodeType === 1) {
      const isSelf = current === el;
      const style = _computedStyle(current);
      if (current.hidden || _attribute(current, "hidden") != null) {
        _push(reasons, isSelf ? "hidden" : "hidden_ancestor", isSelf ? "El candidato tiene atributo hidden." : "Un ancestro del candidato tiene atributo hidden.", "blocker", isSelf ? undefined : summarizeElementForActionability(current));
      }
      if (String(_attribute(current, "aria-hidden") || "").toLowerCase() === "true") {
        _push(reasons, isSelf ? "aria_hidden" : "aria_hidden_ancestor", isSelf ? "El candidato tiene aria-hidden=true." : "Un ancestro del candidato tiene aria-hidden=true.", "blocker", isSelf ? undefined : summarizeElementForActionability(current));
      }
      if (current.disabled === true) {
        _push(reasons, isSelf ? "disabled" : "disabled_ancestor", isSelf ? "El candidato esta disabled." : "Un ancestro del candidato esta disabled.", "blocker", isSelf ? undefined : summarizeElementForActionability(current));
      }
      if (String(_attribute(current, "aria-disabled") || "").toLowerCase() === "true") {
        _push(reasons, isSelf ? "aria_disabled" : "aria_disabled_ancestor", isSelf ? "El candidato tiene aria-disabled=true." : "Un ancestro del candidato tiene aria-disabled=true.", "blocker", isSelf ? undefined : summarizeElementForActionability(current));
      }
      if (style) {
        if (style.display === "none") {
          _push(reasons, isSelf ? "display_none" : "display_none_ancestor", isSelf ? "El candidato tiene display:none." : "Un ancestro del candidato tiene display:none.", "blocker", isSelf ? undefined : summarizeElementForActionability(current));
        }
        if (style.visibility === "hidden" || style.visibility === "collapse") {
          _push(reasons, isSelf ? "visibility_hidden" : "visibility_hidden_ancestor", isSelf ? "El candidato tiene visibility:hidden." : "Un ancestro del candidato tiene visibility:hidden.", "blocker", isSelf ? undefined : summarizeElementForActionability(current));
        }
      }
      current = current.parentElement;
    }

    if (_isWriteAction(actionType) && _isReadonlyForWrite(el)) _push(reasons, "readonly_for_write", "La accion escribe, pero el candidato es readonly.", "blocker");

    const rectReason = _rectDiagnostic(el, options);
    if (rectReason) reasons.push(rectReason);
    if (String(actionType || "").toLowerCase() === "click") {
      const overlayReason = _overlayDiagnostic(el);
      if (overlayReason) reasons.push(overlayReason);
    }

    const actionable = reasons.filter((reason) => reason.severity === "blocker").length === 0;
    const codes = reasons.map((reason) => reason.code);
    return {
      actionable,
      actionType,
      summary: summarizeElementForActionability(el),
      reasons,
      codes,
      developerMessage: actionable
        ? "Candidato accionable: no se detectaron bloqueos tecnicos."
        : `Candidato no confiable: ${codes.join(", ")}.`
    };
  }

  function diagnoseActionabilityCandidates(candidates, opts) {
    const list = Array.isArray(candidates) ? candidates : [];
    const diagnostics = list.map((item, index) => {
      const el = item && item.element ? item.element : item;
      const diagnostic = diagnoseCandidateActionability(el, opts);
      return {
        index,
        selector: item && item.selector ? sanitizeDiagnosticText(item.selector) : "",
        diagnostic
      };
    });
    const actionable = diagnostics.filter((item) => item.diagnostic.actionable);
    const collectionReasons = [];
    if (actionable.length === 0) {
      _push(collectionReasons, "no_actionable_candidates", "No hay candidatos accionables para ejecutar la accion con seguridad.", "blocker");
    } else if (actionable.length > 1) {
      _push(collectionReasons, "multiple_actionable_candidates", "Hay multiples candidatos accionables; el selector no identifica un unico objetivo confiable.", "warning");
    }
    return {
      totalCandidates: diagnostics.length,
      actionableCount: actionable.length,
      reliable: actionable.length === 1,
      diagnostics,
      reasons: collectionReasons,
      codes: collectionReasons.map((reason) => reason.code),
      developerMessage: collectionReasons.length
        ? collectionReasons.map((reason) => reason.message).join(" ")
        : "Hay un unico candidato accionable."
    };
  }

  const api = {
    REDACTED,
    looksSensitive,
    sanitizeDiagnosticText,
    sanitizeAttributeValue,
    summarizeElementForActionability,
    diagnoseCandidateActionability,
    diagnoseActionabilityCandidates,
    _isWriteAction
  };

  globalScope.WebMaticActionabilityDiagnostics = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
