(function initDefaultsCapture(globalScope) {
  const PRE_RUN_RESET_SENSITIVE_RE = /(pass|password|passwd|pwd|token|secret|cvv|cvc|card|tarjeta|otp|pin|seguridad|security|clave|contrasen|contrasenia|api[-_]?key|authorization|auth)/i;

  function isSensitivePreRunField(el) {
    if (!(el instanceof Element)) return false;
    const type = String(el.getAttribute("type") || "").toLowerCase();
    const id = String(el.id || "");
    const name = String(el.getAttribute("name") || "");
    const ariaLabel = String(el.getAttribute("aria-label") || "");
    return type === "password" ||
      PRE_RUN_RESET_SENSITIVE_RE.test(id) ||
      PRE_RUN_RESET_SENSITIVE_RE.test(name) ||
      PRE_RUN_RESET_SENSITIVE_RE.test(ariaLabel);
  }

  function capturePreRunControlsInDoc(doc, out, seen, buildSelector) {
    if (!doc) return;
    const select = typeof buildSelector === "function" ? buildSelector : null;
    let fields = [];
    try {
      fields = Array.from(doc.querySelectorAll("input, select, textarea"));
    } catch (_e) {
      fields = [];
    }

    fields.forEach((el) => {
      try {
        if (el.closest && (el.closest("#webmatic-panel-root") || el.closest("#webmatic-floating-recorder-global") || el.closest("#webmatic-floating-player-global"))) {
          return;
        }
        const tag = String(el.tagName || "").toLowerCase();
        const type = String(el.type || "").toLowerCase();
        if (type === "hidden" || type === "submit" || type === "button" || type === "image" || type === "file" || type === "reset") return;
        if (el.disabled || el.readOnly) return;

        const selector = select ? select(el) : "";
        if (!selector || seen.has(selector)) return;
        seen.add(selector);

        const ctrl = {
          selector,
          tag,
          type,
          id: String(el.id || ""),
          name: String(el.getAttribute("name") || "")
        };

        if (isSensitivePreRunField(el)) {
          out.push(ctrl);
          return;
        }

        if (tag === "select") {
          ctrl.value = String(el.value == null ? "" : el.value);
          ctrl.selectedIndex = Number.isFinite(Number(el.selectedIndex)) ? Number(el.selectedIndex) : 0;
        } else if (type === "checkbox" || type === "radio") {
          ctrl.checked = Boolean(el.checked);
        } else {
          ctrl.value = String(el.value == null ? "" : el.value);
        }
        out.push(ctrl);
      } catch (_e) { /* ignore single field */ }
    });

    try {
      const frames = doc.querySelectorAll("iframe, frame");
      frames.forEach((fr) => {
        try {
          capturePreRunControlsInDoc(fr.contentDocument || (fr.contentWindow && fr.contentWindow.document), out, seen, select);
        } catch (_e) { /* cross-origin */ }
      });
    } catch (_e) { /* ignore */ }
  }

  function captureInitialPreRunReset(doc, locationHref, title, buildSelector) {
    const controls = [];
    capturePreRunControlsInDoc(doc, controls, new Set(), buildSelector);
    if (controls.length === 0) return null;
    return {
      version: 1,
      capturedAt: Date.now(),
      url: String(locationHref || ""),
      title: String(title || ""),
      controls
    };
  }

  const api = {
    isSensitivePreRunField,
    capturePreRunControlsInDoc,
    captureInitialPreRunReset
  };

  globalScope.WebMaticDefaultsCapture = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
