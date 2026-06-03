async function sendToActiveTab(message) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) {
    return;
  }
  await chrome.tabs.sendMessage(tabs[0].id, message);
}

// Verificar si hay grabación inline activa
chrome.runtime.sendMessage({ type: "QUERY_INLINE_RECORDING_STATE" }, (resp) => {
  void chrome.runtime.lastError;
  if (resp && resp.active) {
    document.getElementById("rec-bar").classList.add("active");
  }
});

document.getElementById("rec-stop-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_INLINE_RECORDING" }, () => {
    void chrome.runtime.lastError;
    document.getElementById("rec-bar").classList.remove("active");
    window.close();
  });
});

document.getElementById("togglePanel").addEventListener("click", () => {
  sendToActiveTab({ type: "TOGGLE_PANEL" });
});

document.getElementById("dockLeft").addEventListener("click", () => {
  sendToActiveTab({ type: "SET_PANEL_SIDE", payload: "left" });
});

document.getElementById("dockRight").addEventListener("click", () => {
  sendToActiveTab({ type: "SET_PANEL_SIDE", payload: "right" });
});