(function initUiComponents(globalScope) {
  function _doc() {
    return globalScope && globalScope.document ? globalScope.document : document;
  }

  function createMacroEmpty(text) {
    const empty = _doc().createElement("div");
    empty.className = "webmatic-macro-empty";
    empty.textContent = text;
    return empty;
  }

  function createMacroItem(macro) {
    const item = _doc().createElement("div");
    item.className = "webmatic-macro-item";
    item.dataset.macroId = macro.id;

    const nameSpan = _doc().createElement("span");
    nameSpan.className = "webmatic-macro-name";
    nameSpan.textContent = macro.name;

    const countSpan = _doc().createElement("span");
    countSpan.className = "webmatic-macro-count";
    const n = Array.isArray(macro.steps) ? macro.steps.length : 0;
    countSpan.textContent = n > 0 ? `${n}p` : "";
    countSpan.title = n > 0 ? `${n} paso${n !== 1 ? "s" : ""}` : "Sin pasos";

    const editBtn = _doc().createElement("button");
    editBtn.className = "webmatic-macro-edit-btn";
    editBtn.dataset.action = "macro-edit";
    editBtn.dataset.macroId = macro.id;
    editBtn.setAttribute("aria-label", "Editar macro");
    editBtn.setAttribute("title", "Editar script");
    editBtn.textContent = "\u270F\uFE0F";

    item.appendChild(nameSpan);
    item.appendChild(countSpan);
    item.appendChild(editBtn);
    return item;
  }

  function createThemeSwatch(color, variant, activeVariant) {
    const button = _doc().createElement("button");
    button.className = `webmatic-swatch${variant === activeVariant ? " active" : ""}`;
    button.dataset.action = "settings-theme-variant";
    button.dataset.variant = String(variant);
    button.dataset.color = color.accent;
    button.title = `Variante ${variant}`;
    button.style.background = color.accent;
    return button;
  }

  function updateFolderDisplay(folderDisplay, value) {
    if (!folderDisplay) return;
    const val = String(value || "");
    folderDisplay.textContent = val || "Sin carpeta";
    folderDisplay.classList.toggle("webmatic-folder-empty", !val);
  }

  function updateRecordTabButton(recordTabBtn, isRecording, stepCount) {
    if (!recordTabBtn) return;
    if (isRecording) {
      recordTabBtn.textContent = `\u23F9 Detener (${stepCount})`;
      recordTabBtn.dataset.recording = "true";
    } else {
      recordTabBtn.textContent = "\u25CF Grabar";
      delete recordTabBtn.dataset.recording;
    }
  }

  const api = {
    createMacroEmpty,
    createMacroItem,
    createThemeSwatch,
    updateFolderDisplay,
    updateRecordTabButton
  };

  globalScope.WebMaticUiComponents = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
