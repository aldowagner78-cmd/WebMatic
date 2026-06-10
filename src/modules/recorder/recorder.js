(function initRecorder(globalScope) {
  class Recorder {
    constructor() {
      this.isRecording = false;
    }

    start() {
      this.isRecording = true;
    }

    stop() {
      this.isRecording = false;
    }

    /**
     * Escapes a value to be safely embedded in a [attr="..."] CSS-like selector.
     * Backslashes first, then double quotes.
     */
    static escapeAttr(value) {
      return String(value == null ? "" : value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }

    /**
     * Builds a CSS selector for an element using priority:
     * id → name → aria-label → placeholder → data-testid →
     * a[href] (for link/image-in-link) → gxrow action → text → tag+position
     */
    static buildSelector(element) {
      if (!element || !(element instanceof Element)) return "";
      const E = Recorder.escapeAttr;

      // If element is <img> or <input type=image> inside an <a>, target the <a>
      const tag0 = element.tagName.toLowerCase();
      if ((tag0 === "img" || (tag0 === "input" && element.type === "image" && !element.id)) ) {
        const anchor = element.closest("a[href]");
        if (anchor) {
          element = anchor;
        }
      }

      const tag = element.tagName.toLowerCase();

      if (element.id) {
        return "#" + element.id;
      }

      if (element.getAttribute("name")) {
        const nameAttr = element.getAttribute("name");
        const sameName = Array.from((element.ownerDocument || document).getElementsByTagName(tag))
          .filter((el) => el.getAttribute("name") === nameAttr).length;
        if (sameName === 1) {
          return `${tag}[name="${E(nameAttr)}"]`;
        }
        // Duplicate names are common in paged grids/modals; anchor the selector to a parent id.
        const anc = element.closest("[id]");
        if (anc && anc.id && !/^(wm-|webmatic-)/.test(anc.id)) {
          return `#${anc.id} ${tag}[name="${E(nameAttr)}"]`;
        }
      }

      // <a href> — use relative path as stable selector
      if (tag === "a" && element.getAttribute("href")) {
        const href = element.getAttribute("href");
        // Prefer short/stable hrefs (relative paths without long hash tokens)
        if (href.length <= 80 && !href.startsWith("javascript")) {
          return `a[href="${E(href)}"]`;
        }
      }

      if (element.getAttribute("aria-label")) {
        return `[aria-label="${E(element.getAttribute("aria-label"))}"]`;
      }

      if (element.getAttribute("placeholder")) {
        return `${tag}[placeholder="${E(element.getAttribute("placeholder"))}"]`;
      }

      if (element.dataset && element.dataset.testid) {
        return `[data-testid="${E(element.dataset.testid)}"]`;
      }

      // GeneXus grid row action: element is inside a [gxrow] row
      const gxRow = element.closest && element.closest("[gxrow]");
      if (gxRow) {
        const rowNum = gxRow.getAttribute("gxrow");
        if (element.title) return `[gxrow="${E(rowNum)}"] [title="${E(element.title)}"]`;
      }

      // title attribute (stable in legacy/enterprise apps)
      const titleAttr = element.getAttribute("title");
      if (titleAttr && titleAttr.length <= 80) {
        return `[title="${E(titleAttr)}"]`;
      }

      // Stable data-* attribute (skip auto-generated/dynamic ones)
      const stableData = Array.from(element.attributes).find((a) => {
        if (!a.name.startsWith("data-")) return false;
        if (/data-(v-|reactid|ng-|index$|key$|_)/.test(a.name)) return false;
        if (a.value.length > 80 || a.value === "") return false;
        return true;
      });
      if (stableData) return `[${stableData.name}="${E(stableData.value)}"]`;

      const text = (element.textContent || "").replace(/\s+/g, " ").trim();
      if (text && text.length <= 60) {
        return `${tag}[text="${E(text)}"]`;
      }

      // Anchor selector: nearest ancestor with a stable id + relative path
      let anc = element.parentElement;
      let ancDepth = 0;
      while (anc && ancDepth < 5) {
        if (anc.id && !/^(wm-|webmatic-)/.test(anc.id)) {
          const ancChildren = Array.from(anc.children || []);
          const ancSame = ancChildren.filter((s) => s.tagName === element.tagName);
          if (ancSame.length > 1) {
            return `#${anc.id} ${tag}:nth-of-type(${ancSame.indexOf(element) + 1})`;
          }
          return `#${anc.id} ${tag}`;
        }
        anc = anc.parentElement;
        ancDepth++;
      }

      // Final fallback: stable classes + nth-of-type
      const stableClasses = Array.from(element.classList || [])
        .filter((c) => c.length <= 40 && !/^(js-|ng-|v-|__\w|\d)/.test(c))
        .slice(0, 2).join(".");
      const siblings = Array.from(element.parentElement?.children || []);
      const sameTag = siblings.filter((s) => s.tagName === element.tagName);
      const idx = sameTag.indexOf(element);
      const nth = sameTag.length > 1 ? `:nth-of-type(${idx + 1})` : "";
      return stableClasses ? `${tag}.${stableClasses}${nth}` : `${tag}${nth}`;
    }

    /**
     * Merges consecutive text characters on the same element into one step.
     * Returns a new steps array with merged text runs.
     */
    static mergeKeySteps(steps) {
      const merged = [];
      for (const step of steps) {
        const prev = merged[merged.length - 1];
        if (
          step.type === "text" &&
          prev &&
          prev.type === "text" &&
          prev.selector === step.selector
        ) {
          prev.value = (prev.value || "") + (step.value || "");
        } else {
          merged.push({ ...step });
        }
      }
      return merged;
    }

    static _PRE_RUN_RESET_SENSITIVE_RE = /(pass|password|passwd|pwd|token|secret|cvv|cvc|card|tarjeta|otp|pin|seguridad|security)/i;

    static isSensitivePreRunField(el) {
      if (!(el instanceof Element)) return false;
      const type = String(el.getAttribute("type") || "").toLowerCase();
      const id = String(el.id || "");
      const name = String(el.getAttribute("name") || "");
      const ariaLabel = String(el.getAttribute("aria-label") || "");
      return type === "password" ||
        Recorder._PRE_RUN_RESET_SENSITIVE_RE.test(id) ||
        Recorder._PRE_RUN_RESET_SENSITIVE_RE.test(name) ||
        Recorder._PRE_RUN_RESET_SENSITIVE_RE.test(ariaLabel);
    }

    static capturePreRunControlsInDoc(doc, out, seen, buildSelector) {
      if (!doc) return;
      const select = typeof buildSelector === "function" ? buildSelector : Recorder.buildSelector;
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

          const selector = select(el);
          if (!selector || seen.has(selector)) return;
          seen.add(selector);

          const ctrl = {
            selector,
            tag,
            type,
            id: String(el.id || ""),
            name: String(el.getAttribute("name") || "")
          };

          if (Recorder.isSensitivePreRunField(el)) {
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
            Recorder.capturePreRunControlsInDoc(fr.contentDocument || (fr.contentWindow && fr.contentWindow.document), out, seen, select);
          } catch (_e) { /* cross-origin */ }
        });
      } catch (_e) { /* ignore */ }
    }

    static captureInitialPreRunReset(doc, locationHref, title, buildSelector) {
      const controls = [];
      Recorder.capturePreRunControlsInDoc(doc, controls, new Set(), buildSelector);
      if (controls.length === 0) return null;
      return {
        version: 1,
        capturedAt: Date.now(),
        url: String(locationHref || ""),
        title: String(title || ""),
        controls
      };
    }
  }

  globalScope.WebMaticRecorder = Recorder;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Recorder;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
