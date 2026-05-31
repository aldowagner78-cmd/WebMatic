"use strict";

(function () {
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const wm = window.wmDesktop;

  // ── Refs ──────────────────────────────────────────────────────────
  const webview        = $("#wm-webview");
  const urlInput       = $("#wm-url-input");
  const btnBack        = $("#wm-back");
  const btnFwd         = $("#wm-fwd");
  const btnReload      = $("#wm-reload");
  const btnGo          = $("#wm-go");
  const btnMin         = $("#wm-min");
  const btnMax         = $("#wm-max");
  const btnClose       = $("#wm-close");
  const versionEl      = $("#wm-app-version");
  const darkToggle     = $("#wm-dark-toggle");
  const swatchRow      = $("#wm-swatches");
  const tabBtns        = $$(".wm-tab-btn");
  const viewEls        = $$(".wm-view");
  const btnSetStart    = $("#wm-set-startup");
  const btnClearSes    = $("#wm-clear-session");
  const cfgStepDelay   = $("#wm-cfg-step-delay");
  const cfgStepTimeout = $("#wm-cfg-step-timeout");

  // Grabacion/reproduccion
  const btnRecord      = $("#wm-btn-record");
  const btnPlay        = $("#wm-btn-play");
  const btnStop        = $("#wm-btn-stop");
  const btnSave        = $("#wm-btn-save");
  const btnClear       = $("#wm-btn-clear");
  const recDot         = $("#wm-rec-dot");
  const recLabel       = $("#wm-rec-label");
  const saveForm       = $("#wm-save-form");
  const saveName       = $("#wm-save-name");
  const saveConfirm    = $("#wm-save-confirm");
  const saveCancel     = $("#wm-save-cancel");
  const stepsCard      = $("#wm-steps-card");
  const stepList       = $("#wm-step-list");
  const stepBadge      = $("#wm-step-badge");
  const loopToggle     = $("#wm-loop-toggle");
  const repeatCount    = $("#wm-repeat-count");
  const playStatusCard = $("#wm-playback-status-card");
  const progressFill   = $("#wm-progress-fill");
  const progressText   = $("#wm-progress-text");
  const playMsg        = $("#wm-play-msg");
  const libSearch      = $("#wm-lib-search");
  const macroList      = $("#wm-macro-list");
  const btnImportIim   = $("#wm-btn-import-iim");
  const btnBookmark      = $("#wm-btn-bookmark");
  const bookmarksBar     = $("#wm-bookmarks-bar");
  const bmPopover        = $("#wm-bm-popover");
  const bmNameInput      = $("#wm-bm-name-input");
  const bmPopConfirm     = $("#wm-bm-pop-confirm");
  const bmPopCancel      = $("#wm-bm-pop-cancel");
  const btnImportBm      = $("#wm-btn-import-bookmarks");

  // ── Estado ────────────────────────────────────────────────────────
  let settings      = { themeMode: "dark", themeVariant: 1, startupUrl: "https://www.google.com/" };
  let currentSteps  = [];      // pasos capturados en memoria
  let isRecording   = false;
  let isPlaying     = false;
  let allMacros     = [];
  let bookmarks     = [];      // favoritos guardados
  let recorderScript = null;
  let playerScript   = null;
  let playDoneTimer  = null;   // handle del timeout post-reproduccion

  // ── Tema ──────────────────────────────────────────────────────────
  function applyTheme() {
    const resolved = wm.theme.resolve(settings.themeMode, settings.themeVariant);
    wm.theme.apply(resolved.palette, resolved.mode);
    darkToggle.checked = (settings.themeMode === "dark");
    renderSwatches();
  }

  function renderSwatches() {
    swatchRow.innerHTML = "";
    const mode = settings.themeMode;
    wm.theme.PALETTES[mode].forEach((p, idx) => {
      const variant = idx + 1;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wm-swatch" + (variant === settings.themeVariant ? " active" : "");
      btn.title = wm.theme.VARIANT_LABELS[idx];
      btn.style.background = "linear-gradient(135deg, " + p.headerFrom + ", " + p.headerTo + ")";
      btn.addEventListener("click", async () => {
        settings = await wm.settings.set("themeVariant", variant);
        applyTheme();
      });
      swatchRow.appendChild(btn);
    });
  }

  darkToggle.addEventListener("change", async () => {
    const newMode = darkToggle.checked ? "dark" : "light";
    settings = await wm.settings.set("themeMode", newMode);
    applyTheme();
  });

  // ── Tabs ──────────────────────────────────────────────────────────
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      viewEls.forEach((v) => {
        if (v.dataset.view === tab) v.removeAttribute("hidden");
        else                        v.setAttribute("hidden", "");
      });
    });
  });

  // ── Favoritos (barra de bookmarks) ───────────────────────────────
  function renderBookmarks() {
    // Mantener el boton de importar al inicio
    bookmarksBar.innerHTML = "";
    const importBtn = document.createElement("button");
    importBtn.id = "wm-btn-import-bookmarks";
    importBtn.className = "wm-bm-import-btn";
    importBtn.title = "Importar favoritos desde Chrome / Edge / Brave";
    importBtn.textContent = "\uD83D\uDCC2 Importar";
    importBtn.addEventListener("click", importBrowserBookmarks);
    bookmarksBar.appendChild(importBtn);

    bookmarks.forEach((bm, i) => {
      const btn = document.createElement("button");
      btn.className = "wm-bm-btn";
      btn.title = bm.url;

      const icon = document.createElement("img");
      icon.className = "wm-bm-icon";
      const host = (() => { try { return new URL(bm.url).hostname; } catch (_) { return ""; } })();
      if (host) icon.src = "https://www.google.com/s2/favicons?domain=" + host + "&sz=16";
      icon.onerror = () => { icon.style.display = "none"; };

      const label = document.createElement("span");
      label.textContent = bm.title;

      const del = document.createElement("button");
      del.className = "wm-bm-del";
      del.textContent = "\u00D7";
      del.title = "Eliminar favorito";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        bookmarks.splice(i, 1);
        await wm.settings.set("bookmarks", bookmarks);
        renderBookmarks();
      });

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.appendChild(del);
      btn.addEventListener("click", () => {
        webview.src = bm.url;
        urlInput.value = bm.url;
      });
      bookmarksBar.appendChild(btn);
    });
  }

  // Muestra el popover debajo del boton estrella
  let _bmPendingUrl = "";
  function openBmPopover() {
    const url = urlInput.value.trim();
    if (!url || url === "about:blank") return;
    _bmPendingUrl = url;
    let defaultName = url;
    try { defaultName = new URL(url).hostname.replace(/^www\./, ""); } catch (_) {}
    bmNameInput.value = defaultName;
    bmPopover.removeAttribute("hidden");
    // Posicionar debajo del boton de estrella
    const rect = btnBookmark.getBoundingClientRect();
    bmPopover.style.top  = (rect.bottom + 6) + "px";
    bmPopover.style.left = Math.max(4, rect.right - 270) + "px";
    setTimeout(() => { bmNameInput.select(); bmNameInput.focus(); }, 30);
  }

  function closeBmPopover() {
    bmPopover.setAttribute("hidden", "");
    _bmPendingUrl = "";
  }

  async function confirmBmPopover() {
    const title = bmNameInput.value.trim() || _bmPendingUrl;
    if (!_bmPendingUrl) { closeBmPopover(); return; }
    bookmarks.push({ title, url: _bmPendingUrl });
    await wm.settings.set("bookmarks", bookmarks);
    renderBookmarks();
    closeBmPopover();
  }

  btnBookmark.addEventListener("click", openBmPopover);
  bmPopConfirm.addEventListener("click", confirmBmPopover);
  bmPopCancel.addEventListener("click",  closeBmPopover);
  bmNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter")  confirmBmPopover();
    if (e.key === "Escape") closeBmPopover();
  });
  // Cerrar al hacer clic fuera
  document.addEventListener("mousedown", (e) => {
    if (!bmPopover.hasAttribute("hidden") && !bmPopover.contains(e.target) && e.target !== btnBookmark) {
      closeBmPopover();
    }
  });

  // Importar favoritos desde Chrome / Edge / Brave
  async function importBrowserBookmarks() {
    const result = await wm.bookmarks.importBrowser();
    if (!result.ok) {
      if (result.error !== "cancelado") alert(result.error);
      return;
    }
    const incoming = result.bookmarks || [];
    if (!incoming.length) { alert("No se encontraron favoritos en ese archivo."); return; }
    // Merge: evitar duplicados por URL
    const existing = new Set(bookmarks.map(b => b.url));
    const added = incoming.filter(b => !existing.has(b.url));
    bookmarks.push(...added);
    await wm.settings.set("bookmarks", bookmarks);
    renderBookmarks();
    alert("Se importaron " + added.length + " favoritos nuevos (" + incoming.length + " en total).");
  }

  // ── Controles ventana ─────────────────────────────────────────────
  btnMin.addEventListener("click",   () => wm.window.minimize());
  btnMax.addEventListener("click",   () => wm.window.maximizeToggle());
  btnClose.addEventListener("click", () => wm.window.close());

  // ── Navegacion ────────────────────────────────────────────────────
  function normalizeUrl(input) {
    const t = (input || "").trim();
    if (!t) return null;
    if (/^https?:\/\//i.test(t)) return t;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(t)) return "https://" + t;
    return "https://www.google.com/search?q=" + encodeURIComponent(t);
  }

  function go() {
    const url = normalizeUrl(urlInput.value);
    if (url) webview.src = url;
  }

  btnGo.addEventListener("click",    go);
  urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  btnBack.addEventListener("click",   () => { try { if (webview.canGoBack())    webview.goBack();    } catch (_) {} });
  btnFwd.addEventListener("click",    () => { try { if (webview.canGoForward()) webview.goForward(); } catch (_) {} });
  btnReload.addEventListener("click", () => { try { webview.reload(); } catch (_) {} });

  webview.addEventListener("did-navigate",         (e) => { urlInput.value = e.url; });
  webview.addEventListener("did-navigate-in-page", (e) => { urlInput.value = e.url; });
  webview.addEventListener("did-start-loading",    ()  => btnReload.classList.add("loading"));
  webview.addEventListener("did-stop-loading",     ()  => {
    btnReload.classList.remove("loading");
    // Si estaba grabando y la pagina recargo, re-inyectar el recorder
    if (isRecording && recorderScript) {
      webview.executeJavaScript(recorderScript).catch(() => {});
    }
  });

  // ── Config: sesion / startup URL ──────────────────────────────────
  btnSetStart.addEventListener("click", async () => {
    const cur = webview.getURL ? webview.getURL() : webview.src;
    if (cur && cur !== "about:blank") {
      settings = await wm.settings.set("startupUrl", cur);
      btnSetStart.textContent = "OK — URL guardada";
      setTimeout(() => { btnSetStart.textContent = "Usar URL actual como inicio"; }, 1500);
    }
  });

  btnClearSes.addEventListener("click", async () => {
    if (!confirm("Vas a borrar TODOS los datos de sesion (cookies, login). ¿Continuar?")) return;
    await wm.session.clear();
    webview.reload();
  });

  // ── Etiqueta legible para un paso ─────────────────────────────────
  function stepLabel(step) {
    const sel = step.selector ? step.selector.slice(0, 32) : "";
    const val = step.value   ? String(step.value).slice(0, 24) : "";
    switch (step.type) {
      case "click":    return "\uD83D\uDDB1 click: "    + sel;
      case "dblclick": return "\uD83D\uDDB1\uD83D\uDDB1 dblclick: " + sel;
      case "input":    return "\u270F input: " + sel + (val ? " = " + val : "");
      case "text":     return "\u2328 text: \u201C"  + val + "\u201D en " + sel;
      case "check":    return "\u2611 check: "  + sel + " = " + step.checked;
      case "key":      return "\u2328 key: "    + step.key;
      case "wait":     return "\u23F1 wait: "   + (step.seconds ? step.seconds + "s" : step.ms + "ms");
      case "navigate": return "\uD83C\uDF10 nav: " + (step.url || "").slice(0, 40);
      case "extract":  return "\uD83D\uDCCB extract \u2192 " + step.variable + " desde " + sel;
      default:         return step.type + (sel ? ": " + sel : "");
    }
  }

  // ── Renderiza lista de pasos ──────────────────────────────────────
  // Campos editables por tipo de paso
  const STEP_FIELDS = {
    navigate: [{ key: "url",      label: "URL"      }],
    click:    [{ key: "selector", label: "Selector" }],
    dblclick: [{ key: "selector", label: "Selector" }],
    input:    [{ key: "selector", label: "Selector" }, { key: "value", label: "Valor" }],
    text:     [{ key: "selector", label: "Selector" }, { key: "value", label: "Valor" }],
    check:    [{ key: "selector", label: "Selector" }, { key: "checked", label: "checked" }],
    key:      [{ key: "key",      label: "Tecla"    }],
    wait:     [{ key: "ms",       label: "ms"       }],
    extract:  [{ key: "selector", label: "Selector" }, { key: "variable", label: "Var" }]
  };

  function openStepEditor(li, step, idx) {
    // Reemplaza el label por un formulario inline
    const lbl = li.querySelector(".wm-step-lbl");
    if (!lbl) return; // ya está en modo edición
    const fields = STEP_FIELDS[step.type] || [];
    if (!fields.length) return; // tipo no editable

    const editZone = document.createElement("div");
    editZone.className = "wm-step-edit";

    const inputs = {};
    fields.forEach(({ key, label }) => {
      const row = document.createElement("div");
      row.className = "wm-step-edit-row";
      const lbEl = document.createElement("label");
      lbEl.textContent = label + ":";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = step[key] != null ? String(step[key]) : "";
      inp.dataset.key = key;
      inputs[key] = inp;
      row.appendChild(lbEl);
      row.appendChild(inp);
      editZone.appendChild(row);
    });

    const actions = document.createElement("div");
    actions.className = "wm-step-edit-actions";

    const okBtn = document.createElement("button");
    okBtn.className = "wm-step-edit-ok";
    okBtn.textContent = "OK";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "wm-step-edit-cancel";
    cancelBtn.textContent = "Cancelar";

    actions.appendChild(okBtn);
    actions.appendChild(cancelBtn);
    editZone.appendChild(actions);

    lbl.replaceWith(editZone);
    // Foco en el primer campo
    const firstInp = editZone.querySelector("input");
    if (firstInp) firstInp.focus();

    function commit() {
      fields.forEach(({ key }) => {
        const raw = inputs[key].value;
        // Convertir a número si el campo original era numérico
        if (typeof step[key] === "number" || key === "ms") {
          step[key] = Number(raw) || 0;
        } else if (key === "checked") {
          step[key] = raw === "true" || raw === "1";
        } else {
          step[key] = raw;
        }
      });
      currentSteps[idx] = step;
      renderSteps();
    }

    okBtn.addEventListener("click", commit);
    cancelBtn.addEventListener("click", renderSteps);
    editZone.addEventListener("keydown", (e) => {
      if (e.key === "Enter")  { e.preventDefault(); commit(); }
      if (e.key === "Escape") { e.preventDefault(); renderSteps(); }
    });
  }

  function renderSteps() {
    stepBadge.textContent = String(currentSteps.length);
    if (currentSteps.length === 0) {
      stepsCard.setAttribute("hidden", "");
      return;
    }
    stepsCard.removeAttribute("hidden");
    stepList.innerHTML = "";
    currentSteps.forEach((step, idx) => {
      const li = document.createElement("li");
      li.className = "wm-step-item";
      li.dataset.idx = idx;

      const num = document.createElement("span");
      num.className = "wm-step-num";
      num.textContent = idx + 1;

      const lbl = document.createElement("span");
      lbl.className = "wm-step-lbl";
      lbl.textContent = stepLabel(step);
      lbl.title = "Click para editar • " + JSON.stringify(step);
      lbl.addEventListener("click", () => openStepEditor(li, step, idx));

      // ── Botones de accion (reordenar + eliminar) ──────────────────
      const actionsCol = document.createElement("div");
      actionsCol.className = "wm-step-actions";

      const upBtn = document.createElement("button");
      upBtn.className = "wm-step-move";
      upBtn.title = "Subir";
      upBtn.textContent = "\u25B4";
      upBtn.disabled = idx === 0;
      upBtn.addEventListener("click", () => {
        [currentSteps[idx - 1], currentSteps[idx]] = [currentSteps[idx], currentSteps[idx - 1]];
        renderSteps();
      });

      const downBtn = document.createElement("button");
      downBtn.className = "wm-step-move";
      downBtn.title = "Bajar";
      downBtn.textContent = "\u25BE";
      downBtn.disabled = idx === currentSteps.length - 1;
      downBtn.addEventListener("click", () => {
        [currentSteps[idx], currentSteps[idx + 1]] = [currentSteps[idx + 1], currentSteps[idx]];
        renderSteps();
      });

      const del = document.createElement("button");
      del.className = "wm-step-del";
      del.title = "Eliminar paso";
      del.textContent = "\u2715";
      del.addEventListener("click", () => {
        currentSteps.splice(idx, 1);
        updateRecorderUI();
      });

      actionsCol.appendChild(upBtn);
      actionsCol.appendChild(downBtn);

      li.appendChild(num);
      li.appendChild(lbl);
      li.appendChild(actionsCol);
      li.appendChild(del);
      stepList.appendChild(li);
    });
    // scroll al ultimo paso
    stepList.lastElementChild && stepList.lastElementChild.scrollIntoView({ block: "nearest" });
  }

  function updateRecorderUI() {
    const hasSteps = currentSteps.length > 0;
    btnPlay.disabled  = !hasSteps || isPlaying;
    btnSave.disabled  = !hasSteps || isPlaying;
    btnClear.disabled = !hasSteps || isRecording || isPlaying;
    renderSteps();
  }

  // ── GRABAR ────────────────────────────────────────────────────────
  async function startRecording() {
    if (!recorderScript) {
      recorderScript = await wm.scripts.get("recorder-inject");
    }
    try {
      await webview.executeJavaScript(recorderScript);
    } catch (e) {
      recLabel.textContent = "Error al inyectar recorder";
      return;
    }
    isRecording = true;
    recDot.classList.add("active");
    recLabel.textContent = "Grabando…";
    btnRecord.textContent = "\u23F9 Parar grabacion";
    btnRecord.classList.add("active");
    btnPlay.disabled  = true;
    btnSave.disabled  = true;
    btnClear.disabled = true;
  }

  async function stopRecording() {
    try {
      await webview.executeJavaScript("if(window.__wmRec) window.__wmRec.stop();");
    } catch (_) {}
    isRecording = false;
    recDot.classList.remove("active");
    recLabel.textContent = currentSteps.length + " pasos capturados";
    btnRecord.textContent = "\u25CF Grabar";
    btnRecord.classList.remove("active");
    updateRecorderUI();
  }

  btnRecord.addEventListener("click", () => {
    if (isRecording) stopRecording(); else startRecording();
  });

  // Recibe pasos desde el webview via ipc-message
  webview.addEventListener("ipc-message", (e) => {
    if (e.channel === "wm:step") {
      const step = e.args[0];
      if (step && isRecording) {
        currentSteps.push(step);
        recLabel.textContent = currentSteps.length + " pasos";
        renderSteps();
      }
    }
    if (e.channel === "wm:play-status") {
      handlePlayStatus(e.args[0]);
    }
  });

  // ── REPRODUCIR ────────────────────────────────────────────────────
  async function startPlayback(steps) {
    if (!playerScript) {
      playerScript = await wm.scripts.get("player-inject");
    }
    isPlaying = true;
    btnPlay.disabled = true;
    btnStop.disabled = false;
    btnRecord.disabled = true;
    playStatusCard.removeAttribute("hidden");
    progressFill.style.width = "0%";
    progressText.textContent = "Paso 0 / " + steps.length;
    playMsg.textContent = "";

    try {
      // Pasa los pasos como global antes del script
      const retryMs   = 400;
      const timeoutMs = settings.stepTimeoutMs != null ? settings.stepTimeoutMs : 8000;
      const delayMs   = settings.stepDelayMs   != null ? settings.stepDelayMs   : 100;
      const configCode = "window.__wmPlayerConfig = " + JSON.stringify({ steps, retryMs, timeoutMs, delayMs }) + ";";
      await webview.executeJavaScript(configCode);
      const result = await webview.executeJavaScript(playerScript);
      // Usar el valor de retorno como fuente principal para el evento "done".
      // sendToHost puede fallar si el preload no esta disponible; el retorno siempre llega.
      if (result && result.status === "done" && isPlaying) {
        handlePlayStatus({ type: "done", total: result.total });
      }
    } catch (e) {
      handlePlayStatus({ type: "error", message: e.message });
    }
  }

  async function stopPlayback() {
    try {
      await webview.executeJavaScript("if(window.__wmPlayerStop) window.__wmPlayerStop();");
    } catch (_) {}
    isPlaying = false;
    btnPlay.disabled  = currentSteps.length === 0;
    btnStop.disabled  = true;
    btnRecord.disabled = false;
    playStatusCard.setAttribute("hidden", "");
  }

  function handlePlayStatus(status) {
    if (!status) return;
    if (status.type === "step") {
      const pct = Math.round(((status.idx + 1) / status.total) * 100);
      progressFill.style.width = pct + "%";
      progressText.textContent = "Paso " + (status.idx + 1) + " / " + status.total;
    }
    if (status.type === "done") {
      progressFill.style.width = "100%";
      progressText.textContent = status.total + " / " + status.total;
      playMsg.textContent = "\u2713 Completado";
      playMsg.className = "wm-play-msg success";
      const loop = loopToggle.checked;
      const reps = parseInt(repeatCount.value, 10) || 1;
      if (loop) {
        setTimeout(() => startPlayback(currentSteps), 600);
      } else if (reps > 1) {
        repeatCount.value = reps - 1;
        setTimeout(() => startPlayback(currentSteps), 600);
      } else {
        if (playDoneTimer) clearTimeout(playDoneTimer);
        playDoneTimer = setTimeout(() => {
          playDoneTimer = null;
          isPlaying = false;
          btnPlay.disabled   = currentSteps.length === 0;
          btnStop.disabled   = true;
          btnRecord.disabled = false;
          updateRecorderUI();
        }, 1200);
      }
    }
    if (status.type === "error") {
      playMsg.textContent = "\u26A0 Error: " + (status.message || "desconocido");
      playMsg.className = "wm-play-msg error";
      isPlaying = false;
      btnPlay.disabled   = currentSteps.length === 0;
      btnStop.disabled   = true;
      btnRecord.disabled = false;
    }
  }

  btnPlay.addEventListener("click", () => startPlayback(currentSteps));
  btnStop.addEventListener("click", () => stopPlayback());

  // ── GUARDAR MACRO ─────────────────────────────────────────────────
  btnSave.addEventListener("click", () => {
    saveForm.removeAttribute("hidden");
    saveName.value = "";
    saveName.focus();
  });

  saveCancel.addEventListener("click", () => saveForm.setAttribute("hidden", ""));

  async function doSave() {
    const name = saveName.value.trim();
    if (!name) { saveName.focus(); return; }
    allMacros = await wm.macros.save(name, [...currentSteps]);
    saveForm.setAttribute("hidden", "");
    renderMacroLibrary();
  }

  saveConfirm.addEventListener("click", doSave);
  saveName.addEventListener("keydown", (e) => { if (e.key === "Enter") doSave(); });

  // ── DESCARTAR PASOS ───────────────────────────────────────────────
  btnClear.addEventListener("click", () => {
    if (!confirm("¿Descartar todos los pasos capturados?")) return;
    currentSteps = [];
    recLabel.textContent = "Listo";
    updateRecorderUI();
  });

  // ── BIBLIOTECA DE MACROS ──────────────────────────────────────────
  function renderMacroLibrary(filter) {
    const q = (filter || "").toLowerCase();
    const visible = q ? allMacros.filter(m => m.name.toLowerCase().includes(q)) : allMacros;
    macroList.innerHTML = "";

    if (visible.length === 0) {
      const li = document.createElement("li");
      li.className = "wm-macro-empty";
      li.textContent = allMacros.length === 0 ? "No hay macros guardados aun." : "Sin resultados.";
      macroList.appendChild(li);
      return;
    }

    visible.forEach((macro) => {
      const li = document.createElement("li");
      li.className = "wm-macro-item";

      const info = document.createElement("div");
      info.className = "wm-macro-info";

      const nameEl = document.createElement("div");
      nameEl.className = "wm-macro-name";
      nameEl.textContent = macro.name;
      nameEl.title = "Doble clic para renombrar";
      nameEl.addEventListener("dblclick", () => startRename(macro, nameEl));

      const meta = document.createElement("div");
      meta.className = "wm-macro-meta";
      meta.textContent = (macro.steps ? macro.steps.length : 0) + " pasos";

      info.appendChild(nameEl);
      info.appendChild(meta);

      const btns = document.createElement("div");
      btns.className = "wm-macro-btns";

      const playBtn = document.createElement("button");
      playBtn.className = "wm-macro-btn wm-macro-btn-play";
      playBtn.title = "Reproducir";
      playBtn.textContent = "\u25B6";
      playBtn.addEventListener("click", () => {
        currentSteps = [...(macro.steps || [])];
        updateRecorderUI();
        // Ir al tab macros y lanzar reproduccion
        tabBtns.find(b => b.dataset.tab === "play").click();
        setTimeout(() => startPlayback(currentSteps), 100);
      });

      const loadBtn = document.createElement("button");
      loadBtn.className = "wm-macro-btn";
      loadBtn.title = "Cargar pasos (para editar)";
      loadBtn.textContent = "\u21A4";
      loadBtn.addEventListener("click", () => {
        currentSteps = [...(macro.steps || [])];
        updateRecorderUI();
      });

      const delBtn = document.createElement("button");
      delBtn.className = "wm-macro-btn wm-macro-btn-del";
      delBtn.title = "Eliminar";
      delBtn.textContent = "\u2715";
      delBtn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar \"" + macro.name + "\"?")) return;
        allMacros = await wm.macros.delete(macro.id);
        renderMacroLibrary(libSearch.value);
      });

      const exportBtn = document.createElement("button");
      exportBtn.className = "wm-macro-btn";
      exportBtn.title = "Exportar como .iim";
      exportBtn.textContent = "\u2b07";
      exportBtn.addEventListener("click", async () => {
        const result = await wm.macros.exportFile(macro.name, macro.steps || []);
        if (result && result.ok) {
          exportBtn.textContent = "\u2713";
          setTimeout(() => { exportBtn.textContent = "\u2b07"; }, 1500);
        }
      });

      btns.appendChild(playBtn);
      btns.appendChild(loadBtn);
      btns.appendChild(exportBtn);
      btns.appendChild(delBtn);
      li.appendChild(info);
      li.appendChild(btns);
      macroList.appendChild(li);
    });
  }

  function startRename(macro, nameEl) {
    const originalName = macro.name;
    const inp = document.createElement("input");
    inp.className = "wm-text-input wm-rename-input";
    inp.value = originalName;
    nameEl.replaceWith(inp);
    inp.focus();
    inp.select();

    async function commit() {
      const newName = inp.value.trim() || originalName;
      if (newName !== originalName) {
        allMacros = await wm.macros.rename(macro.id, newName);
        macro.name = newName;
      }
      inp.replaceWith(nameEl);
      nameEl.textContent = macro.name;
    }

    inp.addEventListener("blur",   commit);
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter")  { e.preventDefault(); inp.blur(); }
      if (e.key === "Escape") { inp.value = originalName; inp.blur(); }
    });
  }

  libSearch.addEventListener("input", () => renderMacroLibrary(libSearch.value));

  // ── Settings de reproduccion (delay / timeout) ────────────────────
  cfgStepDelay.addEventListener("change", async () => {
    const v = Math.max(0, parseInt(cfgStepDelay.value, 10) || 0);
    cfgStepDelay.value = v;
    settings = await wm.settings.set("stepDelayMs", v);
  });
  cfgStepTimeout.addEventListener("change", async () => {
    const v = Math.max(500, parseInt(cfgStepTimeout.value, 10) || 500);
    cfgStepTimeout.value = v;
    settings = await wm.settings.set("stepTimeoutMs", v);
  });

  // ── Importar .iim ─────────────────────────────────────────────────────────
  btnImportIim.addEventListener("click", async () => {
    const result = await wm.macros.importFile();
    if (result) {
      allMacros = await wm.macros.save(result.name, result.steps);
      renderMacroLibrary();
    }
  });

  // ── Bootstrap ─────────────────────────────────────────────────────
  (async function init() {
    const [v, wvPreloadPath] = await Promise.all([
      wm.app.getVersion(),
      wm.app.getWebviewPreloadPath()
    ]);
    versionEl.textContent = "v" + v;

    // Establece el preload del webview (bridge para IPC)
    const fileUrl = "file:///" + wvPreloadPath.replace(/\\/g, "/");
    webview.setAttribute("preload", fileUrl);

    settings  = await wm.settings.getAll();
    allMacros = await wm.macros.getAll();
    bookmarks  = Array.isArray(settings.bookmarks) ? settings.bookmarks : [];
    renderBookmarks();

    // Aplicar settings de reproduccion a los inputs de Config
    cfgStepDelay.value   = settings.stepDelayMs   != null ? settings.stepDelayMs   : 100;
    cfgStepTimeout.value = settings.stepTimeoutMs != null ? settings.stepTimeoutMs : 8000;

    applyTheme();
    renderMacroLibrary();

    // loadURL garantiza que el preload bridge se inyecte incluso si startupUrl="about:blank"
    webview.loadURL(settings.startupUrl || "about:blank");

    // Helper de reset para tests E2E: limpia estado y recarga el webview.
    // Acepta una URL de destino (pasar testServer.url garantiza que el preload se inyecte).
    window.__wmTestReset = function (resetUrl) {
      try { if (window.__wmPlayerStop) window.__wmPlayerStop(); } catch (_) {}
      // Cancelar cualquier timer de fin de reproduccion pendiente
      if (playDoneTimer) { clearTimeout(playDoneTimer); playDoneTimer = null; }
      currentSteps          = [];
      isRecording           = false;
      isPlaying             = false;
      recLabel.textContent  = "Listo";
      recDot.classList.remove("active");
      btnRecord.textContent = "\u25CF Grabar";
      btnRecord.classList.remove("active");
      btnRecord.disabled    = false;
      loopToggle.checked    = false;
      repeatCount.value     = "1";
      saveForm.setAttribute("hidden", "");
      playStatusCard.setAttribute("hidden", "");
      playMsg.textContent   = "";
      playMsg.className     = "wm-play-msg";
      progressFill.style.width = "0%";
      updateRecorderUI();
      // Recarga el webview para que el preload bridge se inyecte limpio.
      return new Promise(function (resolve) {
        webview.addEventListener("did-finish-load", function onLoad() {
          webview.removeEventListener("did-finish-load", onLoad);
          resolve();
        });
        webview.loadURL(resetUrl || "about:blank");
      });
    };
  }());
}());
