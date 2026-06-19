(function initStepHumanizer(globalScope) {
  function _cleanText(value) {
    return String(value == null ? "" : value).trim().replace(/\s+/g, " ");
  }

  function _stripQuotes(value) {
    return _cleanText(value).replace(/^["']+|["']+$/g, "");
  }

  function _sentenceCase(value) {
    const text = _cleanText(value).toLowerCase();
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function _formatHumanWords(value) {
    const acronymMap = {
      dni: "DNI",
      cuil: "CUIL",
      cuit: "CUIT",
      cbu: "CBU",
      cvu: "CVU",
      url: "URL",
      id: "ID",
      html: "HTML",
      api: "API",
      nro: "Nro"
    };
    const text = _cleanText(value)
      .split(" ")
      .map((word) => acronymMap[word.toLowerCase()] || word.toLowerCase())
      .join(" ");
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function _humanizeIdentifier(raw) {
    let value = _stripQuotes(raw);
    if (!value) return "";

    value = value
      .replace(/^#/, "")
      .replace(/^\./, "")
      .replace(/^v(?=[A-Z0-9_]+$)/, "")
      .replace(/^GXH_?/i, "")
      .replace(/^CTL_?/i, "");

    value = value
      .replace(/^t\d+[\s_-]*/i, "")
      .replace(/^(btn|button|boton|ctl)[\s_-]+/i, "");

    const attributeMatch = value.match(/^ATTRIBUTESELECTED[_-]?(\d+)$/i);
    if (attributeMatch) return `Atributo ${attributeMatch[1]}`;

    const known = {
      VERBAJAS: "Ver bajas",
      REQCOMPRA: "Req compra",
      NFLGVISTA: "Vista"
    };
    const upper = value.toUpperCase();
    if (known[upper]) return known[upper];

    value = value
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b(ID|URL|HTML|GX|REQ|FLG)\b/g, (m) => m.toLowerCase());

    return _formatHumanWords(value);
  }

  function _selectorFallback(selector) {
    const value = _cleanText(selector);
    if (!value) return "";

    const idMatch = value.match(/#([A-Za-z0-9_-]+)/);
    if (idMatch) return _humanizeIdentifier(idMatch[1]);

    const nameMatch = value.match(/\bname\s*=\s*["']?([^"'\]\s]+)/i);
    if (nameMatch) return _humanizeIdentifier(nameMatch[1]);

    const ariaMatch = value.match(/\baria-label\s*=\s*["']([^"']+)["']/i);
    if (ariaMatch) return _humanizeIdentifier(ariaMatch[1]);

    const titleMatch = value.match(/\btitle\s*=\s*["']([^"']+)["']/i);
    if (titleMatch) return _humanizeIdentifier(titleMatch[1]);

    const lastPart = value.split(/\s+|>|~/).filter(Boolean).pop() || value;
    return _humanizeIdentifier(lastPart.replace(/[:[].*$/, "")) || value;
  }

  function _quote(value) {
    const text = _cleanText(value);
    return text ? `"${text}"` : "";
  }

  function _labelFromControlRef(controlRef) {
    if (!controlRef || typeof controlRef !== "object") return "";
    const label = _cleanText(controlRef.label || controlRef.text || controlRef.name || controlRef.id);
    if (!label || /^#|^\[|^\./.test(label)) return "";
    if (/^(input|select|textarea|button)$/i.test(label)) return "";
    return _humanizeIdentifier(label);
  }

  function humanizeTarget(step) {
    const s = step || {};
    const fromControl = _labelFromControlRef(s.controlRef);
    if (fromControl) return fromControl;

    if ((s.type === "click" || s.type === "dblclick") && s.text) {
      return _humanizeIdentifier(s.text);
    }

    if (s.name) return _humanizeIdentifier(s.name);
    if (s.id) return _humanizeIdentifier(s.id);

    return _selectorFallback(s.selector || s.from || s.to || s.url || "");
  }

  function humanizeValue(step) {
    const s = step || {};
    if (s.useCurrentValue) return "valor actual";
    if (s.text) return _cleanText(s.text);
    if (s.value != null && s.value !== "") return _cleanText(s.value);
    if (s.variable) return _cleanText(s.variable);
    return "";
  }

  function humanizeAction(step) {
    const type = step && step.type;
    const checked = step && (step.checked === true || String(step.checked).toLowerCase() === "true");
    const actions = {
      navigate: "Ir a pagina",
      browser_back: "Volver atras",
      browser_forward: "Avanzar",
      browser_history: "Abrir historial",
      browser_reload: "Recargar pagina",
      open_bookmark: "Abrir favorito",
      open_tab: "Abrir pestana",
      switch_tab: "Cambiar pestana",
      close_tab: "Cerrar pestana",
      click: "Hacer clic",
      dblclick: "Hacer doble clic",
      input: "Escribir",
      text: "Escribir",
      wait: "Esperar",
      key: "Presionar tecla",
      check: checked ? "Tildar" : "Destildar",
      choose_option: "Elegir",
      extract: "Capturar dato",
      wait_for: "Esperar elemento",
      scroll_to: "Desplazarse",
      hover: "Pasar el mouse",
      drag_drop: "Arrastrar",
      set_variable: "Guardar variable",
      prompt: "Pedir dato",
      call_macro: "Llamar macro",
      if_exists: "Si aparece",
      loop_until: "Repetir hasta",
      for_each_row: "Para cada fila",
      capture_defaults: "Estado inicial",
      reset_fields: "Limpiar campos",
      try_fallback: "Intentar alternativa"
    };
    return actions[type] || _humanizeIdentifier(type || "Paso");
  }

  function humanizeStep(step) {
    const s = step || {};
    const action = humanizeAction(s);
    const target = humanizeTarget(s);
    const value = humanizeValue(s);

    if (s.type === "capture_defaults" || s._baselineDefault === true) return "Estado inicial";
    if (s.type === "navigate") return s.url ? `${action}: ${s.url}` : action;
    if (s.type === "input" || s.type === "text") {
      return target ? `${action} ${_quote(value)} en ${_quote(target)}` : `${action} ${_quote(value)}`.trim();
    }
    if (s.type === "check") return target ? `${action} ${_quote(target)}` : action;
    if (s.type === "choose_option") {
      const option = value || "opcion";
      return target ? `${action} ${_quote(option)} en ${_quote(target)}` : `${action} ${_quote(option)}`;
    }
    if (s.type === "wait") {
      const seconds = s.seconds != null ? Number(s.seconds) : Math.round(Number(s.ms || 0) / 1000);
      return `${action} ${seconds || 1} ${Number(seconds) === 1 ? "segundo" : "segundos"}`;
    }
    if (s.type === "click" || s.type === "dblclick") return target ? `${action} en ${_quote(target)}` : action;
    if (s.type === "key") return value ? `${action} ${_quote(value)}` : action;
    if (s.type === "wait_for") return target ? `Esperar a que aparezca ${_quote(target)}` : action;
    if (s.type === "extract") return target ? `${action} desde ${_quote(target)}` : action;
    if (s.type === "scroll_to") return target ? `${action} hasta ${_quote(target)}` : action;
    if (s.type === "hover") return target ? `${action} sobre ${_quote(target)}` : action;
    if (s.type === "loop_until") return "Repetir hasta que se cumpla la condicion";
    if (s.type === "if_exists") return target ? `Si aparece ${_quote(target)}` : "Si aparece el elemento";
    if (s.type === "for_each_row") return "Para cada fila de la tabla";
    if (target) return `${action} ${_quote(target)}`;
    return action;
  }

  function shouldShowTechnicalDetails(step) {
    return !!(step && (step.selector || step.value != null || step.checked != null || step.controlRef || step._baselineDefault));
  }

  const api = {
    humanizeStep,
    humanizeAction,
    humanizeTarget,
    humanizeValue,
    shouldShowTechnicalDetails
  };

  globalScope.WebMaticStepHumanizer = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
