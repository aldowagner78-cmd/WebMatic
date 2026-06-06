(function initPageInventory(globalScope) {
  // Nombres/atributos que NUNCA deben capturar su valor actual (datos sensibles).
  const SENSITIVE_RE = /(pass|password|passwd|pwd|token|secret|cvv|cvc|card|tarjeta|otp|pin|seguridad|security)/i;

  /**
   * Decide si un control puede exponer su valor actual.
   * Bloquea inputs de tipo password y cualquier campo cuyo id/name/autocomplete
   * sugiera datos sensibles.
   */
  function _isSensitive(el) {
    if (!el) return true;
    const type = (el.getAttribute && (el.getAttribute("type") || "")).toLowerCase();
    if (type === "password") return true;
    const id = (el.id || "").toString();
    const name = (el.getAttribute && el.getAttribute("name")) || "";
    const auto = (el.getAttribute && el.getAttribute("autocomplete")) || "";
    let labelText = "";
    const doc = el.ownerDocument || (typeof document !== "undefined" ? document : null);
    const aria = (el.getAttribute && el.getAttribute("aria-label")) || "";
    if (aria) labelText = aria;
    if (!labelText && el.id && doc && typeof doc.querySelector === "function") {
      try {
        const lab = doc.querySelector(`label[for="${_esc(el.id)}"]`);
        if (lab && lab.textContent) labelText = lab.textContent;
      } catch (e) { /* ignore */ }
    }
    if (!labelText && typeof el.closest === "function") {
      const parentLabel = el.closest("label");
      if (parentLabel && parentLabel.textContent) labelText = parentLabel.textContent;
    }
    if (SENSITIVE_RE.test(id) || SENSITIVE_RE.test(name) || SENSITIVE_RE.test(auto) || SENSITIVE_RE.test(labelText)) return true;
    return false;
  }

  /** Escapa un valor para incrustarlo en un selector [attr="..."]. */
  function _esc(value) {
    return String(value == null ? "" : value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  /** Devuelve el selector principal usando el Recorder si está disponible. */
  function _primarySelector(el) {
    const rec = globalScope.WebMaticRecorder;
    if (rec && typeof rec.buildSelector === "function") {
      try { return rec.buildSelector(el); } catch (e) { /* fallback */ }
    }
    // Fallback mínimo y genérico.
    if (el.id) return "#" + el.id;
    const tag = el.tagName.toLowerCase();
    const name = el.getAttribute && el.getAttribute("name");
    if (name) return `${tag}[name="${_esc(name)}"]`;
    return tag;
  }

  /** Lista de selectores alternativos estables (sin duplicar el principal). */
  function _altSelectors(el, primary) {
    const alts = [];
    const tag = el.tagName.toLowerCase();
    const push = (sel) => { if (sel && sel !== primary && !alts.includes(sel)) alts.push(sel); };
    if (el.id) push("#" + el.id);
    const name = el.getAttribute && el.getAttribute("name");
    if (name) push(`${tag}[name="${_esc(name)}"]`);
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria) push(`[aria-label="${_esc(aria)}"]`);
    const ph = el.getAttribute && el.getAttribute("placeholder");
    if (ph) push(`${tag}[placeholder="${_esc(ph)}"]`);
    if (el.dataset && el.dataset.testid) push(`[data-testid="${_esc(el.dataset.testid)}"]`);
    return alts;
  }

  /** Determina el tipo lógico del control. */
  function _controlKind(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "select") return "native-select";
    if (tag === "textarea") return "textarea";
    if (tag === "button") return "button";
    const type = ((el.getAttribute && el.getAttribute("type")) || "").toLowerCase();
    if (tag === "input") {
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "image") return "image-button";
      if (type === "button" || type === "submit" || type === "reset") return "button";
      if (el.getAttribute && el.getAttribute("list")) return "datalist";
      const role = ((el.getAttribute && el.getAttribute("role")) || "").toLowerCase();
      const autocompleteAria = (el.getAttribute && el.getAttribute("aria-autocomplete")) || "";
      const haspopup = ((el.getAttribute && el.getAttribute("aria-haspopup")) || "").toLowerCase();
      if (role === "combobox" || autocompleteAria || haspopup === "listbox") return "autocomplete";
      return "text-input";
    }
    const role = ((el.getAttribute && el.getAttribute("role")) || "").toLowerCase();
    if (role === "combobox") return "autocomplete";
    return "unknown";
  }

  /** Calcula una etiqueta legible para el control. */
  function _label(el) {
    const doc = el.ownerDocument || (typeof document !== "undefined" ? document : null);
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria) return aria.trim();
    if (el.id && doc && typeof doc.querySelector === "function") {
      try {
        const lab = doc.querySelector(`label[for="${_esc(el.id)}"]`);
        if (lab && lab.textContent) return lab.textContent.replace(/\s+/g, " ").trim();
      } catch (e) { /* ignore */ }
    }
    if (typeof el.closest === "function") {
      const parentLabel = el.closest("label");
      if (parentLabel && parentLabel.textContent) {
        return parentLabel.textContent.replace(/\s+/g, " ").trim();
      }
    }
    const ph = el.getAttribute && el.getAttribute("placeholder");
    if (ph) return ph.trim();
    const title = el.getAttribute && el.getAttribute("title");
    if (title) return title.trim();
    const name = el.getAttribute && el.getAttribute("name");
    if (name) return name.trim();
    return "";
  }

  /** Extrae las opciones de un <select> o de un <datalist> referenciado. */
  function _options(el, kind) {
    if (kind === "native-select" && el.options) {
      return Array.from(el.options).map((o, i) => ({
        index: i,
        value: o.value,
        text: (o.text != null ? o.text : (o.textContent || "")).trim(),
        selected: !!o.selected,
        disabled: !!o.disabled
      }));
    }
    if (kind === "datalist") {
      const doc = el.ownerDocument || (typeof document !== "undefined" ? document : null);
      const listId = el.getAttribute && el.getAttribute("list");
      if (listId && doc && typeof doc.getElementById === "function") {
        const dl = doc.getElementById(listId);
        if (dl && dl.options) {
          return Array.from(dl.options).map((o, i) => ({
            index: i,
            value: o.value,
            text: ((o.label || o.textContent || o.value) || "").trim(),
            selected: false,
            disabled: !!o.disabled
          }));
        }
      }
    }
    return [];
  }

  /** Best-effort de visibilidad sin lanzar en entornos sin layout. */
  function _isVisible(el) {
    try {
      if (typeof el.getClientRects === "function") {
        const rects = el.getClientRects();
        if (rects && rects.length > 0) return true;
      }
      if ("offsetParent" in el) return el.offsetParent !== null;
    } catch (e) { /* ignore */ }
    return true;
  }

  /**
   * Captura el descriptor de un control individual.
   * Devuelve null si el elemento debe ignorarse (UI propia de WebMatic).
   */
  function captureControl(el) {
    if (!el || !el.tagName) return null;
    const id = (el.id || "").toString();
    if (/^(wm-|webmatic-)/.test(id)) return null;

    const kind = _controlKind(el);
    const primary = _primarySelector(el);
    if (!primary) return null;

    const control = {
      selector: primary,
      altSelectors: _altSelectors(el, primary),
      id: id || null,
      name: (el.getAttribute && el.getAttribute("name")) || null,
      label: _label(el),
      tag: el.tagName.toLowerCase(),
      type: ((el.getAttribute && el.getAttribute("type")) || "").toLowerCase() || null,
      role: ((el.getAttribute && el.getAttribute("role")) || "").toLowerCase() || null,
      visible: _isVisible(el),
      controlKind: kind,
      options: _options(el, kind)
    };

    // Valor actual: solo para campos no sensibles y de texto/selección.
    if (!_isSensitive(el)) {
      if (kind === "native-select") {
        control.currentValue = el.value != null ? el.value : "";
      } else if (kind === "text-input" || kind === "textarea" || kind === "datalist" || kind === "autocomplete") {
        control.currentValue = el.value != null ? el.value : "";
      } else if (kind === "checkbox" || kind === "radio") {
        control.currentValue = el.checked ? "true" : "false";
      }
    }

    return control;
  }

  /**
   * Recorre el documento y devuelve el inventario completo de la pantalla.
   * @param {Document} [doc]
   * @param {{url?:string,title?:string}} [meta]
   */
  function captureInventory(doc, meta) {
    doc = doc || (typeof document !== "undefined" ? document : null);
    const controls = [];
    if (doc && typeof doc.querySelectorAll === "function") {
      const els = doc.querySelectorAll(
        'input, select, textarea, button, [role="combobox"], [contenteditable="true"]'
      );
      const seen = new Set();
      els.forEach((el) => {
        const c = captureControl(el);
        if (!c || !c.selector) return;
        if (seen.has(c.selector)) return;
        seen.add(c.selector);
        controls.push(c);
      });
    }
    const loc = (typeof location !== "undefined") ? location
      : (doc && doc.location) ? doc.location
      : (doc && doc.defaultView && doc.defaultView.location) ? doc.defaultView.location
      : null;
    return {
      url: (meta && meta.url) || (loc ? loc.href : ""),
      title: (meta && meta.title) || (doc && doc.title) || "",
      capturedAt: Date.now(),
      controls
    };
  }

  /** Aplana todos los controles de una lista de inventarios. */
  function _allControls(inventories) {
    if (!Array.isArray(inventories)) return [];
    const out = [];
    inventories.forEach((inv) => {
      if (inv && Array.isArray(inv.controls)) out.push(...inv.controls);
    });
    return out;
  }

  /**
   * Localiza el control asociado a un selector dentro de los inventarios.
   * Prioridad: coincidencia exacta del selector principal → selector alternativo →
   * fallback por id/name extraído del selector.
   * @returns {object|null}
   */
  function findControlForSelector(selector, inventories) {
    const sel = (selector || "").trim();
    if (!sel) return null;
    const controls = _allControls(inventories);
    if (controls.length === 0) return null;

    // 1) Exacta sobre selector principal.
    let hit = controls.find((c) => c.selector === sel);
    if (hit) return hit;

    // 2) Selector alternativo.
    hit = controls.find((c) => Array.isArray(c.altSelectors) && c.altSelectors.includes(sel));
    if (hit) return hit;

    // 3) Fallback por id (#foo) o por name [name="foo"].
    const idMatch = sel.match(/^#([\w-]+)$/);
    if (idMatch) {
      hit = controls.find((c) => c.id === idMatch[1]);
      if (hit) return hit;
    }
    const nameMatch = sel.match(/\[name="?([^"\]]+)"?\]/);
    if (nameMatch) {
      hit = controls.find((c) => c.name === nameMatch[1]);
      if (hit) return hit;
    }
    return null;
  }

  /**
   * Devuelve las opciones predefinidas asociadas a un selector, si existen en el
   * inventario. Útil para poblar el dropdown del editor visual.
   * @returns {Array|null}
   */
  function findOptionsForSelector(selector, inventories) {
    const ctrl = findControlForSelector(selector, inventories);
    if (ctrl && Array.isArray(ctrl.options) && ctrl.options.length > 0) {
      return ctrl.options.map((o) => ({
        index: o.index,
        value: o.value,
        text: o.text,
        selected: !!o.selected,
        disabled: !!o.disabled
      }));
    }
    return null;
  }

  /**
   * Construye una referencia ligera del control para adjuntar a un step grabado.
   * @returns {{selector:string,controlKind:string,label:string}|null}
   */
  function buildControlRef(step, inventories) {
    if (!step) return null;
    const selector = step.selector || step.from || "";
    const ctrl = findControlForSelector(selector, inventories);
    if (!ctrl) return null;
    return {
      selector: ctrl.selector,
      controlKind: ctrl.controlKind,
      label: ctrl.label || ""
    };
  }

  /**
   * Asocia in-place un controlRef a cada step que tenga selector, usando el
   * inventario. No modifica steps sin control encontrado (fallback silencioso).
   * Devuelve una copia nueva del arreglo de steps.
   */
  function associateSteps(steps, inventories) {
    if (!Array.isArray(steps)) return [];
    return steps.map((s) => {
      const ref = buildControlRef(s, inventories);
      if (ref) return Object.assign({}, s, { controlRef: ref });
      return Object.assign({}, s);
    });
  }

  /**
   * Agrega un inventario a una lista evitando duplicados consecutivos por url
   * (misma pantalla recapturada sin cambios relevantes).
   */
  function appendInventory(list, inventory) {
    const arr = Array.isArray(list) ? list.slice() : [];
    if (!inventory) return arr;
    const last = arr[arr.length - 1];
    if (last && last.url === inventory.url &&
        (last.controls || []).length === (inventory.controls || []).length) {
      // Reemplaza el último por el más reciente (mismo url y mismo nº de controles).
      arr[arr.length - 1] = inventory;
      return arr;
    }
    arr.push(inventory);
    return arr;
  }

  const api = {
    captureControl,
    captureInventory,
    findControlForSelector,
    findOptionsForSelector,
    buildControlRef,
    associateSteps,
    appendInventory
  };

  globalScope.WebMaticPageInventory = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
