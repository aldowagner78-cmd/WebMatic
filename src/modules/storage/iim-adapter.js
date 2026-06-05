(function initIimAdapter(globalScope) {
  // Quotes a value for iim format, escaping backslashes and double quotes
  function _quote(val) {
    return '"' + String(val || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
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
    const steps = macro?.steps || [];
    const lines = ["VERSION BUILD=1000", "TAB T=1"];

    // Embed full steps JSON for lossless round-trip (importFromIim uses this first)
    if (steps.length > 0) {
      // Strip internal runtime-only keys before serialising
      const clean = steps.map((s) => {
        const c = Object.assign({}, s);
        delete c._ts;
        return c;
      });
      lines.push("// WM_JSON:" + JSON.stringify({ version: 2, steps: clean }));
    }

    steps.forEach((step) => {
      // ── Standard IIM instructions (human-readable) ──────────────────────
      if (step.type === "click") {
        lines.push(`CLICK SELECTOR=${_quote(step.selector)}`);
        return;
      }
      if (step.type === "input" || step.type === "text") {
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
          if (parsed && Array.isArray(parsed.steps)) {
            return { steps: parsed.steps };
          }
        } catch (e) { /* malformed JSON — fall through to IIM parser */ }
        break; // only one WM_JSON line expected; stop searching
      }
    }

    // ── Legacy IIM parser (backward compat for scripts without WM_JSON) ────
    const steps = [];

    lines.forEach((line) => {
      const l = line.trim();
      if (!l || l.startsWith("VERSION") || l.startsWith("TAB") || l.startsWith("//")) return;

      if (l.startsWith("NAVIGATE")) {
        const url = _parseParam(l, "URL");
        steps.push({ type: "navigate", url });
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