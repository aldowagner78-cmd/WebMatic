(function initSettingsManager(globalScope) {
  const defaultSettings = Object.freeze({
    panelWidth: 260,
    panelSide: "left",
    speed: 1,
    panelOpacity: 1,
    retryCount: 3,
    retryDelayMs: 500,
    waitThreshold: 3,
    theme: "light",
    themeMode: "light",
    themeVariant: 1,
    accentColor: "#059669",
    surfaceColor: "#f0fdf4",
    downloadFolder: ""
  });

  async function getSettings() {
    const result = await chrome.storage.local.get("webmaticSettings");
    return { ...defaultSettings, ...(result.webmaticSettings || {}) };
  }

  async function saveSettings(settingsPatch) {
    const current = await getSettings();
    const merged = { ...current, ...(settingsPatch || {}) };
    await chrome.storage.local.set({ webmaticSettings: merged });
    return merged;
  }

  const api = Object.freeze({
    defaultSettings,
    getSettings,
    saveSettings
  });

  globalScope.WebMaticSettings = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);