importScripts("../src/modules/storage/fs-handle.js");

chrome.runtime.onInstalled.addListener(() => {
  console.log("[WebMatic Chromium] Extension instalada.");
});

const CONTENT_SCRIPT_FILES = [
  "src/core/contracts.js",
  "src/core/store.js",
  "src/core/utils.js",
  "src/modules/docking/geometry-manager.js",
  "src/modules/ui/ui-shell.js",
  "src/modules/editor/step-editor.js",
  "src/modules/recorder/recorder.js",
  "src/modules/inventory/page-inventory.js",
  "src/modules/player/player.js",
  "src/modules/storage/iim-adapter.js",
  "src/modules/storage/macro-json.js",
  "src/modules/storage/full-backup.js",
  "src/modules/settings/settings-manager.js",
  "src/modules/controls/genexus-autocomplete.js",
  "src/content/content.js"
];

function isRestrictedUrl(url) {
  return !url || /^(chrome|about|edge|devtools|chrome-extension):/i.test(url);
}

function executeFiles(tabId, frameIds, index, done) {
  if (index >= CONTENT_SCRIPT_FILES.length) {
    done(null);
    return;
  }
  chrome.scripting.executeScript(
    {
      target: frameIds && frameIds.length ? { tabId, frameIds } : { tabId, allFrames: true },
      files: [CONTENT_SCRIPT_FILES[index]]
    },
    () => {
      const error = chrome.runtime.lastError;
      if (error) {
        done(error);
        return;
      }
      executeFiles(tabId, frameIds, index + 1, done);
    }
  );
}

function injectContentScripts(tabId, done) {
  chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
    const error = chrome.runtime.lastError;
    if (error) {
      done(error);
      return;
    }
    const frameIds = Array.isArray(frames)
      ? frames.filter((frame) => !isRestrictedUrl(frame.url)).map((frame) => frame.frameId)
      : [];
    executeFiles(tabId, frameIds, 0, done);
  });
}

function sendToggleMessage(tabId, callback) {
  chrome.tabs.sendMessage(tabId, { type: "TOGGLE_PANEL" }, () => {
    callback(chrome.runtime.lastError);
  });
}

function sendMessageToTab(tabId, msg) {
  chrome.tabs.sendMessage(tabId, msg, () => {
    void chrome.runtime.lastError;
  });
}

chrome.action.onClicked.addListener((tab) => {
  if (!tab || !tab.id) return;

  sendToggleMessage(tab.id, (firstError) => {
    if (!firstError) return;
    injectContentScripts(tab.id, (injectError) => {
      if (injectError) {
        console.warn("[WebMatic Chromium] No se pudo inyectar en esta pagina:", injectError.message);
        return;
      }
      sendToggleMessage(tab.id, (secondError) => {
        if (secondError) {
          console.warn("[WebMatic Chromium] No se pudo abrir panel tras inyeccion:", secondError.message);
        }
      });
    });
  });
});

let isRecording = false;
let recordedSteps = [];
let inlineRecordingTabId = null;
let inlineBuffer = [];
let inlineEditorContext = null;
const panelOpenTabs = new Set();
let pendingPlayback = null;

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  if (color) {
    chrome.action.setBadgeBackgroundColor({ color });
  }
}

function showFloatingBtnInTab(tabId) {
  chrome.tabs.sendMessage(tabId, { type: "SHOW_FLOATING_BTN", steps: recordedSteps }, () => {
    void chrome.runtime.lastError;
  });
}

function ensureFloatingBtnInTab(tab) {
  if (!tab || !tab.id || isRestrictedUrl(tab.url)) return;
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
  if (!tab || !tab.id || isRestrictedUrl(tab.url)) return;
  chrome.tabs.sendMessage(tab.id, { type: "OPEN_PANEL" }, () => {
    if (chrome.runtime.lastError) {
      injectContentScripts(tab.id, (err) => {
        if (!err) {
          chrome.tabs.sendMessage(tab.id, { type: "OPEN_PANEL" }, () => {
            void chrome.runtime.lastError;
          });
        }
      });
    }
  });
}

