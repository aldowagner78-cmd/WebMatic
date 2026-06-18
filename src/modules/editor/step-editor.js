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

  function _shortLabel(s) {
    return _stepDefinitions().shortLabel(s);
  }

  function _mkBtn(text, title, disabled, onClick) {
    const btn = document.createElement("button");
    btn.className = "wm-sved-btn";
    btn.textContent = text;
    btn.title = title;
    btn.disabled = disabled;
    if (!disabled) btn.addEventListener("click", onClick);
    return btn;
  }

  const RESET_POLICY_OPTIONS = [
    {
      value: "start_only",
      label: "Solo al inicio",
      hint: "Aplica el baseline al arrancar la macro. Mantiene el comportamiento legacy."
    },
    {
      value: "start_and_resume",
      label: "Inicio y reanudación",
      hint: "Aplica el baseline al arrancar y también al retomar tras navegación o cambio de pestaña."
    }
  ];

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
      if (!selector) return null;
      const bag = this._autocompleteCatalogs && typeof this._autocompleteCatalogs === "object"
        ? this._autocompleteCatalogs
        : {};

      const keys = [selector.trim()];
      const idMatch = selector.trim().match(/^#([\w-]+)$/);
      if (idMatch) {
        keys.push(`#${idMatch[1]}`);
        keys.push(`input[name="${idMatch[1]}"]`);
      }

      for (const key of keys) {
        const arr = bag[key];
        if (!Array.isArray(arr) || arr.length === 0) continue;
        return arr.map((o, idx) => ({
          index: idx,
          value: String(o && o.value != null ? o.value : ""),
          text: String(o && o.text != null ? o.text : ""),
          selected: !!(o && o.selected),
          disabled: !!(o && o.disabled)
        })).filter((o) => o.value || o.text);
      }
      return null;
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
      this._addFormOpen = true;
      this._addFormTargetIndex = Number.isInteger(insertAt) ? insertAt : this.steps.length;
      if (this._addFormTargetIndex < 0) this._addFormTargetIndex = 0;
      if (this._addFormTargetIndex > this.steps.length) this._addFormTargetIndex = this.steps.length;
      this._addFormAsNewBlock = !!asNewBlock;
      this._editIdx = null;
      this._render();
    }

    _closeAddForm() {
      this._addFormOpen = false;
      this._addFormTargetIndex = null;
      this._addFormAsNewBlock = false;
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
          const relY = evt.clientY - rect.top;
          return relY >= rect.height / 2 ? "after" : "before";
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

          const blockHeader = document.createElement("div");
          blockHeader.className = "wm-sved-block-header";

          const blockTag = document.createElement("span");
          blockTag.className = "wm-sved-block-tag";
          blockTag.textContent = `bloque ${blockOrdinal}`;
          blockTag.title = `Bloque encadenado de ${blockSize} pasos`;
          blockHeader.appendChild(blockTag);

          const blockContext = contextMeta.contextLabel || this._formatBlockContextLabel(this._stepBlockKey(this.steps[start]));
          if (blockContext) {
            const ctx = document.createElement("span");
            ctx.className = "wm-sved-block-context";
            ctx.textContent = blockContext;
            const visitSuffix = contextMeta.visitIndex > 0 ? ` · visita ${contextMeta.visitIndex}` : "";
            ctx.title = `Contexto del bloque: ${this._stepBlockKey(this.steps[start])}${visitSuffix}`;
            blockHeader.appendChild(ctx);
          }

          if (contextMeta.visitIndex > 0) {
            const visitBadge = document.createElement("span");
            visitBadge.className = "wm-sved-block-visit-badge";
            visitBadge.textContent = `visita ${contextMeta.visitIndex}`;
            visitBadge.title = contextMeta.isReentry
              ? "Este bloque vuelve a un contexto ya usado antes en la grabación"
              : "Primera visita a este contexto durante la grabación";
            blockHeader.appendChild(visitBadge);
          }

          if (contextMeta.isReentry) {
            const reentryBadge = document.createElement("span");
            reentryBadge.className = "wm-sved-block-reentry-badge";
            reentryBadge.textContent = "reingreso";
            reentryBadge.title = "Este bloque vuelve a un contexto ya usado antes en la grabación";
            blockHeader.appendChild(reentryBadge);
          }

          const blockMeta = document.createElement("span");
          blockMeta.className = "wm-sved-block-meta";
          blockMeta.textContent = `${blockSize} paso${blockSize !== 1 ? "s" : ""}`;
          blockHeader.appendChild(blockMeta);

          const blockStateBadge = document.createElement("span");
          blockStateBadge.className = "wm-sved-block-state-badge";
          if (canCollapse) {
            blockStateBadge.textContent = collapsed ? "⊞ colapsado" : "⊟ expandido";
            blockStateBadge.classList.add(collapsed ? "wm-sved-block-state-collapsed" : "wm-sved-block-state-expanded");
          }
          blockHeader.appendChild(blockStateBadge);

          if (canCollapse) {
            const toggleBtn = document.createElement("button");
            toggleBtn.className = "wm-sved-block-toggle";
            toggleBtn.type = "button";
            toggleBtn.innerHTML = collapsed ? "&#9654;" : "&#9660;";
            toggleBtn.title = collapsed ? "Desplegar bloque para editar pasos" : "Colapsar bloque";
            toggleBtn.addEventListener("click", () => {
              if (this._collapsedBlocks.has(blockKey)) this._collapsedBlocks.delete(blockKey);
              else this._collapsedBlocks.add(blockKey);
              this._render();
            });
            blockHeader.appendChild(toggleBtn);
          }

          blockWrap.appendChild(blockHeader);

          const blockBody = document.createElement("div");
          blockBody.className = "wm-sved-block-body";

          for (let rowIdx = start; rowIdx <= end; rowIdx++) {
            if (collapsed && rowIdx > start) continue;

            const step = this.steps[rowIdx];
            const row = document.createElement("div");
            row.className = "wm-sved-row";
            row.dataset.stepIdx = String(rowIdx);
            const rowBlock = this._findExecutionBlockBounds(rowIdx);
            const blockLead = !!rowBlock && rowBlock.start === rowIdx;
            const isBaselineDefault = _isBaselineDefaultStep(step);

            const movedMeta = this._movedStepMeta.get(step);
            if (movedMeta) {
              row.classList.add("wm-sved-row-moved");
              row.classList.add(movedMeta.source === "drag" ? "wm-sved-row-moved-drag" : "wm-sved-row-moved-button");
            }

            row.classList.add("wm-sved-row-block");
            row.classList.add(blockOrdinal % 2 === 0 ? "wm-sved-row-block-even" : "wm-sved-row-block-odd");
            if (isBaselineDefault) row.classList.add("wm-sved-row-default");

            if (dragEnabled) {
              row.setAttribute("draggable", "true");
              row.classList.add("wm-sved-row-draggable");
              row.addEventListener("dragstart", (evt) => {
                this._dragFromIdx = rowIdx;
                this._dragMode = (blockSize > 1 && blockLead) ? "block" : "step";
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
                let to = rawTarget;
                if (rawTarget > from) to -= 1;
                const mode = this._dragMode;
                clearDraggingState();
                if (to === from || to < 0 || to >= this.steps.length) return;
                this._moveToIndex(from, to, "drag", mode);
              });

              row.addEventListener("dragend", () => {
                clearDraggingState();
              });
            }

            const num = document.createElement("span");
            num.className = "wm-sved-num";
            num.textContent = String(rowIdx + 1);

            const icon = document.createElement("span");
            icon.className = "wm-sved-icon";
            icon.textContent = _stepDefinitions().TYPE_ICONS[step.type] || "\u25B8";

            const typeTag = document.createElement("span");
            typeTag.className = "wm-sved-type";
            typeTag.textContent = step.type;

            const defaultBadge = isBaselineDefault ? document.createElement("span") : null;
            if (defaultBadge) {
              defaultBadge.className = "wm-sved-default-badge";
              defaultBadge.textContent = "default";
              defaultBadge.title = "Paso capturado automáticamente desde el estado inicial de la página";
            }

            const desc = document.createElement("span");
            desc.className = "wm-sved-desc";
            const lbl = _shortLabel(step);
            desc.textContent = lbl;
            desc.title = lbl;
            if (collapsed && rowIdx === start && blockSize > 1) {
              desc.textContent = `${lbl} (+${blockSize - 1} ocultos)`;
            }

            const ctrl = document.createElement("div");
            ctrl.className = "wm-sved-ctrl";
            if (dragEnabled) {
              const dragHandle = document.createElement("span");
              dragHandle.className = "wm-sved-drag-handle";
              dragHandle.textContent = "\u22EE\u22EE";
              dragHandle.title = (blockSize > 1 && blockLead)
                ? `Arrastra para reordenar bloque (${blockSize} pasos)`
                : "Arrastra para reordenar paso";
              ctrl.appendChild(dragHandle);
            }
            const canMoveBlock = blockSize > 1 && blockLead;
            const upDisabled = canMoveBlock ? rowBlock.start === 0 : (rowBlock ? rowIdx <= rowBlock.start : rowIdx === 0);
            const downDisabled = canMoveBlock ? rowBlock.end === this.steps.length - 1 : (rowBlock ? rowIdx >= rowBlock.end : rowIdx === this.steps.length - 1);
            ctrl.appendChild(_mkBtn("\u2191", canMoveBlock ? "Subir bloque" : "Subir dentro del bloque", upDisabled, () => this._move(rowIdx, -1, "button")));
            ctrl.appendChild(_mkBtn("\u2193", canMoveBlock ? "Bajar bloque" : "Bajar dentro del bloque", downDisabled, () => this._move(rowIdx, 1, "button")));
            const editBtn = _mkBtn("✏", "Editar paso", false, () => {
              this._editIdx = this._editIdx === rowIdx ? null : rowIdx;
              this._addFormOpen = false;
              this._render();
            });
            editBtn.classList.add("wm-sved-btn-edit");
            ctrl.appendChild(editBtn);
            const delBtn = _mkBtn("✕", "Eliminar", false, () => this._delete(rowIdx));
            delBtn.classList.add("wm-sved-btn-del");
            ctrl.appendChild(delBtn);

            if (movedMeta) {
              const movedTag = document.createElement("span");
              movedTag.className = "wm-sved-moved-tag";
              movedTag.textContent = "movido";
              movedTag.title = movedMeta.source === "drag"
                ? "Paso reordenado por arrastre"
                : "Paso reordenado con botones";
              ctrl.appendChild(movedTag);
            }

            row.appendChild(num);
            row.appendChild(icon);
            row.appendChild(typeTag);
            if (defaultBadge) row.appendChild(defaultBadge);
            row.appendChild(desc);
            row.appendChild(ctrl);
            blockBody.appendChild(row);

            if (this._editIdx === rowIdx) {
              blockBody.appendChild(this._buildEditForm(rowIdx));
            }
          }

          if (this._editIdx === null) {
            const blockActions = document.createElement("div");
            blockActions.className = "wm-sved-block-actions";
            blockActions.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:4px 2px 2px";

            const addBtn = document.createElement("button");
            if (collapsed) {
              addBtn.className = "wm-sved-add-btn wm-sved-add-btn-block";
              addBtn.innerHTML = "&#9636; Agregar bloque";
              addBtn.title = "Inserta un bloque nuevo después de este";
              addBtn.addEventListener("click", () => this._openAddForm(end + 1, true));
            } else {
              addBtn.className = "wm-sved-add-btn wm-sved-add-btn-step";
              addBtn.innerHTML = "+ Agregar paso al bloque";
              addBtn.title = "Inserta un paso al final de este bloque";
              addBtn.addEventListener("click", () => this._openAddForm(end + 1, false));
            }
            blockActions.appendChild(addBtn);

            if (!collapsed && typeof this._onRecordRequest === "function") {
              if (this._pendingRecordIntoBlock === blockKey) {
                const recBar = document.createElement("div");
                recBar.className = "wm-sved-rec-bar";
                recBar.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:6px;font-size:12px;color:#dc2626;font-family:system-ui,sans-serif";
                const dot = document.createElement("span");
                dot.style.cssText = "display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;animation:webmatic-pulse 1s infinite;flex-shrink:0";
                const lbl = document.createElement("span");
                lbl.textContent = "Grabando en este bloque — interactúa con la página…";
                recBar.appendChild(dot);
                recBar.appendChild(lbl);
                blockActions.appendChild(recBar);
              } else {
                const recBtn = document.createElement("button");
                recBtn.className = "wm-sved-add-btn wm-sved-rec-btn";
                recBtn.style.cssText = "background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.35);color:#dc2626";
                recBtn.innerHTML = "&#9210; Grabar en este bloque";
                recBtn.title = "Graba pasos y los inserta al final de este bloque";
                recBtn.addEventListener("click", () => {
                  this._pendingRecordIntoBlock = blockKey;
                  this._render();
                  this._onRecordRequest((capturedSteps) => {
                    this._pendingRecordIntoBlock = null;
                    const toInsert = Array.isArray(capturedSteps) ? capturedSteps : [];
                    // Insertamos al final del bloque (posición end+1 en el momento actual)
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
                });
                blockActions.appendChild(recBtn);
              }
            }

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
                const next = Array.isArray(capturedSteps) ? capturedSteps : [];
                if (next.length > 0 && next[0] && typeof next[0] === "object") {
                  next[0]._wmBlockStart = true;
                  next[0]._wmCollapsed = true;
                }
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
        fieldsDiv.replaceChildren();
        const ti = _stepDefinitions().STEP_TYPES.find((t) => t.value === typeSelect.value);
        if (!ti) return;
        ti.fields.forEach((field) => {
          const { name, ph } = field;
          if (typeSelect.value === "choose_option" && (name === "value" || name === "text" || name === "variable")) {
            const hidden = document.createElement("input");
            hidden.type = "hidden";
            hidden.dataset.field = name;
            if (prefill && prefill[name] != null) {
              const pv = prefill[name];
              hidden.value = Array.isArray(pv) ? pv.join(", ") : String(pv);
            }
            fieldsDiv.appendChild(hidden);
            return;
          }
          const lbl = document.createElement("label");
          lbl.className = "wm-sved-field-label";
          lbl.textContent = name;
          if (field.select) {
            const sel = document.createElement("select");
            sel.className = "wm-sved-select";
            sel.dataset.field = name;
            field.select.forEach(([val, text]) => {
              const opt = document.createElement("option");
              opt.value = val;
              opt.textContent = text;
              if (prefill && prefill[name] === val) opt.selected = true;
              sel.appendChild(opt);
            });
            lbl.appendChild(sel);
          } else if (name === "checked") {
            const sel = document.createElement("select");
            sel.className = "wm-sved-select";
            sel.dataset.field = name;
            [["true", "✔ Marcar (true)"], ["false", "✘ Desmarcar (false)"]].forEach(([val, text]) => {
              const opt = document.createElement("option");
              opt.value = val;
              opt.textContent = text;
              if (prefill && String(prefill[name]) === val) opt.selected = true;
              sel.appendChild(opt);
            });
            lbl.appendChild(sel);
          } else if (field.type === "toggle") {
            const wrap = document.createElement("div");
            wrap.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:4px;";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.dataset.field = name;
            cb.dataset.fieldtype = "toggle";
            cb.checked = !!(prefill && prefill[name]);
            cb.addEventListener("change", () => {
              const valInp = fieldsDiv.querySelector("[data-field='value']");
              if (valInp) { valInp.disabled = cb.checked; valInp.style.opacity = cb.checked ? "0.4" : "1"; }
            });
            const cbLbl = document.createElement("label");
            cbLbl.textContent = field.label || name;
            cbLbl.style.cssText = "font-weight:normal;cursor:pointer;font-size:12px;";
            wrap.appendChild(cb);
            wrap.appendChild(cbLbl);
            lbl.textContent = "";
            lbl.appendChild(wrap);
            setTimeout(() => {
              const valInp = fieldsDiv.querySelector("[data-field='value']");
              if (valInp && cb.checked) { valInp.disabled = true; valInp.style.opacity = "0.4"; }
            }, 0);
          } else {
            const inp = document.createElement("input");
            inp.className = "wm-sved-field-input";
            inp.type = "text";
            inp.dataset.field = name;
            inp.placeholder = ph || "";
            if (prefill && prefill[name] != null) {
              const pv = prefill[name];
              inp.value = Array.isArray(pv) ? pv.join(", ") : String(pv);
            }
            if ((name === "selector" || name === "from" || name === "to") && this._onPickRequest) {
              const row = document.createElement("div");
              row.style.cssText = "display:flex;gap:4px;align-items:center;width:100%";
              inp.style.flex = "1";
              const pb = document.createElement("button");
              pb.type = "button";
              pb.textContent = "🎯";
              pb.title = "Haz clic en la p\u00e1gina para capturar el selector";
              pb.style.cssText = "all:initial;display:inline-flex;align-items:center;justify-content:center;background:#0ea5e9;color:#fff;border-radius:6px;padding:4px 8px;font-size:14px;cursor:pointer;flex-shrink:0;font-family:system-ui,sans-serif";
              pb.addEventListener("click", (e) => {
                e.preventDefault();
                this._pickElement(name, (selector) => {
                  inp.value = selector;
                  inp.dispatchEvent(new Event("input", { bubbles: true }));
                });
              });
              row.appendChild(inp);
              row.appendChild(pb);
              lbl.appendChild(row);
            } else {
              lbl.appendChild(inp);
            }
          }
          fieldsDiv.appendChild(lbl);
        });
        const first = fieldsDiv.querySelector("input, select");
        if (first) setTimeout(() => first.focus(), 0);
        // Combo amigable de opciones reales (solo choose_option sobre <select> real)
        this._syncOptionPicker(fieldsDiv, typeSelect.value);
        const selInp = fieldsDiv.querySelector("[data-field='selector']");
        if (selInp) selInp.addEventListener("input", () => this._syncOptionPicker(fieldsDiv, typeSelect.value));
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
        fieldsDiv.querySelectorAll("[data-field]").forEach((inp) => {
          if (inp.dataset.fieldtype === "toggle") {
            updated[inp.dataset.field] = inp.checked;
          } else {
            const v = inp.value.trim();
            if (v !== "") updated[inp.dataset.field] = v;
          }
        });
        if (updated.type === "wait") {
          const n = Number(updated.seconds);
          updated.seconds = Number.isFinite(n) && n > 0 ? n : 1;
        }
        if (updated.type === "check")
          updated.checked = updated.checked === "true";
        if (updated.type === "if_exists") {
          updated.then = step.then || [];
          updated.else = step.else || [];
        }
        if (updated.type === "loop_until") {
          updated.max_iterations = Number(updated.max_iterations) || 50;
          updated.steps = step.steps || [];
        }
        if (updated.type === "for_each_row") {
          updated.columns = String(updated.columns || "").split(/,\s*/).map((c) => c.trim()).filter(Boolean);
          updated.dataset = step.dataset || [];
          updated.steps = step.steps || [];
        }

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
        fieldsDiv.replaceChildren();
        const typeInfo = _stepDefinitions().STEP_TYPES.find((t) => t.value === typeSelect.value);
        if (!typeInfo) return;
        typeInfo.fields.forEach((field) => {
          const { name, ph } = field;
          if (typeSelect.value === "choose_option" && (name === "value" || name === "text" || name === "variable")) {
            const hidden = document.createElement("input");
            hidden.type = "hidden";
            hidden.dataset.field = name;
            fieldsDiv.appendChild(hidden);
            return;
          }
          const lbl = document.createElement("label");
          lbl.className = "wm-sved-field-label";
          lbl.textContent = name;
          if (field.select) {
            const sel = document.createElement("select");
            sel.className = "wm-sved-select";
            sel.dataset.field = name;
            field.select.forEach(([val, text]) => {
              const opt = document.createElement("option");
              opt.value = val;
              opt.textContent = text;
              sel.appendChild(opt);
            });
            lbl.appendChild(sel);
          } else if (name === "checked") {
            const sel = document.createElement("select");
            sel.className = "wm-sved-select";
            sel.dataset.field = name;
            [["true", "✔ Marcar (true)"], ["false", "✘ Desmarcar (false)"]].forEach(([val, text]) => {
              const opt = document.createElement("option");
              opt.value = val;
              opt.textContent = text;
              sel.appendChild(opt);
            });
            lbl.appendChild(sel);
          } else if (field.type === "toggle") {
            const wrap = document.createElement("div");
            wrap.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:4px;";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.dataset.field = name;
            cb.dataset.fieldtype = "toggle";
            cb.addEventListener("change", () => {
              const valInp = fieldsDiv.querySelector("[data-field='value']");
              if (valInp) { valInp.disabled = cb.checked; valInp.style.opacity = cb.checked ? "0.4" : "1"; }
            });
            const cbLbl = document.createElement("label");
            cbLbl.textContent = field.label || name;
            cbLbl.style.cssText = "font-weight:normal;cursor:pointer;font-size:12px;";
            wrap.appendChild(cb);
            wrap.appendChild(cbLbl);
            lbl.textContent = "";
            lbl.appendChild(wrap);
          } else {
            const inp = document.createElement("input");
            inp.className = "wm-sved-field-input";
            inp.type = "text";
            inp.dataset.field = name;
            inp.placeholder = ph || "";
            if ((name === "selector" || name === "from" || name === "to") && this._onPickRequest) {
              const row = document.createElement("div");
              row.style.cssText = "display:flex;gap:4px;align-items:center;width:100%";
              inp.style.flex = "1";
              const pb = document.createElement("button");
              pb.type = "button";
              pb.textContent = "🎯";
              pb.title = "Haz clic en la p\u00e1gina para capturar el selector";
              pb.style.cssText = "all:initial;display:inline-flex;align-items:center;justify-content:center;background:#0ea5e9;color:#fff;border-radius:6px;padding:4px 8px;font-size:14px;cursor:pointer;flex-shrink:0;font-family:system-ui,sans-serif";
              pb.addEventListener("click", (e) => {
                e.preventDefault();
                this._pickElement(name, (selector) => {
                  inp.value = selector;
                  inp.dispatchEvent(new Event("input", { bubbles: true }));
                });
              });
              row.appendChild(inp);
              row.appendChild(pb);
              lbl.appendChild(row);
            } else {
              lbl.appendChild(inp);
            }
          }
          fieldsDiv.appendChild(lbl);
        });
        const first = fieldsDiv.querySelector("input, select");
        if (first) setTimeout(() => first.focus(), 0);
        // Combo amigable de opciones reales (solo choose_option sobre <select> real)
        this._syncOptionPicker(fieldsDiv, typeSelect.value);
        const selInp = fieldsDiv.querySelector("[data-field='selector']");
        if (selInp) selInp.addEventListener("input", () => this._syncOptionPicker(fieldsDiv, typeSelect.value));
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
        fieldsDiv.querySelectorAll("[data-field]").forEach((inp) => {
          if (inp.dataset.fieldtype === "toggle") {
            step[inp.dataset.field] = inp.checked;
          } else {
            const v = inp.value.trim();
            if (v !== "") step[inp.dataset.field] = v;
          }
        });
        if (step.type === "wait") {
          const n = Number(step.seconds);
          step.seconds = Number.isFinite(n) && n > 0 ? n : 1;
        }
        if (step.type === "check") {
          step.checked = step.checked === "true";
        }
        if (step.type === "if_exists") {
          step.then = [];
          step.else = [];
        }
        if (step.type === "loop_until") {
          step.max_iterations = Number(step.max_iterations) || 50;
          step.steps = [];
        }
        if (step.type === "for_each_row") {
          step.columns = String(step.columns || "").split(/,\s*/).map((c) => c.trim()).filter(Boolean);
          step.dataset = [];
          step.steps = [];
        }
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
      if (!stepRef || typeof stepRef !== "object") return;
      this._movedStepMeta.set(stepRef, { source, at: Date.now() });
    }

    _normalizeBlockKey(raw) {
      const key = String(raw || "").trim();
      return key || "";
    }

    _stepBlockKey(step) {
      if (!step || typeof step !== "object") return "";
      return this._normalizeBlockKey(step._wmBlockKey);
    }

    _formatBlockContextLabel(blockKey) {
      const key = this._normalizeBlockKey(blockKey);
      if (!key) return "";
      const slash = key.indexOf("/");
      if (slash < 0) return key;
      const host = key.slice(0, slash);
      const path = key.slice(slash) || "/";
      if (path.length <= 32) return `${host}${path}`;
      return `${host}${path.slice(0, 29)}...`;
    }

    _isExecutionBlockBoundaryType(stepType) {
      return stepType === "navigate" || stepType === "open_tab" || stepType === "switch_tab" || stepType === "close_tab";
    }

    _isExecutionBlockBoundaryStep(step, idx) {
      if (!step || typeof step !== "object") return false;
      if (idx === 0) return true;
      if (step._wmBlockStart === true || String(step._wmBlockStart).toLowerCase() === "true") return true;
      const currKey = this._stepBlockKey(step);
      const prev = this.steps[idx - 1];
      const prevKey = this._stepBlockKey(prev);
      if (currKey && prevKey && currKey !== prevKey) return true;
      if (currKey && prevKey && currKey === prevKey) return false;
      return this._isExecutionBlockBoundaryType(step.type);
    }

    _wantsCollapsedByDefault(step) {
      if (!step || typeof step !== "object") return false;
      return step._wmCollapsed === true || String(step._wmCollapsed).toLowerCase() === "true";
    }

    _collapseAllBlocksByDefault() {
      if (!Array.isArray(this.steps) || this.steps.length === 0) return;
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
        if (blockSize > 1) this._collapsedBlocks.add(`${start}:${end}`);
        idx = end + 1;
      }
    }

    _initCollapsedBlocksFromSteps() {
      if (!Array.isArray(this.steps) || this.steps.length === 0) return;
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
        if (blockSize > 1 && this._wantsCollapsedByDefault(this.steps[start])) {
          this._collapsedBlocks.add(`${start}:${end}`);
        }
        idx = end + 1;
      }
    }

    _findExecutionBlockBounds(idx) {
      if (idx < 0 || idx >= this.steps.length) return null;
      let start = 0;
      for (let i = idx; i > 0; i--) {
        const s = this.steps[i];
        if (this._isExecutionBlockBoundaryStep(s, i)) {
          start = i;
          break;
        }
      }

      let end = this.steps.length - 1;
      for (let j = Math.max(start + 1, idx + 1); j < this.steps.length; j++) {
        const s = this.steps[j];
        if (this._isExecutionBlockBoundaryStep(s, j)) {
          end = j - 1;
          break;
        }
      }
      if (end < start) end = start;
      return { start, end };
    }

    _getExecutionBlockOrdinal(idx) {
      if (idx < 0 || idx >= this.steps.length) return 1;
      let ord = 1;
      for (let i = 1; i <= idx; i++) {
        const s = this.steps[i];
        if (this._isExecutionBlockBoundaryStep(s, i)) ord += 1;
      }
      return ord;
    }

    _buildExecutionBlockContextMeta() {
      const meta = new Map();
      if (!Array.isArray(this.steps) || this.steps.length === 0) return meta;
      const visitCountByKey = new Map();
      let idx = 0;
      while (idx < this.steps.length) {
        const block = this._findExecutionBlockBounds(idx) || { start: idx, end: idx };
        const start = block.start;
        const end = block.end;
        if (start !== idx) {
          idx += 1;
          continue;
        }
        const key = this._stepBlockKey(this.steps[start]);
        if (key) {
          const visitIndex = (visitCountByKey.get(key) || 0) + 1;
          visitCountByKey.set(key, visitIndex);
          meta.set(start, {
            visitIndex,
            isReentry: visitIndex > 1,
            blockKey: key,
            contextLabel: this._formatBlockContextLabel(key)
          });
        } else {
          meta.set(start, {
            visitIndex: 0,
            isReentry: false,
            blockKey: "",
            contextLabel: ""
          });
        }
        idx = end + 1;
      }
      return meta;
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