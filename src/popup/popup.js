async function sendToActiveTab(message) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) {
    return;
  }
  await chrome.tabs.sendMessage(tabs[0].id, message);
}

document.getElementById("togglePanel").addEventListener("click", () => {
  sendToActiveTab({ type: "TOGGLE_PANEL" });
});

document.getElementById("dockLeft").addEventListener("click", () => {
  sendToActiveTab({ type: "SET_PANEL_SIDE", payload: "left" });
});

document.getElementById("dockRight").addEventListener("click", () => {
  sendToActiveTab({ type: "SET_PANEL_SIDE", payload: "right" });
});