(function initIimAdapter(globalScope) {
  const SENSITIVE_RE = /(pass|password|passwd|pwd|token|secret|cvv|cvc|card|tarjeta|otp|pin|seguridad|security|clave|contrasen|contrasenia|api[-_]?key|authorization|auth)/i;

  // Quotes a value for iim format, escaping backslashes and double quotes
  function _quote(val) {
    return '"' + String(val || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }

  function _isSensitiveControl(ctrl) {
    if (!ctrl || typeof ctrl !== "object") return false;
    const id = String(ctrl.id || "");
    const name = String(ctrl.name || "");
    const type = String(ctrl.type || ctrl.inputType || "").toLowerCase();
    const label = String(ctrl.label || "");
    const role = String(ctrl.role || "");
    return type === "password" ||
      SENSITIVE_RE.test(id) ||
      SENSITIVE_RE.test(name) ||
      SENSITIVE_RE.test(label) ||
      SENSITIVE_RE.test(role);
  }

  function _isSensitiveStep(step) {
    if (!step || typeof step !== "object") return false;
    if (step.sensitive === true) return true;
    const t = String(step.type || "").toLowerCase();
    if (t !== "input" && t !== "text") return false;
    const selector = String(step.selector || "");
    const id = String(step.id || "");
    const name = String(step.name || "");
    const label = String(step.label || "");
    const inputType = String(step.inputType || step.typeAttr || "").toLowerCase();
    return inputType === "password" ||
      SENSITIVE_RE.test(selector) ||
      SENSITIVE_RE.test(id) ||
      SENSITIVE_RE.test(name) ||
      SENSITIVE_RE.test(label);
  }

  function _sanitizeStepForExport(step) {
    if (!step || typeof step !== "object") return step;
    const out = Object.assign({}, step);
    delete out._ts;

    if (_isSensitiveStep(out)) {
      out.sensitive = true;
      out.value = "";
    }

    if (Array.isArray(out.steps)) out.steps = out.steps.map(_sanitizeStepForExport);
    if (Array.isArray(out.then)) out.then = out.then.map(_sanitizeStepForExport);
    if (Array.isArray(out.else)) out.else = out.else.map(_sanitizeStepForExport);
    if (Array.isArray(out.fallback)) out.fallback = out.fallback.map(_sanitizeStepForExport);

    return out;
  }

  function _sanitizeMetaForExport(meta) {
    if (!meta || typeof meta !== "object") return null;
    const out = Object.assign({}, meta);
    if (Array.isArray(meta.pageInventories)) {
      out.pageInventories = meta.pageInventories.map((inv) => {
        const next = Object.assign({}, inv);
        if (Array.isArray(inv.controls)) {
          next.controls = inv.controls.map((ctrl) => {
            const c = Object.assign({}, ctrl);
            if (_isSensitiveControl(c)) {
              delete c.currentValue;
            }
            return c;
          });
        }
        return next;
      });
    }
    if (meta.preRunReset && typeof meta.preRunReset === "object") {
      const pr = Object.assign({}, meta.preRunReset);
      if (Array.isArray(meta.preRunReset.controls)) {
        pr.controls = meta.preRunReset.controls.map((ctrl) => {
          const c = Object.assign({}, ctrl);
          if (_isSensitiveControl(c)) {
            delete c.value;
          }
          return c;
        });
      }
      out.preRunReset = pr;
    }
    return out;
  }

  /**
   * Exports a macro to IIM text.
   *
   * Lossless round-trip strategy:
   *   A single "// WM_JSON:<json>" comment is inserted after the header.
   *   importFromIim detects it and uses it as the authoritative source,
   *   so ALL step types (including the 11 extended ones) survive any
   *   save / export / import cycle.
   *
   *   Below the JSON comment, human-readable IIM lines are emitted for
   *   the standard types (navigate, click, input, check, key, wait, extract)
   *   so the script editor stays readable. Extended types appear as
   *   "// TYPE ..." comments for visual reference.
   */
  function exportToIim(macro) {
    const steps = Array.isArray(macro?.steps) ? macro.steps.map(_sanitizeStepForExport) : [];
    const meta = _sanitizeMetaForExport(macro?.meta || null);
    const lines = ["VERSION BUILD=1000", "TAB T=1"];

    // Embed full steps JSON for lossless round-trip (importFromIim uses this first)
    if (steps.length > 0 || meta) {
      // Strip internal runtime-only keys before serialising
      const payload = { version: 2, steps };
      if (meta) payload.meta = meta;
      lines.push("// WM_JSON:" + JSON.stringify(payload));
    }

    steps.forEach((step) => {
      // ── Standard IIM instructions (human-readable) ──────────────────────
      if (step.type === "click") {
        lines.push(`CLICK SELECTOR=${_quote(step.selector)}`);
        return;
      }
      if (step.type === "input" || step.type === "text") {
        if (step.sensitive === true) {
          lines.push(`// SENSITIVE_INPUT SELECTOR=${_quote(step.selector)} CONTENT=${_quote("[REDACTED]")}`);
          return;
        }
        lines.push(`TYPE SELECTOR=${_quote(step.selector)} CONTENT=${_quote(step.value)}`);
        return;
      }
      if (step.type === "check") {
        lines.push(`CHECK SELECTOR=${_quote(step.selector)} CHECKED=${_quote(step.checked ? "true" : "false")}`);
        return;
      }
      if (step.type === "choose_option") {
        let line = `CHOOSE_OPTION SELECTOR=${_quote(step.selector)}`;
        if (step.value) line += ` VALUE=${_quote(step.value)}`;
        if (step.text) line += ` TEXT=${_quote(step.text)}`;
        if (step.variable) line += ` VAR=${_quote(step.variable)}`;
        lines.push(line);
        return;
      }
      if (step.type === "key") {
        lines.push(`KEY CODE=${_quote(step.key || "")}`);
        return;
      }
      if (step.type === "navigate") {
        lines.push(`NAVIGATE URL=${_quote(step.url || "")}`);
        return;
      }
      if (step.type === "browser_back") {
        lines.push("BACK");
        return;
      }
      if (step.type === "browser_forward") {
        lines.push("FORWARD");
        return;
      }
      if (step.type === "browser_history") {
        lines.push("HISTORY");
        return;
      }
      if (step.type === "browser_reload") {
        lines.push("RELOAD");
        return;
      }
      if (step.type === "open_bookmark") {
        lines.push(`OPEN_BOOKMARK URL=${_quote(step.url || "")}`);
        return;
      }
      if (step.type === "open_tab") {
        let line = "OPEN_TAB";
        if (step.url) line += ` URL=${_quote(step.url)}`;
        if (typeof step.activate !== "undefined") line += ` ACTIVATE=${_quote(String(step.activate))}`;
        lines.push(line);
        return;
      }
      if (step.type === "switch_tab") {
        let line = "SWITCH_TAB";
        if (step.url) line += ` URL=${_quote(step.url)}`;
        if (typeof step.openIfMissing !== "undefined") line += ` OPEN_IF_MISSING=${_quote(String(step.openIfMissing))}`;
        lines.push(line);
        return;
      }
      if (step.type === "close_tab") {
        let line = "CLOSE_TAB";
        if (step.target) line += ` TARGET=${_quote(String(step.target))}`;
        if (step.url) line += ` URL=${_quote(step.url)}`;
        lines.push(line);
        return;
      }
      if (step.type === "wait") {
        const secs = Number(step.seconds) || 1;
        lines.push(`WAIT SECONDS=${secs}`);
        return;
      }
      if (step.type === "extract") {
        lines.push(`EXTRACT SELECTOR=${_quote(step.selector)} VAR=${_quote(step.variable || "VAR1")}`);
        return;
      }
      if (step.type === "capture_defaults") {
        lines.push(step.exclude
          ? `CAPTURE_DEFAULTS EXCLUDE=${_quote(step.exclude)}`
          : "CAPTURE_DEFAULTS");
        return;
      }

      // ── Extended step types — informational comments only ────────────────
      // (WM_JSON is the authoritative source; these lines are for readability)
      if (step.type === "wait_for") {
        lines.push(`// WAIT_FOR SELECTOR=${_quote(step.selector)} TIMEOUT=${step.timeout || 10000}`);
      } else if (step.type === "dblclick") {
        lines.push(`// DBLCLICK SELECTOR=${_quote(step.selector)}`);
      } else if (step.type === "scroll_to") {
        lines.push(`// SCROLL_TO SELECTOR=${_quote(step.selector)}`);
      } else if (step.type === "hover") {
        lines.push(`// HOVER SELECTOR=${_quote(step.selector)}`);
      } else if (step.type === "set_variable") {
        lines.push(`// SET VAR=${_quote(step.variable || "")} VALUE=${_quote(step.value || "")}`);
      } else if (step.type === "drag_drop") {
        lines.push(`// DRAG_DROP FROM=${_quote(step.from || "")} TO=${_quote(step.to || "")}`);
      } else if (step.type === "prompt") {
        lines.push(`// PROMPT LABEL=${_quote(step.label || "")} VAR=${_quote(step.variable || "")}`);
      } else if (step.type === "if_exists") {
        lines.push(`// IF_EXISTS SELECTOR=${_quote(step.selector)} THEN=${(step.then || []).length} ELSE=${(step.else || []).length}`);
      } else if (step.type === "loop_until") {
        lines.push(`// LOOP_UNTIL SELECTOR=${_quote(step.selector)} CONDITION=${_quote(step.condition || "not_exists")} MAX=${step.max_iterations || 50}`);
      } else if (step.type === "try_fallback") {
        lines.push(`// TRY_FALLBACK STEPS=${(step.steps || []).length} FALLBACK=${(step.fallback || []).length}`);
      } else if (step.type === "call_macro") {
        lines.push(`// CALL_MACRO NAME=${_quote(step.macro_name || "")}`);
      } else if (step.type === "for_each_row") {
        lines.push(`// FOR_EACH_ROW COLUMNS=${_quote((step.columns || []).join(","))} ROWS=${(step.dataset || []).length}`);
      }
      // _ts and other internal metadata are intentionally not exported
    });
    return `${lines.join("\n")}\n`;
  }

  function importFromIim(text) {
    const lines = String(text || "").split(/\r?\n/);

    // ── Fast path: lossless JSON embedded by exportToIim v2+ ────────────────
    // If the WM_JSON comment is present, use it as the authoritative source.
    // This preserves all extended step types through any save/export/import cycle.
    for (const line of lines) {
      const l = line.trim();
      if (l.startsWith("// WM_JSON:")) {
        try {
          const parsed = JSON.parse(l.slice("// WM_JSON:".length));
          // Backward compat #1: WM_JSON era un array de steps.
          if (Array.isArray(parsed)) {
            return { steps: parsed };
          }
          // Backward compat #2: WM_JSON como objeto con steps (+ opcional meta).
          if (parsed && Array.isArray(parsed.steps)) {
            const out = { steps: parsed.steps };
            if (parsed.meta && typeof parsed.meta === "object") out.meta = parsed.meta;
            return out;
          }
        } catch (e) { /* malformed JSON — fall through to IIM parser */ }
        break; // only one WM_JSON line expected; stop searching
      }
    }

    // ── Legacy IIM parser (backward compat for scripts without WM_JSON) ────
    const steps = [];

    lines.forEach((line) => {
      const l = line.trim();
      if (!l || l.startsWith("VERSION") || l.startsWith("TAB")) return;
      if (l.startsWith("//")) {
        const commentStep = _parseCommentInstruction(l);
        if (commentStep) steps.push(commentStep);
        return;
      }

      if (l.startsWith("NAVIGATE")) {
        const url = _parseParam(l, "URL");
        steps.push({ type: "navigate", url });
      } else if (l.startsWith("BACK")) {
        steps.push({ type: "browser_back" });
      } else if (l.startsWith("FORWARD")) {
        steps.push({ type: "browser_forward" });
      } else if (l.startsWith("HISTORY")) {
        steps.push({ type: "browser_history" });
      } else if (l.startsWith("RELOAD")) {
        steps.push({ type: "browser_reload" });
      } else if (l.startsWith("OPEN_BOOKMARK")) {
        const url = _parseParam(l, "URL");
        steps.push({ type: "open_bookmark", url: url || "" });
      } else if (l.startsWith("OPEN_TAB")) {
        const url = _parseParam(l, "URL");
        const activateRaw = _parseParam(l, "ACTIVATE");
        const step = { type: "open_tab" };
        if (url) step.url = url;
        if (activateRaw) step.activate = activateRaw;
        steps.push(step);
      } else if (l.startsWith("SWITCH_TAB")) {
        const url = _parseParam(l, "URL");
        const openRaw = _parseParam(l, "OPEN_IF_MISSING");
        const step = { type: "switch_tab" };
        if (url) step.url = url;
        if (openRaw) step.openIfMissing = openRaw;
        steps.push(step);
      } else if (l.startsWith("CLOSE_TAB")) {
        const target = _parseParam(l, "TARGET");
        const url = _parseParam(l, "URL");
        const step = { type: "close_tab" };
        if (target) step.target = target;
        if (url) step.url = url;
        steps.push(step);
      } else if (l.startsWith("CLICK")) {
        const sel = _parseParam(l, "SELECTOR");
        steps.push({ type: "click", selector: sel });
      } else if (l.startsWith("TYPE")) {
        const sel = _parseParam(l, "SELECTOR");
        const val = _parseParam(l, "CONTENT");
        // Empty or zero-default values are "capture defaults" — execute fast without delay
        const isFastType = val === "" || val === "0";
        steps.push({ type: "input", selector: sel, value: val, _fast: isFastType });
      } else if (l.startsWith("CHECK")) {
        const sel = _parseParam(l, "SELECTOR");
        const checked = _parseParam(l, "CHECKED") === "true";
        // Unchecked defaults are fast (no user intent)
        steps.push({ type: "check", selector: sel, checked, _fast: !checked });
      } else if (l.startsWith("CHOOSE_OPTION")) {
        const sel = _parseParam(l, "SELECTOR");
        const value = _parseParam(l, "VALUE");
        const text = _parseParam(l, "TEXT");
        const variable = _parseParam(l, "VAR");
        const step = { type: "choose_option", selector: sel, value: value || "", variable: variable || "" };
        if (text) step.text = text;
        steps.push(step);
      } else if (l.startsWith("KEY")) {
        const key = _parseParam(l, "CODE");
        steps.push({ type: "key", key });
      } else if (l.startsWith("WAIT")) {
        const secs = parseFloat(_parseParam(l, "SECONDS")) || 1;
        steps.push({ type: "wait", seconds: secs });
      } else if (l.startsWith("EXTRACT")) {
        const sel = _parseParam(l, "SELECTOR");
        const variable = _parseParam(l, "VAR") || "VAR1";
        steps.push({ type: "extract", selector: sel, variable });
      } else if (l.startsWith("CAPTURE_DEFAULTS")) {
        const exclude = _parseParam(l, "EXCLUDE");
        steps.push({ type: "capture_defaults", exclude: exclude || "" });
      }
    });

    return { steps };
  }

  function _parseCommentInstruction(line) {
    const body = String(line || "").replace(/^\s*\/\/\s*/, "").trim();
    if (!body) return null;

    if (body.startsWith("WAIT_FOR")) {
      const selector = _parseParam(body, "SELECTOR");
      const timeout = parseInt(_parseParam(body, "TIMEOUT"), 10) || 10000;
      return selector ? { type: "wait_for", selector, timeout } : null;
    }
    if (body.startsWith("DBLCLICK")) {
      const selector = _parseParam(body, "SELECTOR");
      return selector ? { type: "dblclick", selector } : null;
    }
    if (body.startsWith("SCROLL_TO")) {
      const selector = _parseParam(body, "SELECTOR");
      return selector ? { type: "scroll_to", selector } : null;
    }
    if (body.startsWith("HOVER")) {
      const selector = _parseParam(body, "SELECTOR");
      return selector ? { type: "hover", selector } : null;
    }
    if (body.startsWith("SET")) {
      const variable = _parseParam(body, "VAR");
      const value = _parseParam(body, "VALUE");
      return variable ? { type: "set_variable", variable, value } : null;
    }
    if (body.startsWith("DRAG_DROP")) {
      const from = _parseParam(body, "FROM");
      const to = _parseParam(body, "TO");
      return (from && to) ? { type: "drag_drop", from, to } : null;
    }
    if (body.startsWith("PROMPT")) {
      const label = _parseParam(body, "LABEL");
      const variable = _parseParam(body, "VAR");
      return variable ? { type: "prompt", label: label || "", variable } : null;
    }
    if (body.startsWith("CALL_MACRO")) {
      const macroName = _parseParam(body, "NAME");
      return macroName ? { type: "call_macro", macro_name: macroName, steps: [] } : null;
    }
    if (body.startsWith("IF_EXISTS")) {
      const selector = _parseParam(body, "SELECTOR");
      if (!selector) return null;
      return { type: "if_exists", selector, then: [], else: [] };
    }
    if (body.startsWith("LOOP_UNTIL")) {
      const selector = _parseParam(body, "SELECTOR");
      if (!selector) return null;
      const condition = _parseParam(body, "CONDITION") || "not_exists";
      const maxIterations = parseInt(_parseParam(body, "MAX"), 10);
      return {
        type: "loop_until",
        selector,
        condition,
        max_iterations: Number.isFinite(maxIterations) && maxIterations > 0 ? maxIterations : 50,
        steps: []
      };
    }
    if (body.startsWith("TRY_FALLBACK")) {
      return { type: "try_fallback", steps: [], fallback: [] };
    }
    if (body.startsWith("FOR_EACH_ROW")) {
      const columnsRaw = _parseParam(body, "COLUMNS");
      const columns = columnsRaw
        ? columnsRaw.split(",").map((v) => String(v || "").trim()).filter(Boolean)
        : [];
      return { type: "for_each_row", columns, dataset: [], steps: [] };
    }

    return null;
  }

  // Parses KEY=value from a macro line.
  // Priority 1: quoted form  KEY="..." with backslash escape support.
  // Priority 2: smart unquoted — captures from KEY= until the next UPPERCASE_KEY= or end of line.
  //             This handles legacy unquoted selectors that contain spaces (e.g. td[text="A B"]).
  function _parseParam(line, key) {
    const re1 = new RegExp(key + '="((?:[^"\\\\]|\\\\.)*)"');
    const m1 = re1.exec(line);
    if (m1) return m1[1].replace(/\\(.)/g, "$1");
    const re2 = new RegExp(key + "=(.+?)(?:\\s+[A-Z]+=|$)");
    const m2 = re2.exec(line);
    return m2 ? m2[1].trim() : "";
  }

  const api = Object.freeze({
    exportToIim,
    importFromIim
  });

  globalScope.WebMaticIimAdapter = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);