(function initStepEditor(globalScope) {
  function _stepDefinitions() {
    if (typeof WebMaticStepDefinitions !== "undefined") return WebMaticStepDefinitions;
    if (globalScope && globalScope.WebMaticStepDefinitions) return globalScope.WebMaticStepDefinitions;

    if (typeof require === "function") {
      return require("./schema/step-definitions.js");
    }

    throw new Error("WebMaticStepDefinitions no esta disponible");
  }

  function _editorMeta() {
    if (typeof WebMaticEditorMeta !== "undefined") return WebMaticEditorMeta;
    if (globalScope && globalScope.WebMaticEditorMeta) return globalScope.WebMaticEditorMeta;

    if (typeof require === "function") {
      return require("./state/editor-meta.js");
    }

    throw new Error("WebMaticEditorMeta no esta disponible");
  }

  function _editorCatalogs() {
    if (typeof WebMaticEditorCatalogs !== "undefined") return WebMaticEditorCatalogs;
    if (globalScope && globalScope.WebMaticEditorCatalogs) return globalScope.WebMaticEditorCatalogs;

    if (typeof require === "function") {
      return require("./state/editor-catalogs.js");
    }

    throw new Error("WebMaticEditorCatalogs no esta disponible");
  }

  function _editorRenderUtils() {
    if (typeof WebMaticEditorRenderUtils !== "undefined") return WebMaticEditorRenderUtils;
    if (globalScope && globalScope.WebMaticEditorRenderUtils) return globalScope.WebMaticEditorRenderUtils;

    if (typeof require === "function") {
      return require("./renderers/editor-render-utils.js");
    }

    throw new Error("WebMaticEditorRenderUtils no esta disponible");
  }

  function _blockHeaderRenderer() {
    if (typeof WebMaticBlockHeaderRenderer !== "undefined") return WebMaticBlockHeaderRenderer;
    if (globalScope && globalScope.WebMaticBlockHeaderRenderer) return globalScope.WebMaticBlockHeaderRenderer;

    if (typeof require === "function") {
      return require("./renderers/block-header-renderer.js");
    }

    throw new Error("WebMaticBlockHeaderRenderer no esta disponible");
  }

  function _blockActionsRenderer() {
    if (typeof WebMaticBlockActionsRenderer !== "undefined") return WebMaticBlockActionsRenderer;
    if (globalScope && globalScope.WebMaticBlockActionsRenderer) return globalScope.WebMaticBlockActionsRenderer;

    if (typeof require === "function") {
      return require("./renderers/block-actions-renderer.js");
    }

    throw new Error("WebMaticBlockActionsRenderer no esta disponible");
  }

  function _stepRowRenderer() {
    if (typeof WebMaticStepRowRenderer !== "undefined") return WebMaticStepRowRenderer;
    if (globalScope && globalScope.WebMaticStepRowRenderer) return globalScope.WebMaticStepRowRenderer;

    if (typeof require === "function") {
      return require("./renderers/step-row-renderer.js");
    }

    throw new Error("WebMaticStepRowRenderer no esta disponible");
  }

  function _stepHumanizer() {
    if (typeof WebMaticStepHumanizer !== "undefined") return WebMaticStepHumanizer;
    if (globalScope && globalScope.WebMaticStepHumanizer) return globalScope.WebMaticStepHumanizer;

    if (typeof require === "function") {
      return require("./presentation/step-humanizer.js");
    }

    throw new Error("WebMaticStepHumanizer no esta disponible");
  }

  function _formFieldsRenderer() {
    if (typeof WebMaticFormFieldsRenderer !== "undefined") return WebMaticFormFieldsRenderer;
    if (globalScope && globalScope.WebMaticFormFieldsRenderer) return globalScope.WebMaticFormFieldsRenderer;

    if (typeof require === "function") {
      return require("./renderers/form-fields-renderer.js");
    }

    throw new Error("WebMaticFormFieldsRenderer no esta disponible");
  }

  function _editorValidation() {
    if (typeof WebMaticEditorValidation !== "undefined") return WebMaticEditorValidation;
    if (globalScope && globalScope.WebMaticEditorValidation) return globalScope.WebMaticEditorValidation;

    if (typeof require === "function") {
      return require("./validation/editor-validation.js");
    }

    throw new Error("WebMaticEditorValidation no esta disponible");
  }

  function _blockUtils() {
    if (typeof WebMaticBlockUtils !== "undefined") return WebMaticBlockUtils;
    if (globalScope && globalScope.WebMaticBlockUtils) return globalScope.WebMaticBlockUtils;

    if (typeof require === "function") {
      return require("./blocks/block-utils.js");
    }

    throw new Error("WebMaticBlockUtils no esta disponible");
  }

  function _dragDropUtils() {
    if (typeof WebMaticDragDropUtils !== "undefined") return WebMaticDragDropUtils;
    if (globalScope && globalScope.WebMaticDragDropUtils) return globalScope.WebMaticDragDropUtils;

    if (typeof require === "function") {
      return require("./blocks/drag-drop-utils.js");
    }

    throw new Error("WebMaticDragDropUtils no esta disponible");
  }

  function _inlineRecordingState() {
    if (typeof WebMaticInlineRecordingState !== "undefined") return WebMaticInlineRecordingState;
    if (globalScope && globalScope.WebMaticInlineRecordingState) return globalScope.WebMaticInlineRecordingState;

    if (typeof require === "function") {
      return require("./state/inline-recording-state.js");
    }

    throw new Error("WebMaticInlineRecordingState no esta disponible");
  }

  function _editorStateUtils() {
    if (typeof WebMaticEditorStateUtils !== "undefined") return WebMaticEditorStateUtils;
    if (globalScope && globalScope.WebMaticEditorStateUtils) return globalScope.WebMaticEditorStateUtils;

    if (typeof require === "function") {
      return require("./state/editor-state-utils.js");
    }

    throw new Error("WebMaticEditorStateUtils no esta disponible");
  }

  function _shortLabel(s) {
    return _stepDefinitions().shortLabel(s);
  }

  function _mkBtn(text, title, disabled, onClick) {
    return _editorRenderUtils().mkBtn(text, title, disabled, onClick);
  }

  const RESET_POLICY_OPTIONS = _editorRenderUtils().RESET_POLICY_OPTIONS;

  function _cloneMeta(meta) {
    return _editorMeta().cloneMeta(meta);
  }

  function _normalizeResetPolicyMode(policy) {
    return _editorMeta().normalizeResetPolicyMode(policy);
  }

  function _normalizeStepEditorMeta(meta) {
    return _editorMeta().normalizeStepEditorMeta(meta);
  }

  function _isBaselineDefaultStep(step) {
    return _editorMeta().isBaselineDefaultStep(step);
  }

  function _normalizeComparableStepValue(value) {
    return _editorMeta().normalizeComparableStepValue(value);
  }

  function _hasMeaningfulStepChanges(originalStep, updatedStep) {
    return _editorMeta().hasMeaningfulStepChanges(originalStep, updatedStep);
  }

  class StepEditor {
    constructor() {
      this.steps = [];
      this._container = null;
      this._onChange = null;
      this._addFormOpen = false;
      this._editIdx = null;   // index of the step being edited, or null
      this._onRecordRequest = null; // callback(onDone) para grabar pasos inline
      this._pendingRecord = false;  // true mientras la grabación inline está activa
      this._onPickRequest = null;   // callback(fieldName, onPicked) para picker visual
      this._inventory = [];         // inventario de controles capturado al grabar
      this._autocompleteCatalogs = {}; // meta.autocompleteCatalogs
      this._movedStepMeta = new Map(); // stepRef -> {source, at}
      this._macroMeta = _normalizeStepEditorMeta(null);
      this._dragFromIdx = null;
      this._dragMode = "step"; // "step" | "block"
      this._collapsedBlocks = new Set(); // keys "start:end" de bloques colapsados
      this._addFormTargetIndex = null;
      this._addFormAsNewBlock = false;
      this._pendingRecordIntoBlock = null; // blockKey mientras graba inline en un bloque
    }

    /** Registra el inventario de controles (macro.meta.pageInventories). */
    setInventory(inventories) {
      this._inventory = Array.isArray(inventories) ? inventories : [];
    }

    setAutocompleteCatalogs(catalogs) {
      this._autocompleteCatalogs = (catalogs && typeof catalogs === "object") ? catalogs : {};
    }

    setMeta(meta) {
      this._macroMeta = _normalizeStepEditorMeta(meta);
      this._render();
    }

    getMeta() {
      return _cloneMeta(this._macroMeta);
    }

    _catalogOptionsForSelector(selector) {
      return _editorCatalogs().catalogOptionsForSelector(this._autocompleteCatalogs, selector);
    }

    /** Registra el handler que activa la grabación inline desde content.js */
    setRecordRequestHandler(fn) {
      this._onRecordRequest = fn;
    }

    /** Registra el handler del picker visual desde content.js */
    setPickerHandler(fn) {
      this._onPickRequest = fn;
    }

    /** Activa el picker para un campo; content.js oculta el panel y espera el clic */
    _pickElement(fieldName, onPicked) {
      if (typeof this._onPickRequest === "function") {
        this._onPickRequest(fieldName, onPicked);
      }
    }

    /**
     * Funcion pura testeable: resuelve un selector contra `root` y, si apunta a un
     * <select> real, devuelve sus opciones reales. Generico para cualquier web.
     * Devuelve null si el selector no existe o no apunta a un <select>.
     * @param {string} selector
     * @param {Document|Element} [root] - por defecto document
     * @returns {{index:number,value:string,text:string,selected:boolean,disabled:boolean}[]|null}
     */
    static getSelectOptionsForSelector(selector, root) {
      const doc = root || (typeof document !== "undefined" ? document : null);
      if (!selector || !doc || typeof doc.querySelector !== "function") return null;
      let el = null;
      try { el = doc.querySelector(selector); } catch (e) { return null; }
      if (!el) return null;
      const isSelect =
        (typeof HTMLSelectElement !== "undefined" && el instanceof HTMLSelectElement) ||
        (el.tagName && el.tagName.toLowerCase() === "select");
      if (!isSelect || !el.options) return null;
      return Array.from(el.options).map((o, i) => ({
        index: i,
        value: o.value,
        text: (o.text != null ? o.text : (o.textContent || "")).trim(),
        selected: !!o.selected,
        disabled: !!o.disabled
      }));
    }

    /**
     * Inserta un combo amigable de opciones cuando el paso en edición lo admite
     * (choose_option, input o text) y existen opciones conocidas para su selector.
     * Las opciones se obtienen primero del <select> real de la página y, si no hay,
     * del inventario capturado al grabar (macro.meta.pageInventories). Al elegir,
     * sincroniza los campos manuales `value` (y `text` en choose_option), sin
     * borrarlos si el valor escrito no está en la lista. Si no hay opciones, no
     * hace nada (queda el editor manual).
     */
    _syncOptionPicker(fieldsDiv, typeValue) {
      const supported = typeValue === "choose_option" || typeValue === "input" || typeValue === "text";
      if (!fieldsDiv || !supported) return;
      const prev = fieldsDiv.querySelector("[data-wm-optpicker]");
      if (prev) prev.remove();

      const selInput = fieldsDiv.querySelector("[data-field='selector']");
      if (!selInput) return;
      const selector = (selInput.value || "").trim();

      // 1) Opciones del <select> real de la página. 2) Inventario de la macro.
      let options = StepEditor.getSelectOptionsForSelector(selector);
      if ((!options || options.length === 0) && this._inventory && this._inventory.length) {
        const inv = (typeof globalScope !== "undefined" && globalScope.WebMaticPageInventory) || null;
        const valInput  = fieldsDiv.querySelector("[data-field='value']");
        const textInput = fieldsDiv.querySelector("[data-field='text']");
        const typedValue = ((valInput && valInput.value) || (textInput && textInput.value) || "").trim();
        const stepHint = {
          selector,
          value: typedValue,
          text: (textInput && textInput.value ? String(textInput.value).trim() : "")
        };
        if (inv && typeof inv.findOptionsForStep === "function") {
          options = inv.findOptionsForStep(stepHint, this._inventory);
        } else if (inv && typeof inv.findOptionsForSelector === "function") {
          options = inv.findOptionsForSelector(selector, this._inventory);
        }
      }
      const fromCatalogMeta = this._catalogOptionsForSelector(selector);
      let sourceCtrl = null;
      const invApi = (typeof globalScope !== "undefined" && globalScope.WebMaticPageInventory) || null;
      if (invApi && typeof invApi.findControlForSelector === "function") {
        sourceCtrl = invApi.findControlForSelector(selector, this._inventory);
      }
      const sourceKind = String(sourceCtrl && sourceCtrl.controlKind || "");
      const isTypedAutocomplete = sourceKind === "autocomplete" || sourceKind === "text-input" || sourceKind === "datalist";

      // Para campos tipeables/autocomplete, el catálogo por selector de metadata
      // es más confiable que heurísticas de inventario y evita cruces de campo.
      if (fromCatalogMeta && fromCatalogMeta.length > 0 && (isTypedAutocomplete || !options || options.length <= 1)) {
        options = fromCatalogMeta;
      }
      if (!options || options.length === 0) return;

      const valInput  = fieldsDiv.querySelector("[data-field='value']");
      const textInput = fieldsDiv.querySelector("[data-field='text']");

      const block = document.createElement("label");
      block.className = "wm-sved-field-label";
      block.setAttribute("data-wm-optpicker", "1");
      block.textContent = "opciones del campo";

      // Campo principal de interacción (escribir para filtrar/seleccionar).
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:4px;align-items:center;width:100%";

      const filterInput = document.createElement("input");
      filterInput.className = "wm-sved-field-input";
      filterInput.type = "text";
      filterInput.placeholder = "escribe para filtrar opciones";
      filterInput.style.flex = "1";
      row.appendChild(filterInput);

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.textContent = "▾";
      toggleBtn.title = "Mostrar opciones";
      toggleBtn.style.cssText = "all:initial;display:inline-flex;align-items:center;justify-content:center;background:#0ea5e9;color:#fff;border-radius:6px;padding:4px 8px;font-size:14px;cursor:pointer;flex-shrink:0;font-family:system-ui,sans-serif";
      row.appendChild(toggleBtn);

      block.appendChild(row);

      const combo = document.createElement("select");
      combo.className = "wm-sved-select";
      combo.dataset.wmOptcombo = "1";
      combo.style.display = "none";

      const panel = document.createElement("div");
      panel.dataset.wmOptpanel = "1";
      panel.style.cssText = "display:none;max-height:180px;overflow:auto;border:1px solid rgba(14,165,233,0.45);border-radius:6px;background:#fff;margin-top:4px";

      const renderOpts = (filter) => {
        combo.replaceChildren();
        const f = (filter || "").toLowerCase();
        options.forEach((o) => {
          if (f && !((o.text || "").toLowerCase().includes(f) ||
                     String(o.value).toLowerCase().includes(f))) return;
          const opt = document.createElement("option");
          opt.value = o.value;
          opt.textContent = o.text || o.value;
          if (o.disabled) opt.disabled = true;
          combo.appendChild(opt);
        });
      };

      const renderPanel = (filter) => {
        panel.replaceChildren();
        const f = (filter || "").toLowerCase();
        options.forEach((o) => {
          if (f && !((o.text || "").toLowerCase().includes(f) ||
                     String(o.value).toLowerCase().includes(f))) return;
          const item = document.createElement("button");
          item.type = "button";
          item.textContent = o.text || o.value;
          item.style.cssText = "all:initial;display:block;width:100%;box-sizing:border-box;padding:7px 9px;cursor:pointer;font-size:12px;font-family:system-ui,sans-serif;color:#0f172a;border-bottom:1px solid rgba(15,23,42,0.08)";
          if (o.disabled) {
            item.disabled = true;
            item.style.opacity = "0.45";
            item.style.cursor = "not-allowed";
          }
          item.addEventListener("click", () => {
            combo.value = o.value;
            combo.dispatchEvent(new Event("change", { bubbles: true }));
            panel.style.display = "none";
          });
          panel.appendChild(item);
        });
      };
      renderOpts("");
      renderPanel("");

      // Preseleccion: por value actual, si no por text actual, si no por selected real.
      const curVal  = valInput  ? valInput.value.trim()  : "";
      const curText = textInput ? textInput.value.trim() : "";
      let pre = null;
      if (curVal)  pre = options.find((o) => String(o.value) === curVal);
      if (!pre && curText) pre = options.find((o) => (o.text || "").trim() === curText);
      if (!pre && curVal) pre = options.find((o) => (o.text || "").trim() === curVal);
      if (!pre) pre = options.find((o) => o.selected);
      if (pre) {
        combo.value = pre.value;
        filterInput.value = pre.text || pre.value;
      }

      let suppressFieldFilter = false;

      combo.addEventListener("change", () => {
        const chosen = options.find((o) => String(o.value) === combo.value);
        if (!chosen) return;
        suppressFieldFilter = true;
        if (valInput) {
          valInput.value = chosen.value;
          valInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (textInput) {
          textInput.value = chosen.text;
          textInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        filterInput.value = chosen.text || chosen.value;
        suppressFieldFilter = false;
      });

      // Comportamiento "tipo autocomplete" en editor visual:
      // al escribir en VALUE/TEXT, se filtra el catálogo del desplegable.
      const applyFieldFilter = () => {
        if (suppressFieldFilter) return;
        const q = String(filterInput.value || "").trim();
        renderOpts(q);
        renderPanel(q);
        panel.style.display = "block";
        if (valInput) {
          valInput.value = q;
          valInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (textInput) {
          textInput.value = q;
          textInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      };
      filterInput.addEventListener("input", applyFieldFilter);
      filterInput.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowDown") {
          ev.preventDefault();
          renderPanel("");
          panel.style.display = "block";
        }
        if (ev.key === "Escape") panel.style.display = "none";
      });

      toggleBtn.addEventListener("click", () => {
        if (panel.style.display === "block") {
          panel.style.display = "none";
          return;
        }
        renderPanel("");
        panel.style.display = "block";
        filterInput.focus();
      });

      block.appendChild(combo);
      block.appendChild(panel);

      // Insertar el combo justo despues del campo selector (mismo layout existente).
      let anchor = selInput;
      while (anchor && anchor.parentElement !== fieldsDiv) anchor = anchor.parentElement;
      if (anchor && anchor.nextSibling) fieldsDiv.insertBefore(block, anchor.nextSibling);
      else fieldsDiv.appendChild(block);
    }

    setSteps(steps) {
      this.steps = Array.isArray(steps) ? JSON.parse(JSON.stringify(steps)) : [];
      this._movedStepMeta.clear();
      this._collapsedBlocks.clear();
      this._addFormOpen = false;
      this._addFormTargetIndex = null;
      this._addFormAsNewBlock = false;
      this._pendingRecordIntoBlock = null;
      this._collapseAllBlocksByDefault();
      this._initCollapsedBlocksFromSteps();
    }

    _openAddForm(insertAt, asNewBlock = false) {
      const state = _editorStateUtils().openAddFormState(insertAt, this.steps.length, asNewBlock);
      this._addFormOpen = state.addFormOpen;
      this._addFormTargetIndex = state.addFormTargetIndex;
      this._addFormAsNewBlock = state.addFormAsNewBlock;
      this._editIdx = null;
      this._render();
    }

    _closeAddForm() {
      const state = _editorStateUtils().closeAddFormState();
      this._addFormOpen = state.addFormOpen;
      this._addFormTargetIndex = state.addFormTargetIndex;
      this._addFormAsNewBlock = state.addFormAsNewBlock;
    }

    getSteps() {
      return JSON.parse(JSON.stringify(this.steps));
    }

    hasPendingReorderChanges() {
      return this._movedStepMeta.size > 0;
    }

    clearReorderHighlights() {
      if (this._movedStepMeta.size === 0) return;
      this._movedStepMeta.clear();
      this._render();
    }

    mount(container, onChange) {
      this._container = container;
      this._onChange = onChange;
      this._addFormOpen = false;
      this._editIdx = null;
      this._pendingRecordIntoBlock = null;
      this._render();
    }

    unmount() {
      if (this._container) this._container.replaceChildren();
      this._container = null;
    }

    _fire() {
      if (typeof this._onChange === "function") this._onChange(this.getSteps(), this.getMeta());
    }

    _resetPolicyHint(mode) {
      const found = RESET_POLICY_OPTIONS.find((opt) => opt.value === _normalizeResetPolicyMode(mode));
      return found ? found.hint : RESET_POLICY_OPTIONS[0].hint;
    }

    _setResetPolicyMode(mode) {
      const next = _normalizeStepEditorMeta(this._macroMeta);
      next.preRunResetPolicy = { mode: _normalizeResetPolicyMode(mode) };
      this._macroMeta = next;
    }

    _buildMacroMetaPanel() {
      const panel = document.createElement("div");
      panel.className = "wm-sved-meta-panel";

      const title = document.createElement("div");
      title.className = "wm-sved-meta-title";
      title.textContent = "Política de reseteo";
      panel.appendChild(title);

      const row = document.createElement("label");
      row.className = "wm-sved-field-label";
      row.textContent = "Cuándo restaurar campos";

      const select = document.createElement("select");
      select.className = "wm-sved-select";
      select.dataset.field = "preRunResetPolicy";
      const currentMode = _normalizeResetPolicyMode(this._macroMeta && this._macroMeta.preRunResetPolicy);
      RESET_POLICY_OPTIONS.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === currentMode) option.selected = true;
        select.appendChild(option);
      });
      row.appendChild(select);
      panel.appendChild(row);

      const hint = document.createElement("div");
      hint.className = "wm-sved-meta-hint";
      hint.textContent = this._resetPolicyHint(currentMode);
      panel.appendChild(hint);

      select.addEventListener("change", () => {
        this._setResetPolicyMode(select.value);
        hint.textContent = this._resetPolicyHint(select.value);
        this._fire();
      });

      return panel;
    }

    _render() {
      const c = this._container;
      if (!c) return;
      c.replaceChildren();

      c.appendChild(this._buildMacroMetaPanel());

      if (this.steps.length === 0 && !this._addFormOpen) {
        const empty = document.createElement("div");
        empty.className = "wm-sved-empty";
        empty.textContent = "Sin pasos. Usa \u2018+ Agregar paso\u2019 para comenzar, o graba una macro.";
        c.appendChild(empty);
      } else if (this.steps.length > 0) {
        const list = document.createElement("div");
        list.className = "wm-sved-list";
        const dragEnabled = this._editIdx === null;

        if (this.hasPendingReorderChanges()) {
          const pending = document.createElement("div");
          pending.className = "wm-sved-reorder-pending";
          const n = this._movedStepMeta.size;
          pending.textContent = `Reordenado pendiente: ${n} paso${n !== 1 ? "s" : ""}. Guarda para aplicar o cierra para descartar.`;
          list.appendChild(pending);
        }

        const clearDropIndicators = () => {
          list.querySelectorAll(".wm-sved-row-drop-before, .wm-sved-row-drop-after").forEach((el) => {
            el.classList.remove("wm-sved-row-drop-before", "wm-sved-row-drop-after");
          });
        };

        const clearDraggingState = () => {
          this._dragFromIdx = null;
          this._dragMode = "step";
          clearDropIndicators();
          list.querySelectorAll(".wm-sved-row-dragging").forEach((el) => {
            el.classList.remove("wm-sved-row-dragging");
          });
        };

        const computeDropPos = (evt, row) => {
          const rect = row.getBoundingClientRect();
          return _dragDropUtils().computeDropPosition(evt.clientY, rect.top, rect.height);
        };

        const applyDropIndicator = (row, pos) => {
          clearDropIndicators();
          row.classList.add(pos === "after" ? "wm-sved-row-drop-after" : "wm-sved-row-drop-before");
        };

        const persistedCollapsed = new Set();
        const blockContextMeta = this._buildExecutionBlockContextMeta();
        let idx = 0;
        while (idx < this.steps.length) {
          const block = this._findExecutionBlockBounds(idx) || { start: idx, end: idx };
          const start = block.start;
          const end = block.end;
          if (start !== idx) {
            idx += 1;
            continue;
          }

          const blockSize = end - start + 1;
          const blockOrdinal = this._getExecutionBlockOrdinal(start);
          const blockKey = `${start}:${end}`;
          const canCollapse = blockSize > 1;
          const hasOpenEditInBlock = this._editIdx !== null && this._editIdx >= start && this._editIdx <= end;
          const collapsed = canCollapse && this._collapsedBlocks.has(blockKey) && !hasOpenEditInBlock;
          const isDefaultsBlock = _isBaselineDefaultStep(this.steps[start]);
          const contextMeta = blockContextMeta.get(start) || { visitIndex: 0, isReentry: false, blockKey: "", contextLabel: "" };
          if (canCollapse && this._collapsedBlocks.has(blockKey)) persistedCollapsed.add(blockKey);

          const blockWrap = document.createElement("section");
          blockWrap.className = `wm-sved-block wm-sved-block-theme-${((blockOrdinal - 1) % 4) + 1}`;
          if (isDefaultsBlock) blockWrap.classList.add("wm-sved-block-defaults");
          if (contextMeta.isReentry) blockWrap.classList.add("wm-sved-block-reentry");
          blockWrap.dataset.blockStart = String(start);
          blockWrap.dataset.blockEnd = String(end);
          if (contextMeta.visitIndex > 0) blockWrap.dataset.blockVisit = String(contextMeta.visitIndex);
          if (contextMeta.isReentry) blockWrap.dataset.blockReentry = "true";
          if (collapsed) blockWrap.classList.add("wm-sved-block-collapsed");

          const blockKeyName = this._stepBlockKey(this.steps[start]);
          const blockContext = contextMeta.contextLabel || this._formatBlockContextLabel(blockKeyName);
          const visitSuffix = contextMeta.visitIndex > 0 ? ` · visita ${contextMeta.visitIndex}` : "";
          const blockHeader = _blockHeaderRenderer().buildExecutionBlockHeader({
            documentRef: document,
            blockOrdinal,
            blockSize,
            blockContextLabel: blockContext,
            blockContextTitle: blockContext ? `Contexto del bloque: ${blockKeyName}${visitSuffix}` : "",
            visitIndex: contextMeta.visitIndex,
            isReentry: contextMeta.isReentry,
            collapsed,
            canCollapse,
            onToggle: () => {
              if (this._collapsedBlocks.has(blockKey)) this._collapsedBlocks.delete(blockKey);
              else this._collapsedBlocks.add(blockKey);
              this._render();
            }
          });

          blockWrap.appendChild(blockHeader);

          const blockBody = document.createElement("div");
          blockBody.className = "wm-sved-block-body";

          for (let rowIdx = start; rowIdx <= end; rowIdx++) {
            if (collapsed && rowIdx > start) continue;

            const step = this.steps[rowIdx];
            const rowBlock = this._findExecutionBlockBounds(rowIdx);
            const blockLead = !!rowBlock && rowBlock.start === rowIdx;
            const isBaselineDefault = _isBaselineDefaultStep(step);

            const movedMeta = this._movedStepMeta.get(step);
            const row = _stepRowRenderer().buildStepRow({
              documentRef: document,
              rowIdx,
              stepType: step.type,
              typeIcon: _stepDefinitions().TYPE_ICONS[step.type] || "\u25B8",
              actionLabel: _stepHumanizer().humanizeAction(step),
              humanLabel: _stepHumanizer().humanizeStep(step),
              shortLabel: _shortLabel(step),
              showTechnicalDetails: _stepHumanizer().shouldShowTechnicalDetails(step),
              blockOrdinal,
              blockSize,
              isBaselineDefault,
              dragEnabled,
              movedMeta,
              blockLead,
              isCollapsedSummary: collapsed && rowIdx === start && blockSize > 1,
              dragHandleTitle: (blockSize > 1 && blockLead)
                ? `Arrastra para reordenar bloque (${blockSize} pasos)`
                : "Arrastra para reordenar paso",
              onMoveUp: () => _mkBtn("\u2191", blockSize > 1 && blockLead ? "Subir bloque" : "Subir dentro del bloque", blockSize > 1 && blockLead ? rowBlock.start === 0 : (rowBlock ? rowIdx <= rowBlock.start : rowIdx === 0), () => this._move(rowIdx, -1, "button")),
              onMoveDown: () => _mkBtn("\u2193", blockSize > 1 && blockLead ? "Bajar bloque" : "Bajar dentro del bloque", blockSize > 1 && blockLead ? rowBlock.end === this.steps.length - 1 : (rowBlock ? rowIdx >= rowBlock.end : rowIdx === this.steps.length - 1), () => this._move(rowIdx, 1, "button")),
              onEditClick: () => {
                this._editIdx = this._editIdx === rowIdx ? null : rowIdx;
                this._addFormOpen = false;
                this._render();
              },
              onDeleteClick: () => this._delete(rowIdx)
            });

            if (dragEnabled) {
              row.addEventListener("dragstart", (evt) => {
                this._dragFromIdx = rowIdx;
                this._dragMode = _dragDropUtils().resolveDragMode(blockSize, blockLead, "auto");
                row.classList.add("wm-sved-row-dragging");
                if (evt.dataTransfer) {
                  evt.dataTransfer.effectAllowed = "move";
                  evt.dataTransfer.setData("text/plain", String(rowIdx));
                }
              });

              row.addEventListener("dragover", (evt) => {
                if (this._dragFromIdx === null) return;
                evt.preventDefault();
                const pos = computeDropPos(evt, row);
                applyDropIndicator(row, pos);
              });

              row.addEventListener("drop", (evt) => {
                if (this._dragFromIdx === null) return;
                evt.preventDefault();
                const from = this._dragFromIdx;
                const pos = computeDropPos(evt, row);
                const rawTarget = pos === "after" ? rowIdx + 1 : rowIdx;
                const to = _dragDropUtils().normalizeDropTarget(rawTarget, from);
                const mode = this._dragMode;
                clearDraggingState();
                if (to === from || to < 0 || to >= this.steps.length) return;
                this._moveToIndex(from, to, "drag", mode);
              });

              row.addEventListener("dragend", () => {
                clearDraggingState();
              });
            }

            blockBody.appendChild(row);

            if (this._editIdx === rowIdx) {
              blockBody.appendChild(this._buildEditForm(rowIdx));
            }
          }

          if (this._editIdx === null) {
            const blockActions = _blockActionsRenderer().buildBlockActions({
              documentRef: document,
              collapsed,
              blockKey,
              pendingRecordIntoBlock: this._pendingRecordIntoBlock,
              addButtonClass: collapsed
                ? "wm-sved-add-btn wm-sved-add-btn-block"
                : "wm-sved-add-btn wm-sved-add-btn-step",
              addButtonHtml: collapsed ? "&#9636; Agregar bloque" : "+ Agregar paso al bloque",
              addButtonTitle: collapsed
                ? "Inserta un bloque nuevo después de este"
                : "Inserta un paso al final de este bloque",
              onAddClick: () => this._openAddForm(end + 1, collapsed),
              onRecordRequest: typeof this._onRecordRequest === "function" ? this._onRecordRequest : null,
              onRecordClick: () => {
                this._pendingRecordIntoBlock = blockKey;
                this._render();
                this._onRecordRequest((capturedSteps) => {
                  this._pendingRecordIntoBlock = null;
                  const toInsert = _inlineRecordingState().normalizeInlineRecordedSteps(capturedSteps, false);
                  const insertAt = this._findExecutionBlockBounds(start)
                    ? this._findExecutionBlockBounds(start).end + 1
                    : end + 1;
                  for (let i = toInsert.length - 1; i >= 0; i--) {
                    this.steps.splice(insertAt, 0, toInsert[i]);
                  }
                  this._collapseAllBlocksByDefault();
                  this._render();
                  this._fire();
                });
              }
            });

            if (this._addFormOpen && this._addFormTargetIndex === end + 1) {
              blockBody.appendChild(blockActions);
              blockBody.appendChild(this._buildAddForm());
            } else {
              blockBody.appendChild(blockActions);
            }
          }

          blockWrap.appendChild(blockBody);
          list.appendChild(blockWrap);
          idx = end + 1;
        }

        this._collapsedBlocks = persistedCollapsed;
        c.appendChild(list);
      }

      // Only show add controls when not in edit mode
      if (this._editIdx === null) {
        if (this._pendingRecord) {
          // Grabación inline activa — mostrar indicador
          const recBar = document.createElement("div");
          recBar.className = "wm-sved-rec-bar";
          recBar.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:6px;font-size:12px;color:#dc2626;font-family:system-ui,sans-serif";
          const dot = document.createElement("span");
          dot.style.cssText = "display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444;animation:webmatic-pulse 1s infinite;flex-shrink:0";
          const lbl = document.createElement("span");
          lbl.textContent = "Grabando pasos nuevos — interactúa con la página. Detén la grabación cuando termines.";
          recBar.appendChild(dot);
          recBar.appendChild(lbl);
          c.appendChild(recBar);
        } else if (this._addFormOpen && this.steps.length === 0) {
          c.appendChild(this._buildAddForm());
        } else {
          const btnRow = document.createElement("div");
          btnRow.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap";
          if (this.steps.length === 0) {
            const addBtn = document.createElement("button");
            addBtn.className = "wm-sved-add-btn wm-sved-add-btn-block";
            addBtn.innerHTML = "&#9636; Agregar primer bloque";
            addBtn.addEventListener("click", () => {
              this._openAddForm(0, true);
            });
            btnRow.appendChild(addBtn);
          }
          if (typeof this._onRecordRequest === "function") {
            const recBtn = document.createElement("button");
            recBtn.className = "wm-sved-add-btn wm-sved-rec-btn";
            recBtn.style.cssText = "background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.4);color:#dc2626";
            recBtn.textContent = "\u23FA Grabar interacci\u00f3n (nuevo bloque)";
            recBtn.title = "Graba pasos y los agrega como bloque nuevo al final";
            recBtn.addEventListener("click", () => {
              this._pendingRecord = true;
              this._render();
              this._onRecordRequest((capturedSteps) => {
                this._pendingRecord = false;
                const next = _inlineRecordingState().normalizeInlineRecordedSteps(capturedSteps, true);
                for (const s of next) {
                  this.steps.push(s);
                }
                this._collapseAllBlocksByDefault();
                this._render();
                this._fire();
              });
            });
            btnRow.appendChild(recBtn);
          }
          c.appendChild(btnRow);
        }
      }
    }

    _buildEditForm(idx) {
      const step = this.steps[idx];
      const form = document.createElement("div");
      form.className = "wm-sved-add-form wm-sved-edit-form";

      const typeInfo = _stepDefinitions().STEP_TYPES.find((t) => t.value === step.type);

      // Advanced / nested step types not in the add-form list
      if (!typeInfo) {
        const msg = document.createElement("p");
        msg.className = "wm-sved-empty";
        msg.style.padding = "8px 0";
        msg.textContent = `Tipo avanzado “${step.type}” — edita en la pestaña “Script IIM”.`;
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "wm-sved-cancel-btn";
        cancelBtn.textContent = "Cerrar";
        cancelBtn.addEventListener("click", () => { this._editIdx = null; this._render(); });
        form.appendChild(msg);
        form.appendChild(cancelBtn);
        return form;
      }

      // Type selector
      const typeRow = document.createElement("label");
      typeRow.className = "wm-sved-field-label";
      typeRow.textContent = "Tipo de paso";
      const typeSelect = document.createElement("select");
      typeSelect.className = "wm-sved-select";
      _stepDefinitions().STEP_TYPES.forEach(({ value, label }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        if (value === step.type) opt.selected = true;
        typeSelect.appendChild(opt);
      });
      typeRow.appendChild(typeSelect);
      form.appendChild(typeRow);

      // Field inputs
      const fieldsDiv = document.createElement("div");
      fieldsDiv.className = "wm-sved-fields";

      const renderFields = (prefill) => {
        const ti = _stepDefinitions().STEP_TYPES.find((t) => t.value === typeSelect.value);
        if (!ti) return;
        _formFieldsRenderer().renderStepTypeFields({
          documentRef: document,
          fieldsDiv,
          typeValue: typeSelect.value,
          typeInfo: ti,
          prefill,
          onPickElement: this._onPickRequest ? (fieldName, onPicked) => this._pickElement(fieldName, onPicked) : null,
          onSyncOptionPicker: (targetFieldsDiv, typeValue) => this._syncOptionPicker(targetFieldsDiv, typeValue)
        });
      };

      // Pre-fill with current step values; on type change clear fields
      renderFields(step);
      typeSelect.addEventListener("change", () => renderFields({}));
      form.appendChild(fieldsDiv);

      // Confirm / cancel buttons
      const btnRow = document.createElement("div");
      btnRow.className = "wm-sved-add-btns";

      const confirmBtn = document.createElement("button");
      confirmBtn.className = "wm-sved-confirm-btn";
      confirmBtn.textContent = "✔ Guardar";
      confirmBtn.addEventListener("click", () => {
        const originalStep = step && typeof step === "object" ? { ...step } : step;
        const updated = { type: typeSelect.value };
        _formFieldsRenderer().readStepFields(fieldsDiv, updated);
        _editorValidation().normalizeEditedStep(updated, step);

        // Preserve block layout metadata handled by the visual editor.
        if (step && step._wmBlockStart) updated._wmBlockStart = true;
        if (step && step._wmCollapsed) updated._wmCollapsed = true;

        // If a captured default was edited, promote it to a normal user step.
        // If it was not changed, keep it as silent default.
        if (_isBaselineDefaultStep(step)) {
          const changed = _hasMeaningfulStepChanges(originalStep, updated);
          if (changed) {
            delete updated._baselineDefault;
            delete updated._fast;
          } else {
            updated._baselineDefault = true;
            updated._fast = true;
          }
        }

        this.steps[idx] = updated;
        this._editIdx = null;
        this._render();
        this._fire();
      });

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "wm-sved-cancel-btn";
      cancelBtn.textContent = "Cancelar";
      cancelBtn.addEventListener("click", () => { this._editIdx = null; this._render(); });

      btnRow.appendChild(confirmBtn);
      btnRow.appendChild(cancelBtn);
      form.appendChild(btnRow);
      return form;
    }

    _buildAddForm() {
      const form = document.createElement("div");
      form.className = "wm-sved-add-form";

      const typeRow = document.createElement("label");
      typeRow.className = "wm-sved-field-label";
      typeRow.textContent = "Tipo de paso";
      const typeSelect = document.createElement("select");
      typeSelect.className = "wm-sved-select";
      _stepDefinitions().STEP_TYPES.forEach(({ value, label }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        typeSelect.appendChild(opt);
      });
      typeRow.appendChild(typeSelect);
      form.appendChild(typeRow);

      const fieldsDiv = document.createElement("div");
      fieldsDiv.className = "wm-sved-fields";

      const renderFields = () => {
        const typeInfo = _stepDefinitions().STEP_TYPES.find((t) => t.value === typeSelect.value);
        if (!typeInfo) return;
        _formFieldsRenderer().renderStepTypeFields({
          documentRef: document,
          fieldsDiv,
          typeValue: typeSelect.value,
          typeInfo,
          prefill: null,
          onPickElement: this._onPickRequest ? (fieldName, onPicked) => this._pickElement(fieldName, onPicked) : null,
          onSyncOptionPicker: (targetFieldsDiv, typeValue) => this._syncOptionPicker(targetFieldsDiv, typeValue)
        });
      };

      typeSelect.addEventListener("change", renderFields);
      renderFields();
      form.appendChild(fieldsDiv);

      const btnRow = document.createElement("div");
      btnRow.className = "wm-sved-add-btns";

      const confirmBtn = document.createElement("button");
      confirmBtn.className = "wm-sved-confirm-btn";
      confirmBtn.textContent = "\u2714 Agregar";
      confirmBtn.addEventListener("click", () => {
        const step = { type: typeSelect.value };
        _formFieldsRenderer().readStepFields(fieldsDiv, step);
        _editorValidation().normalizeNewStep(step);
        if (this._addFormAsNewBlock) {
          step._wmBlockStart = true;
          step._wmCollapsed = true;
        }
        const insertAt = Number.isInteger(this._addFormTargetIndex) ? this._addFormTargetIndex : this.steps.length;
        if (insertAt < 0 || insertAt >= this.steps.length) this.steps.push(step);
        else this.steps.splice(insertAt, 0, step);
        this._closeAddForm();
        this._collapseAllBlocksByDefault();
        this._render();
        this._fire();
      });

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "wm-sved-cancel-btn";
      cancelBtn.textContent = "Cancelar";
      cancelBtn.addEventListener("click", () => {
        this._closeAddForm();
        this._render();
      });

      btnRow.appendChild(confirmBtn);
      btnRow.appendChild(cancelBtn);
      form.appendChild(btnRow);
      return form;
    }

    _markStepMoved(stepRef, source) {
      _editorStateUtils().markStepMoved(this._movedStepMeta, stepRef, source);
    }

    _normalizeBlockKey(raw) {
      return _blockUtils().normalizeBlockKey(raw);
    }

    _stepBlockKey(step) {
      return _blockUtils().stepBlockKey(step);
    }

    _formatBlockContextLabel(blockKey) {
      return _blockUtils().formatBlockContextLabel(blockKey);
    }

    _isExecutionBlockBoundaryType(stepType) {
      return _blockUtils().isExecutionBlockBoundaryType(stepType);
    }

    _isExecutionBlockBoundaryStep(step, idx) {
      return _blockUtils().isExecutionBlockBoundaryStep(step, idx, this.steps);
    }

    _wantsCollapsedByDefault(step) {
      return _blockUtils().wantsCollapsedByDefault(step);
    }

    _collapseAllBlocksByDefault() {
      _blockUtils().collectCollapsibleBlockKeys(this.steps).forEach((key) => {
        this._collapsedBlocks.add(key);
      });
    }

    _initCollapsedBlocksFromSteps() {
      _blockUtils().collectCollapsibleBlockKeys(this.steps, { onlyMarkedByDefault: true }).forEach((key) => {
        this._collapsedBlocks.add(key);
      });
    }

    _findExecutionBlockBounds(idx) {
      return _blockUtils().findExecutionBlockBounds(this.steps, idx);
    }

    _getExecutionBlockOrdinal(idx) {
      return _blockUtils().getExecutionBlockOrdinal(this.steps, idx);
    }

    _buildExecutionBlockContextMeta() {
      return _blockUtils().buildExecutionBlockContextMeta(this.steps);
    }

    _moveRangeToIndex(start, end, toIndex, source) {
      const len = end - start + 1;
      if (len <= 0) return;
      const segment = this.steps.splice(start, len);
      let insertAt = toIndex;
      if (insertAt > start) insertAt -= len;
      if (insertAt < 0) insertAt = 0;
      if (insertAt > this.steps.length) insertAt = this.steps.length;
      this.steps.splice(insertAt, 0, ...segment);

      if (this._editIdx !== null) {
        if (this._editIdx >= start && this._editIdx <= end) {
          this._editIdx = insertAt + (this._editIdx - start);
        } else if (this._editIdx < start && this._editIdx >= insertAt) {
          this._editIdx += len;
        } else if (this._editIdx > end && this._editIdx < insertAt + len) {
          this._editIdx -= len;
        }
      }

      segment.forEach((s) => this._markStepMoved(s, source));
      this._render();
      this._fire();
    }

    _moveToIndex(from, to, source, mode = "auto") {
      if (from === to) return;
      if (from < 0 || to < 0 || from >= this.steps.length || to >= this.steps.length) return;

      const block = this._findExecutionBlockBounds(from);
      if (block && block.start !== block.end) {
        const isBlockLead = from === block.start;
        const wantsBlockMove = mode === "block" || (mode === "auto" && isBlockLead);

        if (wantsBlockMove) {
          if (to >= block.start && to <= block.end) return;
          this._moveRangeToIndex(block.start, block.end, to, source);
          return;
        }

        // Movimiento individual seguro: no salir del bloque actual.
        if (to < block.start || to > block.end) return;
      }

      const moved = this.steps.splice(from, 1)[0];
      this.steps.splice(to, 0, moved);

      if (this._editIdx === from) {
        this._editIdx = to;
      } else if (this._editIdx !== null) {
        if (from < to && this._editIdx > from && this._editIdx <= to) {
          this._editIdx -= 1;
        } else if (from > to && this._editIdx >= to && this._editIdx < from) {
          this._editIdx += 1;
        }
      }

      this._markStepMoved(moved, source);
      this._render();
      this._fire();
    }

    _move(idx, dir, source = "button") {
      const block = this._findExecutionBlockBounds(idx);
      const isBlockLead = !!block && idx === block.start && block.start !== block.end;
      if (isBlockLead) {
        if (dir < 0) {
          if (block.start <= 0) return;
          this._moveRangeToIndex(block.start, block.end, block.start - 1, source);
          return;
        }
        if (dir > 0) {
          if (block.end >= this.steps.length - 1) return;
          this._moveRangeToIndex(block.start, block.end, block.end + 2, source);
          return;
        }
      }
      const ni = idx + dir;
      if (ni < 0 || ni >= this.steps.length) return;
      this._moveToIndex(idx, ni, source, "step");
    }

    _delete(idx) {
      const removed = this.steps.splice(idx, 1)[0];
      this._movedStepMeta.delete(removed);
      if (this._editIdx === idx) this._editIdx = null;
      else if (this._editIdx !== null && this._editIdx > idx) this._editIdx--;
      this._render();
      this._fire();
    }
  }

  globalScope.WebMaticStepEditor = StepEditor;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = StepEditor;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