function ensureInlineMirrorOrGoBack(tabId) {
  if (inlineRecordingTabId === null || tabId === inlineRecordingTabId) return;
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    const url = tab.url || tab.pendingUrl || "";
    const restricted = /^(about:|chrome:|edge:|chrome-extension:|blob:|data:)/i.test(url) || /\.pdf(\?|#|$)/i.test(url);
    if (restricted) {
      setTimeout(() => {
        chrome.tabs.update(inlineRecordingTabId, { active: true }, () => { void chrome.runtime.lastError; });
      }, 300);
      return;
    }
    chrome.tabs.sendMessage(tabId, { type: "SHOW_INLINE_REC_MIRROR" }, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        setTimeout(() => {
          if (inlineRecordingTabId !== null) {
            chrome.tabs.update(inlineRecordingTabId, { active: true }, () => { void chrome.runtime.lastError; });
          }
        }, 300);
      }
    });
  });
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    if (isRecording) ensureFloatingBtnInTab(tab);
    if (panelOpenTabs.has(activeInfo.tabId)) ensurePanelOpenInTab(tab);
    if (inlineRecordingTabId !== null) ensureInlineMirrorOrGoBack(activeInfo.tabId);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (isRecording) ensureFloatingBtnInTab(tab);
  if (panelOpenTabs.has(tabId)) ensurePanelOpenInTab(tab);
  if (inlineRecordingTabId !== null && tabId === inlineRecordingTabId) {
    const count = inlineBuffer.length;
    setTimeout(() => {
      if (inlineRecordingTabId === tabId) {
        chrome.tabs.sendMessage(tabId, { type: "SHOW_INLINE_REC_PANEL", priorStepCount: count }, () => {
          void chrome.runtime.lastError;
        });
      }
    }, 600);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  panelOpenTabs.delete(tabId);
  if (inlineRecordingTabId === tabId) inlineRecordingTabId = null;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true, source: "background" });
    return true;
  }

  if (message?.type === "SAVE_PLAYBACK_STATE") {
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
      const pending = pendingPlayback;
      pendingPlayback = null;
      sendResponse({ pending });
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
    chrome.storage.local.get("webmaticExportFolder", (result) => {
      sendResponse({ name: (result && result.webmaticExportFolder) || null });
    });
    return true;
  }

  if (message?.type === "EXPORT_FILE") {
    chrome.storage.local.get("webmaticExportFolder", (result) => {
      const folderName = (result && result.webmaticExportFolder) || null;
      const filename = folderName ? `${folderName}/${message.filename}` : message.filename;
      const useSaveAs = message.saveAs === true ? true : (message.saveAs === false ? false : !folderName);
      const url = `data:text/plain;charset=utf-8,${encodeURIComponent(String(message.content || ""))}`;
      chrome.downloads.download({ url, filename, saveAs: useSaveAs, conflictAction: "overwrite" }, () => {
        void chrome.runtime.lastError;
      });
      sendResponse({ ok: true, folder: folderName });
    });
    return true;
  }

  if (message?.type === "DOWNLOAD_FILE") {
    chrome.downloads.download({
      url: String(message.url || ""),
      filename: message.filename || "macro.iim",
      saveAs: true
    }, () => {
      void chrome.runtime.lastError;
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "PANEL_STATE_CHANGED") {
    if (sender && sender.tab && sender.tab.id) {
      if (message.visible) panelOpenTabs.add(sender.tab.id);
      else panelOpenTabs.delete(sender.tab.id);
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
      setBadge("REC", "#dc2626");
    } else {
      recordedSteps = [];
      setBadge("");
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => sendMessageToTab(tab.id, { type: "HIDE_FLOATING_BTN" }));
      });
    }
    if (sender && sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, { type: "RECORDING_STATE", active: isRecording }, () => {
        void chrome.runtime.lastError;
      });
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
      chrome.tabs.sendMessage(sender.tab.id, { type: "FRAME_STEP_CAPTURED", step: message.step }, { frameId: 0 }, () => {
        void chrome.runtime.lastError;
      });
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

  if (message?.type === "INLINE_RECORDING_STARTED") {
    if (sender && sender.tab && sender.tab.id) {
      inlineRecordingTabId = sender.tab.id;
      inlineBuffer = [];
      inlineEditorContext = message.editorContext || null;
      setBadge("●REC", "#ef4444");
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "INLINE_RECORD_STEP") {
    if (inlineRecordingTabId !== null && message.step) {
      const step = message.step;
      if (step._merge && inlineBuffer.length > 0) {
        const clean = Object.assign({}, step);
        delete clean._merge;
        inlineBuffer[inlineBuffer.length - 1] = clean;
      } else if (!step._merge) {
        inlineBuffer.push(step);
      }
    }
    return false;
  }

  if (message?.type === "INLINE_RECORDING_STOP_REQUEST") {
    const steps = inlineBuffer.slice();
    const editorContext = inlineEditorContext;
    inlineBuffer = [];
    inlineEditorContext = null;
    inlineRecordingTabId = null;
    if (!isRecording) setBadge("");
    sendResponse({ ok: true, steps, editorContext });
    return true;
  }

  if (message?.type === "INLINE_RECORDING_STOPPED") {
    inlineRecordingTabId = null;
    inlineBuffer = [];
    inlineEditorContext = null;
    if (!isRecording) setBadge("");
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