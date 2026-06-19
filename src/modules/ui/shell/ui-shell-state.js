(function initUiShellState(globalScope) {
  function applyPanelState(panel, state) {
    if (!panel || !state) return;
    panel.style.display = state.ui.panelVisible ? "block" : "none";
    panel.style.width = `${state.ui.panelWidth}px`;
    panel.style.opacity = String(state.settings.panelOpacity ?? 1);
    panel.classList.toggle("webmatic-left", state.ui.panelSide === "left");
    panel.classList.toggle("webmatic-right", state.ui.panelSide === "right");
    panel.classList.toggle("webmatic-floating-mode", state.ui.isFloatingRecorderVisible);
    panel.classList.toggle("webmatic-dark", state.settings.themeMode === "dark");
  }

  function syncModeButtons(buttons, mode) {
    Array.from(buttons || []).forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
  }

  function syncViews(views, mode) {
    Array.from(views || []).forEach((view) => {
      view.classList.toggle("active", view.dataset.view === mode);
    });
  }

  function setActiveByPredicate(element, active) {
    if (element) element.classList.toggle("active", Boolean(active));
  }

  const api = {
    applyPanelState,
    syncModeButtons,
    syncViews,
    setActiveByPredicate
  };

  globalScope.WebMaticUiShellState = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
