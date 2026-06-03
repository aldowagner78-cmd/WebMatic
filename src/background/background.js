chrome.runtime.onInstalled.addListener(() => {
  console.log("[WebMatic] Extension instalada.");
});

const CONTENT_SCRIPT_FILES = [
  "src/core/contracts.js",
  "src/core/store.js",
  "src/core/utils.js",
  "src/modules/docking/geometry-manager.js",
  "src/modules/ui/ui-shell.js",
  "src/modules/editor/step-editor.js",
  "src/modules/recorder/recorder.js",
  "src/modules/player/player.js",
  "src/modules/storage/iim-adapter.js",
  "src/modules/settings/settings-manager.js",
  "src/content/content.js"
];

function sendToggleMessage(tabId, callback) {
  chrome.tabs.sendMessage(tabId, { type: "TOGGLE_PANEL" }, () => {
    const error = chrome.runtime.lastError;
    callback(error);
  });
}

function injectContentScripts(tabId, done) {
  let index = 0;

  function next() {
    if (index >= CONTENT_SCRIPT_FILES.length) {
      done(null);
      return;
    }

    chrome.tabs.executeScript(tabId, { file: CONTENT_SCRIPT_FILES[index] }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        done(error);
        return;
      }
      index += 1;
      next();
    });
  }

  next();
}

chrome.browserAction.onClicked.addListener((tab) => {
  if (!tab || !tab.id) {
    return;
  }

  sendToggleMessage(tab.id, (firstError) => {
    if (!firstError) {
      return;
    }

    injectContentScripts(tab.id, (injectError) => {
      if (injectError) {
        console.warn("[WebMatic] No se pudo inyectar en esta pagina:", injectError.message);
        return;
      }

      sendToggleMessage(tab.id, (secondError) => {
        if (secondError) {
          console.warn("[WebMatic] No se pudo abrir panel tras inyeccion:", secondError.message);
        }
      });
    });
  });
});

let isRecording = false;
let recordedSteps = [];
let inlineRecordingTabId = null; // tab donde hay grabación inline activa

// Tracks which tabs have the panel open, so it can be restored after page navigation
const panelOpenTabs = new Set();

// Stores pending playback state so it can be resumed after page navigation
// { tabId, steps, index, vars, speed }
let pendingPlayback = null;

function sendMessageToTab(tabId, msg) {
  chrome.tabs.sendMessage(tabId, msg, () => {
    void chrome.runtime.lastError;
  });
}

function showFloatingBtnInTab(tabId) {
  chrome.tabs.sendMessage(tabId, { type: "SHOW_FLOATING_BTN", steps: recordedSteps }, () => {
    void chrome.runtime.lastError;
  });
}

function ensureFloatingBtnInTab(tab) {
  if (!tab || !tab.id) return;
  if (!tab.url || /^(chrome|about|moz-extension|chrome-extension):/.test(tab.url)) return;
  // Always send recordedSteps so the new page can restore accumulated steps
  chrome.tabs.sendMessage(tab.id, { type: "SHOW_FLOATING_BTN", steps: recordedSteps }, () => {
    if (chrome.runtime.lastError) {
      injectContentScripts(tab.id, (err) => {
        if (!err) {
          chrome.tabs.sendMessage(tab.id, { type: "SHOW_FLOATING_BTN", steps: recordedSteps }, () => {
            void chrome.runtime.lastError;
          });
        }
      });
    }
  });
}

