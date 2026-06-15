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
    const doc = el.ownerDocument || (typeof document !== "undefined" ? document : null);
    const rec = globalScope.WebMaticRecorder;
    const isValidForElement = (selector) => {
      const sel = String(selector || "").trim();
      if (!sel || !doc) return false;
      if (rec && typeof rec.selectorResolvesToElement === "function") {
        return rec.selectorResolvesToElement(doc, sel, el);
      }
      try {
        return doc.querySelector(sel) === el && doc.querySelectorAll(sel).length === 1;
      } catch (_e) {
        return false;
      }
    };
    const push = (sel) => {
      if (!sel || sel === primary || alts.includes(sel)) return;
      if (isValidForElement(sel)) alts.push(sel);
    };
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

  function _normalizeTokenKey(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "")
      .toLowerCase();
  }

  function _looksLikeOptionTupleArray(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const sample = arr.slice(0, Math.min(arr.length, 6));
    let good = 0;
    for (const item of sample) {
      if (!Array.isArray(item) || item.length < 2) continue;
      const a = item[0];
      const b = item[1];
      if ((typeof a === "string" || typeof a === "number") &&
          (typeof b === "string" || typeof b === "number")) {
        good += 1;
      }
    }
    return good >= Math.max(1, Math.floor(sample.length * 0.6));
  }

  function _toOptionsFromTupleArray(arr) {
    if (!_looksLikeOptionTupleArray(arr)) return null;
    return arr.map((item, i) => ({
      index: i,
      value: String(item[0] == null ? "" : item[0]),
      text: String(item[1] == null ? "" : item[1]),
      selected: false,
      disabled: false
    }));
  }

  function _walkOptionSources(node, path, out, seen, depth, budget) {
    if (!node || depth > 6 || budget.count > 18000) return;
    budget.count += 1;

    if (Array.isArray(node)) {
      const direct = _toOptionsFromTupleArray(node);
      if (direct && direct.length > 0) {
        out.push({ path, options: direct });
      }
      for (let i = 0; i < node.length; i += 1) {
        _walkOptionSources(node[i], `${path}[${i}]`, out, seen, depth + 1, budget);
      }
      return;
    }

    if (typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);

    // Patrón GeneXus frecuente: { isset:true, s:"x", v:[[value,text], ...] }
    if (Array.isArray(node.v)) {
      const fromV = _toOptionsFromTupleArray(node.v);
      if (fromV && fromV.length > 0) out.push({ path: `${path}.v`, options: fromV });
    }

    const keys = Object.keys(node);
    for (const k of keys) {
      _walkOptionSources(node[k], `${path}.${k}`, out, seen, depth + 1, budget);
    }
  }

  function _extractCatalogEntriesFromSerializedControls(controls) {
    const entries = [];
    const seen = new WeakSet();
    const budget = { count: 0 };
    (controls || []).forEach((ctrl, idx) => {
      const raw = ctrl && ctrl.currentValue != null ? String(ctrl.currentValue) : "";
      if (!raw || raw.length < 3) return;
      const head = raw.trim()[0];
      if (head !== "{" && head !== "[") return;
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { return; }
      _walkOptionSources(parsed, `control[${idx}].${ctrl.id || ctrl.name || "state"}`, entries, seen, 0, budget);
    });
    return entries;
  }

  function _extractCatalogEntriesFromGeneXusRuntime(doc) {
    const win = (doc && doc.defaultView) || (typeof window !== "undefined" ? window : null);
    if (!win || !win.gx || typeof win.gx !== "object") return [];
    const entries = [];
    const seen = new WeakSet();
    const budget = { count: 0 };
    _walkOptionSources(win.gx, "gx", entries, seen, 0, budget);
    return entries;
  }

  function _enrichControlsWithCatalogs(controls, catalogEntries) {
    if (!Array.isArray(controls) || controls.length === 0) return;
    if (!Array.isArray(catalogEntries) || catalogEntries.length === 0) return;

    controls.forEach((ctrl) => {
      if (!ctrl || (Array.isArray(ctrl.options) && ctrl.options.length > 0)) return;
      if (ctrl.controlKind !== "text-input" && ctrl.controlKind !== "autocomplete" && ctrl.controlKind !== "datalist") return;

      const tokenA = _normalizeTokenKey(ctrl.id || "");
      const tokenB = _normalizeTokenKey(ctrl.name || "");
      const tokenC = _normalizeTokenKey(ctrl.label || "");
      const tokens = [tokenA, tokenB, tokenC].filter(Boolean);
      if (tokens.length === 0) return;

      let best = null;
      let bestScore = 0;

      for (const entry of catalogEntries) {
        if (!entry || !Array.isArray(entry.options) || entry.options.length < 2) continue;
        const p = _normalizeTokenKey(entry.path || "");
        if (!p) continue;

        let score = 0;
        for (const t of tokens) {
          if (!t) continue;
          if (p.includes(t)) score = Math.max(score, 10 + Math.min(t.length, 10));
          else if (t.length >= 5 && (p.includes(t.slice(0, -1)) || p.includes(t.slice(1)))) score = Math.max(score, 6);
        }
        if (score === 0) continue;

        // A igual score, preferir el catálogo más grande.
        const sizeBonus = Math.min(entry.options.length, 50) / 100;
        const final = score + sizeBonus;
        if (final > bestScore) {
          bestScore = final;
          best = entry.options;
        }
      }

      if (best && best.length > 0) {
        ctrl.options = best.map((o, i) => ({
          index: i,
          value: String(o.value == null ? "" : o.value),
          text: String(o.text == null ? "" : o.text),
          selected: !!o.selected,
          disabled: !!o.disabled
        }));
      }
    });
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

    // Enriquecimiento profundo: intenta recuperar catálogos (GeneXus/runtime)
    // para campos autocomplete/text-input que no exponen opciones en DOM.
    const catalogs = [];
    catalogs.push(..._extractCatalogEntriesFromSerializedControls(controls));
    catalogs.push(..._extractCatalogEntriesFromGeneXusRuntime(doc));
    _enrichControlsWithCatalogs(controls, catalogs);

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

  function _normalizeToken(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function _optionsFromControl(ctrl) {
    if (!ctrl || !Array.isArray(ctrl.options) || ctrl.options.length === 0) return null;
    return ctrl.options.map((o) => ({
      index: o.index,
      value: o.value,
      text: o.text,
      selected: !!o.selected,
      disabled: !!o.disabled
    }));
  }

  function _idOrNameBase(ctrl) {
    const raw = String((ctrl && (ctrl.id || ctrl.name)) || "");
    if (!raw) return "";
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
    // Sufijos frecuentes de inputs de descripcion/autocomplete.
    return cleaned.replace(/(descripcion|desc|nombre|label|text|txt|input)$/i, "");
  }

  function _commonPrefixLen(a, b) {
    const x = String(a || "");
    const y = String(b || "");
    const max = Math.min(x.length, y.length);
    let i = 0;
    while (i < max && x[i] === y[i]) i += 1;
    return i;
  }

  function _hasGeneXusCompanionControl(sourceCtrl, controls) {
    if (!sourceCtrl || !Array.isArray(controls) || controls.length === 0) return false;
    const rawBase = String(sourceCtrl.id || sourceCtrl.name || "").trim();
    if (!rawBase) return false;
    const targetHc = ("GXHC" + rawBase).toLowerCase();
    const targetH = ("GXH_" + rawBase).toLowerCase();

    return controls.some((c) => {
      const id = String((c && c.id) || "").toLowerCase();
      const name = String((c && c.name) || "").toLowerCase();
      return id.startsWith(targetHc) ||
        name.startsWith(targetHc) ||
        id.startsWith(targetH) ||
        name.startsWith(targetH);
    });
  }

  function _hasGeneXusStateHint(sourceCtrl, controls) {
    if (!sourceCtrl || !Array.isArray(controls) || controls.length === 0) return false;
    const rawBase = String(sourceCtrl.id || sourceCtrl.name || "").trim();
    if (!rawBase) return false;

    const hintH = `GXH_${rawBase}`;
    const hintHc = `GXHC${rawBase}`;

    for (const c of controls) {
      if (!c || c.currentValue == null) continue;
      const text = String(c.currentValue);
      if (!text) continue;
      if (text.includes(hintH) || text.includes(hintHc)) return true;
    }
    return false;
  }

  /**
   * Obtiene opciones para un step/selector con fallback robusto para UIs con
   * input visible + select oculto (patrón común en GeneXus/autocomplete).
   */
  function findOptionsForStep(step, inventories) {
    if (!step) return null;
    const selector = (step.selector || "").trim();

    // 1) Resolución directa por selector (comportamiento original).
    const direct = selector ? findOptionsForSelector(selector, inventories) : null;
    if (direct && direct.length > 0) return direct;

    // 2) Si viene controlRef, intentar por ese selector canónico.
    const refSel = step.controlRef && step.controlRef.selector ? String(step.controlRef.selector).trim() : "";
    if (refSel) {
      const fromRef = findOptionsForSelector(refSel, inventories);
      if (fromRef && fromRef.length > 0) return fromRef;
    }

    const controls = _allControls(inventories);
    if (controls.length === 0) return null;

    const sourceCtrl =
      (selector ? findControlForSelector(selector, inventories) : null) ||
      (refSel ? findControlForSelector(refSel, inventories) : null);
    if (!sourceCtrl) return null;

    // 3) Fallback por similitud de label/id/name hacia controles con opciones.
    const srcLabel = _normalizeToken(sourceCtrl.label || "");
    const srcBase = _idOrNameBase(sourceCtrl);
    const candidates = controls.filter((c) => Array.isArray(c.options) && c.options.length > 0);
    let bestCtrl = null;
    let bestScore = 0;
    let bestHasStrongEvidence = false;

    for (const cand of candidates) {
      if (cand === sourceCtrl) continue;
      let score = 0;
      let hasStrongEvidence = false;
      const candLabel = _normalizeToken(cand.label || "");
      const candBase = _idOrNameBase(cand);

      if (srcLabel && candLabel) {
        if (srcLabel === candLabel) {
          score += 8;
          hasStrongEvidence = true;
        } else if (srcLabel.includes(candLabel) || candLabel.includes(srcLabel)) {
          score += 4;
        }
      }

      if (srcBase && candBase) {
        if (srcBase === candBase) {
          score += 7;
          hasStrongEvidence = true;
        } else if (srcBase.startsWith(candBase) || candBase.startsWith(srcBase)) {
          score += 5;
          if (Math.min(srcBase.length, candBase.length) >= 8) hasStrongEvidence = true;
        }

        const pref = _commonPrefixLen(srcBase, candBase);
        if (pref >= 8) score += 2;

        const srcShort = srcBase.replace(/(acion|aciones|desc|descripcion|label|text|txt|input)$/i, "");
        const candShort = candBase.replace(/(combo|combobox|select|sel|list|lista|codigo|cod)$/i, "");
        if (srcShort && candShort && (srcShort === candShort || srcShort.startsWith(candShort) || candShort.startsWith(srcShort))) {
          score += 6;
          hasStrongEvidence = true;
        }
      }

      if (cand.controlKind === "native-select") score += 1;

      // Caso típico GeneXus/autocomplete: input visible + select companion con sufijo combo.
      if (
        cand.controlKind === "native-select" &&
        sourceCtrl.controlKind !== "native-select" &&
        cand.options && cand.options.length >= 2
      ) {
        const candRaw = _normalizeToken(String(cand.id || cand.name || ""));
        if (/combo|combobox|select|lista/.test(candRaw) && score >= 5) score += 3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCtrl = cand;
        bestHasStrongEvidence = hasStrongEvidence;
      }
    }

    // Exigir un mínimo de evidencia para evitar falsos positivos.
    if (bestCtrl && bestScore >= 8 && bestHasStrongEvidence) {
      return _optionsFromControl(bestCtrl);
    }

    // 4) Fallback específico GeneXus/autocomplete: algunas pantallas no exponen
    // opciones en DOM pero sí publican companion controls GXHC<campo>_*.
    // En ese caso devolvemos una opción sintética con el valor tipeado.
    const isTypedField = sourceCtrl.controlKind === "text-input" ||
      sourceCtrl.controlKind === "autocomplete" ||
      sourceCtrl.controlKind === "datalist";
    const typedValue = String(step.value == null ? "" : step.value).trim();
    if (
      isTypedField &&
      typedValue &&
      (_hasGeneXusCompanionControl(sourceCtrl, controls) || _hasGeneXusStateHint(sourceCtrl, controls))
    ) {
      return [{
        index: 0,
        value: typedValue,
        text: typedValue,
        selected: false,
        disabled: false
      }];
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
    findOptionsForStep,
    buildControlRef,
    associateSteps,
    appendInventory
  };

  globalScope.WebMaticPageInventory = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
