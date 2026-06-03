(function initUiShell(globalScope) {
  const PANEL_ID = "webmatic-panel-root";
  const UI_VERSION = "2026-06-02-v12";
  // Paletas completas: cada variante define TODOS los tokens de color
  const THEME_PALETTES = {
    light: [
      // Variante 1 — Verde esmeralda
      { accent: "#059669", accentFg: "#ffffff", surface: "#f0fdf4", surface2: "#dcfce7", btnBg: "#ecfdf5", btnHover: "#d1fae5", border: "#a7f3d0", swatchBorder: "#6ee7b7", text: "#064e3b", textMuted: "#065f46", cardBg: "#ffffff", scrollbar: "#6ee7b7", headerFrom: "#065f46", headerTo: "#10b981", headerText: "#ffffff" },
      // Variante 2 — Azul cielo
      { accent: "#0284c7", accentFg: "#ffffff", surface: "#f0f9ff", surface2: "#e0f2fe", btnBg: "#e0f2fe", btnHover: "#bae6fd", border: "#7dd3fc", swatchBorder: "#38bdf8", text: "#0c4a6e", textMuted: "#075985", cardBg: "#ffffff", scrollbar: "#7dd3fc", headerFrom: "#0c4a6e", headerTo: "#0ea5e9", headerText: "#ffffff" },
      // Variante 3 — Violeta
      { accent: "#7c3aed", accentFg: "#ffffff", surface: "#faf5ff", surface2: "#ede9fe", btnBg: "#ede9fe", btnHover: "#ddd6fe", border: "#c4b5fd", swatchBorder: "#a78bfa", text: "#3b0764", textMuted: "#4c1d95", cardBg: "#ffffff", scrollbar: "#c4b5fd", headerFrom: "#4c1d95", headerTo: "#8b5cf6", headerText: "#ffffff" },
      // Variante 4 — Rojo
      { accent: "#dc2626", accentFg: "#ffffff", surface: "#fef2f2", surface2: "#fee2e2", btnBg: "#fee2e2", btnHover: "#fecaca", border: "#fca5a5", swatchBorder: "#f87171", text: "#7f1d1d", textMuted: "#991b1b", cardBg: "#ffffff", scrollbar: "#fca5a5", headerFrom: "#7f1d1d", headerTo: "#ef4444", headerText: "#ffffff" }
    ],
    dark: [
      // Variante 1 — Verde oscuro
      { accent: "#34d399", accentFg: "#022c22", surface: "#022c22", surface2: "#064e3b", btnBg: "#065f46", btnHover: "#047857", border: "#047857", swatchBorder: "#059669", text: "#d1fae5", textMuted: "#6ee7b7", cardBg: "#064e3b", scrollbar: "#047857", headerFrom: "#022c22", headerTo: "#065f46", headerText: "#a7f3d0" },
      // Variante 2 — Azul oscuro
      { accent: "#38bdf8", accentFg: "#0c1a2e", surface: "#0c1a2e", surface2: "#0c2d4a", btnBg: "#0c4a6e", btnHover: "#075985", border: "#0369a1", swatchBorder: "#0284c7", text: "#e0f2fe", textMuted: "#7dd3fc", cardBg: "#0c2d4a", scrollbar: "#0369a1", headerFrom: "#0c1a2e", headerTo: "#0c4a6e", headerText: "#bae6fd" },
      // Variante 3 — Violeta oscuro
      { accent: "#a78bfa", accentFg: "#1e1b2e", surface: "#1e1b2e", surface2: "#2d1b69", btnBg: "#2e1065", btnHover: "#4c1d95", border: "#4c1d95", swatchBorder: "#7c3aed", text: "#ede9fe", textMuted: "#c4b5fd", cardBg: "#2d1b69", scrollbar: "#4c1d95", headerFrom: "#1e1b2e", headerTo: "#4c1d95", headerText: "#ddd6fe" },
      // Variante 4 — Rojo oscuro
      { accent: "#f87171", accentFg: "#2a1515", surface: "#2a1515", surface2: "#450a0a", btnBg: "#7f1d1d", btnHover: "#991b1b", border: "#991b1b", swatchBorder: "#dc2626", text: "#fee2e2", textMuted: "#fca5a5", cardBg: "#450a0a", scrollbar: "#991b1b", headerFrom: "#2a1515", headerTo: "#7f1d1d", headerText: "#fecaca" }
    ]
  };

  function ensureStylesheet() {
    if (document.getElementById("webmatic-style-link")) {
      return;
    }

    const link = document.createElement("link");
    link.id = "webmatic-style-link";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("src/modules/ui/ui-shell.css");
    document.head.appendChild(link);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createPanel() {
    const panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.dataset.uiVersion = UI_VERSION;
    panel.className = "webmatic-left";
    panel.innerHTML = `
      <button class="webmatic-floating-recorder" data-action="record-toggle" type="button">
        <span class="webmatic-floating-dot"></span>
        Grabando
      </button>
      <header class="webmatic-header">
        <h1 class="webmatic-title">WebMatic</h1>
        <button class="webmatic-help-btn" type="button" data-action="help" aria-label="Abrir manual de ayuda">?</button>
        <button class="webmatic-close-btn" type="button" data-action="close-panel" aria-label="Cerrar sidebar">&#x2715;</button>
      </header>
      <nav class="webmatic-segment" aria-label="Modos">
        <button class="webmatic-mode-btn webmatic-record-tab" data-action="record-toggle" data-record-btn>&#9679; Grabar</button>
        <button class="webmatic-mode-btn" data-mode="play">Reproducir</button>
        <button class="webmatic-mode-btn" data-mode="settings">Configurar</button>
      </nav>
      <section class="webmatic-content">
        <div class="webmatic-view" data-view="play">
          <div class="webmatic-search-row">
            <input class="webmatic-search-input" data-action-input="library-search" type="text" placeholder="Buscar macro..." autocomplete="off" />
          </div>
          <details class="webmatic-play-data-box" aria-label="Dato de ejecucion">
            <summary class="webmatic-play-data-summary">Datos de autocompletado</summary>
            <div class="webmatic-play-data-content">
              <div class="webmatic-play-data-tag">Dato para autocompletar</div>
              <label class="webmatic-toggle-row" for="webmatic-play-runtime-enabled">
                <input id="webmatic-play-runtime-enabled" type="checkbox" data-action-change="play-runtime-enabled" />
                <span>Usar dato en esta ejecucion</span>
              </label>
              <div class="webmatic-play-data-row">
                <select class="webmatic-field-control" data-action-change="play-runtime-type" aria-label="Tipo de dato">
                  <option value="dni">DNI</option>
                  <option value="affiliate">N° de afiliado</option>
                  <option value="authorization">Autorizacion</option>
                  <option value="name">Nombre</option>
                  <option value="password">Contrasena</option>
                  <option value="generic">Otro</option>
                </select>
                <input
                  class="webmatic-field-control"
                  data-action-input="play-runtime-data"
                  type="text"
                  placeholder="Ingresa el dato"
                  autocomplete="off"
                />
              </div>
              <div class="webmatic-play-data-actions">
                <button class="webmatic-action-btn webmatic-btn-ghost" data-action="play-runtime-item-add" type="button">+ Agregar otro dato</button>
              </div>
              <div class="webmatic-runtime-item-list" data-runtime-item-list></div>
              <div class="webmatic-runtime-template-box">
                <div class="webmatic-runtime-template-row">
                  <select class="webmatic-field-control" data-action-change="play-runtime-template-select" aria-label="Plantilla de datos">
                    <option value="">Sin plantilla</option>
                  </select>
                  <button class="webmatic-action-btn webmatic-btn-ghost" data-action="play-runtime-template-apply" type="button">Aplicar</button>
                </div>
                <div class="webmatic-runtime-template-actions">
                  <button class="webmatic-action-btn webmatic-btn-ghost" data-action="play-runtime-template-save" type="button">Guardar actual</button>
                  <button class="webmatic-action-btn webmatic-btn-ghost" data-action="play-runtime-template-delete" type="button">Quitar plantilla</button>
                </div>
              </div>
            </div>
          </details>
          <div class="webmatic-macro-list" data-library-list></div>
          <div class="webmatic-macro-actions">
            <button class="webmatic-action-btn" data-action="macro-play" disabled>&#9654; Reproducir</button>
            <button class="webmatic-action-btn webmatic-btn-stop" data-action="play-stop" style="display:none">&#9632; Detener</button>
            <button class="webmatic-action-btn" data-action="macro-rename" disabled>Renombrar</button>
            <button class="webmatic-action-btn" data-action="macro-duplicate" disabled title="Crea una c\u00f3pia de la macro seleccionada">Duplicar</button>
            <button class="webmatic-action-btn" data-action="macro-delete" disabled>Eliminar</button>
          </div>
          <div class="webmatic-loop-row">
            <div class="webmatic-loop-count" data-loop-count>
              <span>Repetir</span>
              <input class="webmatic-repeat-input" data-action-change="repeat-count" type="number" min="2" max="100" value="5" />
              <span>veces</span>
            </div>
            <button class="webmatic-action-btn webmatic-btn-play-loop" data-action="macro-play-loop" disabled>&#9654;&#9654; Bucle</button>
          </div>
          <div class="webmatic-step-progress" data-step-progress style="display:none"></div>
          <button class="webmatic-action-btn webmatic-btn-addwait" data-action="add-wait-here" style="display:none" data-addwait-btn title="Agrega +1s de espera antes del paso actual en la macro guardada">&#9719; +1s aqui</button>
        </div>
        <div class="webmatic-view" data-view="settings">
          <section class="webmatic-settings-card" aria-label="Visualizacion">
            <h3>Visualizacion</h3>
            <div class="webmatic-actions webmatic-actions-inline">
              <button class="webmatic-action-btn" data-action="settings-side-left">Izquierda</button>
              <button class="webmatic-action-btn" data-action="settings-side-right">Derecha</button>
            </div>
            <div class="webmatic-subtitle">Temas</div>
            <label class="webmatic-toggle-row" for="webmatic-dark-toggle">
              <input id="webmatic-dark-toggle" type="checkbox" data-action-change="settings-theme-mode" />
              <span>Modo oscuro</span>
            </label>
            <div class="webmatic-swatch-row" data-theme-swatches></div>
            <div class="webmatic-subtitle">Velocidad de reproduccion</div>
            <div class="webmatic-slider-row">
              <input class="webmatic-slider" data-action-input="settings-speed" type="range" min="0.5" max="3" step="0.25" value="1" />
              <span class="webmatic-slider-label" data-speed-label>1&times;</span>
            </div>
            <div class="webmatic-subtitle">Opacidad del panel</div>
            <div class="webmatic-slider-row">
              <input class="webmatic-slider" data-action-input="settings-opacity" type="range" min="0.7" max="1" step="0.05" value="1" />
              <span class="webmatic-slider-label" data-opacity-label>100%</span>
            </div>
            <div class="webmatic-subtitle">Umbral de pausa al grabar (s)</div>
            <div class="webmatic-slider-row">
              <input class="webmatic-slider" data-action-input="settings-wait-threshold" type="range" min="1" max="10" step="0.5" value="3" />
              <span class="webmatic-slider-label" data-wait-threshold-label>3s</span>
            </div>
            <div class="webmatic-subtitle">Ampliar datos a precargar</div>
            <div class="webmatic-play-data-row">
              <input
                class="webmatic-field-control"
                data-action-input="settings-custom-type-draft"
                type="text"
                placeholder="Ej: Numero de socio"
                autocomplete="off"
              />
              <button class="webmatic-action-btn" data-action="settings-custom-type-add" type="button">Agregar</button>
            </div>
            <div class="webmatic-custom-type-list" data-custom-type-list></div>
          </section>
          <section class="webmatic-settings-card" aria-label="Exportacion">
            <h3>Exportacion y respaldo</h3>
            <p class="webmatic-settings-hint">Exporta la macro seleccionada o un backup completo de todas tus macros.</p>
            <div class="webmatic-actions">
              <button class="webmatic-action-btn" data-action="macro-export" disabled>&#11123; Exportar seleccionada (.iim)</button>
              <button class="webmatic-action-btn webmatic-btn-backup" data-action="macros-backup-all">&#128190; Backup de todas las macros</button>
              <button class="webmatic-action-btn" data-action="macros-import-all">&#128228; Importar backup (.json)</button>
              <input type="file" data-import-file-input accept=".json,application/json" style="display:none" />
            </div>
          </section>
        </div>
      </section>
      <div class="webmatic-save-modal" data-save-modal>
        <h3 class="webmatic-save-title">Guardar macro</h3>
        <input class="webmatic-save-name" data-save-name type="text" placeholder="Nombre de la macro" autocomplete="off" />
        <div class="webmatic-save-btns">
          <button class="webmatic-action-btn" data-action="save-confirm">Guardar</button>
          <button class="webmatic-action-btn webmatic-btn-ghost" data-action="save-cancel">Cancelar</button>
        </div>
        <button class="webmatic-action-btn webmatic-save-editor-btn" data-action="save-editor-toggle">Editar script</button>
        <textarea class="webmatic-save-script" data-save-script rows="6"></textarea>
      </div>
      <!-- Script Editor: full-screen overlay modal -->
      <div class="webmatic-script-overlay" data-script-editor style="display:none">
        <div class="webmatic-script-dialog">
          <div class="webmatic-script-header">
            <h3 class="webmatic-script-title" data-script-editor-title>Editor de script</h3>
            <button class="webmatic-script-close" data-action="script-editor-close" aria-label="Cerrar">✕</button>
          </div>
          <div class="webmatic-script-tabs">
            <button class="webmatic-script-tab active" data-action="script-editor-tab" data-script-tab="visual">&#128203; Visual</button>
            <button class="webmatic-script-tab" data-action="script-editor-tab" data-script-tab="script">&#128196; Script IIM</button>
          </div>
          <div class="wm-sved-container" data-step-visual-container></div>
          <textarea class="webmatic-script-textarea" data-script-editor-area spellcheck="false" autocorrect="off" autocapitalize="off" style="display:none"></textarea>
          <div class="webmatic-script-footer">
            <button class="webmatic-action-btn" data-action="script-editor-save">&#128190; Guardar</button>
            <button class="webmatic-action-btn webmatic-btn-ghost" data-action="script-editor-saveas">Guardar como…</button>
            <button class="webmatic-action-btn webmatic-btn-ghost" data-action="script-editor-copy">&#128203; Copiar</button>
            <button class="webmatic-action-btn webmatic-btn-ghost" data-action="script-editor-close">Cerrar</button>
          </div>
        </div>
      </div>
      <!-- Generic dialog modal: used for prompt/confirm/alert -->
      <div class="webmatic-wm-overlay" data-wm-dialog style="display:none">
        <div class="webmatic-wm-dialog">
          <p class="webmatic-wm-message" data-wm-message></p>
          <input class="webmatic-wm-input" data-wm-input type="text" autocomplete="off" style="display:none" />
          <div class="webmatic-wm-btns">
            <button class="webmatic-action-btn" data-wm-ok>Aceptar</button>
            <button class="webmatic-action-btn webmatic-btn-ghost" data-wm-cancel style="display:none">Cancelar</button>
          </div>
        </div>
      </div>
    `;

    return panel;
  }

  function mount() {
    ensureStylesheet();
    let panel = document.getElementById(PANEL_ID);
    if (panel && panel.dataset.uiVersion !== UI_VERSION) {
      panel.remove();
      panel = null;
    }
    if (!panel) {
      panel = createPanel();
      document.documentElement.appendChild(panel);
    }
    return panel;
  }

  /**
   * Shows a custom modal dialog inside the WebMatic panel.
   * type: "prompt" | "confirm" | "alert"
   * opts: { message, defaultValue, okLabel, cancelLabel }
   * Returns a Promise that resolves with the value (prompt) or boolean (confirm/alert), or null on cancel.
   */
  function wmModal(type, opts) {
    return new Promise((resolve) => {
      const panel = document.getElementById(PANEL_ID);
      if (!panel) { resolve(null); return; }

      const overlay = panel.querySelector("[data-wm-dialog]");
      const msgEl   = panel.querySelector("[data-wm-message]");
      const inputEl = panel.querySelector("[data-wm-input]");
      const okBtn   = panel.querySelector("[data-wm-ok]");
      const cancelBtn = panel.querySelector("[data-wm-cancel]");
      if (!overlay || !msgEl || !inputEl || !okBtn || !cancelBtn) { resolve(null); return; }

      msgEl.textContent = opts.message || "";
      okBtn.textContent = opts.okLabel || "Aceptar";
      cancelBtn.textContent = opts.cancelLabel || "Cancelar";

      if (type === "prompt") {
        inputEl.style.display = "";
        inputEl.value = opts.defaultValue || "";
        cancelBtn.style.display = "";
      } else if (type === "confirm") {
        inputEl.style.display = "none";
        cancelBtn.style.display = "";
      } else {
        inputEl.style.display = "none";
        cancelBtn.style.display = "none";
      }

      overlay.style.display = "flex";
      if (type === "prompt") { setTimeout(() => { inputEl.focus(); inputEl.select(); }, 30); }

      function cleanup() {
        overlay.style.display = "none";
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        overlay.removeEventListener("keydown", onKey);
      }
      function onOk() {
        cleanup();
        if (type === "prompt") resolve(inputEl.value);
        else resolve(true);
      }
      function onCancel() { cleanup(); resolve(null); }
      function onKey(e) {
        if (e.key === "Enter") { e.preventDefault(); onOk(); }
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      overlay.addEventListener("keydown", onKey);
    });
  }

  function unmount() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
      panel.remove();
    }
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

  function renderLibrary(panel, state) {
    const listEl = panel.querySelector("[data-library-list]");
    if (!listEl) {
      return;
    }

    const { macros, selectedMacroId } = state.library;
    const filtered = filterMacros(macros, state.library.searchQuery);

    const currentIds = Array.from(listEl.querySelectorAll(".webmatic-macro-item[data-macro-id]"))
      .map((el) => el.dataset.macroId)
      .join(",");
    const newIds = filtered.map((m) => m.id).join(",");

    if (currentIds !== newIds) {
      listEl.innerHTML = "";
      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "webmatic-macro-empty";
        empty.textContent = macros.length === 0 ? "Sin macros guardadas" : "Sin resultados";
        listEl.appendChild(empty);
      } else {
        filtered.forEach((m) => {
          const item = document.createElement("div");
          item.className = "webmatic-macro-item";
          item.dataset.macroId = m.id;
          const nameSpan = document.createElement("span");
          nameSpan.className = "webmatic-macro-name";
          nameSpan.textContent = m.name;
          const countSpan = document.createElement("span");
          countSpan.className = "webmatic-macro-count";
          const n = Array.isArray(m.steps) ? m.steps.length : 0;
          countSpan.textContent = n > 0 ? `${n}p` : "";
          countSpan.title = n > 0 ? `${n} paso${n !== 1 ? "s" : ""}` : "Sin pasos";
          const editBtn = document.createElement("button");
          editBtn.className = "webmatic-macro-edit-btn";
          editBtn.dataset.action = "macro-edit";
          editBtn.dataset.macroId = m.id;
          editBtn.setAttribute("aria-label", "Editar macro");
          editBtn.setAttribute("title", "Editar script");
          editBtn.textContent = "✏️";
          item.appendChild(nameSpan);
          item.appendChild(countSpan);
          item.appendChild(editBtn);
          listEl.appendChild(item);
        });
      }
    }

    listEl.querySelectorAll(".webmatic-macro-item[data-macro-id]").forEach((item) => {
      item.classList.toggle("selected", item.dataset.macroId === selectedMacroId);
    });

    const hasSelection = Boolean(selectedMacroId) && filtered.some((m) => m.id === selectedMacroId);
    panel.querySelectorAll("[data-action^='macro-']").forEach((btn) => {
      if (btn.dataset.action === "macros-backup-all") return;
      if (btn.dataset.action === "macros-import-all") return;
      if (btn.dataset.action === "macro-edit") return;
      btn.disabled = !hasSelection;
      btn.classList.toggle("webmatic-btn-disabled", !hasSelection);
    });

    const playBtn = panel.querySelector("[data-action='macro-play']");
    const stopBtn = panel.querySelector("[data-action='play-stop']");
    if (playBtn && stopBtn) {
      playBtn.style.display = state.playback.isPlaying ? "none" : "";
      stopBtn.style.display = state.playback.isPlaying ? "" : "none";
    }

    const loopPlayBtn = panel.querySelector("[data-action='macro-play-loop']");
    if (loopPlayBtn) {
      loopPlayBtn.disabled = !hasSelection || state.playback.isPlaying;
      loopPlayBtn.classList.toggle("webmatic-btn-disabled", !hasSelection || state.playback.isPlaying);
    }

    const repeatInput = panel.querySelector("[data-action-change='repeat-count']");
    if (repeatInput && document.activeElement !== repeatInput) {
      repeatInput.value = String(state.playback.repeatCount);
    }

    // Step progress panel — visible only while playing
    const stepProgress = panel.querySelector("[data-step-progress]");
    const addWaitBtn = panel.querySelector("[data-addwait-btn]");
    if (addWaitBtn) {
      addWaitBtn.style.display = state.playback.isPlaying && state.playback.currentStepIndex >= 0 ? "" : "none";
    }
    if (stepProgress) {
      const isPlaying = state.playback.isPlaying;
      const steps = state.playback.currentSteps;
      const currentIdx = state.playback.currentStepIndex;
      stepProgress.style.display = isPlaying && steps && steps.length > 0 ? "" : "none";
      if (isPlaying && steps && steps.length > 0) {
        // Build visible (non-fast) step list once, or update current highlight
        const visibleSteps = steps
          .map((s, i) => ({ s, i }))
          .filter(({ s }) => !s._fast);
        const html = visibleSteps.map(({ s, i }) => {
          const isCurrent = i === currentIdx;
          const isDone = i < currentIdx;
          let label = "";
          // Standard types
          if (s.type === "navigate")     label = `&#127760; ${s.url || ""}`;
          else if (s.type === "click")   label = `&#128432; ${s.selector || ""}`;
          else if (s.type === "input" || s.type === "text")  label = `&#9998; ${s.selector || ""} = "${s.value || ""}"`;
          else if (s.type === "wait")    label = `&#9719; ${s.seconds != null ? s.seconds + "s" : (s.ms || 0) + "ms"}`;
          else if (s.type === "key")     label = `&#9000; ${s.key || ""}`;
          else if (s.type === "check")   label = `&#9745; ${s.selector || ""}`;
          else if (s.type === "extract") label = `&#9999; ${s.selector || ""}${s.variable ? " \u2192 " + s.variable : ""}`;
          // Extended types
          else if (s.type === "wait_for")    label = `&#9203; esperar ${s.selector || ""}`;
          else if (s.type === "scroll_to")   label = `&#8681; scroll \u2192 ${s.selector || ""}`;
          else if (s.type === "hover")        label = `&#9655; hover ${s.selector || ""}`;
          else if (s.type === "drag_drop")    label = `&#8596; drag ${s.from || ""} \u2192 ${s.to || ""}`;
          else if (s.type === "set_variable") label = `= ${s.variable || ""} \u2190 ${s.value || ""}`;
          else if (s.type === "prompt")       label = `? ${s.label || "prompt"}${s.variable ? " \u2192 " + s.variable : ""}`;
          else if (s.type === "if_exists")    label = `? si existe ${s.selector || ""}`;
          else if (s.type === "loop_until")   label = `&#8635; bucle ${s.selector || ""}`;
          else if (s.type === "try_fallback") label = `&#9888; try/fallback`;
          else if (s.type === "call_macro")   label = `&#8618; llamar \"${s.macro_name || ""}\"`;
          else if (s.type === "for_each_row") label = `&#9638; ${(s.dataset || []).length} filas`;
          else label = s.type;
          const cls = isCurrent ? "webmatic-step-item webmatic-step-current"
            : isDone ? "webmatic-step-item webmatic-step-done"
            : "webmatic-step-item";
          return `<div class="${cls}">${label}</div>`;
        }).join("");
        stepProgress.innerHTML = html;
        // Scroll current step into view
        const currentEl = stepProgress.querySelector(".webmatic-step-current");
        if (currentEl) currentEl.scrollIntoView({ block: "nearest" });
      }
    }
  }

  function render(state) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) {
      return;
    }

    panel.style.display = state.ui.panelVisible ? "block" : "none";
    panel.style.width = `${state.ui.panelWidth}px`;
    panel.style.opacity = String(state.settings.panelOpacity ?? 1);
    panel.classList.toggle("webmatic-left", state.ui.panelSide === "left");
    panel.classList.toggle("webmatic-right", state.ui.panelSide === "right");
    panel.classList.toggle("webmatic-floating-mode", state.ui.isFloatingRecorderVisible);
    panel.classList.toggle("webmatic-dark", state.settings.themeMode === "dark");

    // Aplicar paleta completa según modo y variante
    const _mode = state.settings.themeMode === "dark" ? "dark" : "light";
    const _vi = Number(state.settings.themeVariant);
    const _pi = Number.isFinite(_vi) && _vi >= 1 && _vi <= 4 ? _vi - 1 : 0;
    const _p = THEME_PALETTES[_mode][_pi];
    panel.style.setProperty("--webmatic-accent",        _p.accent);
    panel.style.setProperty("--webmatic-accent-fg",     _p.accentFg);
    panel.style.setProperty("--webmatic-surface",       _p.surface);
    panel.style.setProperty("--webmatic-surface-2",     _p.surface2);
    panel.style.setProperty("--webmatic-btn-bg",        _p.btnBg);
    panel.style.setProperty("--webmatic-btn-hover",     _p.btnHover);
    panel.style.setProperty("--webmatic-border",        _p.border);
    panel.style.setProperty("--webmatic-swatch-border", _p.swatchBorder);
    panel.style.setProperty("--webmatic-text",          _p.text);
    panel.style.setProperty("--webmatic-text-muted",    _p.textMuted);
    panel.style.setProperty("--webmatic-card-bg",       _p.cardBg);
    panel.style.setProperty("--webmatic-scrollbar",     _p.scrollbar);
    panel.style.setProperty("--webmatic-header-from",   _p.headerFrom);
    panel.style.setProperty("--webmatic-header-to",     _p.headerTo);
    panel.style.setProperty("--webmatic-header-text",   _p.headerText);

    const modeButtons = panel.querySelectorAll(".webmatic-mode-btn");
    const views = panel.querySelectorAll(".webmatic-view");

    modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === state.ui.mode);
    });

    views.forEach((view) => {
      view.classList.toggle("active", view.dataset.view === state.ui.mode);
    });

    const sideLeftButton = panel.querySelector('[data-action="settings-side-left"]');
    const sideRightButton = panel.querySelector('[data-action="settings-side-right"]');
    if (sideLeftButton) {
      sideLeftButton.classList.toggle("active", state.ui.panelSide === "left");
    }
    if (sideRightButton) {
      sideRightButton.classList.toggle("active", state.ui.panelSide === "right");
    }

    const darkToggle = panel.querySelector("#webmatic-dark-toggle");
    if (darkToggle) {
      darkToggle.checked = state.settings.themeMode === "dark";
    }

    const swatchRow = panel.querySelector("[data-theme-swatches]");
    if (swatchRow) {
      const mode = state.settings.themeMode === "dark" ? "dark" : "light";
      swatchRow.style.display = "grid";
      swatchRow.innerHTML = THEME_PALETTES[mode].map((p) => p.accent)
        .map((color, index) => {
          const variant = index + 1;
          const activeClass = variant === state.settings.themeVariant ? " active" : "";
          return `<button class="webmatic-swatch${activeClass}" data-action="settings-theme-variant" data-variant="${variant}" data-color="${color}" title="Variante ${variant}" style="background:${color}"></button>`;
        })
        .join("");
    }

    const speedSlider = panel.querySelector("[data-action-input='settings-speed']");
    const speedLabel = panel.querySelector("[data-speed-label]");
    if (speedSlider && document.activeElement !== speedSlider) {
      speedSlider.value = String(state.settings.speed ?? 1);
    }
    if (speedLabel) {
      speedLabel.textContent = `${Number(state.settings.speed ?? 1)}×`;
    }

    const opacitySlider = panel.querySelector("[data-action-input='settings-opacity']");
    const opacityLabel = panel.querySelector("[data-opacity-label]");
    if (opacitySlider && document.activeElement !== opacitySlider) {
      opacitySlider.value = String(state.settings.panelOpacity ?? 1);
    }
    if (opacityLabel) {
      opacityLabel.textContent = `${Math.round((state.settings.panelOpacity ?? 1) * 100)}%`;
    }

    const waitThresholdSlider = panel.querySelector("[data-action-input='settings-wait-threshold']");
    const waitThresholdLabel = panel.querySelector("[data-wait-threshold-label]");
    if (waitThresholdSlider && document.activeElement !== waitThresholdSlider) {
      waitThresholdSlider.value = String(state.settings.waitThreshold ?? 3);
    }
    if (waitThresholdLabel) {
      waitThresholdLabel.textContent = `${Number(state.settings.waitThreshold ?? 3)}s`;
    }

    const playRuntimeEnabled = panel.querySelector("#webmatic-play-runtime-enabled");
    if (playRuntimeEnabled) {
      playRuntimeEnabled.checked = Boolean(state.settings.runtimeDataEnabled);
    }

    const playRuntimeType = panel.querySelector("[data-action-change='play-runtime-type']");
    const baseOptions = [
      { value: "dni", label: "DNI" },
      { value: "affiliate", label: "N° de afiliado" },
      { value: "authorization", label: "Autorizacion" },
      { value: "name", label: "Nombre" },
      { value: "password", label: "Contrasena" },
      { value: "generic", label: "Otro" }
    ];
    const customTypes = Array.isArray(state.settings.runtimeCustomTypes) ? state.settings.runtimeCustomTypes : [];
    const customOptions = customTypes
      .filter((label) => typeof label === "string" && label.trim())
      .map((label) => ({ value: `custom:${label.trim().toLowerCase()}`, label: label.trim() }));
    const options = [...baseOptions, ...customOptions];
    const optionHtml = options
      .map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`)
      .join("");

    if (playRuntimeType) {
      const currentValue = String(state.settings.runtimeDataType || "generic");
      if (playRuntimeType.innerHTML !== optionHtml) {
        playRuntimeType.innerHTML = optionHtml;
      }
      if (document.activeElement !== playRuntimeType) {
        playRuntimeType.value = options.some((o) => o.value === currentValue) ? currentValue : "generic";
      }
    }

    const playRuntimeData = panel.querySelector("[data-action-input='play-runtime-data']");
    if (playRuntimeData && document.activeElement !== playRuntimeData) {
      playRuntimeData.value = String(state.settings.runtimeData || "");
    }

    const runtimeItemList = panel.querySelector("[data-runtime-item-list]");
    if (runtimeItemList) {
      const items = Array.isArray(state.settings.runtimeDataItems) ? state.settings.runtimeDataItems : [];
      if (items.length === 0) {
        runtimeItemList.innerHTML = "";
      } else {
        runtimeItemList.innerHTML = items.map((item, index) => {
          const selectedValue = String(item && item.type ? item.type : "generic");
          const selectedOptionsHtml = options
            .map((o) => `<option value="${escapeHtml(o.value)}"${o.value === selectedValue ? " selected" : ""}>${escapeHtml(o.label)}</option>`)
            .join("");
          const checked = item && item.enabled ? " checked" : "";
          const value = escapeHtml(String(item && item.data ? item.data : ""));
          return `
            <div class="webmatic-runtime-item-row">
              <label class="webmatic-runtime-item-toggle" title="Usar este dato">
                <input type="checkbox" data-action-change="play-runtime-item-enabled" data-index="${index}"${checked} />
              </label>
              <select class="webmatic-field-control" data-action-change="play-runtime-item-type" data-index="${index}">${selectedOptionsHtml}</select>
              <input class="webmatic-field-control" data-action-input="play-runtime-item-data" data-index="${index}" type="text" value="${value}" placeholder="Ingresa el dato" autocomplete="off" />
              <button class="webmatic-action-btn webmatic-btn-ghost" data-action="play-runtime-item-remove" data-index="${index}" type="button">Quitar</button>
            </div>
          `;
        }).join("");
      }
    }

    const runtimeTemplateSelect = panel.querySelector("[data-action-change='play-runtime-template-select']");
    if (runtimeTemplateSelect) {
      const templates = Array.isArray(state.settings.runtimeDataTemplates) ? state.settings.runtimeDataTemplates : [];
      const selectedId = String(state.settings.runtimeTemplateSelectedId || "");
      const tplHtml = [`<option value="">Sin plantilla</option>`]
        .concat(templates.map((tpl) => {
          const id = escapeHtml(String(tpl && tpl.id ? tpl.id : ""));
          const name = escapeHtml(String(tpl && tpl.name ? tpl.name : "Plantilla"));
          return `<option value="${id}">${name}</option>`;
        }))
        .join("");
      if (runtimeTemplateSelect.innerHTML !== tplHtml) {
        runtimeTemplateSelect.innerHTML = tplHtml;
      }
      if (document.activeElement !== runtimeTemplateSelect) {
        runtimeTemplateSelect.value = templates.some((t) => String(t.id) === selectedId) ? selectedId : "";
      }
    }

    const customTypeList = panel.querySelector("[data-custom-type-list]");
    if (customTypeList) {
      const customTypes = Array.isArray(state.settings.runtimeCustomTypes) ? state.settings.runtimeCustomTypes : [];
      if (customTypes.length === 0) {
        customTypeList.innerHTML = '<div class="webmatic-macro-empty">Sin tipos personalizados</div>';
      } else {
        customTypeList.innerHTML = customTypes
          .map((label) => `<div class="webmatic-custom-type-item"><span>${escapeHtml(label)}</span><button class="webmatic-action-btn webmatic-btn-ghost" data-action="settings-custom-type-remove" data-custom-label="${escapeHtml(label)}" type="button">Quitar</button></div>`)
          .join("");
      }
    }

    const folderDisplay = panel.querySelector("[data-folder-display]");
    if (folderDisplay) {
      const val = String(state.settings.downloadFolder || "");
      folderDisplay.textContent = val || "Sin carpeta";
      folderDisplay.classList.toggle("webmatic-folder-empty", !val);
    }

    renderLibrary(panel, state);

    // Record tab button: red when recording
    const recordTabBtn = panel.querySelector("[data-record-btn]");
    if (recordTabBtn) {
      if (state.recorder.isRecording) {
        recordTabBtn.textContent = `\u23F9 Detener (${state.draft.steps.length})`;
        recordTabBtn.dataset.recording = "true";
      } else {
        recordTabBtn.textContent = "\u25CF Grabar";
        delete recordTabBtn.dataset.recording;
      }
    }

    const saveModal = panel.querySelector("[data-save-modal]");
    if (saveModal) {
      const open = state.ui.saveModal && state.ui.saveModal.open;
      saveModal.style.display = open ? "block" : "none";
      if (open) {
        const scriptArea = saveModal.querySelector("[data-save-script]");
        if (scriptArea && !scriptArea.dataset.userEdited) {
          scriptArea.value = state.ui.saveModal.script;
        }
      }
    }

    // Script editor overlay
    const scriptEditor = panel.querySelector("[data-script-editor]");
    if (scriptEditor) {
      const se = state.ui.scriptEditor;
      const isOpen = se && se.open;
      scriptEditor.style.display = isOpen ? "flex" : "none";
      if (isOpen) {
        const area = scriptEditor.querySelector("[data-script-editor-area]");
        const title = scriptEditor.querySelector("[data-script-editor-title]");
        if (area && document.activeElement !== area) {
          // Strip the WM_JSON embedded comment — it's an internal detail, not meant
          // for manual editing. If the user edits the IIM lines and saves, the save
          // handler will re-generate WM_JSON from the new steps automatically.
          const displayScript = (se.script || "").split("\n").filter(
            (l) => !l.trimStart().startsWith("// WM_JSON:")
          ).join("\n");
          area.value = displayScript;
        }
        if (title) {
          title.textContent = se.macroId ? "Editar script" : "Script grabado";
        }
        // Save button label changes depending on whether we're editing an existing macro
        const saveBtn = scriptEditor.querySelector("[data-action='script-editor-save']");
        if (saveBtn) {
          saveBtn.textContent = se.macroId ? "💾 Guardar" : "💾 Guardar macro…";
          saveBtn.disabled = false;
          saveBtn.classList.remove("webmatic-btn-disabled");
        }
      }
    }
  }

  function bindModeEvents(onModeSelected, onActionClicked) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) {
      return;
    }

    panel.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      // Edit button (pencil) on macro item — must check before macro-item selection
      if (target.dataset.action === "macro-edit" && target.dataset.macroId) {
        if (typeof onActionClicked === "function") {
          onActionClicked("macro-edit", { macroId: target.dataset.macroId });
        }
        return;
      }

      // Macro list item click
      const macroItem = target.closest("[data-macro-id]");
      if (macroItem && !macroItem.dataset.action && typeof onActionClicked === "function") {
        onActionClicked("library-select", { value: macroItem.dataset.macroId });
        return;
      }

      const action = target.dataset.action;

      if (action === "save-editor-toggle") {
        const scriptArea = panel.querySelector("[data-save-script]");
        if (scriptArea) {
          const visible = scriptArea.style.display !== "none";
          scriptArea.style.display = visible ? "none" : "block";
          scriptArea.dataset.userEdited = "1";
          target.textContent = visible ? "Editar script" : "Ocultar script";
        }
        return;
      }

      const mode = target.dataset.mode;
      if (mode) {
        onModeSelected(mode);
        return;
      }

      if (action === "save-confirm") {
        const nameInput = panel.querySelector("[data-save-name]");
        const scriptArea = panel.querySelector("[data-save-script]");
        if (typeof onActionClicked === "function") {
          onActionClicked("save-confirm", {
            name: nameInput ? nameInput.value.trim() : "",
            script: scriptArea ? scriptArea.value : ""
          });
        }
        return;
      }

      if (action === "folder-pick") {
        if (typeof onActionClicked === "function") {
          onActionClicked("folder-pick", {});
        }
        return;
      }

      if (action === "settings-custom-type-add") {
        const draftInput = panel.querySelector("[data-action-input='settings-custom-type-draft']");
        if (typeof onActionClicked === "function") {
          onActionClicked("settings-custom-type-add", {
            value: draftInput ? String(draftInput.value || "").trim() : ""
          });
        }
        return;
      }

      if (action === "script-editor-tab") {
        if (typeof onActionClicked === "function") {
          onActionClicked("script-editor-tab", { tab: target.dataset.scriptTab || "visual" });
        }
        return;
      }

      if (action && typeof onActionClicked === "function") {
        onActionClicked(action, {
          variant: target.dataset.variant ? Number(target.dataset.variant) : undefined,
          customLabel: target.dataset.customLabel ? String(target.dataset.customLabel) : undefined,
          index: typeof target.dataset.index !== "undefined" ? Number(target.dataset.index) : undefined
        });
      }
    });

    panel.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const action = target.dataset.actionChange;
      if (action && typeof onActionClicked === "function") {
        onActionClicked(action, {
          checked: "checked" in target ? target.checked : undefined,
          value: target.value,
          index: typeof target.dataset.index !== "undefined" ? Number(target.dataset.index) : undefined
        });
      }
    });

    panel.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const action = target.dataset.actionInput;
      if (action && typeof onActionClicked === "function") {
        onActionClicked(action, {
          value: target.value,
          index: typeof target.dataset.index !== "undefined" ? Number(target.dataset.index) : undefined
        });
      }
    });
  }

  const api = Object.freeze({
    mount,
    unmount,
    render,
    bindModeEvents,
    wmModal
  });

  globalScope.WebMaticUiShell = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);