function ensurePanelOpenInTab(tab) {
  if (!tab || !tab.id) return;
  if (!tab.url || /^(chrome|about|moz-extension|chrome-extension):/.test(tab.url)) return;
  chrome.tabs.sendMessage(tab.id, { type: "OPEN_PANEL" }, () => {
    if (chrome.runtime.lastError) {
      injectContentScripts(tab.id, (err) => {
        if (!err) {
          chrome.tabs.sendMessage(tab.id, { type: "OPEN_PANEL" }, () => { void chrome.runtime.lastError; });
        }
      });
    }
  });
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    if (isRecording) ensureFloatingBtnInTab(tab);
    if (panelOpenTabs.has(activeInfo.tabId)) ensurePanelOpenInTab(tab);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (isRecording) ensureFloatingBtnInTab(tab);
  if (panelOpenTabs.has(tabId)) ensurePanelOpenInTab(tab);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  panelOpenTabs.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true, source: "background" });
    return true;
  }

  if (message?.type === "SAVE_PLAYBACK_STATE") {
    // Called by player just before a navigating click
    if (sender && sender.tab && sender.tab.id) {
      pendingPlayback = {
        tabId: sender.tab.id,
        steps: message.steps,
        index: message.index,
        vars: message.vars || {},
        speed: message.speed || 1,
        macroId: message.macroId || null
      };
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "QUERY_PENDING_PLAYBACK") {
    if (sender && sender.tab && sender.tab.id && pendingPlayback && pendingPlayback.tabId === sender.tab.id) {
      const p = pendingPlayback;
      pendingPlayback = null;
      sendResponse({ pending: p });
    } else {
      sendResponse({ pending: null });
    }
    return true;
  }

  if (message?.type === "CLEAR_PENDING_PLAYBACK") {
    pendingPlayback = null;
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "OPEN_OPTIONS_PAGE") {
    chrome.runtime.openOptionsPage(() => { void chrome.runtime.lastError; });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "GET_FOLDER_NAME") {
    chrome.storage.local.get("webmaticExportFolder", (r) => {
      sendResponse({ name: (r && r.webmaticExportFolder) || null });
    });
    return true;
  }

  if (message?.type === "EXPORT_FILE") {
    chrome.storage.local.get("webmaticExportFolder", (r) => {
      const folderName = (r && r.webmaticExportFolder) || null;
      const filename = folderName
        ? folderName + "/" + message.filename
        : message.filename;
      // saveAs=false means save silently (backup); saveAs=true or undefined means use dialog when no folder
      const useSaveAs = message.saveAs === false ? false : !folderName;
      const bytes = new TextEncoder().encode(message.content);
      const blob = new Blob([bytes], { type: "text/plain;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      chrome.downloads.download(
        { url: blobUrl, filename, saveAs: useSaveAs, conflictAction: "overwrite" },
        () => { void chrome.runtime.lastError; setTimeout(() => URL.revokeObjectURL(blobUrl), 60000); }
      );
      sendResponse({ ok: true, folder: folderName });
    });
    return true;
  }

  if (message?.type === "DOWNLOAD_FILE") {
    try {
      // Decode the base64 data URL to a Blob so Firefox saveAs dialog works reliably
      const dataUrl = String(message.url || "");
      const base64 = dataUrl.indexOf(",") !== -1 ? dataUrl.split(",")[1] : dataUrl;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "text/plain;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      chrome.downloads.download(
        { url: blobUrl, filename: message.filename || "macro.iim", saveAs: true },
        () => {
          void chrome.runtime.lastError;
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        }
      );
    } catch (e) {
      console.error("[WebMatic] DOWNLOAD_FILE error:", e);
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "PANEL_STATE_CHANGED") {
    if (sender && sender.tab && sender.tab.id) {
      if (message.visible) {
        panelOpenTabs.add(sender.tab.id);
      } else {
        panelOpenTabs.delete(sender.tab.id);
      }
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "QUERY_RECORDING_STATE") {
    sendResponse({ isRecording });
    return true;
  }

  if (message?.type === "RECORDING_STATE") {
    isRecording = message.active === true;
    if (isRecording) {
      recordedSteps = [];
      chrome.browserAction.setBadgeText({ text: "REC" });
      chrome.browserAction.setBadgeBackgroundColor({ color: "#dc2626" });
    } else {
      recordedSteps = [];
      chrome.browserAction.setBadgeText({ text: "" });
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => sendMessageToTab(tab.id, { type: "HIDE_FLOATING_BTN" }));
      });
    }
    // Notificar a todos los sub-frames del tab actual
    if (sender && sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(
        sender.tab.id,
        { type: "RECORDING_STATE", active: isRecording },
        () => { void chrome.runtime.lastError; }
      );
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "RECORD_STEP") {
    if (isRecording && message.step) {
      const step = message.step;
      if (step._merge && recordedSteps.length > 0) {
        const clean = Object.assign({}, step);
        delete clean._merge;
        recordedSteps[recordedSteps.length - 1] = clean;
      } else if (!step._merge) {
        recordedSteps.push(step);
      }
    }
    return false;
  }

  if (message?.type === "FRAME_STEP_CAPTURED") {
    if (isRecording && sender && sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(
        sender.tab.id,
        { type: "FRAME_STEP_CAPTURED", step: message.step },
        { frameId: 0 },
        () => { void chrome.runtime.lastError; }
      );
    }
    return false;
  }

  if (message?.type === "OPEN_HELP_PAGE") {
    const helpTheme = { themeMode: message.themeMode || "light", themeVariant: message.themeVariant || 1 };
    chrome.storage.local.set({ webmaticHelpTheme: helpTheme }, () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("src/help/help.html") }, () => {
        void chrome.runtime.lastError;
      });
    });
    sendResponse({ ok: true });
    return true;
  }

  // ── Grabación inline ──
  if (message?.type === "INLINE_RECORDING_STARTED") {
    if (sender && sender.tab && sender.tab.id) {
      inlineRecordingTabId = sender.tab.id;
      chrome.browserAction.setBadgeText({ text: "●REC" });
      chrome.browserAction.setBadgeBackgroundColor({ color: "#ef4444" });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "INLINE_RECORDING_STOPPED") {
    inlineRecordingTabId = null;
    if (!isRecording) {
      chrome.browserAction.setBadgeText({ text: "" });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "QUERY_INLINE_RECORDING_STATE") {
    sendResponse({ active: inlineRecordingTabId !== null, tabId: inlineRecordingTabId });
    return true;
  }

  if (message?.type === "STOP_INLINE_RECORDING") {
    if (inlineRecordingTabId !== null) {
      chrome.tabs.sendMessage(inlineRecordingTabId, { type: "STOP_INLINE_RECORDING" }, () => {
        void chrome.runtime.lastError;
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  return false;
});