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

    static _selectorBuilder() {
      if (typeof WebMaticSelectorBuilder !== "undefined") return WebMaticSelectorBuilder;
      if (globalScope && globalScope.WebMaticSelectorBuilder) return globalScope.WebMaticSelectorBuilder;
      if (typeof require === "function") {
        try { return require("../../common/selectors/selector-builder.js"); } catch (_e) { /* ignore */ }
      }
      throw new Error("WebMaticSelectorBuilder no está disponible");
    }

    static escapeAttr(value) {
      return Recorder._selectorBuilder().escapeAttr(value);
    }

    static escapeCssIdent(value) {
      return Recorder._selectorBuilder().escapeCssIdent(value);
    }

    static _normalizeText(value) {
      return Recorder._selectorBuilder().normalizeText(value);
    }

    static _resolveSelectorInDoc(doc, selector) {
      return Recorder._selectorBuilder().resolveSelectorInDoc(doc, selector);
    }

    static selectorResolvesToElement(doc, selector, element, opts) {
      return Recorder._selectorBuilder().selectorResolvesToElement(doc, selector, element, opts);
    }

    static isLikelyDynamicValue(value) {
      return Recorder._selectorBuilder().isLikelyDynamicValue(value);
    }

    static buildSelector(element) {
      return Recorder._selectorBuilder().buildSelector(element);
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

    /**
     * Deduplica solo rafagas locales de cambios sobre el mismo selector,
     * preservando ediciones del mismo campo en momentos distintos del flujo.
     */
    /**
     * Limpieza posgrabacion conservadora.
     * Elimina solo snapshots redundantes del mismo campo con el mismo valor,
     * preservando cambios reales como TYPE "ana" -> WAIT -> TYPE "".
     */
    static normalizeRecordedSteps(steps) {
      const list = Array.isArray(steps) ? steps : [];
      const isInputLike = (s) => !!(s && (s.type === "input" || s.type === "text") && s.selector);
      const isWait = (s) => !!(s && s.type === "wait");
      const stepValue = (s) => String(s && s.value == null ? "" : s.value);
      const sameInputSnapshot = (a, b) => !!(
        isInputLike(a) &&
        isInputLike(b) &&
        a.selector === b.selector &&
        stepValue(a) === stepValue(b)
      );

      const normalizeTextForCompare = (value) => String(value == null ? "" : value)
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const commonPrefixLength = (a, b) => {
        const x = normalizeTextForCompare(a);
        const y = normalizeTextForCompare(b);
        const max = Math.min(x.length, y.length);
        let n = 0;
        while (n < max && x[n] === y[n]) n += 1;
        return n;
      };

      const levenshteinDistance = (a, b) => {
        const x = normalizeTextForCompare(a);
        const y = normalizeTextForCompare(b);
        if (x === y) return 0;
        if (!x) return y.length;
        if (!y) return x.length;
        const prev = Array(y.length + 1);
        const cur = Array(y.length + 1);
        for (let j = 0; j <= y.length; j += 1) prev[j] = j;
        for (let i = 1; i <= x.length; i += 1) {
          cur[0] = i;
          for (let j = 1; j <= y.length; j += 1) {
            const cost = x[i - 1] === y[j - 1] ? 0 : 1;
            cur[j] = Math.min(
              prev[j] + 1,
              cur[j - 1] + 1,
              prev[j - 1] + cost
            );
          }
          for (let j = 0; j <= y.length; j += 1) prev[j] = cur[j];
        }
        return prev[y.length];
      };

      const valuesLookLikeSameTypingRun = (fromValue, toValue) => {
        const from = normalizeTextForCompare(fromValue);
        const to = normalizeTextForCompare(toValue);
        if (!from || !to) return false;
        if (from === to) return true;
        if (to.startsWith(from) || from.startsWith(to)) return true;

        const shortest = Math.min(from.length, to.length);
        const longest = Math.max(from.length, to.length);
        const prefix = commonPrefixLength(from, to);

        // Correcciones de tipeo dentro de una misma frase/campo, por ejemplo:
        // "DIAGNOSTICO EJ 12 FIM" -> "DIAGNOSTICO EJ 12 FINAL".
        if (shortest >= 8 && prefix >= Math.max(5, Math.floor(shortest * 0.65))) return true;

        // Ediciones pequeÃ±as sobre textos parecidos. Evita compactar cambios reales
        // no relacionados como "uno" -> "dos" o "foo" -> "bar".
        const distance = levenshteinDistance(from, to);
        const maxDistance = Math.max(2, Math.ceil(longest * 0.25));
        return shortest >= 6 && distance <= maxDistance;
      };

      const findPrevNonWaitIndex = (arr, fromIndex) => {
        for (let i = fromIndex; i >= 0; i -= 1) {
          if (!isWait(arr[i])) return i;
        }
        return -1;
      };

      const compactConsecutiveWaits = (arr) => {
        const out = [];
        for (const step of arr) {
          if (isWait(step) && out.length > 0 && isWait(out[out.length - 1])) {
            const prev = out[out.length - 1];
            const a = Number(prev.seconds);
            const b = Number(step.seconds);
            prev.seconds = Math.max(0, (Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0));
            continue;
          }
          out.push(step);
        }
        return out;
      };

      const compacted = [];
      for (const step of list) {
        if (isInputLike(step)) {
          const prevIdx = findPrevNonWaitIndex(compacted, compacted.length - 1);
          const prev = prevIdx >= 0 ? compacted[prevIdx] : null;

          // Caso seguro: TYPE mismo selector + mismo valor, aunque haya WAIT entre ambos.
          if (sameInputSnapshot(prev, step)) {
            continue;
          }

          // Caso seguro: TYPE X -> KEY Enter -> TYPE X inmediato.
          // Ese TYPE posterior suele ser un flush tardio del mismo valor.
          if (prev && prev.type === "key" && String(prev.key || "").toLowerCase() === "enter") {
            const hasWaitAfterEnter = compacted.slice(prevIdx + 1).some((s) => isWait(s));
            const beforeKeyIdx = findPrevNonWaitIndex(compacted, prevIdx - 1);
            const beforeKey = beforeKeyIdx >= 0 ? compacted[beforeKeyIdx] : null;
            if (!hasWaitAfterEnter && sameInputSnapshot(beforeKey, step)) {
              continue;
            }
          }
        }
        compacted.push(step);
      }

      const withoutDuplicateWaits = compactConsecutiveWaits(compacted);
      const out = [];

      const shouldCompactInputRun = (inputSteps) => {
        if (!Array.isArray(inputSteps) || inputSteps.length < 2) return false;
        const values = inputSteps.map((s) => stepValue(s));
        const finalValue = values[values.length - 1];

        // El borrado final es una accion real: conservar, por ejemplo:
        // TYPE "ana" -> WAIT -> TYPE "".
        if (finalValue === "") return false;

        const nonEmptyValues = values.filter((v) => normalizeTextForCompare(v) !== "");
        if (nonEmptyValues.length < 2) return false;

        // No compactar cambios reales no relacionados, por ejemplo:
        // "uno" -> WAIT -> "dos".
        for (let i = 1; i < nonEmptyValues.length; i += 1) {
          if (!valuesLookLikeSameTypingRun(nonEmptyValues[i - 1], nonEmptyValues[i])) {
            return false;
          }
        }

        // Compacta escritura progresiva y correcciones dentro del mismo campo:
        // "DIA" -> "DIAGNOSTICO" -> "DIAGNOSTICO EJ 12 FINAL".
        // Tambien compacta limpiar y reescribir si el valor final pertenece al mismo texto:
        // "TES" -> "" -> "test enter".
        return true;
      };

      for (let i = 0; i < withoutDuplicateWaits.length; i += 1) {
        const step = withoutDuplicateWaits[i];
        if (!isInputLike(step)) {
          out.push(step);
          continue;
        }

        const selector = step.selector;
        const runItems = [step];
        const runInputs = [step];
        let j = i + 1;
        while (j < withoutDuplicateWaits.length) {
          const nx = withoutDuplicateWaits[j];
          if (isWait(nx)) {
            let k = j;
            while (k < withoutDuplicateWaits.length && isWait(withoutDuplicateWaits[k])) k += 1;
            const nextReal = withoutDuplicateWaits[k];
            // Solo absorber WAIT si despues viene otro snapshot del mismo campo.
            // Si el WAIT separa el ultimo TYPE de otra accion/campo, se conserva fuera del run.
            if (isInputLike(nextReal) && nextReal.selector === selector) {
              while (j < k) {
                runItems.push(withoutDuplicateWaits[j]);
                j += 1;
              }
              continue;
            }
            break;
          }
          if (isInputLike(nx) && nx.selector === selector) {
            runItems.push(nx);
            runInputs.push(nx);
            j += 1;
            continue;
          }
          break;
        }

        if (shouldCompactInputRun(runInputs)) {
          out.push(runInputs[runInputs.length - 1]);
          i = j - 1;
          continue;
        }

        out.push(...runItems);
        i = j - 1;
      }

      return compactConsecutiveWaits(out);
    }

    static dedupeFieldRuns(steps) {
      const isFieldLike = (s) => !!(s && (s.type === "input" || s.type === "text" || s.type === "check") && s.selector);
      const out = [];
      const list = Array.isArray(steps) ? steps : [];

      for (let i = 0; i < list.length; i += 1) {
        const step = list[i];
        if (!isFieldLike(step)) {
          out.push(step);
          continue;
        }

        let dropCurrent = false;
        for (let j = i + 1; j < list.length; j += 1) {
          const nx = list[j];
          if (nx && nx.type === "wait") continue;
          if (isFieldLike(nx) && nx.selector === step.selector) {
            const prevTs = Number(step._ts);
            const nextTs = Number(nx._ts);
            const separatedByRealPause = Number.isFinite(prevTs) && Number.isFinite(nextTs) && Math.max(0, nextTs - prevTs) >= 1200;
            // Same-field edits separated by a real pause are meaningful states
            // (example: live-filter "ana" -> wait -> clear). Preserve both.
            dropCurrent = !separatedByRealPause;
          }
          break;
        }

        if (!dropCurrent) out.push(step);
      }

      const withRealWaits = [];
      let lastRealStep = null;
      let hasExplicitWaitAfterLastClick = false;
      const isBaselineOrAuto = (s) => !!(s && (s._baselineDefault || s._fast));
      const isExplicitWait = (s) => !!(s && (s.type === "wait" || s.type === "wait_for"));
      const isRealStep = (s) => !!(s && !isExplicitWait(s) && !isBaselineOrAuto(s));

      for (const step of out) {
        if (isExplicitWait(step)) {
          withRealWaits.push(step);
          if (lastRealStep && (lastRealStep.type === "click" || isFieldLike(lastRealStep))) {
            hasExplicitWaitAfterLastClick = true;
          }
          continue;
        }

        if (!isRealStep(step)) {
          withRealWaits.push(step);
          continue;
        }

        if (lastRealStep && !hasExplicitWaitAfterLastClick) {
          const shouldPreservePause =
            lastRealStep.type === "click" ||
            (isFieldLike(lastRealStep) && isFieldLike(step) && lastRealStep.selector === step.selector);

          if (shouldPreservePause) {
            const prevTs = Number(lastRealStep._ts);
            const curTs = Number(step._ts);
            if (Number.isFinite(prevTs) && Number.isFinite(curTs)) {
              const deltaMs = Math.max(0, curTs - prevTs);
              if (deltaMs >= 1200) {
                withRealWaits.push({ type: "wait", seconds: Math.min(10, Math.ceil(deltaMs / 1000)) });
              }
            }
          }
        }

        withRealWaits.push(step);
        lastRealStep = step;
        hasExplicitWaitAfterLastClick = false;
      }

      return Recorder.normalizeRecordedSteps(withRealWaits);
    }

    static _PRE_RUN_RESET_SENSITIVE_RE = /(pass|password|passwd|pwd|token|secret|cvv|cvc|card|tarjeta|otp|pin|seguridad|security|clave|contrasen|contrasenia|api[-_]?key|authorization|auth)/i;

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
