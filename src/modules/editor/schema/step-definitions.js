(function initStepDefinitions(globalScope) {
  const STEP_TYPES = [
    { value: "navigate",     label: "\u{1F310} Navegar",        fields: [{ name: "url",        ph: "https://ejemplo.com" }] },
    { value: "browser_back",    label: "\u2B05 Atrás", fields: [] },
    { value: "browser_forward", label: "\u27A1 Adelante", fields: [] },
    { value: "browser_history", label: "\u21C4 Historial", fields: [] },
    { value: "browser_reload",  label: "\u21BB Recargar", fields: [] },
    { value: "open_bookmark",   label: "\u{1F516} Abrir favorito", fields: [{ name: "url", ph: "https://ejemplo.com" }] },
    { value: "open_tab",     label: "\u{1F5D7} Abrir pestaña", fields: [{ name: "url", ph: "https://ejemplo.com" }, { name: "activate", ph: "true", select: [["true", "Activar nueva pestaña"], ["false", "Abrir en segundo plano"]] }] },
    { value: "switch_tab",   label: "\u21C4 Cambiar pestaña",  fields: [{ name: "url", ph: "https://ejemplo.com" }, { name: "openIfMissing", ph: "true", select: [["true", "Abrir si no existe"], ["false", "Fallar si no existe"]] }] },
    { value: "close_tab",    label: "\u2716 Cerrar pestaña",   fields: [{ name: "target", ph: "current", select: [["current", "Cerrar pestaña actual"], ["match_url", "Cerrar por URL"]] }, { name: "url", ph: "https://ejemplo.com (si target=match_url)" }] },
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
    { value: "prompt",       label: "? Preguntar al usuario",   fields: [{ name: "label",      ph: "¿Ingresa nombre?" }, { name: "variable", ph: "NOMBRE" }] },
    { value: "call_macro",   label: "\u21AA Llamar macro",      fields: [{ name: "macro_name", ph: "Nombre de la macro" }] },
    { value: "if_exists",    label: "\u2299 Si existe",         fields: [{ name: "selector", ph: "#elemento" }] },
    { value: "loop_until",   label: "\u21BA Repetir hasta",     fields: [{ name: "selector", ph: "#spinner" }, { name: "condition", ph: "not_exists", select: [["not_exists", "\u23F3 mientras NO existe"], ["exists", "\u23F3 mientras SÍ existe"]] }, { name: "max_iterations", ph: "50" }] },
    { value: "for_each_row", label: "\u25A6 Por cada fila",     fields: [{ name: "columns", ph: "COL1, COL2" }] },
    { value: "capture_defaults", label: "\u2699 Capturar defaults", fields: [{ name: "exclude", ph: "#campo-a-conservar, .selector (opcional)" }] },
    { value: "reset_fields", label: "\uD83E\uDDF9 Limpiar campos", fields: [{ name: "exclude", ph: "#campo-a-conservar (opcional)" }] }
  ];

  const TYPE_ICONS = {
    navigate: "\u{1F310}", browser_back: "\u2B05", browser_forward: "\u27A1", browser_history: "\u21C4", browser_reload: "\u21BB", open_bookmark: "\u{1F516}", open_tab: "\u{1F5D7}", switch_tab: "\u21C4", close_tab: "\u2716", click: "\u{1F5B1}", dblclick: "\u{1F5B1}\u{1F5B1}", input: "\u2328", text: "\u2328",
    wait: "\u23F1", key: "\u2328", check: "\u2611", choose_option: "\u{1F4CB}", extract: "\u270F",
    wait_for: "\u23F3", scroll_to: "\u21D3", hover: "\u25B7", drag_drop: "\u2194",
    set_variable: "=", prompt: "?", if_exists: "\u2299", loop_until: "\u21BA",
    capture_defaults: "\u2699",
    try_fallback: "\u26A0", call_macro: "\u21AA", for_each_row: "\u25A6"
  };

  function shortLabel(s) {
    if (!s) return "";
    if (s.type === "navigate") return s.url || "";
    if (s.type === "browser_back") return "atrás";
    if (s.type === "browser_forward") return "adelante";
    if (s.type === "browser_history") return "historial";
    if (s.type === "browser_reload") return "recargar";
    if (s.type === "open_bookmark") return s.url || "favorito";
    if (s.type === "open_tab") return `${s.url || ""} (${String(s.activate || "true") === "false" ? "segundo plano" : "activa"})`;
    if (s.type === "switch_tab") return `${s.url || ""} (${String(s.openIfMissing || "true") === "false" ? "sin abrir" : "abrir si falta"})`;
    if (s.type === "close_tab") return s.target === "match_url" ? `por URL: ${s.url || ""}` : "pestaña actual";
    if (s.type === "click") return s.selector || "";
    if (s.type === "dblclick") return s.selector || "";
    if (s.type === "input" || s.type === "text") {
      return s.useCurrentValue ? `${s.selector || ""} = \u21BA actual` : `${s.selector || ""} = "${s.value || ""}"`;
    }
    if (s.type === "wait") return s.seconds != null ? `${s.seconds}s` : `${s.ms || 0}ms`;
    if (s.type === "key") return s.key || "";
    if (s.type === "check") return `${s.selector || ""} ${s.checked ? "\u2714" : "\u2718"}`;
    if (s.type === "choose_option") return `${s.selector || ""} ${s.value ? `= ${s.value}` : (s.text ? `= "${s.text}"` : "(elegir al ejecutar)")}`;
    if (s.type === "extract") return `${s.selector || ""} \u2192 ${s.variable || ""}`;
    if (s.type === "wait_for") return s.selector || "";
    if (s.type === "scroll_to") return s.selector || "";
    if (s.type === "hover") return s.selector || "";
    if (s.type === "drag_drop") return `${s.from || ""} \u2192 ${s.to || ""}`;
    if (s.type === "set_variable") return `${s.variable || ""} \u2190 ${s.value || ""}`;
    if (s.type === "prompt") return `${s.label || ""} \u2192 ${s.variable || ""}`;
    if (s.type === "call_macro") return `"${s.macro_name || ""}"`;
    if (s.type === "if_exists") return s.selector || "";
    if (s.type === "loop_until") return s.selector || "";
    if (s.type === "capture_defaults") return s.exclude ? `excepto ${s.exclude}` : "todos los campos";
    if (s.type === "try_fallback") return `${(s.steps || []).length} / ${(s.fallback || []).length} pasos`;
    if (s.type === "for_each_row") return `${(s.dataset || []).length} filas \u00D7 ${(s.columns || []).join(", ")}`;
    return s.type;
  }

  const api = {
    STEP_TYPES,
    TYPE_ICONS,
    shortLabel
  };

  globalScope.WebMaticStepDefinitions = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
