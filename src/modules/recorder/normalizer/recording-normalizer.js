(function initRecordingNormalizer(globalScope) {
  const MAX_RECORDED_IDLE_WAIT_SECONDS = 1;

  function mergeKeySteps(steps) {
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

  function normalizeRecordedSteps(steps) {
    const list = Array.isArray(steps) ? steps : [];
    const isInputLike = (s) => !!(s && (s.type === "input" || s.type === "text") && s.selector);
    const isWait = (s) => !!(s && s.type === "wait");
    const isAutoWait = (s) => !!(s && s.type === "wait" && s._autoWait === true);
    const isBaselineOrAuto = (s) => !!(s && (s._baselineDefault || s._fast));
    const stepValue = (s) => String(s && s.value == null ? "" : s.value);
    const sameInputSnapshot = (a, b) => !!(
      isInputLike(a) &&
      isInputLike(b) &&
      !isBaselineOrAuto(a) &&
      !isBaselineOrAuto(b) &&
      a.selector === b.selector &&
      stepValue(a) === stepValue(b)
    );

    const normalizeTextForCompare = (value) => String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    const isShortAutoWait = (s) => {
      if (!isAutoWait(s)) return false;
      const seconds = Number(s.seconds);
      return !Number.isFinite(seconds) || seconds <= MAX_RECORDED_IDLE_WAIT_SECONDS;
    };

    const controlRefText = (step, key) => String(step && step.controlRef && step.controlRef[key] || "").toLowerCase();
    const hasChoiceLikeControlRef = (step) => {
      const kind = controlRefText(step, "controlKind");
      const tag = controlRefText(step, "tag");
      const type = controlRefText(step, "type");
      const role = controlRefText(step, "role");
      const ariaAutocomplete = controlRefText(step, "ariaAutocomplete") || controlRefText(step, "aria-autocomplete");
      const inputMode = controlRefText(step, "inputMode");
      const blockedKinds = [
        "native-select",
        "select",
        "checkbox",
        "radio",
        "option",
        "choose-option",
        "choose_option",
        "combobox",
        "listbox",
        "autocomplete",
        "autocomplete-input",
        "datalist"
      ];
      if (blockedKinds.includes(kind)) return true;
      if (tag === "select") return true;
      if (type === "checkbox" || type === "radio") return true;
      if (role === "combobox" || role === "listbox" || role === "option") return true;
      if (ariaAutocomplete || inputMode === "autocomplete") return true;
      return false;
    };

    const isTextEditableInputStep = (step) => {
      if (!isInputLike(step) || isBaselineOrAuto(step) || hasChoiceLikeControlRef(step)) return false;
      const ref = step.controlRef || null;
      if (!ref) return true;
      const kind = controlRefText(step, "controlKind");
      const tag = controlRefText(step, "tag");
      const type = controlRefText(step, "type");
      const contentEditable = controlRefText(step, "contentEditable");
      const allowedInputTypes = new Set(["", "text", "search", "email", "tel", "url", "number", "password"]);
      if (kind && kind !== "text-input" && kind !== "textarea" && kind !== "contenteditable") return false;
      if (tag === "textarea") return true;
      if (contentEditable === "true" || contentEditable === "plaintext-only") return true;
      if (!tag || tag === "input") return allowedInputTypes.has(type);
      return false;
    };

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

      const fromIsSubsequenceOfTo = (() => {
        let j = 0;
        for (let i = 0; i < to.length && j < from.length; i += 1) {
          if (to[i] === from[j]) j += 1;
        }
        return j === from.length;
      })();
      if (from.length >= 3 && to.length > from.length && from[0] === to[0] && fromIsSubsequenceOfTo) {
        return true;
      }

      const shortest = Math.min(from.length, to.length);
      const longest = Math.max(from.length, to.length);
      const prefix = commonPrefixLength(from, to);

      // Correcciones de tipeo dentro de una misma frase/campo, por ejemplo:
      // "DIAGNOSTICO EJ 12 FIM" -> "DIAGNOSTICO EJ 12 FINAL".
      if (shortest >= 8 && prefix >= Math.max(5, Math.floor(shortest * 0.65))) return true;

      // Ediciones pequenas sobre textos parecidos. Evita compactar cambios reales
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

    const findNextNonWait = (arr, fromIndex) => {
      for (let i = fromIndex; i < arr.length; i += 1) {
        if (!isWait(arr[i])) return arr[i];
      }
      return null;
    };

    const shouldPreservePostClickAutoWait = (waitStep, prevNonWait, nextNonWait) => {
      if (!isAutoWait(waitStep) || !prevNonWait || prevNonWait.type !== "click") return false;
      const seconds = Number(waitStep.seconds);
      if (!Number.isFinite(seconds) || seconds <= MAX_RECORDED_IDLE_WAIT_SECONDS) return false;
      return !nextNonWait || nextNonWait.type === "wait_for";
    };

    const compactConsecutiveWaits = (arr) => {
      const out = [];
      let prevNonWait = null;
      for (let idx = 0; idx < arr.length; idx += 1) {
        const step = arr[idx];
        const nextNonWait = findNextNonWait(arr, idx + 1);
        if (isWait(step) && out.length > 0 && isWait(out[out.length - 1]) && isAutoWait(step) === isAutoWait(out[out.length - 1])) {
          const prev = out[out.length - 1];
          const a = Number(prev.seconds);
          const b = Number(step.seconds);
          prev.seconds = Math.max(0, (Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0));
          if (
            isAutoWait(prev) &&
            prev.seconds > MAX_RECORDED_IDLE_WAIT_SECONDS &&
            !shouldPreservePostClickAutoWait(prev, prevNonWait, nextNonWait)
          ) {
            prev.seconds = MAX_RECORDED_IDLE_WAIT_SECONDS;
          }
          continue;
        }
        if (isAutoWait(step)) {
          const seconds = Number(step.seconds);
          const normalizedSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : MAX_RECORDED_IDLE_WAIT_SECONDS;
          const preserveLongWait = shouldPreservePostClickAutoWait(
            { ...step, seconds: normalizedSeconds },
            prevNonWait,
            nextNonWait
          );
          out.push({
            ...step,
            seconds: preserveLongWait ? normalizedSeconds : Math.min(MAX_RECORDED_IDLE_WAIT_SECONDS, normalizedSeconds)
          });
          continue;
        }
        out.push(step);
        prevNonWait = step;
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
          const beforeKeyIdx = findPrevNonWaitIndex(compacted, prevIdx - 1);
          const beforeKey = beforeKeyIdx >= 0 ? compacted[beforeKeyIdx] : null;
          if (sameInputSnapshot(beforeKey, step)) {
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
      if (inputSteps.some((s) => isBaselineOrAuto(s))) return false;
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
            let allShortAutoWaits = true;
            for (let w = j; w < k; w += 1) {
              const waitStep = withoutDuplicateWaits[w];
              const seconds = Number(waitStep && waitStep.seconds);
              if (!isShortAutoWait(waitStep) || (Number.isFinite(seconds) && seconds > MAX_RECORDED_IDLE_WAIT_SECONDS)) {
                allShortAutoWaits = false;
                break;
              }
            }
            if (!allShortAutoWaits) break;
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

      const nextAfterRun = withoutDuplicateWaits[j];
      if (nextAfterRun && nextAfterRun.type === "choose_option") {
        out.push(...runItems);
        i = j - 1;
        continue;
      }

      if (runInputs.every(isTextEditableInputStep) && shouldCompactInputRun(runInputs)) {
        out.push(runInputs[runInputs.length - 1]);
        i = j - 1;
        continue;
      }

      out.push(...runItems);
      i = j - 1;
    }

    const compactTextInputsConfirmedByEnter = (arr) => {
      const result = [];
      for (const step of arr) {
        const keyName = String(step && step.key || "").toLowerCase();
        if (!(step && step.type === "key" && keyName === "enter" && step.selector)) {
          result.push(step);
          continue;
        }

        const selector = step.selector;
        let j = result.length - 1;
        while (j >= 0) {
          const prev = result[j];
          if (isShortAutoWait(prev)) {
            j -= 1;
            continue;
          }
          if (isTextEditableInputStep(prev) && prev.selector === selector) {
            j -= 1;
            continue;
          }
          break;
        }

        const start = j + 1;
        const segment = result.slice(start);
        const inputs = segment.filter((item) => isInputLike(item));
        if (
          inputs.length >= 2 &&
          inputs.every((item) => item.selector === selector && isTextEditableInputStep(item))
        ) {
          let lastInputSegmentIndex = -1;
          for (let k = segment.length - 1; k >= 0; k -= 1) {
            if (isInputLike(segment[k])) {
              lastInputSegmentIndex = k;
              break;
            }
          }
          const tailWaits = segment.slice(lastInputSegmentIndex + 1).filter(isShortAutoWait);
          result.splice(start, result.length - start, inputs[inputs.length - 1], ...tailWaits);
        }

        result.push(step);
      }
      return result;
    };

    // ── Pasada: inferir selector de Enter cuando falta pero viene de campo editable ──
    // Si un key Enter no tiene selector, pero el paso real previo (ignorando auto-waits
    // cortos) es un input sobre un campo editable (no choice-like), heredar su selector.
    // Esto cubre el caso del sub-frame que no grabó selector (comportamiento legacy).
    const inferMissingEnterSelector = (arr) => {
      return arr.map((step, idx) => {
        if (!(step && step.type === "key" && String(step.key || "").toLowerCase() === "enter" && !step.selector)) {
          return step;
        }
        for (let j = idx - 1; j >= 0; j -= 1) {
          const prev = arr[j];
          if (isShortAutoWait(prev) || isAutoWait(prev)) continue;
          if (isTextEditableInputStep(prev) && prev.selector) {
            const inferredRef = prev.controlRef
              ? Object.assign({}, prev.controlRef)
              : { selector: prev.selector, tag: "input" };
            return Object.assign({}, step, { selector: prev.selector, controlRef: inferredRef });
          }
          break; // cualquier otro paso real detiene la inferencia
        }
        return step;
      });
    };

    // ── Pasada: compactar click nativo + choose_option + click option ────────
    // Para selects nativos, el recorder produce: click SELECT → choose_option SELECT → click OPTION
    // Se compacta a solo choose_option. No se toca si hay controlRef de combobox/listbox/custom.
    const isCustomWidgetChoose = (step) => {
      const ref = step && step.controlRef;
      if (!ref) return false;
      const kind = String(ref.controlKind || "").toLowerCase();
      const role = String(ref.role || "").toLowerCase();
      const ariaAuto = String(ref.ariaAutocomplete || ref["aria-autocomplete"] || "").toLowerCase();
      const inpMode = String(ref.inputMode || "").toLowerCase();
      const customKinds = ["combobox", "listbox", "autocomplete", "autocomplete-input"];
      if (customKinds.some((k) => kind.includes(k))) return true;
      if (role === "combobox" || role === "listbox" || role === "option") return true;
      if (ariaAuto) return true;
      if (inpMode === "autocomplete") return true;
      return false;
    };

    const isOptionChildSelector = (parentSel, childSel) => {
      if (!parentSel || !childSel) return false;
      const escaped = String(parentSel).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      return new RegExp("^" + escaped + "\\s*>?\\s*option\\b").test(String(childSel));
    };

    const compactNativeSelectClicks = (arr) => {
      const remove = new Set();
      for (let i = 0; i < arr.length; i += 1) {
        const step = arr[i];
        if (!step || step.type !== "choose_option") continue;
        if (isCustomWidgetChoose(step)) continue;
        const sel = step.selector;
        if (!sel) continue;

        // Buscar el paso real inmediatamente previo (ignorando auto-waits)
        let prevIdx = -1;
        for (let j = i - 1; j >= 0; j -= 1) {
          if (isAutoWait(arr[j])) continue;
          prevIdx = j;
          break;
        }
        const prevStep = prevIdx >= 0 ? arr[prevIdx] : null;
        if (!prevStep || prevStep.type !== "click" || prevStep.selector !== sel) continue;

        // Paso previo es click sobre el mismo selector → marcar para eliminar
        remove.add(prevIdx);

        // Buscar si el paso siguiente (ignorando auto-waits) es click sobre option hijo
        let nextIdx = -1;
        for (let j = i + 1; j < arr.length; j += 1) {
          if (isAutoWait(arr[j])) continue;
          nextIdx = j;
          break;
        }
        const nextStep = nextIdx >= 0 ? arr[nextIdx] : null;
        if (nextStep && nextStep.type === "click" && isOptionChildSelector(sel, nextStep.selector)) {
          remove.add(nextIdx);
        }
      }
      if (remove.size === 0) return arr;
      return arr.filter((_, idx) => !remove.has(idx));
    };

    const insertWaitForBeforeChooseOption = (arr) => {
      const result = [];
      for (const step of arr) {
        const prev = result[result.length - 1];
        if (
          step &&
          step.type === "choose_option" &&
          step.selector &&
          !(prev && (prev.type === "wait_for" || prev.type === "wait"))
        ) {
          result.push({ type: "wait_for", selector: step.selector, timeout: 10000, _autoWait: true });
        }
        result.push(step);
      }
      return result;
    };

    const preferWaitForAfterDynamicClick = (arr) => {
      const result = [];
      for (let i = 0; i < arr.length; i += 1) {
        const step = arr[i];
        if (isAutoWait(step)) {
          let prevReal = null;
          for (let j = result.length - 1; j >= 0; j -= 1) {
            if (!isWait(result[j])) {
              prevReal = result[j];
              break;
            }
          }
          const nextReal = findNextNonWait(arr, i + 1);
          if (prevReal && prevReal.type === "click" && nextReal && nextReal.type === "wait_for") {
            continue;
          }
        }
        result.push(step);
      }
      return result;
    };

    return compactConsecutiveWaits(
      preferWaitForAfterDynamicClick(
        compactTextInputsConfirmedByEnter(
          insertWaitForBeforeChooseOption(
            compactNativeSelectClicks(inferMissingEnterSelector(out))
          )
        )
      )
    );
  }

  function dedupeFieldRuns(steps) {
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
              withRealWaits.push({ type: "wait", seconds: Math.ceil(deltaMs / 1000), _autoWait: true });
            }
          }
        }
      }

      withRealWaits.push(step);
      lastRealStep = step;
      hasExplicitWaitAfterLastClick = false;
    }

    return normalizeRecordedSteps(withRealWaits);
  }

  const api = {
    mergeKeySteps,
    normalizeRecordedSteps,
    dedupeFieldRuns
  };

  globalScope.WebMaticRecordingNormalizer = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
