"use strict";

// Preload del webview: puente entre scripts inyectados y el host (renderer.js)
// ipcRenderer.sendToHost → webview.addEventListener('ipc-message') en host
const { ipcRenderer } = require("electron");

window.__wm = {
  sendToHost(channel, data) {
    ipcRenderer.sendToHost(channel, data);
  }
};
