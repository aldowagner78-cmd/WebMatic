(function initStepEditor(globalScope) {
  const STEP_TYPES = [
    { value: "navigate",     label: "\u{1F310} Navegar",        fields: [{ name: "url",        ph: "https://ejemplo.com" }] },
    { value: "click",        label: "\u{1F5B1} Clic",           fields: [{ name: "selector",   ph: "#mi-boton" }] },
    { value: "dblclick",     label: "\u{1F5B1}\u{1F5B1} Doble clic", fields: [{ name: "selector", ph: "#mi-boton" }] },
    { value: "input",        label: "\u2328 Escribir",          fields: [{ name: "selector",   ph: "#mi-input" }, { name: "value", ph: "texto a escribir" }, { name: "useCurrentValue", type: "toggle", label: "\u21BA Usar valor actual del campo" }] },
    { value: "wait",         label: "\u23F1 Esperar (s)",       fields: [{ name: "seconds",    ph: "2" }] },
    { value: "key",          label: "\u2328 Tecla",             fields: [{ name: "key",        ph: "Enter" }] },
    { value: "check",        label: "\u2611 Checkbox",          fields: [{ name: "selector",   ph: "#mi-check" }, { name: "checked", ph: "true" }] },
    { value: "choose_option", label: "\u{1F4CB} Elegir opcion",   fields: [{ name: "selector", ph: "#mi-select" }, { name: "value", ph: "valor (opcional)" }, { name: "text", ph: "texto visible (opcional)" }, { name: "variable", ph: "OPCION (opcional)" }] },
    { value: "extract",      label: "\u270F Extraer",           fields: [{ name: "selector",   ph: "#precio" }, { name: "variable", ph: "PRECIO" }] },
    { value: "wait_for",     label: "\u23F3 Esperar selector",  fields: [{ name: "selector",   ph: "#resultado" }] },
    { value: "scroll_to",    label: "\u21D3 Scroll a",          fields: [{ name: "selector",   ph: "#footer" }] },
    { value: "hover",        label: "\u25B7 Hover",             fields: [{ name: "selector",   ph: "#menu" }] },
    { value: "drag_drop",    label: "\u2194 Arrastrar",         fields: [{ name: "from",       ph: "#origen" }, { name: "to", ph: "#destino" }] },
    { value: "set_variable", label: "= Variable",               fields: [{ name: "variable",   ph: "MI_VAR" }, { name: "value", ph: "valor" }] },
    { value: "prompt",       label: "? Preguntar al usuario",   fields: [{ name: "label",      ph: "\u00BFIngresa nombre?" }, { name: "variable", ph: "NOMBRE" }] },
    { value: "call_macro",   label: "\u21AA Llamar macro",      fields: [{ name: "macro_name", ph: "Nombre de la macro" }] },
    { value: "if_exists",    label: "\u2299 Si existe",         fields: [{ name: "selector", ph: "#elemento" }] },
    { value: "loop_until",   label: "\u21BA Repetir hasta",     fields: [{ name: "selector", ph: "#spinner" }, { name: "condition", ph: "not_exists", select: [["not_exists", "\u23F3 mientras NO existe"], ["exists", "\u23F3 mientras S\u00ED existe"]] }, { name: "max_iterations", ph: "50" }] },
    { value: "for_each_row", label: "\u25A6 Por cada fila",     fields: [{ name: "columns", ph: "COL1, COL2" }] },
    { value: "capture_defaults", label: "\u2699 Capturar defaults", fields: [{ name: "exclude", ph: "#campo-a-conservar, .selector (opcional)" }] },
    { value: "reset_fields", label: "\uD83E\uDDF9 Limpiar campos", fields: [{ name: "exclude", ph: "#campo-a-conservar (opcional)" }] },
  ];

  const TYPE_ICONS = {
    navigate: "\u{1F310}", click: "\u{1F5B1}", dblclick: "\u{1F5B1}\u{1F5B1}", input: "\u2328", text: "\u2328",
    wait: "\u23F1", key: "\u2328", check: "\u2611", choose_option: "\u{1F4CB}", extract: "\u270F",
    wait_for: "\u23F3", scroll_to: "\u21D3", hover: "\u25B7", drag_drop: "\u2194",
    set_variable: "=", prompt: "?", if_exists: "\u2299", loop_until: "\u21BA",
    capture_defaults: "\u2699",
    try_fallback: "\u26A0", call_macro: "\u21AA", for_each_row: "\u25A6"
  };

  function _shortLabel(s) {
    if (!s) return "";
    if (s.type === "navigate")     return s.url || "";
    if (s.type === "click")        return s.selector || "";
    if (s.type === "dblclick")     return s.selector || "";
    if (s.type === "input" || s.type === "text")
      return s.useCurrentValue ? `${s.selector || ""} = \u21BA actual` : `${s.selector || ""} = "${s.value || ""}"`;
    if (s.type === "wait")
      return s.seconds != null ? `${s.seconds}s` : `${s.ms || 0}ms`;
    if (s.type === "key")          return s.key || "";
    if (s.type === "check")        return `${s.selector || ""} ${s.checked ? "\u2714" : "\u2718"}`;
    if (s.type === "choose_option")return `${s.selector || ""} ${s.value ? `= ${s.value}` : (s.text ? `= "${s.text}"` : "(elegir al ejecutar)")}`;
    if (s.type === "extract")      return `${s.selector || ""} \u2192 ${s.variable || ""}`;
    if (s.type === "wait_for")     return s.selector || "";
    if (s.type === "scroll_to")    return s.selector || "";
    if (s.type === "hover")        return s.selector || "";
    if (s.type === "drag_drop")    return `${s.from || ""} \u2192 ${s.to || ""}`;
    if (s.type === "set_variable") return `${s.variable || ""} \u2190 ${s.value || ""}`;
    if (s.type === "prompt")       return `${s.label || ""} \u2192 ${s.variable || ""}`;
    if (s.type === "call_macro")   return `"${s.macro_name || ""}"`;
    if (s.type === "if_exists")    return s.selector || "";
    if (s.type === "loop_until")   return s.selector || "";
    if (s.type === "capture_defaults") return s.exclude ? `excepto ${s.exclude}` : "todos los campos";
    if (s.type === "try_fallback")
      return `${(s.steps || []).length} / ${(s.fallback || []).length} pasos`;
    if (s.type === "for_each_row")
      return `${(s.dataset || []).length} filas \u00D7 ${(s.columns || []).join(", ")}`;
    return s.type;
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
    }

    /** Registra el inventario de controles (macro.meta.pageInventories). */
    setInventory(inventories) {
      this._inventory = Array.isArray(inventories) ? inventories : [];
    }

    setAutocompleteCatalogs(catalogs) {
      this._autocompleteCatalogs = (catalogs && typeof catalogs === "object") ? catalogs : {};
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
        combo.innerHTML = "";
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
        panel.innerHTML = "";
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
    }

    getSteps() {
      return JSON.parse(JSON.stringify(this.steps));
    }

    mount(container, onChange) {
      this._container = container;
      this._onChange = onChange;
      this._addFormOpen = false;
      this._editIdx = null;
      this._render();
    }

    unmount() {
      if (this._container) this._container.innerHTML = "";
      this._container = null;
    }

    _fire() {
      if (typeof this._onChange === "function") this._onChange(this.getSteps());
    }

    _render() {
      const c = this._container;
      if (!c) return;
      c.innerHTML = "";

      if (this.steps.length === 0 && !this._addFormOpen) {
        const empty = document.createElement("div");
        empty.className = "wm-sved-empty";
        empty.textContent = "Sin pasos. Usa \u2018+ Agregar paso\u2019 para comenzar, o graba una macro.";
        c.appendChild(empty);
      } else if (this.steps.length > 0) {
        const list = document.createElement("div");
        list.className = "wm-sved-list";
        this.steps.forEach((step, idx) => {
          const row = document.createElement("div");
          row.className = "wm-sved-row";

          const num = document.createElement("span");
          num.className = "wm-sved-num";
          num.textContent = String(idx + 1);

          const icon = document.createElement("span");
          icon.className = "wm-sved-icon";
          icon.textContent = TYPE_ICONS[step.type] || "\u25B8";

          const typeTag = document.createElement("span");
          typeTag.className = "wm-sved-type";
          typeTag.textContent = step.type;

          const desc = document.createElement("span");
          desc.className = "wm-sved-desc";
          const lbl = _shortLabel(step);
          desc.textContent = lbl;
          desc.title = lbl;

          const ctrl = document.createElement("div");
          ctrl.className = "wm-sved-ctrl";
          ctrl.appendChild(_mkBtn("\u2191", "Subir", idx === 0, () => this._move(idx, -1)));
          ctrl.appendChild(_mkBtn("\u2193", "Bajar", idx === this.steps.length - 1, () => this._move(idx, 1)));
          const editBtn = _mkBtn("✏", "Editar paso", false, () => {
            this._editIdx = this._editIdx === idx ? null : idx;
            this._addFormOpen = false;
            this._render();
          });
          editBtn.classList.add("wm-sved-btn-edit");
          ctrl.appendChild(editBtn);
          const delBtn = _mkBtn("✕", "Eliminar", false, () => this._delete(idx));
          delBtn.classList.add("wm-sved-btn-del");
          ctrl.appendChild(delBtn);

          row.appendChild(num);
          row.appendChild(icon);
          row.appendChild(typeTag);
          row.appendChild(desc);
          row.appendChild(ctrl);
          list.appendChild(row);

          // Show edit form inline, below the row
          if (this._editIdx === idx) {
            list.appendChild(this._buildEditForm(idx));
          }
        });
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
        } else if (this._addFormOpen) {
          c.appendChild(this._buildAddForm());
        } else {
          const btnRow = document.createElement("div");
          btnRow.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap";
          const addBtn = document.createElement("button");
          addBtn.className = "wm-sved-add-btn";
          addBtn.textContent = "+ Agregar paso";
          addBtn.addEventListener("click", () => {
            this._addFormOpen = true;
            this._render();
          });
          btnRow.appendChild(addBtn);
          if (typeof this._onRecordRequest === "function") {
            const recBtn = document.createElement("button");
            recBtn.className = "wm-sved-add-btn wm-sved-rec-btn";
            recBtn.style.cssText = "background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.4);color:#dc2626";
            recBtn.textContent = "\u23FA Grabar interacci\u00f3n";
            recBtn.title = "Interact\u00faa con la p\u00e1gina y los pasos se capturan autom\u00e1ticamente";
            recBtn.addEventListener("click", () => {
              this._pendingRecord = true;
              this._render();
              this._onRecordRequest((capturedSteps) => {
                this._pendingRecord = false;
                for (const s of capturedSteps) {
                  this.steps.push(s);
                }
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

      const typeInfo = STEP_TYPES.find((t) => t.value === step.type);

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
      STEP_TYPES.forEach(({ value, label }) => {
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
        fieldsDiv.innerHTML = "";
        const ti = STEP_TYPES.find((t) => t.value === typeSelect.value);
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
      STEP_TYPES.forEach(({ value, label }) => {
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
        fieldsDiv.innerHTML = "";
        const typeInfo = STEP_TYPES.find((t) => t.value === typeSelect.value);
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
        this.steps.push(step);
        this._addFormOpen = false;
        this._render();
        this._fire();
      });

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "wm-sved-cancel-btn";
      cancelBtn.textContent = "Cancelar";
      cancelBtn.addEventListener("click", () => {
        this._addFormOpen = false;
        this._render();
      });

      btnRow.appendChild(confirmBtn);
      btnRow.appendChild(cancelBtn);
      form.appendChild(btnRow);
      return form;
    }

    _move(idx, dir) {
      const ni = idx + dir;
      if (ni < 0 || ni >= this.steps.length) return;
      [this.steps[idx], this.steps[ni]] = [this.steps[ni], this.steps[idx]];
      this._render();
      this._fire();
    }

    _delete(idx) {
      this.steps.splice(idx, 1);
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