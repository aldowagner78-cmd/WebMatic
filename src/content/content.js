(function bootstrapWebMatic(globalScope) {
  // ── Shared: flash visual feedback on recorded element ───────────────────
  function flashElement(el) {
    if (!(el instanceof Element)) return;
    try {
      const doc = el.ownerDocument;
      const win = doc && doc.defaultView;
      if (!doc || !win) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const root = doc.documentElement || doc.body;
      const ov = doc.createElement("div");
      ov.setAttribute("data-wm-flash", "1");
      Object.assign(ov.style, {
        position: "fixed",
        top: (rect.top - 3) + "px",
        left: (rect.left - 3) + "px",
        width: (rect.width + 6) + "px",
        height: (rect.height + 6) + "px",
        border: "2px solid #ef4444",
        borderRadius: "4px",
        backgroundColor: "rgba(239,68,68,0.10)",
        zIndex: "2147483647",
        pointerEvents: "none",
        boxSizing: "border-box",
        transition: "opacity 0.45s ease",
        opacity: "1"
      });
      const badge = doc.createElement("span");
      Object.assign(badge.style, {
        position: "absolute",
        top: "-11px",
        right: "-11px",
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        background: "#ef4444",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        color: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,.35)",
        lineHeight: "1",
        userSelect: "none"
      });
      badge.textContent = "⚡";
      ov.appendChild(badge);
      root.appendChild(ov);
      setTimeout(() => { ov.style.opacity = "0"; }, 380);
      setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 820);
    } catch (_) {}
  }

  // ── Sub-frame mode: only attach a lightweight recorder ──────────────────
  // When all_frames:true, this script runs inside every iframe too.
  // We do NOT mount the UI in sub-frames; we just capture events and relay
  // them to the background, which forwards them to the top frame.
  if (window !== window.top) {
    const _Rec = globalScope.WebMaticRecorder;
    let _isRecording = false;
    // Consultar estado inicial (si la grabacion ya estaba activa al cargar el iframe)
    chrome.runtime.sendMessage({ type: "QUERY_RECORDING_STATE" }, (resp) => {
      if (chrome.runtime.lastError) return;
      if (resp && resp.isRecording) _isRecording = true;
    });
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "RECORDING_STATE") _isRecording = msg.active === true;
    });
    function _sel(el) {
      if (_Rec && typeof _Rec.buildSelector === "function") return _Rec.buildSelector(el);
      if (!el || !(el instanceof Element)) return "";
      if (el.id) return "#" + el.id;
      return el.tagName.toLowerCase();
    }
    function _send(step) {
      if (!_isRecording) return;
      chrome.runtime.sendMessage({ type: "FRAME_STEP_CAPTURED", step }, () => { void chrome.runtime.lastError; });
    }
    document.addEventListener("click", (e) => {
      let t = e.target;
      if (!(t instanceof Element)) return;
      const tTag = t.tagName.toLowerCase();
      if (tTag === "img" || (tTag === "input" && t.type === "image" && !t.id)) {
        const anchor = t.closest("a[href]");
        if (anchor) t = anchor;
      }
      if (_isRecording) flashElement(t);
      _send({ type: "click", selector: _sel(t) });
    }, true);
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement) && !(t instanceof HTMLSelectElement)) return;
      if (t.readOnly || t.disabled) return;
      if (_isRecording) flashElement(t);
      if (t instanceof HTMLInputElement && t.type === "checkbox") {
        _send({ type: "check", selector: _sel(t), checked: t.checked });
        return;
      }
      _send({ type: "input", selector: _sel(t), value: t.value });
    }, true);
    document.addEventListener("keydown", (e) => {
      if (["Enter", "Tab", "Escape"].includes(e.key)) {
        if (_isRecording && e.target instanceof Element) flashElement(e.target);
        _send({ type: "key", key: e.key });
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        _send({ type: "text", selector: e.target instanceof Element ? _sel(e.target) : "", value: e.key });
      }
    }, true);
    // Sub-frame copy: capture extract step + track last copied for paste substitution
    let _lastCopiedText = null;
    let _lastCopiedVar = null;
    let _varCounter = 0;
    const INLINE_SF = /^(A|ABBR|B|BDI|BDO|BIG|BR|CITE|CODE|DFN|EM|I|KBD|MARK|Q|S|SAMP|SMALL|SPAN|STRONG|SUB|SUP|TIME|TT|U|VAR)$/;
    const BLOCK_SF  = /^(TD|TH|LI|P|DIV|BLOCKQUOTE|PRE|H[1-6]|DT|DD|ARTICLE|SECTION|ASIDE|HEADER|FOOTER|MAIN|NAV|FIGURE|FIGCAPTION|SUMMARY|DETAILS)$/;
    const BAD_SF    = /^(TABLE|TBODY|THEAD|TFOOT|TR|COLGROUP|COL|UL|OL|DL|FORM|FIELDSET|BODY|HTML)$/;
    function _resolveExtraction(node) {
      let el = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      while (el && el.tagName) {
        const t = el.tagName.toUpperCase();
        if (BAD_SF.test(t)) return null;
        if (BLOCK_SF.test(t) || !INLINE_SF.test(t)) return el;
        el = el.parentElement;
      }
      return null;
    }
    document.addEventListener("copy", (e) => {
      if (!_isRecording) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const txt = sel.toString().trim();
      if (!txt) return;
      const srcEl = _resolveExtraction(sel.anchorNode);
      if (!srcEl) return;
      _varCounter += 1;
      _lastCopiedText = txt;
      _lastCopiedVar = `VAR${_varCounter}`;
      flashElement(srcEl);
      _send({ type: "extract", selector: _sel(srcEl), variable: _lastCopiedVar });
    }, true);
    // Override change listener above to substitute paste value
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement) && !(t instanceof HTMLSelectElement)) return;
      if (t.readOnly || t.disabled) return;
      if (_isRecording && _lastCopiedText !== null && _lastCopiedVar !== null && t.value.trim() === _lastCopiedText) {
        _send({ type: "input", selector: _sel(t), value: `{{!${_lastCopiedVar}}}` });
      }
    }, true);
    // contenteditable input (debounced — avoids capturing every keystroke)
    let _sfCeTimer = null;
    document.addEventListener("input", (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.isContentEditable) return;
      if (!_isRecording) return;
      clearTimeout(_sfCeTimer);
      _sfCeTimer = setTimeout(() => {
        const val = (t.innerText || t.textContent || "").trim();
        flashElement(t);
        _send({ type: "input", selector: _sel(t), value: val });
      }, 400);
    }, true);
    // dblclick
    document.addEventListener("dblclick", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (!_isRecording) return;
      flashElement(t);
      _send({ type: "dblclick", selector: _sel(t) });
    }, true);
    // hover: solo graba si el hover despliega contenido nuevo (dropdown/menu/tooltip)
    let _sfHoverEl = null;
    let _sfHoverTimer = null;
    let _sfHoverObs = null;
    let _sfHoverSeen = false;
    document.addEventListener("mouseover", (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !_isRecording || t === _sfHoverEl) return;
      clearTimeout(_sfHoverTimer);
      if (_sfHoverObs) { _sfHoverObs.disconnect(); _sfHoverObs = null; }
      _sfHoverSeen = false;
      _sfHoverEl = t;
      try {
        const _root = document.body || document.documentElement;
        _sfHoverObs = new MutationObserver((muts) => {
          if (_sfHoverSeen) return;
          for (const m of muts) {
            if (m.type === "childList") {
              for (const n of m.addedNodes) {
                if (n instanceof Element && n.offsetWidth > 0 && n.offsetHeight > 0) { _sfHoverSeen = true; return; }
              }
            } else if (m.attributeName === "aria-expanded" && m.target.getAttribute("aria-expanded") === "true") {
              _sfHoverSeen = true; return;
            }
          }
        });
        _sfHoverObs.observe(_root, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
      } catch (_) {}
      _sfHoverTimer = setTimeout(() => {
        if (_sfHoverObs) { _sfHoverObs.disconnect(); _sfHoverObs = null; }
        if (_sfHoverEl !== t || !_sfHoverSeen) return;
        flashElement(t);
        _send({ type: "hover", selector: _sel(t) });
      }, 800);
    }, true);
    // scroll_to: solo graba si el scroll ocurre en un contenedor emergente (dropdown/listbox/menu)
    function _sfIsMenuScroll(el) {
      if (!(el instanceof Element)) return false;
      if (el.tagName.toLowerCase() === "select") return true;
      const role = (el.getAttribute("role") || "").toLowerCase();
      if (["listbox","menu","menubar","tree","combobox","grid","treegrid"].includes(role)) return true;
      if (el.closest("[role='listbox'],[role='menu'],[role='combobox'],[role='tree']")) return true;
      try {
        const cs = window.getComputedStyle(el);
        const pos = cs.position; const ov = cs.overflowY;
        if ((pos === "absolute" || pos === "fixed") && (ov === "auto" || ov === "scroll")) return true;
      } catch (_) {}
      return false;
    }
    let _sfScrollTimer = null;
    document.addEventListener("scroll", (e) => {
      if (!_isRecording) return;
      const scrollEl = e.target instanceof Element ? e.target : null;
      if (!scrollEl || !_sfIsMenuScroll(scrollEl)) return;
      clearTimeout(_sfScrollTimer);
      _sfScrollTimer = setTimeout(() => {
        _send({ type: "scroll_to", selector: _sel(scrollEl) });
      }, 900);
    }, true);
    return; // skip full bootstrap in sub-frames
  }
  // ── Top-frame bootstrap ──────────────────────────────────────────────────

  if (globalScope.__webmaticRuntime && typeof globalScope.__webmaticRuntime.destroy === "function") {
    globalScope.__webmaticRuntime.destroy();
  }

  const contracts = globalScope.WebMaticContracts;
  const storeFactory = globalScope.WebMaticStore;
  const uiShell = globalScope.WebMaticUiShell;
  const geometry = globalScope.WebMaticGeometry;
  const settingsApi = globalScope.WebMaticSettings;

  if (!contracts || !storeFactory || !uiShell || !geometry || !settingsApi) {
    console.error("[WebMatic] Modulos base incompletos.");
    return;
  }

  const store = storeFactory.createStore();
  const iimAdapter = globalScope.WebMaticIimAdapter;
  const themePalettes = {
    light: [
      { accentColor: "#059669", surfaceColor: "#f0fdf4" },
      { accentColor: "#0284c7", surfaceColor: "#f0f9ff" },
      { accentColor: "#7c3aed", surfaceColor: "#faf5ff" },
      { accentColor: "#dc2626", surfaceColor: "#fef2f2" }
    ],
    dark: [
      { accentColor: "#34d399", surfaceColor: "#022c22" },
      { accentColor: "#38bdf8", surfaceColor: "#0c1a2e" },
      { accentColor: "#a78bfa", surfaceColor: "#1e1b2e" },
      { accentColor: "#f87171", surfaceColor: "#2a1515" }
    ]
  };

  function resolveTheme(themeMode, themeVariant) {
    const mode = themeMode === "dark" ? "dark" : "light";
    const variant = Number(themeVariant);
    const index = Number.isFinite(variant) && variant >= 1 && variant <= 4 ? variant - 1 : 0;
    return {
      themeMode: mode,
      themeVariant: index + 1,
      ...themePalettes[mode][index]
    };
  }

  const recorderRuntime = {
    cleanup: null,
    varCounter: 0,
    lastCopiedText: null,
    lastCopiedVar: null,
    _ceTimer: null,       // debounce timer for contenteditable input
    _hoverTimer: null,    // debounce timer for hover recording
    _scrollTimer: null    // debounce timer for scroll_to recording
  };

  const playerRuntime = {
    activePlayer: null
  };

  // ── Visual step editor state ─────────────────────────────────────────
  let seEditor = null;           // WebMaticStepEditor instance
  let _seActiveTab = "visual";  // which tab is active: "visual" | "script"
  let _prevScriptEditorOpen = false;

  /** Sync tab button active state and show/hide visual/script panes. */
  function _applyScriptTab(overlay, tab) {
    if (!overlay) return;
    const container = overlay.querySelector("[data-step-visual-container]");
    const area = overlay.querySelector("[data-script-editor-area]");
    overlay.querySelectorAll("[data-script-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.scriptTab === tab);
    });
    if (container) container.style.display = tab === "visual" ? "" : "none";
    if (area) area.style.display = tab === "script" ? "" : "none";
    _seActiveTab = tab;
  }

  /** Get steps from the active editor mode (visual or script IIM). */
  function _resolveEditorSteps(area, seState, fallbackSteps) {
    if (_seActiveTab === "visual" && seEditor) {
      return seEditor.getSteps();
    }
    const rawScript = area ? area.value : "";
    const _wmStrip = (s) => (s || "").split("\n")
      .filter((l) => !l.trimStart().startsWith("// WM_JSON:")).join("\n");
    const scriptUnchanged = rawScript.trim() === _wmStrip(seState.script).trim();
    if (scriptUnchanged && fallbackSteps && fallbackSteps.length > 0) return fallbackSteps;
    return iimAdapter ? iimAdapter.importFromIim(rawScript).steps : [];
  }

  const FLOATING_BTN_ID = "webmatic-floating-recorder-global";
  const FLOATING_PLAYER_ID = "webmatic-floating-player-global";

  // ── Playback floating panel ─────────────────────────────────────────────
  function _stepLabel(s) {
    if (!s) return "";
    if (s.type === "navigate")    return "\uD83C\uDF10 " + (s.url || "");
    if (s.type === "click")       return "\uD83D\uDDB1 " + (s.selector || "");
    if (s.type === "dblclick")    return "\uD83D\uDDB1\uD83D\uDDB1 " + (s.selector || "");
    if (s.type === "input" || s.type === "text")
                                  return "\u270E " + (s.selector || "") + (s.value ? " = \"" + s.value + "\"" : "");
    if (s.type === "wait")        return "\u23F1 " + (s.seconds != null ? s.seconds + "s" : (s.ms || 0) + "ms");
    if (s.type === "check")       return "\u2611 " + (s.selector || "");
    if (s.type === "key")         return "\u2328 " + (s.key || "");
    if (s.type === "extract")     return "\u270F " + (s.selector || "") + (s.variable ? " \u2192 " + s.variable : "");
    if (s.type === "wait_for")    return "\u23F3 esperar " + (s.selector || "");
    if (s.type === "scroll_to")   return "\u21E9 scroll \u2192 " + (s.selector || "");
    if (s.type === "hover")       return "\u25B7 hover " + (s.selector || "");
    if (s.type === "drag_drop")   return "\u2194 drag " + (s.from || "") + " \u2192 " + (s.to || "");
    if (s.type === "set_variable")return "= " + (s.variable || "") + " \u2190 " + (s.value || "");
    if (s.type === "prompt")      return "? " + (s.label || "prompt") + (s.variable ? " \u2192 " + s.variable : "");
    if (s.type === "if_exists")   return "? si existe " + (s.selector || "");
    if (s.type === "loop_until")  return "\u21BA bucle " + (s.selector || "");
    if (s.type === "try_fallback")return "\u26A0 try/fallback";
    if (s.type === "call_macro")  return "\u21AA llamar \"" + (s.macro_name || "") + "\"";
    if (s.type === "for_each_row")return "\u25A6 " + ((s.dataset || []).length) + " filas \u00D7 " + ((s.columns || []).join(", "));
    return s.type;
  }

  function createPlaybackFloating(onStop, onAddWait, onReplay, onClose, onLoopReplay) {
    if (document.getElementById(FLOATING_PLAYER_ID)) return;
    const PANEL_HEIGHT = 52;
    const panel = document.createElement("div");
    panel.id = FLOATING_PLAYER_ID;
    panel.style.cssText = [
      "all:initial",
      "display:flex",
      "align-items:center",
      "gap:8px",
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "height:" + PANEL_HEIGHT + "px",
      "z-index:2147483646",
      "border-bottom:2px solid rgba(37,99,235,0.35)",
      "background:rgba(255,255,255,0.97)",
      "backdrop-filter:blur(12px)",
      "padding:0 12px",
      "font-family:system-ui,sans-serif",
      "font-size:12px",
      "box-shadow:0 3px 14px rgba(37,99,235,0.18)",
      "box-sizing:border-box"
    ].join(";");

    if (!document.getElementById("webmatic-floating-keyframes")) {
      const style = document.createElement("style");
      style.id = "webmatic-floating-keyframes";
      style.textContent = "@keyframes webmatic-pulse{0%,100%{opacity:1}50%{opacity:0.35}}";
      document.head.appendChild(style);
    }

    // Spinner dot
    const dot = document.createElement("span");
    dot.id = "wm-play-dot";
    dot.style.cssText = "display:inline-block;width:10px;height:10px;border-radius:999px;background:#2563eb;animation:webmatic-pulse 1s infinite;flex-shrink:0";
    panel.appendChild(dot);

    // Macro name label
    const nameEl = document.createElement("span");
    nameEl.id = "wm-play-name";
    nameEl.style.cssText = "font-weight:700;color:#2563eb;white-space:nowrap;flex-shrink:0;max-width:140px;overflow:hidden;text-overflow:ellipsis";
    nameEl.textContent = "Reproduciendo";
    panel.appendChild(nameEl);

    // Divider
    const div1 = document.createElement("span");
    div1.style.cssText = "color:#cbd5e1;flex-shrink:0";
    div1.textContent = "|";
    panel.appendChild(div1);

    // Current step info text
    const infoEl = document.createElement("span");
    infoEl.id = "wm-play-info";
    infoEl.style.cssText = "flex:1;min-width:0;font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:system-ui,sans-serif";
    infoEl.textContent = "Iniciando...";
    panel.appendChild(infoEl);

    // Progress bar at bottom of panel
    const progressBar = document.createElement("div");
    progressBar.id = "wm-play-progress";
    progressBar.style.cssText = "position:absolute;bottom:0;left:0;height:3px;background:#2563eb;transition:width 0.35s ease;width:0%";
    panel.appendChild(progressBar);

    // +1s button
    const addWaitEl = document.createElement("button");
    addWaitEl.id = "wm-play-addwait";
    addWaitEl.style.cssText = [
      "all:initial",
      "display:none",
      "align-items:center",
      "gap:4px",
      "flex-shrink:0",
      "border:1px solid #f59e0b",
      "background:rgba(245,158,11,0.1)",
      "color:#b45309",
      "border-radius:6px",
      "padding:3px 9px",
      "font-size:11px",
      "font-weight:700",
      "font-family:system-ui,sans-serif",
      "cursor:pointer",
      "white-space:nowrap"
    ].join(";");
    addWaitEl.textContent = "\u23F1 +1s aqu\xED";
    addWaitEl.addEventListener("click", (e) => { e.stopPropagation(); if (typeof onAddWait === "function") onAddWait(); });
    panel.appendChild(addWaitEl);

    // Replay button (visible when stopped)
    const replayEl = document.createElement("button");
    replayEl.id = "wm-play-replay";
    replayEl.style.cssText = [
      "all:initial",
      "display:none",
      "align-items:center",
      "gap:4px",
      "flex-shrink:0",
      "border:1px solid rgba(37,99,235,0.4)",
      "background:rgba(37,99,235,0.08)",
      "color:#2563eb",
      "border-radius:6px",
      "padding:3px 9px",
      "font-size:11px",
      "font-weight:700",
      "font-family:system-ui,sans-serif",
      "cursor:pointer",
      "white-space:nowrap"
    ].join(";");
    replayEl.textContent = "\u25B6 Repetir";
    replayEl.addEventListener("click", (e) => { e.stopPropagation(); if (typeof onReplay === "function") onReplay(); });
    panel.appendChild(replayEl);

    // Loop count input (visible when stopped/completed)
    const loopCountEl = document.createElement("input");
    loopCountEl.id = "wm-play-loop-count";
    loopCountEl.type = "number";
    loopCountEl.min = "2";
    loopCountEl.max = "99";
    loopCountEl.value = "2";
    loopCountEl.style.cssText = [
      "all:initial",
      "display:none",
      "width:44px",
      "border:1px solid rgba(37,99,235,0.35)",
      "border-radius:6px",
      "padding:3px 6px",
      "font-size:12px",
      "font-family:system-ui,sans-serif",
      "color:#2563eb",
      "background:rgba(37,99,235,0.06)",
      "text-align:center",
      "flex-shrink:0"
    ].join(";");
    panel.appendChild(loopCountEl);

    // Loop replay button
    const loopReplayEl = document.createElement("button");
    loopReplayEl.id = "wm-play-loop-replay";
    loopReplayEl.style.cssText = [
      "all:initial",
      "display:none",
      "align-items:center",
      "gap:4px",
      "flex-shrink:0",
      "border:1px solid rgba(37,99,235,0.4)",
      "background:rgba(37,99,235,0.08)",
      "color:#2563eb",
      "border-radius:6px",
      "padding:3px 9px",
      "font-size:11px",
      "font-weight:700",
      "font-family:system-ui,sans-serif",
      "cursor:pointer",
      "white-space:nowrap"
    ].join(";");
    loopReplayEl.textContent = "\u25B6\u25B6 Bucle";
    loopReplayEl.title = "Repetir la macro N veces seguidas";
    loopReplayEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const n = Math.max(2, Math.min(99, parseInt(loopCountEl.value, 10) || 2));
      if (typeof onLoopReplay === "function") onLoopReplay(n);
    });
    panel.appendChild(loopReplayEl);

    // Stop button
    const stopEl = document.createElement("button");
    stopEl.id = "wm-play-stop";
    stopEl.style.cssText = [
      "all:initial",
      "display:inline-flex",
      "align-items:center",
      "gap:4px",
      "flex-shrink:0",
      "border:1px solid rgba(220,38,38,0.4)",
      "background:rgba(220,38,38,0.07)",
      "color:#dc2626",
      "border-radius:6px",
      "padding:3px 9px",
      "font-size:11px",
      "font-weight:700",
      "font-family:system-ui,sans-serif",
      "cursor:pointer",
      "white-space:nowrap"
    ].join(";");
    stopEl.textContent = "\u25A0 Detener";
    stopEl.addEventListener("click", (e) => { e.stopPropagation(); if (typeof onStop === "function") onStop(); });
    panel.appendChild(stopEl);

    // Close button
    const closeEl = document.createElement("button");
    closeEl.id = "wm-play-close";
    closeEl.style.cssText = [
      "all:initial",
      "display:inline-flex",
      "align-items:center",
      "flex-shrink:0",
      "border:1px solid rgba(100,116,139,0.3)",
      "background:rgba(100,116,139,0.07)",
      "color:#64748b",
      "border-radius:6px",
      "padding:3px 8px",
      "font-size:13px",
      "font-weight:700",
      "font-family:system-ui,sans-serif",
      "cursor:pointer",
      "line-height:1"
    ].join(";");
    closeEl.textContent = "\u00D7";
    closeEl.title = "Cerrar panel de reproduccion";
    closeEl.addEventListener("click", (e) => { e.stopPropagation(); if (typeof onClose === "function") onClose(); });
    panel.appendChild(closeEl);

    document.documentElement.style.marginTop = PANEL_HEIGHT + "px";
    document.documentElement.appendChild(panel);
  }

  function updatePlaybackFloating(state) {
    const panel = document.getElementById(FLOATING_PLAYER_ID);
    if (!panel) return;
    const { isPlaying, currentSteps, currentStepIndex, errorMessage } = state.playback;
    const macroId = state.library.selectedMacroId;
    const macro = state.library.macros.find((m) => m.id === macroId);
    const total = (currentSteps || []).length;

    const nameEl = panel.querySelector("#wm-play-name");
    if (nameEl && macro) nameEl.textContent = macro.name;

    const dot = panel.querySelector("#wm-play-dot");
    const infoEl = panel.querySelector("#wm-play-info");
    const progress = panel.querySelector("#wm-play-progress");
    const addWaitEl = panel.querySelector("#wm-play-addwait");
    const stopEl = panel.querySelector("#wm-play-stop");
    const replayEl = panel.querySelector("#wm-play-replay");
    const loopCountEl = panel.querySelector("#wm-play-loop-count");
    const loopReplayEl = panel.querySelector("#wm-play-loop-replay");

    if (errorMessage) {
      // Error state — keep panel open, show error, allow fix and replay
      if (dot) { dot.style.background = "#dc2626"; dot.style.animation = "none"; }
      if (infoEl) { infoEl.textContent = "\u2717 " + errorMessage; infoEl.style.color = "#dc2626"; infoEl.style.fontWeight = "600"; infoEl.title = errorMessage; }
      if (progress) { progress.style.background = "#dc2626"; }
      if (addWaitEl) addWaitEl.style.display = "inline-flex";
      if (stopEl) stopEl.style.display = "none";
      if (replayEl) replayEl.style.display = "inline-flex";
      if (loopCountEl) loopCountEl.style.display = "inline-flex";
      if (loopReplayEl) loopReplayEl.style.display = "inline-flex";
    } else if (isPlaying) {
      // Playing — show current step
      if (dot) { dot.style.background = "#2563eb"; dot.style.animation = "webmatic-pulse 1s infinite"; }
      const step = currentStepIndex >= 0 && currentStepIndex < total ? currentSteps[currentStepIndex] : null;
      const label = step ? _stepLabel(step) : "Iniciando...";
      const counter = total > 0 ? ` (${Math.min(currentStepIndex + 1, total)}/${total})` : "";
      if (infoEl) { infoEl.textContent = "\u25B8 " + label + counter; infoEl.style.color = "#1e293b"; infoEl.style.fontWeight = "500"; infoEl.title = label; }
      if (progress && total > 0) progress.style.width = Math.round(((currentStepIndex + 1) / total) * 100) + "%";
      if (progress) progress.style.background = "#2563eb";
      if (addWaitEl) addWaitEl.style.display = "inline-flex";
      if (stopEl) stopEl.style.display = "inline-flex";
      if (replayEl) replayEl.style.display = "none";
      if (loopCountEl) loopCountEl.style.display = "none";
      if (loopReplayEl) loopReplayEl.style.display = "none";
    } else if (!isPlaying && currentStepIndex >= total && total > 0) {
      // Completed successfully
      if (dot) { dot.style.background = "#16a34a"; dot.style.animation = "none"; }
      if (infoEl) { infoEl.textContent = "\u2713 Completado sin errores \u2014 " + total + "/" + total + " pasos"; infoEl.style.color = "#16a34a"; infoEl.style.fontWeight = "700"; infoEl.title = ""; }
      if (progress) { progress.style.width = "100%"; progress.style.background = "#16a34a"; }
      if (addWaitEl) addWaitEl.style.display = "none";
      if (stopEl) stopEl.style.display = "none";
      if (replayEl) replayEl.style.display = "inline-flex";
      if (loopCountEl) loopCountEl.style.display = "inline-flex";
      if (loopReplayEl) loopReplayEl.style.display = "inline-flex";
    } else {
      // Idle / initial
      if (dot) { dot.style.background = "#2563eb"; dot.style.animation = "webmatic-pulse 1s infinite"; }
      if (infoEl) { infoEl.textContent = "Iniciando..."; infoEl.style.color = "#64748b"; infoEl.style.fontWeight = "400"; }
      if (stopEl) stopEl.style.display = "inline-flex";
      if (replayEl) replayEl.style.display = "none";
      if (addWaitEl) addWaitEl.style.display = "none";
      if (loopCountEl) loopCountEl.style.display = "none";
      if (loopReplayEl) loopReplayEl.style.display = "none";
    }
  }

  function removePlaybackFloating() {
    const el = document.getElementById(FLOATING_PLAYER_ID);
    if (el) el.parentNode.removeChild(el);
    // Only remove margin-top if the recorder floating btn isn't also showing
    if (!document.getElementById(FLOATING_BTN_ID)) {
      document.documentElement.style.marginTop = "";
    }
    // Restore sidebar now that the floating panel is gone
    store.dispatch({ type: contracts.ActionTypes.PANEL_SHOWN });
  }

  function createFloatingBtn(onStop) {
    if (document.getElementById(FLOATING_BTN_ID)) return;
    const btn = document.createElement("button");
    btn.id = FLOATING_BTN_ID;
    btn.setAttribute("aria-label", "Grabando — Clic para detener");
    const BTN_HEIGHT = 30;
    btn.style.cssText = [
      "all:initial",
      "display:flex",
      "align-items:center",
      "gap:8px",
      "position:fixed",
      "top:0",
      "right:80px",
      "height:" + BTN_HEIGHT + "px",
      "z-index:2147483646",
      "border:1px solid rgba(220,38,38,0.30)",
      "border-top:none",
      "background:rgba(255,255,255,0.97)",
      "backdrop-filter:blur(10px)",
      "color:#dc2626",
      "border-radius:0 0 10px 10px",
      "padding:0 14px",
      "font-size:12px",
      "font-weight:700",
      "font-family:system-ui,sans-serif",
      "letter-spacing:0.2px",
      "box-shadow:0 3px 10px rgba(220,38,38,0.18)",
      "cursor:pointer",
      "white-space:nowrap"
    ].join(";");
    // Push page content down so the button doesn't overlap anything
    document.documentElement.style.marginTop = BTN_HEIGHT + "px";

    const dot = document.createElement("span");
    dot.style.cssText = [
      "display:inline-block",
      "width:10px",
      "height:10px",
      "border-radius:999px",
      "background:#dc2626",
      "animation:webmatic-pulse 1s infinite",
      "flex-shrink:0"
    ].join(";");

    // inject keyframe only once
    if (!document.getElementById("webmatic-floating-keyframes")) {
      const style = document.createElement("style");
      style.id = "webmatic-floating-keyframes";
      style.textContent = "@keyframes webmatic-pulse{0%,100%{opacity:1}50%{opacity:0.35}}";
      document.head.appendChild(style);
    }

    const label = document.createElement("span");
    label.textContent = "Grabando — Clic para detener";

    btn.appendChild(dot);
    btn.appendChild(label);

    btn.addEventListener("click", () => {
      if (typeof onStop === "function") onStop();
    });

    document.documentElement.appendChild(btn);
  }

  function removeFloatingBtn() {
    const el = document.getElementById(FLOATING_BTN_ID);
    if (el) el.parentNode.removeChild(el);
    document.documentElement.style.marginTop = "";
  }

  function filterMacros(macros, query) {
    if (!query || !query.trim()) {
      return macros;
    }
    const q = query.trim().toLowerCase();
    const prefix = macros.filter((m) => m.name.toLowerCase().startsWith(q));
    if (prefix.length > 0) {
      return prefix;
    }
    return macros.filter((m) => m.name.toLowerCase().includes(q));
  }

  const RecorderClass = globalScope.WebMaticRecorder;

  function buildSelector(element) {
    if (RecorderClass && typeof RecorderClass.buildSelector === "function") {
      return RecorderClass.buildSelector(element);
    }
    // fallback (should not happen if scripts loaded correctly)
    if (!element || !(element instanceof Element)) return "";
    if (element.id) return `#${element.id}`;
    const tag = element.tagName.toLowerCase();
    const classes = Array.from(element.classList || []).slice(0, 2).join(".");
    return classes ? `${tag}.${classes}` : tag;
  }

  function captureStep(step) {
    const stamped = Object.assign({ _ts: Date.now() }, step);
    chrome.runtime.sendMessage({ type: "RECORD_STEP", step: stamped }, () => { void chrome.runtime.lastError; });
    store.dispatch({ type: contracts.ActionTypes.STEP_CAPTURED, payload: stamped });
  }

  function startRecorderSession() {
    if (recorderRuntime.cleanup) {
      recorderRuntime.cleanup();
    }

    // Capture current URL as first step (only if not already the last step)
    const currentSteps = store.getState().draft.steps;
    const lastStep = currentSteps[currentSteps.length - 1];
    if (!lastStep || lastStep.type !== "navigate" || lastStep.url !== window.location.href) {
      captureStep({ type: "navigate", url: window.location.href });
    }

    const onClick = (event) => {
      let target = event.target;
      if (!(target instanceof Element) || target.closest("#webmatic-panel-root") || target.closest("#webmatic-floating-recorder-global") || target.closest("#webmatic-floating-player-global")) {
        return;
      }
      // For <img> and imageless clicks inside <a>, bubble up to the anchor
      const tag = target.tagName.toLowerCase();
      if (tag === "img" || (tag === "input" && target.type === "image" && !target.id)) {
        const anchor = target.closest("a[href]");
        if (anchor) target = anchor;
      }
      flashElement(target);
      captureStep({ type: "click", selector: buildSelector(target) });
    };

    const onChange = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLSelectElement)) {
        return;
      }
      if (target.closest("#webmatic-panel-root") || target.closest("#webmatic-floating-recorder-global") || target.closest("#webmatic-floating-player-global")) {
        return;
      }
      // Skip readonly and disabled fields — value can't be set by user
      if (target.readOnly || target.disabled) return;
      flashElement(target);
      // For checkboxes capture the boolean checked state, not the raw .value attr
      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        captureStep({ type: "check", selector: buildSelector(target), checked: target.checked });
        return;
      }
      // Radio buttons: record as check with checked:true (the selected option)
      if (target instanceof HTMLInputElement && target.type === "radio") {
        captureStep({ type: "check", selector: buildSelector(target), checked: true });
        return;
      }
      // Dynamic copy/paste: if pasted value matches last copied text, use variable reference
      const rawValue = target.value;
      let recordedValue = rawValue;
      if (
        recorderRuntime.lastCopiedText !== null &&
        recorderRuntime.lastCopiedVar !== null &&
        rawValue.trim() === recorderRuntime.lastCopiedText
      ) {
        recordedValue = `{{!${recorderRuntime.lastCopiedVar}}}`;
      }
      captureStep({ type: "input", selector: buildSelector(target), value: recordedValue });
    };

    const onKeydown = (event) => {
      const target = event.target;
      if (target instanceof Element && (target.closest("#webmatic-panel-root") || target.closest("#webmatic-floating-recorder-global") || target.closest("#webmatic-floating-player-global"))) {
        return;
      }
      // Special navigation keys → capture as key step
      if (["Enter", "Tab", "Escape"].includes(event.key)) {
        if (target instanceof Element) flashElement(target);
        captureStep({ type: "key", key: event.key });
        return;
      }
      // Printable chars → capture as text step; store will merge via Recorder.mergeKeySteps
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        const selector = target instanceof Element ? buildSelector(target) : "";
        const currentSteps = store.getState().draft.steps;
        const lastStep = currentSteps[currentSteps.length - 1];
        if (lastStep && lastStep.type === "text" && lastStep.selector === selector) {
          // merge into last step
          captureStep({ type: "text", selector, value: lastStep.value + event.key, _merge: true });
        } else {
          captureStep({ type: "text", selector, value: event.key });
        }
      }
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    document.addEventListener("keydown", onKeydown, true);

    // ── Copy listener: record EXTRACT step + set up variable for paste substitution ──
    const onCopy = (event) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const copiedText = sel.toString().trim();
      if (!copiedText) return;

      // Walk up from anchor node to find a meaningful block element
      function resolveExtractionTarget(node) {
        if (!node) return null;
        const INLINE = /^(A|ABBR|B|BDI|BDO|BIG|BR|CITE|CODE|DFN|EM|I|KBD|MARK|Q|S|SAMP|SMALL|SPAN|STRONG|SUB|SUP|TIME|TT|U|VAR)$/;
        const BLOCK = /^(TD|TH|LI|P|DIV|BLOCKQUOTE|PRE|H[1-6]|DT|DD|ARTICLE|SECTION|ASIDE|HEADER|FOOTER|MAIN|NAV|FIGURE|FIGCAPTION|SUMMARY|DETAILS)$/;
        const BAD  = /^(TABLE|TBODY|THEAD|TFOOT|TR|COLGROUP|COL|UL|OL|DL|FORM|FIELDSET|BODY|HTML)$/;
        let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        while (el && el.tagName) {
          const tag = el.tagName.toUpperCase();
          if (BAD.test(tag)) return null;
          if (BLOCK.test(tag) || !INLINE.test(tag)) return el;
          el = el.parentElement;
        }
        return null;
      }

      const srcEl = resolveExtractionTarget(sel.anchorNode);
      if (!srcEl || srcEl.closest("#webmatic-panel-root")) return;

      recorderRuntime.varCounter += 1;
      const varName = `VAR${recorderRuntime.varCounter}`;
      recorderRuntime.lastCopiedText = copiedText;
      recorderRuntime.lastCopiedVar = varName;

      flashElement(srcEl);
      captureStep({ type: "extract", selector: buildSelector(srcEl), variable: varName });
    };

    document.addEventListener("copy", onCopy, true);

    // ── contenteditable input (debounced 400ms) ──────────────────────────────
    const onContentEditableInput = (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.isContentEditable) return;
      if (target.closest("#webmatic-panel-root") || target.closest("#webmatic-floating-recorder-global") || target.closest("#webmatic-floating-player-global")) return;
      clearTimeout(recorderRuntime._ceTimer);
      recorderRuntime._ceTimer = setTimeout(() => {
        const val = (target.innerText || target.textContent || "").trim();
        flashElement(target);
        captureStep({ type: "input", selector: buildSelector(target), value: val });
      }, 400);
    };
    document.addEventListener("input", onContentEditableInput, true);

    // ── dblclick ─────────────────────────────────────────────────────────────
    const onDblClick = (event) => {
      let target = event.target;
      if (!(target instanceof Element) || target.closest("#webmatic-panel-root") || target.closest("#webmatic-floating-recorder-global") || target.closest("#webmatic-floating-player-global")) return;
      const tagDbl = target.tagName.toLowerCase();
      if (tagDbl === "img" || (tagDbl === "input" && target.type === "image" && !target.id)) {
        const anchor = target.closest("a[href]");
        if (anchor) target = anchor;
      }
      flashElement(target);
      captureStep({ type: "dblclick", selector: buildSelector(target) });
    };
    document.addEventListener("dblclick", onDblClick, true);

    // ── hover: solo graba si el hover despliega contenido nuevo (dropdown/menu/tooltip) ─
    let _hoverEl   = null;
    let _hoverObs  = null;
    let _hoverSeen = false;
    const onMouseOver = (event) => {
      const t = event.target;
      if (!(t instanceof Element)) return;
      if (t === _hoverEl) return;
      if (t.closest("#webmatic-panel-root") || t.closest("#webmatic-floating-recorder-global") || t.closest("#webmatic-floating-player-global")) return;
      clearTimeout(recorderRuntime._hoverTimer);
      if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
      _hoverSeen = false;
      _hoverEl = t;
      try {
        const _root = document.body || document.documentElement;
        _hoverObs = new MutationObserver((muts) => {
          if (_hoverSeen) return;
          for (const m of muts) {
            if (m.type === "childList") {
              for (const n of m.addedNodes) {
                if (n instanceof Element && n.offsetWidth > 0 && n.offsetHeight > 0) { _hoverSeen = true; return; }
              }
            } else if (m.attributeName === "aria-expanded" && m.target.getAttribute("aria-expanded") === "true") {
              _hoverSeen = true; return;
            }
          }
        });
        _hoverObs.observe(_root, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
      } catch (_) {}
      recorderRuntime._hoverTimer = setTimeout(() => {
        if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
        if (_hoverEl !== t || !_hoverSeen) return;
        flashElement(t);
        captureStep({ type: "hover", selector: buildSelector(t) });
      }, 800);
    };
    document.addEventListener("mouseover", onMouseOver, true);

    // ── scroll_to: solo graba si ocurre en un contenedor emergente (dropdown/listbox/menu) ─
    function _isMenuScroll(el) {
      if (!(el instanceof Element)) return false;
      if (el.tagName.toLowerCase() === "select") return true;
      const role = (el.getAttribute("role") || "").toLowerCase();
      if (["listbox","menu","menubar","tree","combobox","grid","treegrid"].includes(role)) return true;
      if (el.closest("[role='listbox'],[role='menu'],[role='combobox'],[role='tree']")) return true;
      try {
        const cs = window.getComputedStyle(el);
        const pos = cs.position; const ov = cs.overflowY;
        if ((pos === "absolute" || pos === "fixed") && (ov === "auto" || ov === "scroll")) return true;
      } catch (_) {}
      return false;
    }
    const onScroll = (e) => {
      const scrollEl = e.target instanceof Element ? e.target : null;
      if (!scrollEl || !_isMenuScroll(scrollEl)) return;
      if (scrollEl.closest("#webmatic-panel-root") || scrollEl.closest("#webmatic-floating-recorder-global") || scrollEl.closest("#webmatic-floating-player-global")) return;
      clearTimeout(recorderRuntime._scrollTimer);
      recorderRuntime._scrollTimer = setTimeout(() => {
        captureStep({ type: "scroll_to", selector: buildSelector(scrollEl) });
      }, 900);
    };
    document.addEventListener("scroll", onScroll, true);

    // ── SPA navigation: patch history API to capture pushState/replaceState ──
    const _origPushState    = history.pushState.bind(history);
    const _origReplaceState = history.replaceState.bind(history);
    const _captureSpaNav = (rawUrl) => {
      try {
        const url = new URL(String(rawUrl || ""), window.location.href).href;
        const st  = store.getState().draft.steps;
        const last = st[st.length - 1];
        if (!last || last.type !== "navigate" || last.url !== url) {
          captureStep({ type: "navigate", url });
        }
      } catch (e) { /* malformed URL — skip */ }
    };
    history.pushState = function(state, title, url) {
      _origPushState(state, title, url);
      if (url != null) _captureSpaNav(url);
    };
    history.replaceState = function(state, title, url) {
      _origReplaceState(state, title, url);
      if (url != null) _captureSpaNav(url);
    };
    const _onPopState = () => _captureSpaNav(window.location.href);
    window.addEventListener("popstate", _onPopState);

    recorderRuntime.cleanup = () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("keydown", onKeydown, true);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("input", onContentEditableInput, true);
      document.removeEventListener("dblclick", onDblClick, true);
      document.removeEventListener("mouseover", onMouseOver, true);
      window.removeEventListener("scroll", onScroll, true);
      history.pushState    = _origPushState;
      history.replaceState = _origReplaceState;
      window.removeEventListener("popstate", _onPopState);
      clearTimeout(recorderRuntime._ceTimer);
      clearTimeout(recorderRuntime._hoverTimer);
      clearTimeout(recorderRuntime._scrollTimer);
      recorderRuntime.lastCopiedText = null;
      recorderRuntime.lastCopiedVar  = null;
      recorderRuntime._ceTimer       = null;
      recorderRuntime._hoverTimer    = null;
      recorderRuntime._scrollTimer   = null;
      recorderRuntime.cleanup        = null;
    };
  }

  function stopRecorderSession() {
    if (recorderRuntime.cleanup) {
      recorderRuntime.cleanup();
    }
  }

  const INLINE_REC_PANEL_ID = "webmatic-inline-rec-panel";

  /**
   * Starts a lightweight recording session isolated from the main draft.
   * Captures events into a local buffer and calls onDone(filteredSteps) when stopped.
   * Shows a small floating panel to stop the recording.
   */
  function startInlineRecording(onDone) {
    // Remove any leftover panel
    const oldPanel = document.getElementById(INLINE_REC_PANEL_ID);
    if (oldPanel && oldPanel.parentNode) oldPanel.parentNode.removeChild(oldPanel);

    // Ocultar el panel para liberar la página durante la grabación
    const _wasVisible = store.getState().ui.panelVisible;
    if (_wasVisible) {
      store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
    }

    const buffer = [];
    let _ceTimer = null;
    let _hoverEl = null, _hoverObs = null, _hoverSeen = false, _hoverTimer = null;
    let _scrollTimer = null;
    let lastCopiedText = null, lastCopiedVar = null, varCounter = 0;

    function addStep(step) {
      buffer.push(Object.assign({ _ts: Date.now() }, step));
      // Update count in panel
      const countEl = document.getElementById(INLINE_REC_PANEL_ID + "-count");
      if (countEl) countEl.textContent = buffer.length + (buffer.length === 1 ? " paso" : " pasos");
    }

    // ── Event handlers (same logic as startRecorderSession but writing to buffer) ──
    const _onClick = (e) => {
      let t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID) ||
          t.closest("#webmatic-floating-recorder-global") || t.closest("#webmatic-floating-player-global")) return;
      const tag = t.tagName.toLowerCase();
      if (tag === "img" || (tag === "input" && t.type === "image" && !t.id)) {
        const anchor = t.closest("a[href]"); if (anchor) t = anchor;
      }
      flashElement(t);
      addStep({ type: "click", selector: buildSelector(t) });
    };

    const _onChange = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement) && !(t instanceof HTMLSelectElement)) return;
      if (t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID)) return;
      if (t.readOnly || t.disabled) return;
      flashElement(t);
      if (t instanceof HTMLInputElement && t.type === "checkbox") { addStep({ type: "check", selector: buildSelector(t), checked: t.checked }); return; }
      if (t instanceof HTMLInputElement && t.type === "radio")    { addStep({ type: "check", selector: buildSelector(t), checked: true }); return; }
      const raw = t.value;
      const val = (lastCopiedText !== null && lastCopiedVar !== null && raw.trim() === lastCopiedText)
        ? `{{!${lastCopiedVar}}}` : raw;
      addStep({ type: "input", selector: buildSelector(t), value: val });
    };

    const _onKeydown = (e) => {
      const t = e.target;
      if (t instanceof Element && (t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID))) return;
      if (["Enter", "Tab", "Escape"].includes(e.key)) {
        if (t instanceof Element) flashElement(t);
        addStep({ type: "key", key: e.key }); return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        const sel = t instanceof Element ? buildSelector(t) : "";
        const last = buffer[buffer.length - 1];
        if (last && last.type === "text" && last.selector === sel) {
          last.value = (last.value || "") + e.key; // merge text
          const countEl = document.getElementById(INLINE_REC_PANEL_ID + "-count");
          if (countEl) countEl.textContent = buffer.length + (buffer.length === 1 ? " paso" : " pasos");
        } else {
          addStep({ type: "text", selector: sel, value: e.key });
        }
      }
    };

    const _onDblClick = (e) => {
      let t = e.target;
      if (!(t instanceof Element) || t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID)) return;
      const tag = t.tagName.toLowerCase();
      if (tag === "img" || (tag === "input" && t.type === "image" && !t.id)) {
        const anchor = t.closest("a[href]"); if (anchor) t = anchor;
      }
      flashElement(t); addStep({ type: "dblclick", selector: buildSelector(t) });
    };

    const _onCopy = (e) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const txt = sel.toString().trim(); if (!txt) return;
      const INLINE = /^(A|ABBR|B|CITE|CODE|EM|I|KBD|MARK|Q|S|SAMP|SMALL|SPAN|STRONG|SUB|SUP|U|VAR)$/;
      const BLOCK  = /^(TD|TH|LI|P|DIV|BLOCKQUOTE|PRE|H[1-6]|DT|DD|ARTICLE|SECTION|ASIDE|HEADER|FOOTER|MAIN)$/;
      const BAD    = /^(TABLE|TBODY|THEAD|TFOOT|TR|UL|OL|DL|FORM|BODY|HTML)$/;
      let el = sel.anchorNode && sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : sel.anchorNode;
      while (el && el.tagName) {
        const tag = el.tagName.toUpperCase();
        if (BAD.test(tag)) { el = null; break; }
        if (BLOCK.test(tag) || !INLINE.test(tag)) break;
        el = el.parentElement;
      }
      if (!el || !(el instanceof Element) || el.closest("#webmatic-panel-root")) return;
      varCounter++; const vn = `VAR${varCounter}`;
      lastCopiedText = txt; lastCopiedVar = vn;
      flashElement(el); addStep({ type: "extract", selector: buildSelector(el), variable: vn });
    };

    const _onCeInput = (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.isContentEditable) return;
      if (t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID)) return;
      clearTimeout(_ceTimer);
      _ceTimer = setTimeout(() => {
        const val = (t.innerText || t.textContent || "").trim();
        flashElement(t); addStep({ type: "input", selector: buildSelector(t), value: val });
      }, 400);
    };

    const _onMouseOver = (e) => {
      const t = e.target;
      if (!(t instanceof Element) || t === _hoverEl) return;
      if (t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID)) return;
      clearTimeout(_hoverTimer);
      if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
      _hoverSeen = false; _hoverEl = t;
      try {
        _hoverObs = new MutationObserver((muts) => {
          if (_hoverSeen) return;
          for (const m of muts) {
            if (m.type === "childList") {
              for (const n of m.addedNodes) {
                if (n instanceof Element && n.offsetWidth > 0 && n.offsetHeight > 0) { _hoverSeen = true; return; }
              }
            } else if (m.attributeName === "aria-expanded" && m.target.getAttribute("aria-expanded") === "true") {
              _hoverSeen = true; return;
            }
          }
        });
        _hoverObs.observe(document.body || document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
      } catch (_) {}
      _hoverTimer = setTimeout(() => {
        if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
        if (_hoverEl !== t || !_hoverSeen) return;
        flashElement(t); addStep({ type: "hover", selector: buildSelector(t) });
      }, 800);
    };

    const _onScroll = (e) => {
      const scrollEl = e.target instanceof Element ? e.target : null;
      if (!scrollEl) return;
      const role = (scrollEl.getAttribute("role") || "").toLowerCase();
      const isMenu = scrollEl.tagName.toLowerCase() === "select" ||
        ["listbox","menu","combobox","tree"].includes(role) ||
        scrollEl.closest("[role='listbox'],[role='menu'],[role='combobox'],[role='tree']");
      if (!isMenu) return;
      if (scrollEl.closest("#webmatic-panel-root") || scrollEl.closest("#" + INLINE_REC_PANEL_ID)) return;
      clearTimeout(_scrollTimer);
      _scrollTimer = setTimeout(() => { addStep({ type: "scroll_to", selector: buildSelector(scrollEl) }); }, 900);
    };

    document.addEventListener("click",     _onClick,    true);
    document.addEventListener("change",    _onChange,   true);
    document.addEventListener("keydown",   _onKeydown,  true);
    document.addEventListener("dblclick",  _onDblClick, true);
    document.addEventListener("copy",      _onCopy,     true);
    document.addEventListener("input",     _onCeInput,  true);
    document.addEventListener("mouseover", _onMouseOver,true);
    document.addEventListener("scroll",    _onScroll,   true);

    // ── Cleanup ──
    function _cleanup() {
      document.removeEventListener("click",     _onClick,    true);
      document.removeEventListener("change",    _onChange,   true);
      document.removeEventListener("keydown",   _onKeydown,  true);
      document.removeEventListener("dblclick",  _onDblClick, true);
      document.removeEventListener("copy",      _onCopy,     true);
      document.removeEventListener("input",     _onCeInput,  true);
      document.removeEventListener("mouseover", _onMouseOver,true);
      document.removeEventListener("scroll",    _onScroll,   true);
      clearTimeout(_ceTimer); clearTimeout(_hoverTimer); clearTimeout(_scrollTimer);
      if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
      const p = document.getElementById(INLINE_REC_PANEL_ID);
      if (p && p.parentNode) p.parentNode.removeChild(p);
    }

    function _stop() {
      _cleanup();
      // Restaurar el panel si estaba visible antes de grabar
      if (_wasVisible && !store.getState().ui.panelVisible) {
        store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
      }
      const filtered = _cleanupSteps(buffer);
      if (typeof onDone === "function") onDone(filtered);
    }

    // ── Floating stop panel ──
    const panel = document.createElement("div");
    panel.id = INLINE_REC_PANEL_ID;
    panel.style.cssText = [
      "all:initial", "position:fixed", "bottom:16px", "right:16px", "z-index:2147483647",
      "display:flex", "align-items:center", "gap:8px",
      "background:rgba(239,68,68,0.95)", "color:#fff",
      "border-radius:10px", "padding:10px 14px",
      "font-family:system-ui,sans-serif", "font-size:13px", "font-weight:600",
      "box-shadow:0 4px 20px rgba(239,68,68,0.4)",
      "cursor:default", "user-select:none"
    ].join(";");

    if (!document.getElementById("webmatic-floating-keyframes")) {
      const style = document.createElement("style");
      style.id = "webmatic-floating-keyframes";
      style.textContent = "@keyframes webmatic-pulse{0%,100%{opacity:1}50%{opacity:0.35}}";
      document.head.appendChild(style);
    }

    const dot = document.createElement("span");
    dot.style.cssText = "display:inline-block;width:10px;height:10px;border-radius:50%;background:#fff;animation:webmatic-pulse 0.8s infinite;flex-shrink:0";
    panel.appendChild(dot);

    const lbl = document.createElement("span");
    lbl.textContent = "Grabando pasos nuevos";
    panel.appendChild(lbl);

    const countEl = document.createElement("span");
    countEl.id = INLINE_REC_PANEL_ID + "-count";
    countEl.style.cssText = "font-size:11px;opacity:0.85;margin-left:2px";
    countEl.textContent = "0 pasos";
    panel.appendChild(countEl);

    const stopBtn = document.createElement("button");
    stopBtn.style.cssText = [
      "all:initial", "display:inline-flex", "align-items:center", "gap:4px",
      "background:#fff", "color:#dc2626", "border-radius:6px",
      "padding:4px 10px", "font-size:12px", "font-weight:700",
      "font-family:system-ui,sans-serif", "cursor:pointer",
      "margin-left:6px", "white-space:nowrap"
    ].join(";");
    stopBtn.textContent = "⏹ Detener";
    stopBtn.title = "Detener grabaci\u00f3n e insertar pasos en el editor";
    stopBtn.addEventListener("click", (e) => { e.stopPropagation(); _stop(); });
    panel.appendChild(stopBtn);

    document.documentElement.appendChild(panel);
  }

  /**
   * Cleans up recorded steps before saving:
   * 1. Removes "focus clicks" — CLICK(X) immediately before TYPE/CHECK(X) on same selector
   * 2. Removes clicks on <option> elements (handled by direct SELECT value setting)
   * 3. Removes "defocus clicks" — clicks on body/html (used to close autocomplete dropdowns)
   * 4. Deduplicates TYPE/CHECK steps per selector — keeps only the last value
   *    (handles both "input" steps from blur/change and "text" steps from keypresses)
   */
  function _cleanupSteps(steps) {
    const isTypeLike = (t) => t === "input" || t === "text";

    // Pass 0: remove single click steps that are precursors of a dblclick
    // (double-click fires: click → click → dblclick; keep only the dblclick)
    const hasDblClick = steps.some((s) => s.type === "dblclick");
    const pass0 = hasDblClick ? (() => {
      const out = [];
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        if (s.type === "click" && s.selector) {
          let isDblPrecursor = false;
          for (let k = i + 1; k <= Math.min(i + 2, steps.length - 1); k++) {
            if (steps[k].type === "dblclick" && steps[k].selector === s.selector) {
              isDblPrecursor = true;
              break;
            }
          }
          if (isDblPrecursor) continue;
        }
        out.push(s);
      }
      return out;
    })() : steps;

    // Pass 1: remove focus/defocus/option clicks
    const pass1 = pass0.filter((step, i) => {
      if (step.type !== "click") return true;
      // Remove clicks on <option> — SELECT value is set directly via TYPE
      if (step.selector && /^option[\[.]/i.test(step.selector)) return false;
      // Remove defocus clicks on body/html — used to close autocomplete popups
      if (step.selector && /^(body|html)[\s.#[\]$]?/i.test(step.selector)) return false;
      // Remove focus click: CLICK(X) before TYPE/CHECK(X) on same selector,
      // even if separated by WAIT steps
      for (let j = i + 1; j < steps.length; j++) {
        const nx = steps[j];
        if (nx.type === "wait") continue; // skip auto-generated waits
        if ((isTypeLike(nx.type) || nx.type === "check") &&
            nx.selector && nx.selector === step.selector) return false;
        break; // first non-wait step doesn't match — keep the click
      }
      return true;
    });

    // Pass 2: keep only last TYPE/CHECK per selector
    const lastIdx = new Map();
    pass1.forEach((step, i) => {
      if ((isTypeLike(step.type) || step.type === "check") && step.selector) {
        lastIdx.set(step.selector, i);
      }
    });
    const pass2 = pass1.filter((step, i) => {
      if ((isTypeLike(step.type) || step.type === "check") && step.selector) {
        return lastIdx.get(step.selector) === i;
      }
      return true;
    });

    // Pass 3: deduplicate consecutive hover / scroll_to steps on the same selector
    // (mouse-over and scroll events fire rapidly; keep the last occurrence in each run)
    const _dedupHoverScroll = new Set(["hover", "scroll_to"]);
    const pass3 = pass2.filter((step, i, arr) => {
      if (!_dedupHoverScroll.has(step.type) || !step.selector) return true;
      // Remove if a later step with the same type+selector appears before any
      // non-wait step of a different type or different selector
      for (let j = i + 1; j < arr.length; j++) {
        const nx = arr[j];
        if (nx.type === "wait") continue;
        if (nx.type === step.type && nx.selector === step.selector) return false; // later dup exists
        break;
      }
      return true;
    });

    // Pass 4: auto-inject wait_for after navigate steps
    // Inserts wait_for for the first selector-bearing step after each navigate,
    // making macros robust on full page loads and SPA transitions.
    const pass4 = [];
    for (let i = 0; i < pass3.length; i++) {
      pass4.push(pass3[i]);
      if (pass3[i].type === "navigate") {
        const nextStep = pass3[i + 1];
        // Skip if already followed by a wait/wait_for
        if (nextStep && nextStep.type !== "wait" && nextStep.type !== "wait_for") {
          for (let j = i + 1; j < pass3.length; j++) {
            if (pass3[j].type === "wait" || pass3[j].type === "navigate") continue;
            if (pass3[j].selector) {
              pass4.push({ type: "wait_for", selector: pass3[j].selector, timeout: 10000 });
            }
            break;
          }
        }
      }
    }
    // Pass 4b: auto-inject wait_for after click steps that open modals/dialogs
    // When a click is followed by check/input on a DIFFERENT selector, the click
    // likely opened new content (modal, panel, dynamic form). Inject wait_for so
    // the macro waits for that element to appear instead of failing on timing.
    const pass4b = [];
    for (let i = 0; i < pass4.length; i++) {
      pass4b.push(pass4[i]);
      const cur = pass4[i];
      if (cur.type === "click" && cur.selector) {
        // Find next non-wait step
        let nextStep = null;
        for (let j = i + 1; j < pass4.length; j++) {
          if (pass4[j].type === "wait" || pass4[j].type === "wait_for") continue;
          nextStep = pass4[j];
          break;
        }
        // Inject wait_for if: next step is check/input on a DIFFERENT selector
        // AND not already followed immediately by a wait_for
        if (
          nextStep &&
          (nextStep.type === "check" || nextStep.type === "input") &&
          nextStep.selector &&
          nextStep.selector !== cur.selector
        ) {
          const immNext = pass4[i + 1];
          if (!immNext || immNext.type !== "wait_for") {
            pass4b.push({ type: "wait_for", selector: nextStep.selector, timeout: 10000 });
          }
        }
      }
    }

    // Pass 5: deduplicate consecutive navigate steps with the same URL
    // (SPA nav patch or manual re-triggers can emit duplicate navigates)
    const pass5 = pass4b.filter((step, i, arr) => {
      if (step.type !== "navigate" || !step.url) return true;
      // Remove if the immediately preceding non-wait step is also a navigate to the same URL
      for (let j = i - 1; j >= 0; j--) {
        if (arr[j].type === "wait") continue;
        return !(arr[j].type === "navigate" && arr[j].url === step.url);
      }
      return true;
    });
    return pass5;
  }

  /**
   * Recursively resolves call_macro.steps by looking up macro_name in the library.
   * Also descends into nested sub-step arrays (steps/then/else/fallback) so that
   * call_macro references inside if_exists, loop_until, etc. are resolved too.
   * Depth guard prevents infinite loops from circular macro references (max 8 levels).
   */
  function _resolveCallMacros(steps, macros, _depth) {
    if (!Array.isArray(steps)) return steps;
    if ((_depth || 0) > 8) return steps;
    return steps.map((step) => {
      const d = (_depth || 0) + 1;
      if (step.type === "call_macro") {
        const ref = macros.find((m) => m.name === step.macro_name);
        if (ref && Array.isArray(ref.steps) && ref.steps.length > 0) {
          return { ...step, steps: _resolveCallMacros(ref.steps, macros, d) };
        }
        return step;
      }
      const resolved = { ...step };
      if (Array.isArray(step.steps))    resolved.steps    = _resolveCallMacros(step.steps, macros, d);
      if (Array.isArray(step.then))     resolved.then     = _resolveCallMacros(step.then, macros, d);
      if (Array.isArray(step.else))     resolved.else     = _resolveCallMacros(step.else, macros, d);
      if (Array.isArray(step.fallback)) resolved.fallback = _resolveCallMacros(step.fallback, macros, d);
      return resolved;
    });
  }

  /**
   * Scans all form fields on the current page and returns steps for those
   * whose selectors are not already present in capturedSelectors.
   * Includes fields with default/empty values so the script is complete.
   */
  function capturePageDefaults(capturedSelectors) {
    const RecorderClass = globalScope.WebMaticRecorder;
    const seen = new Set(capturedSelectors);
    const extraSteps = [];

    const fields = Array.from(document.querySelectorAll("input, select, textarea"));
    for (const el of fields) {
      // Skip hidden, submit, button, image, file, reset inputs
      const tag = el.tagName.toLowerCase();
      const type = (el.type || "").toLowerCase();
      if (type === "submit" || type === "button" || type === "image" ||
          type === "file" || type === "reset" || type === "hidden") continue;
      // Skip invisible elements
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      // Skip our own panel elements
      if (el.closest("#webmatic-panel-root")) continue;
      // Skip readonly/disabled
      if (el.readOnly || el.disabled) continue;

      const sel = RecorderClass ? RecorderClass.buildSelector(el) : (el.id ? `#${el.id}` : "");
      if (!sel || seen.has(sel)) continue;
      seen.add(sel);

      if (tag === "select") {
        extraSteps.push({ type: "input", selector: sel, value: el.value, _fast: true });
      } else if (type === "checkbox") {
        extraSteps.push({ type: "check", selector: sel, checked: el.checked, _fast: true });
      } else if (type === "radio") {
        if (el.checked) extraSteps.push({ type: "check", selector: sel, checked: true, _fast: true });
      } else {
        extraSteps.push({ type: "input", selector: sel, value: el.value || "", _fast: true });
      }
    }
    return extraSteps;
  }

  function addWaitHere() {
    const currentState = store.getState();
    const stepIdx = currentState.playback.currentStepIndex;
    const macroId = currentState.library.selectedMacroId;
    const macro = currentState.library.macros.find((m) => m.id === macroId);
    if (!macro || stepIdx < 0) return;
    const steps = [...macro.steps];
    if (stepIdx > 0 && steps[stepIdx - 1].type === "wait") {
      steps[stepIdx - 1] = { ...steps[stepIdx - 1], seconds: steps[stepIdx - 1].seconds + 1 };
    } else {
      steps.splice(stepIdx, 0, { type: "wait", seconds: 1 });
    }
    const updatedMacro = { ...macro, steps };
    const updatedMacros = currentState.library.macros.map((m) => m.id === macroId ? updatedMacro : m);
    store.dispatch({ type: contracts.ActionTypes.LIBRARY_LOADED, payload: updatedMacros });
    store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `+1s agregado antes del paso ${stepIdx + 1}` });
    chrome.storage.local.set({ webmaticMacros: updatedMacros });
  }

  uiShell.unmount();
  uiShell.mount();
  uiShell.bindModeEvents(
    (mode) => {
      store.dispatch({ type: contracts.ActionTypes.MODE_SET, payload: mode });
    },
    async (actionId, meta) => {

      if (actionId === "record-toggle") {
        const currentState = store.getState();
        if (currentState.recorder.isRecording) {
          stopRecorderSession();
          removeFloatingBtn();
          chrome.runtime.sendMessage({ type: "RECORDING_STATE", active: false }, () => { void chrome.runtime.lastError; });
          store.dispatch({ type: contracts.ActionTypes.RECORD_STOPPED });
          const afterStop = store.getState();
          if (afterStop.draft.steps.length > 0 && iimAdapter) {
            const utils = globalScope.WebMaticUtils;
            const threshold = (afterStop.settings && afterStop.settings.waitThreshold) || 3;
            const recorded = afterStop.draft.steps;
            const navigateSteps = recorded.filter((s) => s.type === "navigate");
            const interactions = recorded.filter((s) => s.type !== "navigate");
            const allSteps = _cleanupSteps([...navigateSteps, ...interactions]);
            const processedSteps = utils ? utils.injectWaitSteps(allSteps, threshold * 1000) : allSteps;
            const script = iimAdapter.exportToIim({ steps: processedSteps });
            store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_OPENED, payload: { script, macroId: null, draftSteps: processedSteps } });
          }
        } else {
          store.dispatch({ type: contracts.ActionTypes.RECORD_STARTED });
          startRecorderSession();
          createFloatingBtn(() => {
            stopRecorderSession();
            removeFloatingBtn();
            chrome.runtime.sendMessage({ type: "RECORDING_STATE", active: false }, () => { void chrome.runtime.lastError; });
            store.dispatch({ type: contracts.ActionTypes.RECORD_STOPPED });
            const afterStop = store.getState();
            if (afterStop.draft.steps.length > 0 && iimAdapter) {
              const utils = globalScope.WebMaticUtils;
              const threshold = (afterStop.settings && afterStop.settings.waitThreshold) || 3;
              const recorded = afterStop.draft.steps;
              const navigateSteps = recorded.filter((s) => s.type === "navigate");
              const interactions = recorded.filter((s) => s.type !== "navigate");
              const allSteps = _cleanupSteps([...navigateSteps, ...interactions]);
              const processedSteps = utils ? utils.injectWaitSteps(allSteps, threshold * 1000) : allSteps;
              const script = iimAdapter.exportToIim({ steps: processedSteps });
              store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_OPENED, payload: { script, macroId: null, draftSteps: processedSteps } });
            }
          });
          chrome.runtime.sendMessage({ type: "RECORDING_STATE", active: true }, () => { void chrome.runtime.lastError; });
        }
      }

      if (actionId === "play-start") {
        store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
      }

      if (actionId === "play-stop") {
        if (playerRuntime.activePlayer) {
          playerRuntime.activePlayer.stop();
          playerRuntime.activePlayer = null;
        }
        store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
      }

      if (actionId === "close-panel") {
        const currentState = store.getState();
        if (currentState.ui.panelVisible) {
          store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
        }
      }

      if (actionId === "help") {
        const _hs = store.getState().settings;
        chrome.runtime.sendMessage({
          type: "OPEN_HELP_PAGE",
          themeMode: _hs.themeMode || "light",
          themeVariant: _hs.themeVariant || 1
        });
      }

      if (actionId === "settings-side-left") {
        store.dispatch({ type: contracts.ActionTypes.PANEL_SIDE_SET, payload: "left" });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Vista izquierda aplicada" });
        settingsApi.saveSettings({ panelSide: "left", panelWidth: 260 });
      }

      if (actionId === "settings-side-right") {
        store.dispatch({ type: contracts.ActionTypes.PANEL_SIDE_SET, payload: "right" });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Vista derecha aplicada" });
        settingsApi.saveSettings({ panelSide: "right", panelWidth: 260 });
      }

      if (actionId === "settings-theme-mode") {
        const nextMode = meta?.checked ? "dark" : "light";
        const current = store.getState().settings;
        const nextVariant = current.themeVariant;
        const themeSettings = resolveTheme(nextMode, nextVariant);
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: themeSettings });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Tema ${nextMode === "dark" ? "oscuro" : "claro"} aplicado` });
        settingsApi.saveSettings({ panelWidth: 260, panelSide: store.getState().ui.panelSide, ...themeSettings });
      }

      if (actionId === "settings-theme-variant") {
        const variant = Number(meta?.variant || 1);
        const current = store.getState().settings;
        const themeSettings = resolveTheme(current.themeMode, variant);
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: themeSettings });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Variante ${themeSettings.themeVariant} aplicada` });
        settingsApi.saveSettings({ panelWidth: 260, panelSide: store.getState().ui.panelSide, ...themeSettings });
      }

      if (actionId === "settings-speed") {
        const raw = parseFloat(meta?.value ?? 1);
        const speed = Math.min(3, Math.max(0.5, isNaN(raw) ? 1 : raw));
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { speed } });
        settingsApi.saveSettings({ speed });
      }

      if (actionId === "settings-opacity") {
        const raw = parseFloat(meta?.value ?? 1);
        const panelOpacity = Math.min(1, Math.max(0.7, isNaN(raw) ? 1 : raw));
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { panelOpacity } });
        settingsApi.saveSettings({ panelOpacity });
      }

      if (actionId === "settings-wait-threshold") {
        const raw = parseFloat(meta?.value ?? 3);
        const waitThreshold = Math.min(10, Math.max(1, isNaN(raw) ? 3 : raw));
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { waitThreshold } });
        settingsApi.saveSettings({ waitThreshold });
      }

      if (actionId === "folder-pick") {
        chrome.runtime.sendMessage({ type: "OPEN_OPTIONS_PAGE" }, () => { void chrome.runtime.lastError; });
      }

      if (actionId === "library-search") {
        const query = String(meta?.value || "");
        store.dispatch({ type: contracts.ActionTypes.LIBRARY_FILTERED, payload: query });
        const macros = store.getState().library.macros;
        const filtered = filterMacros(macros, query);
        if (filtered.length === 1) {
          store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: filtered[0].id });
        } else {
          store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: null });
        }
      }

      if (actionId === "library-select") {
        store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: meta?.value || null });
      }

      if (actionId === "loop-toggle") {
        store.dispatch({ type: contracts.ActionTypes.PLAYBACK_LOOP_TOGGLED });
      }

      if (actionId === "repeat-count") {
        store.dispatch({ type: contracts.ActionTypes.PLAYBACK_REPEAT_SET, payload: Number(meta?.value || 5) });
      }

      if (actionId === "macro-duplicate") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro) return;
        const copyName = macro.name + " (copia)";
        const copySteps = macro.steps ? JSON.parse(JSON.stringify(macro.steps)) : [];
        const copyScript = iimAdapter ? iimAdapter.exportToIim({ steps: copySteps }) : (macro.script || "");
        const copy = {
          id: `macro_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          name: copyName,
          steps: copySteps,
          script: copyScript,
          createdAt: Date.now()
        };
        store.dispatch({ type: contracts.ActionTypes.MACRO_SAVED, payload: copy });
        store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: copy.id });
        chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Macro duplicada: "${copyName}"` });
      }

      if (actionId === "add-wait-here") {
        addWaitHere();
        return;
      }

      if (actionId === "macro-play") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro) return;
        function _startMacroPlay() {
          const _state = store.getState();
          const _macro = _state.library.macros.find((m) => m.id === selectedId);
          if (!_macro) return;
          if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
          store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Reproduciendo "${_macro.name}"` });
          const _PlayerClass = globalScope.WebMaticPlayer;
          if (!_PlayerClass || !Array.isArray(_macro.steps) || _macro.steps.length === 0) return;
          const _player = new _PlayerClass();
          playerRuntime.activePlayer = _player;
          // Initialize panel with all steps before starting (call_macro references resolved)
          const _resolvedSteps = _resolveCallMacros(_macro.steps, _state.library.macros);
          store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: 0, steps: _resolvedSteps } });
          _player.play(_resolvedSteps, {
            speed: _state.settings.speed ?? 1,
            macroId: _macro.id,
            onStep: (step, index) => {
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: _resolvedSteps } });
            },
            onDone: () => {
              playerRuntime.activePlayer = null;
              // Mark all steps done, then stop
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: _resolvedSteps.length, steps: _resolvedSteps } });
              store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
              store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Reproduccion completada" });
            },
            onError: (err) => {
              playerRuntime.activePlayer = null;
              const errIdx = store.getState().playback.currentStepIndex;
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
              store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Error: ${err.message}` });
            }
          });
        }
        createPlaybackFloating(
          () => {
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
          },
          () => addWaitHere(),
          () => { _startMacroPlay(); },
          () => {
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
            removePlaybackFloating();
          },
          (n) => {
            // Repetir N veces desde el flotante
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            const _fbState = store.getState();
            const _fbMacro = _fbState.library.macros.find((m) => m.id === selectedId);
            if (!_fbMacro) return;
            store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
            store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Bucle x${n}: "${_fbMacro.name}"` });
            const _fbPlayer = new (globalScope.WebMaticPlayer)();
            playerRuntime.activePlayer = _fbPlayer;
            let _fbIter = 0;
            const _fbResolved = _resolveCallMacros(_fbMacro.steps, _fbState.library.macros);
            store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: 0, steps: _fbResolved } });
            function _fbNext() {
              if (_fbIter >= n || _fbPlayer._abort) {
                playerRuntime.activePlayer = null;
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: _fbResolved.length, steps: _fbResolved } });
                store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
                return;
              }
              _fbIter++;
              _fbPlayer._abort = false;
              _fbPlayer.play(_fbResolved, {
                speed: _fbState.settings.speed ?? 1,
                macroId: _fbMacro.id,
                onStep: (step, index) => { store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: _fbResolved } }); },
                onDone: _fbNext,
                onError: (err) => {
                  playerRuntime.activePlayer = null;
                  const errIdx = store.getState().playback.currentStepIndex;
                  store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
                }
              });
            }
            _fbNext();
          }
        );
        _startMacroPlay();
      }

      if (actionId === "macro-play-loop") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro) return;
        function _startLoopPlay() {
          const _lstate = store.getState();
          const _lmacro = _lstate.library.macros.find((m) => m.id === selectedId);
          if (!_lmacro) return;
          if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
          const _lCount = _lstate.playback.repeatCount;
          store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Reproduciendo "${_lmacro.name}" en bucle x${_lCount}` });
          const _LPlayerClass = globalScope.WebMaticPlayer;
          if (!_LPlayerClass || !Array.isArray(_lmacro.steps) || _lmacro.steps.length === 0) return;
          const _lPlayer = new _LPlayerClass();
          playerRuntime.activePlayer = _lPlayer;
          let _lIter = 0;
          // Initialize panel with all steps before starting (call_macro references resolved)
          const _lResolvedSteps = _resolveCallMacros(_lmacro.steps, _lstate.library.macros);
          store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: 0, steps: _lResolvedSteps } });
          function _lNext() {
            if (_lIter >= _lCount || _lPlayer._abort) {
              playerRuntime.activePlayer = null;
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: _lResolvedSteps.length, steps: _lResolvedSteps } });
              store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
              return;
            }
            _lIter++;
            _lPlayer._abort = false;
            _lPlayer.play(_lResolvedSteps, {
              speed: _lstate.settings.speed ?? 1,
              macroId: _lmacro.id,
              onStep: (step, index) => {
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: _lResolvedSteps } });
              },
              onDone: _lNext,
              onError: (err) => {
                playerRuntime.activePlayer = null;
                const errIdx = store.getState().playback.currentStepIndex;
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
                store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Error: ${err.message}` });
              }
            });
          }
          _lNext();
        }
        function _startLoopPlayN(n) {
          const _lnstate = store.getState();
          const _lnmacro = _lnstate.library.macros.find((m) => m.id === selectedId);
          if (!_lnmacro) return;
          if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
          store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Bucle x${n}: "${_lnmacro.name}"` });
          const _lnPlayer = new (globalScope.WebMaticPlayer)();
          playerRuntime.activePlayer = _lnPlayer;
          let _lnIter = 0;
          const _lnResolved = _resolveCallMacros(_lnmacro.steps, _lnstate.library.macros);
          store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: 0, steps: _lnResolved } });
          function _lnNext() {
            if (_lnIter >= n || _lnPlayer._abort) {
              playerRuntime.activePlayer = null;
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: _lnResolved.length, steps: _lnResolved } });
              store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
              return;
            }
            _lnIter++;
            _lnPlayer._abort = false;
            _lnPlayer.play(_lnResolved, {
              speed: _lnstate.settings.speed ?? 1,
              macroId: _lnmacro.id,
              onStep: (step, index) => { store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: _lnResolved } }); },
              onDone: _lnNext,
              onError: (err) => {
                playerRuntime.activePlayer = null;
                const errIdx = store.getState().playback.currentStepIndex;
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
              }
            });
          }
          _lnNext();
        }
        createPlaybackFloating(
          () => {
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
          },
          () => addWaitHere(),
          () => { _startLoopPlay(); },
          () => {
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
            removePlaybackFloating();
          },
          (n) => { _startLoopPlayN(n); }
        );
        _startLoopPlay();
      }

      if (actionId === "macro-edit") {
        const currentState = store.getState();
        const editId = meta?.macroId || currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === editId);
        if (!macro || !iimAdapter) return;
        const script = macro.script || iimAdapter.exportToIim(macro);
        store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_OPENED, payload: { script, macroId: macro.id } });
      }

      if (actionId === "script-editor-close") {
        store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_CLOSED });
      }

      if (actionId === "script-editor-tab") {
        const tab = meta?.tab || "visual";
        const panel = document.getElementById("webmatic-panel-root");
        const overlay = panel && panel.querySelector("[data-script-editor]");
        if (!overlay) return;
        const area = overlay.querySelector("[data-script-editor-area]");
        const container = overlay.querySelector("[data-step-visual-container]");
        if (tab === "visual" && seEditor && iimAdapter && area) {
          // Script → Visual: parse current textarea into step editor
          const parsed = iimAdapter.importFromIim(area.value);
          seEditor.setSteps((parsed && parsed.steps) || []);
          if (!seEditor._onRecordRequest) {
            seEditor.setRecordRequestHandler((onDone) => { startInlineRecording(onDone); });
          }
          _applyScriptTab(overlay, "visual");
          if (container) seEditor.mount(container, () => {});
        } else if (tab === "script" && seEditor && iimAdapter && area) {
          // Visual → Script: export current steps to textarea
          const steps = seEditor.getSteps();
          const script = iimAdapter.exportToIim({ steps });
          const displayScript = script.split("\n")
            .filter((l) => !l.trimStart().startsWith("// WM_JSON:")).join("\n");
          area.value = displayScript;
          _applyScriptTab(overlay, "script");
        } else {
          _applyScriptTab(overlay, tab);
        }
      }

      if (actionId === "script-editor-copy") {
        const panel = document.getElementById("webmatic-panel-root");
        let textToCopy = "";
        if (_seActiveTab === "visual" && seEditor && iimAdapter) {
          textToCopy = iimAdapter.exportToIim({ steps: seEditor.getSteps() });
        } else {
          const area = panel && panel.querySelector("[data-script-editor-area]");
          textToCopy = area ? area.value : "";
        }
        navigator.clipboard.writeText(textToCopy).catch(() => {
          const area = panel && panel.querySelector("[data-script-editor-area]");
          if (area) { area.select(); document.execCommand("copy"); }
        });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Script copiado al portapapeles" });
      }

      if (actionId === "script-editor-save") {
        const panel = document.getElementById("webmatic-panel-root");
        const area = panel && panel.querySelector("[data-script-editor-area]");
        const currentState = store.getState();
        const macroId = currentState.ui.scriptEditor.macroId;
        const seState = currentState.ui.scriptEditor;
        if (!macroId) {
          // No existing macro: act as Save As
          const name = await uiShell.wmModal("prompt", { message: "Nombre para la macro:", okLabel: "Guardar" });
          if (!name || !name.trim()) return;
          const steps = _resolveEditorSteps(area, seState, seState.draftSteps);
          const scriptToStore = iimAdapter ? iimAdapter.exportToIim({ steps }) : (area ? area.value : "");
          const macro = {
            id: `macro_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            name: name.trim(),
            steps,
            script: scriptToStore,
            createdAt: Date.now()
          };
          store.dispatch({ type: contracts.ActionTypes.MACRO_SAVED, payload: macro });
          store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_CLOSED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Macro "${macro.name}" guardada` });
          chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
        } else {
          const originalSteps = currentState.library.macros.find((m) => m.id === macroId)?.steps || [];
          const steps = _resolveEditorSteps(area, seState, originalSteps);
          const scriptToStore = iimAdapter ? iimAdapter.exportToIim({ steps }) : (area ? area.value : "");
          const updatedMacros = currentState.library.macros.map((m) =>
            m.id === macroId ? { ...m, script: scriptToStore, steps } : m
          );
          store.dispatch({ type: contracts.ActionTypes.LIBRARY_LOADED, payload: updatedMacros });
          store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_CLOSED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Macro guardada" });
          chrome.storage.local.set({ webmaticMacros: updatedMacros });
        }
      }

      if (actionId === "script-editor-saveas") {
        const panel = document.getElementById("webmatic-panel-root");
        const area = panel && panel.querySelector("[data-script-editor-area]");
        const name = await uiShell.wmModal("prompt", { message: "Nombre para la nueva macro:", okLabel: "Guardar" });
        if (!name || !name.trim()) return;
        const seStateSa = store.getState().ui.scriptEditor;
        const steps = _resolveEditorSteps(area, seStateSa, seStateSa.draftSteps);
        const scriptToStoreSa = iimAdapter ? iimAdapter.exportToIim({ steps }) : (area ? area.value : "");
        const macro = {
          id: `macro_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          name: name.trim(),
          steps,
          script: scriptToStoreSa,
          createdAt: Date.now()
        };
        store.dispatch({ type: contracts.ActionTypes.MACRO_SAVED, payload: macro });
        store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_CLOSED });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Macro "${macro.name}" guardada` });
        chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
      }

      if (actionId === "macro-rename") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro) {
          return;
        }
        const newName = await uiShell.wmModal("prompt", { message: "Nuevo nombre para la macro:", defaultValue: macro.name, okLabel: "Renombrar" });
        if (newName && newName.trim()) {
          store.dispatch({ type: contracts.ActionTypes.MACRO_RENAMED, payload: { id: selectedId, name: newName.trim() } });
          chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
        }
      }

      if (actionId === "macro-delete") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro) {
          return;
        }
        const ok = await uiShell.wmModal("confirm", { message: `¿Eliminar la macro "${macro.name}"?`, okLabel: "Eliminar", cancelLabel: "Cancelar" });
        if (ok) {
          store.dispatch({ type: contracts.ActionTypes.MACRO_DELETED, payload: selectedId });
          chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
        }
      }

      if (actionId === "macro-export") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro || !iimAdapter) return;
        const script = iimAdapter.exportToIim(macro);
        const safeName = macro.name.replace(/[^a-z0-9_\-]/gi, "_") + ".iim";
        chrome.runtime.sendMessage({ type: "EXPORT_FILE", filename: safeName, content: script }, (resp) => {
          void chrome.runtime.lastError;
          if (resp && resp.folder) {
            store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Guardado en ${resp.folder}` });
          }
        });
      }

      if (actionId === "macros-backup-all") {
        const currentState = store.getState();
        const macros = currentState.library.macros;
        if (!macros || macros.length === 0) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "No hay macros para exportar." });
          return;
        }
        const date = new Date().toISOString().slice(0, 10);
        const filename = `webmatic-backup-${date}.json`;
        const content = JSON.stringify({ version: 1, exportedAt: Date.now(), macros }, null, 2);
        chrome.runtime.sendMessage({ type: "EXPORT_FILE", filename, content, saveAs: false }, (resp) => {
          void chrome.runtime.lastError;
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Backup guardado: ${filename}` });
        });
      }

      if (actionId === "macros-import-all") {
        // Trigger the hidden file input inside the panel
        const panel = document.getElementById("webmatic-panel-root");
        const fileInput = panel && panel.querySelector("[data-import-file-input]");
        if (!fileInput) return;

        // One-shot listener: resolves when the user picks a file
        const onFileChosen = (e) => {
          fileInput.removeEventListener("change", onFileChosen);
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const parsed = JSON.parse(ev.target.result);
              if (!parsed || !Array.isArray(parsed.macros) || parsed.macros.length === 0) {
                store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Archivo sin macros válidas." });
                return;
              }
              // Merge: keep existing macros that don't share an id with the imported ones,
              // then append all imported macros (preserving their ids and steps intact).
              const existingMacros = store.getState().library.macros;
              const importedIds = new Set(parsed.macros.map((m) => m.id));
              const kept = existingMacros.filter((m) => !importedIds.has(m.id));
              const merged = [...kept, ...parsed.macros];
              store.dispatch({ type: contracts.ActionTypes.LIBRARY_LOADED, payload: merged });
              chrome.storage.local.set({ webmaticMacros: merged });
              store.dispatch({
                type: contracts.ActionTypes.STATUS_MESSAGE_SET,
                payload: `${parsed.macros.length} macro${parsed.macros.length !== 1 ? "s" : ""} importada${parsed.macros.length !== 1 ? "s" : ""}`
              });
            } catch (err) {
              store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Error al leer el archivo." });
            } finally {
              // Reset input so the same file can be chosen again
              fileInput.value = "";
            }
          };
          reader.readAsText(file);
        };

        fileInput.addEventListener("change", onFileChosen);
        fileInput.click();
      }

      if (actionId === "save-confirm") {
        const name = String(meta?.name || "").trim();
        if (!name) {
          return;
        }
        const currentState = store.getState();
        const macro = {
          id: `macro_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          name,
          steps: currentState.draft.steps,
          script: String(meta?.script || currentState.ui.saveModal.script || ""),
          createdAt: Date.now()
        };
        store.dispatch({ type: contracts.ActionTypes.MACRO_SAVED, payload: macro });
        store.dispatch({ type: contracts.ActionTypes.SAVE_MODAL_CLOSED });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Macro "${name}" guardada` });
        chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
      }

      if (actionId === "save-cancel") {
        store.dispatch({ type: contracts.ActionTypes.SAVE_MODAL_CLOSED });
      }
    }
  );

  let _prevPanelVisible = false;

  const unsubscribeRender = store.subscribe((state) => {
    uiShell.render(state);

    // Mount / unmount visual step editor when script editor opens or closes
    const seOpen = state.ui.scriptEditor.open;
    if (seOpen && !_prevScriptEditorOpen) {
      // Script editor just opened — initialize step editor in visual tab
      const panel = document.getElementById("webmatic-panel-root");
      const overlay = panel && panel.querySelector("[data-script-editor]");
      const container = overlay && overlay.querySelector("[data-step-visual-container]");
      if (container && globalScope.WebMaticStepEditor) {
        if (!seEditor) {
          seEditor = new globalScope.WebMaticStepEditor();
          seEditor.setRecordRequestHandler((onDone) => {
            startInlineRecording(onDone);
          });
        }
        const seState = state.ui.scriptEditor;
        const steps = seState.draftSteps && seState.draftSteps.length > 0
          ? seState.draftSteps
          : (iimAdapter ? iimAdapter.importFromIim(seState.script || "").steps : []);
        seEditor.setSteps(steps);
        _applyScriptTab(overlay, "visual");
        seEditor.mount(container, () => {});
      }
    }
    if (!seOpen && _prevScriptEditorOpen) {
      if (seEditor) seEditor.unmount();
      _seActiveTab = "visual";
    }
    _prevScriptEditorOpen = seOpen;

    // Notify background when panel visibility changes so it can restore it after navigation
    if (state.ui.panelVisible !== _prevPanelVisible) {
      _prevPanelVisible = state.ui.panelVisible;
      chrome.runtime.sendMessage({ type: "PANEL_STATE_CHANGED", visible: state.ui.panelVisible }, () => {
        void chrome.runtime.lastError;
      });
    }

    // Update global floating button label with live step count
    const floatingBtn = document.getElementById(FLOATING_BTN_ID);
    if (floatingBtn && state.recorder.isRecording) {
      const label = floatingBtn.querySelector("span:last-child");
      if (label) {
        const count = state.draft.steps.length;
        label.textContent = count > 0
          ? `Grabando (${count} paso${count !== 1 ? "s" : ""}) — Clic para detener`
          : "Grabando — Clic para detener";
      }
    }

    // Update playback floating panel whenever it exists (playing OR stopped)
    if (document.getElementById(FLOATING_PLAYER_ID)) {
      updatePlaybackFloating(state);
    }

    if (state.ui.panelVisible && !state.ui.isFloatingRecorderVisible) {
      const layout = geometry.calculateLayout(
        window.innerWidth,
        window.innerHeight,
        state.ui.panelWidth,
        state.ui.panelSide
      );
      geometry.applyLayoutToDocument(layout, state.ui.panelSide);
    } else {
      document.documentElement.style.marginLeft = "0px";
      document.documentElement.style.marginRight = "0px";
    }
  });

  settingsApi.getSettings().then((settings) => {
    const themeSettings = resolveTheme(settings.themeMode, settings.themeVariant);
    store.dispatch({ type: contracts.ActionTypes.PANEL_WIDTH_SET, payload: 260 });
    store.dispatch({ type: contracts.ActionTypes.PANEL_SIDE_SET, payload: settings.panelSide });
    store.dispatch({
      type: contracts.ActionTypes.SETTINGS_UPDATED,
      payload: {
        ...themeSettings,
        speed: settings.speed ?? 1,
        panelOpacity: settings.panelOpacity ?? 1,
        waitThreshold: settings.waitThreshold ?? 3,
        downloadFolder: settings.downloadFolder || ""
      }
    });
    store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Configuracion cargada" });
  });

  // Restore saved export folder name from background (extension-origin IndexedDB)
  chrome.runtime.sendMessage({ type: "GET_FOLDER_NAME" }, (resp) => {
    void chrome.runtime.lastError;
    if (resp && resp.name) {
      store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { downloadFolder: resp.name } });
    }
  });

  chrome.storage.local.get("webmaticMacros", (result) => {
    const macros = Array.isArray(result.webmaticMacros) ? result.webmaticMacros : [];
    store.dispatch({ type: contracts.ActionTypes.LIBRARY_LOADED, payload: macros });
  });

  // Check if there's a pending playback that was interrupted by page navigation
  chrome.runtime.sendMessage({ type: "QUERY_PENDING_PLAYBACK" }, (resp) => {
    if (chrome.runtime.lastError || !resp || !resp.pending) return;
    const p = resp.pending;
    const PlayerClass = globalScope.WebMaticPlayer;
    if (!PlayerClass || !Array.isArray(p.steps) || p.index >= p.steps.length) return;

    // Brief delay to let the page finish rendering
    setTimeout(() => {
      store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
      store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Reanudando reproduccion..." });
      // Restore selected macro so addWaitHere works
      if (p.macroId) store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: p.macroId });
      // Re-create the playback floating panel
      createPlaybackFloating(
        () => {
          if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
          store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
          removePlaybackFloating();
        },
        () => addWaitHere(),
        () => {
          // Replay from start using the pending macro (ignore navigation resume offset)
          if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
          const _rstate = store.getState();
          const _rmacro = _rstate.library.macros.find((m) => m.id === p.macroId);
          if (!_rmacro) return;
          store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Reproduciendo "${_rmacro.name}"` });
          const _RPlayerClass = globalScope.WebMaticPlayer;
          if (!_RPlayerClass) return;
          const _rPlayer = new _RPlayerClass();
          playerRuntime.activePlayer = _rPlayer;
          const _rResolvedSteps = _resolveCallMacros(_rmacro.steps, _rstate.library.macros);
          _rPlayer.play(_rResolvedSteps, {
            speed: p.speed,
            macroId: p.macroId,
            onStep: (step, index) => {
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: _rResolvedSteps } });
            },
            onDone: () => {
              playerRuntime.activePlayer = null;
              store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
              store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Reproduccion completada" });
            },
            onError: (err) => {
              playerRuntime.activePlayer = null;
              const errIdx = store.getState().playback.currentStepIndex;
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
              store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Error: ${err.message}` });
            }
          });
        },
        () => {
          if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
          store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
          removePlaybackFloating();
        },
        (n) => {
          if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
          const _rnstate = store.getState();
          const _rnmacro = _rnstate.library.macros.find((m) => m.id === p.macroId);
          if (!_rnmacro) return;
          store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Bucle x${n}: "${_rnmacro.name}"` });
          const _rnPlayer = new (globalScope.WebMaticPlayer)();
          playerRuntime.activePlayer = _rnPlayer;
          let _rnIter = 0;
          const _rnResolved = _resolveCallMacros(_rnmacro.steps, _rnstate.library.macros);
          store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: 0, steps: _rnResolved } });
          function _rnNext() {
            if (_rnIter >= n || _rnPlayer._abort) {
              playerRuntime.activePlayer = null;
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: _rnResolved.length, steps: _rnResolved } });
              store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
              return;
            }
            _rnIter++;
            _rnPlayer._abort = false;
            _rnPlayer.play(_rnResolved, {
              speed: p.speed,
              macroId: p.macroId,
              onStep: (step, index) => { store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: _rnResolved } }); },
              onDone: _rnNext,
              onError: (err) => {
                playerRuntime.activePlayer = null;
                const errIdx = store.getState().playback.currentStepIndex;
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
              }
            });
          }
          _rnNext();
        }
      );
      // Show macro name if found
      if (p.macroId) {
        const foundMacro = store.getState().library.macros.find((m) => m.id === p.macroId);
        const nameEl = document.getElementById("wm-play-name");
        if (nameEl && foundMacro) nameEl.textContent = foundMacro.name;
      }
      const player = new PlayerClass();
      playerRuntime.activePlayer = player;
      player.play(p.steps, {
        speed: p.speed,
        startIndex: p.index,
        vars: p.vars,
        macroId: p.macroId,
        onStep: (step, index) => {
          store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: p.steps } });
        },
        onDone: () => {
          playerRuntime.activePlayer = null;
          store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: p.steps.length, steps: p.steps } });
          store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Reproduccion completada" });
        },
        onError: (err) => {
          playerRuntime.activePlayer = null;
          const errIdx = store.getState().playback.currentStepIndex;
          store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Error: ${err.message}` });
        }
      });
    }, 800);
  });

  const onStorageChanged = (changes, areaName) => {
    if (areaName !== "local" || !changes.webmaticSettings) {
      return;
    }

    const nextSettings = changes.webmaticSettings.newValue || {};
    store.dispatch({ type: contracts.ActionTypes.PANEL_WIDTH_SET, payload: 260 });
    if (typeof nextSettings.panelSide !== "undefined") {
      store.dispatch({ type: contracts.ActionTypes.PANEL_SIDE_SET, payload: nextSettings.panelSide });
    }
    store.dispatch({
      type: contracts.ActionTypes.SETTINGS_UPDATED,
      payload: {
        ...resolveTheme(nextSettings.themeMode, nextSettings.themeVariant),
        speed: nextSettings.speed ?? 1,
        panelOpacity: nextSettings.panelOpacity ?? 1
      }
    });
  };

  chrome.storage.onChanged.addListener(onStorageChanged);

  const onRuntimeMessage = (message, sender, sendResponse) => {
    if (message?.type === "TOGGLE_PANEL") {
      store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "OPEN_PANEL") {
      if (!store.getState().ui.panelVisible) {
        store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
      }
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "SET_PANEL_SIDE") {
      store.dispatch({ type: contracts.ActionTypes.PANEL_SIDE_SET, payload: message.payload });
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "SHOW_FLOATING_BTN") {
      // Background signals recording is active (new page load or tab switch during recording).
      // We must (re)start the recorder session on this page so events are captured.
      store.dispatch({ type: contracts.ActionTypes.RECORD_STARTED });
      // Restore steps accumulated on previous pages in this recording session
      if (message.steps && message.steps.length > 0) {
        message.steps.forEach((step) => {
          const clean = Object.assign({}, step);
          delete clean._merge;
          store.dispatch({ type: contracts.ActionTypes.STEP_CAPTURED, payload: clean });
        });
      }
      startRecorderSession();
      createFloatingBtn(() => {
        stopRecorderSession();
        removeFloatingBtn();
        chrome.runtime.sendMessage({ type: "RECORDING_STATE", active: false }, () => { void chrome.runtime.lastError; });
        store.dispatch({ type: contracts.ActionTypes.RECORD_STOPPED });
        const afterStop = store.getState();
        if (afterStop.draft.steps.length > 0 && iimAdapter) {
          const utils = globalScope.WebMaticUtils;
          const threshold = (afterStop.settings && afterStop.settings.waitThreshold) || 3;
          const recorded = afterStop.draft.steps;
          const navigateSteps = recorded.filter((s) => s.type === "navigate");
          const interactions = recorded.filter((s) => s.type !== "navigate");
          const allSteps = _cleanupSteps([...navigateSteps, ...interactions]);
          const processedSteps = utils ? utils.injectWaitSteps(allSteps, threshold * 1000) : allSteps;
          const script = iimAdapter.exportToIim({ steps: processedSteps });
          store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_OPENED, payload: { script, macroId: null, draftSteps: processedSteps } });
        }
      });
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "HIDE_FLOATING_BTN") {
      removeFloatingBtn();
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "FRAME_STEP_CAPTURED") {
      if (store.getState().recorder.isRecording) {
        const step = message.step;
        const currentSteps = store.getState().draft.steps;
        const lastStep = currentSteps[currentSteps.length - 1];
        // Merge consecutive text steps on the same selector
        if (step.type === "text" && lastStep && lastStep.type === "text" && lastStep.selector === step.selector) {
          captureStep({ type: "text", selector: step.selector, value: lastStep.value + step.value, _merge: true });
        } else {
          captureStep(step);
        }
      }
      return false;
    }

    return false;
  };

  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  globalScope.__webmaticRuntime = {
    destroy() {
      stopRecorderSession();
      removeFloatingBtn();
      if (playerRuntime.activePlayer) {
        playerRuntime.activePlayer.stop();
        playerRuntime.activePlayer = null;
      }
      chrome.runtime.sendMessage({ type: "RECORDING_STATE", active: false }, () => { void chrome.runtime.lastError; });
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
      chrome.storage.onChanged.removeListener(onStorageChanged);
      if (typeof unsubscribeRender === "function") {
        unsubscribeRender();
      }
      uiShell.unmount();
      document.documentElement.style.marginLeft = "0px";
      document.documentElement.style.marginRight = "0px";
    }
  };

  console.log("[WebMatic] Bootstrap completado.");
})(typeof globalThis !== "undefined" ? globalThis : window);