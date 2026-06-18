(function initEditorRenderUtils(globalScope) {
  function mkBtn(text, title, disabled, onClick) {
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

  const api = {
    mkBtn,
    RESET_POLICY_OPTIONS
  };

  globalScope.WebMaticEditorRenderUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);