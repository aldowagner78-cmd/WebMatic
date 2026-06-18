(function initBaselineRestorer(globalScope) {
  function restoreFormFromBaseline(preRunReset, context, deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    const findElement = options.findElement;
    const collectCurrentFormControls = options.collectCurrentFormControls;
    const setCheckedNative = options.setCheckedNative;
    const setElementValueLikeUser = options.setElementValueLikeUser;

    const controls = Array.isArray(preRunReset && preRunReset.controls) ? preRunReset.controls : [];
    const summary = { restored: 0, skipped: 0, mismatch: 0 };

    try {
      console.info("[WebMatic][preRunReset:start]", {
        controls: controls.length,
        url: String((preRunReset && preRunReset.url) || ""),
        reason: String((context && context.reason) || "")
      });
    } catch (_e) { /* ignore */ }

    try {
      console.info("[WebMatic][preRunReset:baselineLoaded]", {
        controls: controls.length,
        capturedAt: Number((preRunReset && preRunReset.capturedAt) || 0) || null
      });
    } catch (_e) { /* ignore */ }

    try {
      if (typeof collectCurrentFormControls === "function" && doc) {
        const current = [];
        collectCurrentFormControls(doc, current);
        console.info("[WebMatic][preRunReset:currentScanned]", { controls: current.length });
      }
    } catch (_e) { /* ignore */ }

    controls.forEach((ctrl, idx) => {
      const selector = String((ctrl && ctrl.selector) || "").trim();

      if (!selector) {
        summary.skipped += 1;
        try { console.info("[WebMatic][preRunReset:controlSkipped]", { index: idx, reason: "missing_selector" }); } catch (_e) { /* ignore */ }
        return;
      }

      const el = typeof findElement === "function" ? findElement(selector) : null;

      if (!el) {
        summary.mismatch += 1;
        try { console.info("[WebMatic][preRunReset:controlMismatch]", { index: idx, selector, reason: "not_found" }); } catch (_e) { /* ignore */ }
        return;
      }

      const tag = String(el.tagName || "").toLowerCase();
      const type = String(el.type || "").toLowerCase();
      const expectedTag = String((ctrl && ctrl.tag) || "").toLowerCase();

      if (expectedTag && expectedTag !== tag) {
        summary.mismatch += 1;
        try {
          console.info("[WebMatic][preRunReset:controlMismatch]", {
            index: idx,
            selector,
            reason: "tag_mismatch",
            expectedTag,
            actualTag: tag
          });
        } catch (_e) { /* ignore */ }
        return;
      }

      try {
        if (tag === "select") {
          const rawValue = String((ctrl && ctrl.value) != null ? ctrl.value : "");
          const hasRecordedValue = Object.prototype.hasOwnProperty.call(ctrl || {}, "value");
          const hasRecordedIndex = Number.isFinite(Number(ctrl && ctrl.selectedIndex));
          const beforeValue = String(el.value == null ? "" : el.value);
          const beforeIndex = Number(el.selectedIndex);

          if (hasRecordedValue) {
            const proto = el.constructor && el.constructor.prototype ? el.constructor.prototype : HTMLSelectElement.prototype;
            const desc = Object.getOwnPropertyDescriptor(proto, "value");
            if (desc && typeof desc.set === "function") desc.set.call(el, rawValue);
            else el.value = rawValue;
          }

          if (String(el.value == null ? "" : el.value) !== rawValue && hasRecordedIndex) {
            el.selectedIndex = Number(ctrl.selectedIndex);
          }

          const afterValue = String(el.value == null ? "" : el.value);
          const afterIndex = Number(el.selectedIndex);
          const changed = beforeValue !== afterValue || beforeIndex !== afterIndex;

          if (changed) {
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            summary.restored += 1;
            try { console.info("[WebMatic][preRunReset:controlRestored]", { index: idx, selector, type: "select" }); } catch (_e) { /* ignore */ }
          } else {
            summary.skipped += 1;
            try { console.info("[WebMatic][preRunReset:controlSkipped]", { index: idx, selector, reason: "already_equal" }); } catch (_e) { /* ignore */ }
          }

          return;
        }

        if (type === "checkbox" || type === "radio") {
          const desired = Boolean(ctrl && ctrl.checked);

          if (Boolean(el.checked) === desired) {
            summary.skipped += 1;
            try { console.info("[WebMatic][preRunReset:controlSkipped]", { index: idx, selector, reason: "already_equal" }); } catch (_e) { /* ignore */ }
            return;
          }

          if (typeof setCheckedNative === "function") {
            setCheckedNative(el, desired);
          } else {
            el.checked = desired;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }

          summary.restored += 1;
          try { console.info("[WebMatic][preRunReset:controlRestored]", { index: idx, selector, type }); } catch (_e) { /* ignore */ }
          return;
        }

        const desiredValue = String((ctrl && ctrl.value) != null ? ctrl.value : "");

        if (el && el.isContentEditable) {
          const currentText = String(el.innerText != null ? el.innerText : (el.textContent || ""));

          if (currentText === desiredValue) {
            summary.skipped += 1;
            try { console.info("[WebMatic][preRunReset:controlSkipped]", { index: idx, selector, reason: "already_equal" }); } catch (_e) { /* ignore */ }
            return;
          }

          el.innerText = desiredValue;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          summary.restored += 1;
          try { console.info("[WebMatic][preRunReset:controlRestored]", { index: idx, selector, type: "contenteditable" }); } catch (_e) { /* ignore */ }
          return;
        }

        if (String(el.value == null ? "" : el.value) === desiredValue) {
          summary.skipped += 1;
          try { console.info("[WebMatic][preRunReset:controlSkipped]", { index: idx, selector, reason: "already_equal" }); } catch (_e) { /* ignore */ }
          return;
        }

        if (typeof setElementValueLikeUser === "function") {
          setElementValueLikeUser(el, desiredValue);
        } else {
          el.value = desiredValue;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }

        summary.restored += 1;
        try { console.info("[WebMatic][preRunReset:controlRestored]", { index: idx, selector, type: tag || type || "field" }); } catch (_e) { /* ignore */ }
      } catch (_e) {
        summary.mismatch += 1;
        try { console.info("[WebMatic][preRunReset:controlMismatch]", { index: idx, selector, reason: "apply_failed" }); } catch (_x) { /* ignore */ }
      }
    });

    try {
      console.info("[WebMatic][preRunReset:done]", summary);
    } catch (_e) { /* ignore */ }

    return summary;
  }

  const api = {
    restoreFormFromBaseline
  };

  globalScope.WebMaticBaselineRestorer = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);