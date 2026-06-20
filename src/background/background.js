chrome.runtime.onInstalled.addListener(() => {
  console.log("[WebMatic] Extension instalada.");
});

const CONTENT_SCRIPT_FILES = [
  "src/core/contracts.js",
  "src/core/store.js",
  "src/core/utils.js",
  "src/modules/docking/geometry-manager.js",
  "src/modules/ui/build-info.js",
  "src/modules/ui/ui-shell.js",
  "src/modules/editor/step-editor.js",
  "src/modules/recorder/recorder.js",
  "src/modules/player/player.js",
  "src/modules/macros/macro-step-compactor.js",
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
let recordingActiveTabId = null;
let justOpenedActiveTabId = null;
const recordingTabUrlById = new Map();
const floatingShownAtByTab = new Map();
let inlineRecordingTabId = null; // tab donde hay grabación inline activa
let inlineBuffer = [];           // pasos acumulados entre navegaciones
let inlineEditorContext = null;  // { macroId, draftSteps } del editor al iniciar grabación

// Tracks which tabs have the panel open, so it can be restored after page navigation
const panelOpenTabs = new Set();

// Historial liviano por pestaña para inferir back/forward en eventos webNavigation.
const tabNavStateById = new Map(); // tabId -> { stack: string[], index: number }
const lastBrowserNavEventByTab = new Map(); // tabId -> { type, url, at }

// Stores pending playback state so it can be resumed after page navigation.
// Keyed by destination tabId to avoid singleton overwrite across concurrent playbacks.
// Map<tabId, { tabId, steps, index, vars, speed, macroId }>
const pendingPlaybackByTab = new Map();

function _tabsNavigation() {
  if (typeof globalThis !== "undefined" && globalThis.WebMaticTabsNavigation) return globalThis.WebMaticTabsNavigation;
  if (typeof require === "function") {
    try { return require("./tabs-navigation.js"); } catch (_e) { /* ignore */ }
  }
  throw new Error("WebMaticTabsNavigation no está disponible");
}

function _isRestrictedUrl(url) {
  return _tabsNavigation().isRestrictedUrl(url);
}

function _rememberTabUrl(tab) {
  if (!tab || !tab.id) return;
  const url = String(tab.url || tab.pendingUrl || "").trim();
  if (!url) return;
  recordingTabUrlById.set(tab.id, url);
}

function _snapshotAllTabUrls() {
  chrome.tabs.query({}, (tabs) => {
    (tabs || []).forEach((tab) => {
      _rememberTabUrl(tab);
      const u = String((tab && (tab.url || tab.pendingUrl)) || "").trim();
      if (!u || _isRestrictedUrl(u)) return;
      tabNavStateById.set(tab.id, { stack: [u], index: 0 });
    });
  });
}

function _isTopFrameNavigation(details) {
  return !!details && Number(details.frameId) === 0 && Number(details.tabId) > 0;
}

function _dedupeBrowserNavStep(tabId, type, url) {
  const now = Date.now();
  const prev = lastBrowserNavEventByTab.get(tabId);
  if (prev && prev.type === type && String(prev.url || "") === String(url || "") && (now - prev.at) < 700) {
    return true;
  }
  lastBrowserNavEventByTab.set(tabId, { type, url: String(url || ""), at: now });
  return false;
}

function _updateTabNavigationState(tabId, url, transitionType, qualifiers) {
  const cleanUrl = String(url || "").trim();
  if (!cleanUrl || _isRestrictedUrl(cleanUrl)) return null;

  const q = Array.isArray(qualifiers) ? qualifiers : [];
  const state = tabNavStateById.get(tabId) || { stack: [], index: -1 };
  const existingIdx = state.stack.lastIndexOf(cleanUrl);

  let inferredHistoryDir = "";
  if (q.includes("forward_back")) {
    if (existingIdx >= 0) {
      if (existingIdx < state.index) inferredHistoryDir = "back";
      else if (existingIdx > state.index) inferredHistoryDir = "forward";
      state.index = existingIdx;
    } else {
      if (state.index >= 0 && state.index < state.stack.length - 1) {
        state.stack = state.stack.slice(0, state.index + 1);
      }
      state.stack.push(cleanUrl);
      state.index = state.stack.length - 1;
    }
  } else if (transitionType !== "reload") {
    if (state.index >= 0 && state.index < state.stack.length - 1) {
      state.stack = state.stack.slice(0, state.index + 1);
    }
    if (state.stack[state.index] !== cleanUrl) {
      state.stack.push(cleanUrl);
      state.index = state.stack.length - 1;
    }
  }

  tabNavStateById.set(tabId, state);
  return inferredHistoryDir;
}

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

function ensureFloatingBtnInTab(tab, options = {}) {
  if (!tab || !tab.id) return;
  if (!tab.url || /^(chrome|about|moz-extension|chrome-extension):/.test(tab.url)) return;
  const force = options.force === true;
  const now = Date.now();
  const last = floatingShownAtByTab.get(tab.id) || 0;
  // Avoid duplicate SHOW_FLOATING_BTN bursts (onActivated + onUpdated complete)
  if (!force && (now - last) < 250) return;
  floatingShownAtByTab.set(tab.id, now);
  // Always send recordedSteps so the new page can restore accumulated steps
  chrome.tabs.sendMessage(tab.id, { type: "SHOW_FLOATING_BTN", steps: recordedSteps }, () => {
    if (chrome.runtime.lastError) {
      injectContentScripts(tab.id, (err) => {
        if (!err) {
          floatingShownAtByTab.set(tab.id, Date.now());
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

function _ensureInlineMirrorOrGoBack(tabId) {
  if (inlineRecordingTabId === null) return;
  // Si es la misma pestaña de grabación, no hacer nada
  if (tabId === inlineRecordingTabId) return;
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    const url = tab.url || tab.pendingUrl || "";
    // PDFs y páginas restringidas no aceptan content scripts — volver a la pestaña de grabación
    const isRestricted = /^(about:|chrome:|moz-extension:|chrome-extension:|blob:|data:)/i.test(url) ||
      /\.pdf(\?|#|$)/i.test(url);
    if (isRestricted) {
      setTimeout(() => {
        chrome.tabs.update(inlineRecordingTabId, { active: true }, () => { void chrome.runtime.lastError; });
      }, 300);
      return;
    }
    // Página normal: intentar mostrar el espejo; si falla (sin content script), volver
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
    _rememberTabUrl(tab);
    if (isRecording) {
      if (justOpenedActiveTabId === activeInfo.tabId) {
        justOpenedActiveTabId = null;
      } else if (recordingActiveTabId !== null && recordingActiveTabId !== activeInfo.tabId) {
        recordedSteps.push({
          type: "switch_tab",
          url: String(tab && (tab.url || tab.pendingUrl) || ""),
          openIfMissing: "true"
        });
      }
      recordingActiveTabId = activeInfo.tabId;
    }
    if (isRecording) ensureFloatingBtnInTab(tab, { force: true });
    if (panelOpenTabs.has(activeInfo.tabId)) ensurePanelOpenInTab(tab);
    if (inlineRecordingTabId !== null) {
      _ensureInlineMirrorOrGoBack(activeInfo.tabId);
    }
  });
});

chrome.tabs.onCreated.addListener((tab) => {
  _rememberTabUrl(tab);
  if (!isRecording) return;

  const rawUrl = String(tab && (tab.url || tab.pendingUrl) || "").trim();
  const step = {
    type: "open_tab",
    activate: tab && tab.active ? "true" : "false"
  };
  if (rawUrl && !_isRestrictedUrl(rawUrl)) {
    step.url = rawUrl;
  }
  recordedSteps.push(step);

  if (tab && tab.active) {
    justOpenedActiveTabId = tab.id;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  _rememberTabUrl(tab);
  if (changeInfo.status !== "complete") return;
  if (isRecording) ensureFloatingBtnInTab(tab);
  if (panelOpenTabs.has(tabId)) ensurePanelOpenInTab(tab);
  // Si la pestaña de grabación inline navegó a una subpágina, re-inyectar el panel flotante
  if (inlineRecordingTabId !== null && tabId === inlineRecordingTabId) {
    const count = inlineBuffer.length;
    setTimeout(() => {
      if (inlineRecordingTabId === tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: "SHOW_INLINE_REC_PANEL",
          priorStepCount: count
        }, () => { void chrome.runtime.lastError; });
      }
    }, 600);
  }
});

if (chrome.webNavigation && chrome.webNavigation.onCommitted && typeof chrome.webNavigation.onCommitted.addListener === "function") {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (!_isTopFrameNavigation(details)) return;
    const tabId = Number(details.tabId);
    const url = String(details.url || "").trim();
    if (!url || _isRestrictedUrl(url)) return;

    _rememberTabUrl({ id: tabId, url });
    const transitionType = String(details.transitionType || "");
    const qualifiers = Array.isArray(details.transitionQualifiers) ? details.transitionQualifiers : [];
    const historyDir = _updateTabNavigationState(tabId, url, transitionType, qualifiers);

    if (!isRecording) return;

    let step = null;
    if (transitionType === "reload") {
      step = { type: "browser_reload" };
    } else if (qualifiers.includes("forward_back")) {
      if (historyDir === "back") step = { type: "browser_back" };
      else if (historyDir === "forward") step = { type: "browser_forward" };
      else step = { type: "browser_history" };
    } else if (transitionType === "auto_bookmark") {
      step = { type: "open_bookmark", url };
    }

    if (!step) return;
    const keyUrl = step.url || url;
    if (_dedupeBrowserNavStep(tabId, step.type, keyUrl)) return;
    recordedSteps.push(step);
  });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  const closedUrl = String(recordingTabUrlById.get(tabId) || "").trim();
  recordingTabUrlById.delete(tabId);
  floatingShownAtByTab.delete(tabId);
  tabNavStateById.delete(tabId);
  lastBrowserNavEventByTab.delete(tabId);
  if (justOpenedActiveTabId === tabId) justOpenedActiveTabId = null;

  if (isRecording) {
    const step = { type: "close_tab" };
    if (closedUrl && !_isRestrictedUrl(closedUrl)) {
      step.target = "match_url";
      step.url = closedUrl;
    } else {
      step.target = "current";
    }
    recordedSteps.push(step);
  }

  panelOpenTabs.delete(tabId);
  pendingPlaybackByTab.delete(tabId);
  if (inlineRecordingTabId === tabId) inlineRecordingTabId = null;
  if (recordingActiveTabId === tabId) recordingActiveTabId = null;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const backgroundRouter = (typeof globalThis !== "undefined" && globalThis.WebMaticBackgroundRouter)
    ? globalThis.WebMaticBackgroundRouter
    : null;
  const isBackgroundMessage = (type) => backgroundRouter && typeof backgroundRouter.isMessageType === "function"
    ? backgroundRouter.isMessageType(message, type)
    : ((message && typeof message === "object" ? String(message.type || "") : "") === String(type || ""));

  if (isBackgroundMessage("PING")) {
    sendResponse({ ok: true, source: "background" });
    return true;
  }

  if (isBackgroundMessage("SAVE_PLAYBACK_STATE")) {
    // Called by player just before a navigating click
    if (sender && sender.tab && sender.tab.id) {
      const explicitTabId = Number(message.targetTabId);
      const pending = {
        tabId: Number.isFinite(explicitTabId) && explicitTabId > 0 ? explicitTabId : sender.tab.id,
        steps: message.steps,
        index: message.index,
        vars: message.vars || {},
        speed: message.speed || 1,
        macroId: message.macroId || null
      };
      pendingPlaybackByTab.set(pending.tabId, pending);
    }
    sendResponse({ ok: true });
    return true;
  }

  if (isBackgroundMessage("QUERY_PENDING_PLAYBACK")) {
    const senderTabId = sender && sender.tab && sender.tab.id ? Number(sender.tab.id) : 0;
    if (senderTabId > 0 && pendingPlaybackByTab.has(senderTabId)) {
      const p = pendingPlaybackByTab.get(senderTabId);
      pendingPlaybackByTab.delete(senderTabId);
      sendResponse({ pending: p });
    } else {
      sendResponse({ pending: null });
    }
    return true;
  }

  if (isBackgroundMessage("CLEAR_PENDING_PLAYBACK")) {
    const explicitTabId = Number(message.tabId);
    if (Number.isFinite(explicitTabId) && explicitTabId > 0) {
      pendingPlaybackByTab.delete(explicitTabId);
    } else if (sender && sender.tab && sender.tab.id) {
      pendingPlaybackByTab.delete(Number(sender.tab.id));
    } else {
      pendingPlaybackByTab.clear();
    }
    sendResponse({ ok: true });
    return true;
  }

  if (isBackgroundMessage("OPEN_OPTIONS_PAGE")) {
    chrome.runtime.openOptionsPage(() => { void chrome.runtime.lastError; });
    sendResponse({ ok: true });
    return true;
  }

  if (isBackgroundMessage("GET_FOLDER_NAME")) {
    chrome.storage.local.get("webmaticExportFolder", (r) => {
      sendResponse({ name: (r && r.webmaticExportFolder) || null });
    });
    return true;
  }

  if (isBackgroundMessage("EXPORT_FILE")) {
    chrome.storage.local.get("webmaticExportFolder", (r) => {
      const fsHandle = (typeof globalThis !== "undefined" && globalThis.WebMaticFsHandle)
        ? globalThis.WebMaticFsHandle
        : null;

      const folderNameRaw = (r && r.webmaticExportFolder) || "";
      const folderName = fsHandle && typeof fsHandle.sanitizeFolderName === "function"
        ? fsHandle.sanitizeFolderName(folderNameRaw)
        : String(folderNameRaw || "").trim();

      const filename = fsHandle && typeof fsHandle.buildExportFilename === "function"
        ? fsHandle.buildExportFilename(folderName, message.filename)
        : (folderName ? folderName + "/" + String(message.filename || "") : String(message.filename || "webmatic-export.txt"));
      // saveAs=false: guardar silencioso. saveAs=true: forzar diálogo.
      // undefined: comportamiento previo (diálogo solo si no hay carpeta configurada).
      const useSaveAs = message.saveAs === true
        ? true
        : (message.saveAs === false ? false : !folderName);
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

  if (isBackgroundMessage("DOWNLOAD_FILE")) {
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

  if (isBackgroundMessage("PANEL_STATE_CHANGED")) {
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

  if (isBackgroundMessage("QUERY_RECORDING_STATE")) {
    sendResponse({ isRecording });
    return true;
  }

  if (isBackgroundMessage("QUERY_RECORDED_STEPS")) {
    sendResponse({ steps: recordedSteps.slice() });
    return true;
  }

  if (isBackgroundMessage("RECORDING_STATE")) {
    isRecording = message.active === true;
    if (isRecording) {
      recordedSteps = [];
      recordingActiveTabId = sender && sender.tab ? sender.tab.id : null;
      justOpenedActiveTabId = null;
      recordingTabUrlById.clear();
      floatingShownAtByTab.clear();
      tabNavStateById.clear();
      lastBrowserNavEventByTab.clear();
      _snapshotAllTabUrls();
      chrome.browserAction.setBadgeText({ text: "REC" });
      chrome.browserAction.setBadgeBackgroundColor({ color: "#dc2626" });
    } else {
      recordedSteps = [];
      recordingActiveTabId = null;
      justOpenedActiveTabId = null;
      recordingTabUrlById.clear();
      floatingShownAtByTab.clear();
      tabNavStateById.clear();
      lastBrowserNavEventByTab.clear();
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

  if (isBackgroundMessage("PLAYBACK_NAVIGATE")) {
    const currentTabId = sender && sender.tab && sender.tab.id ? Number(sender.tab.id) : 0;
    if (!currentTabId) {
      sendResponse({ ok: false, error: "missing_sender_tab" });
      return true;
    }

    const resolvedNavigation = _tabsNavigation().resolveNavigationUrl(message.url, sender.tab.url || "about:blank");
    if (!resolvedNavigation.ok) {
      sendResponse({ ok: false, error: resolvedNavigation.error });
      return true;
    }

    const targetUrl = resolvedNavigation.url;

    const _pendingState = _tabsNavigation().buildPendingPlaybackState(currentTabId, message);

    if (_pendingState) {
      pendingPlaybackByTab.set(currentTabId, _pendingState);
    }

    const _isFileUrl = targetUrl.startsWith("file:");

    chrome.tabs.update(currentTabId, { url: targetUrl }, () => {
      if (!chrome.runtime.lastError) {
        sendResponse({ ok: true, handoff: true, tabId: currentTabId });
        return;
      }

      // tabs.update failed — save the real error and try tabs.create as fallback.
      const updateErrorMsg = chrome.runtime.lastError.message || "unknown";
      if (_pendingState) pendingPlaybackByTab.delete(currentTabId);

      chrome.tabs.create({ url: targetUrl, active: true }, (newTab) => {
        if (chrome.runtime.lastError || !newTab || !newTab.id) {
          const createErrorMsg = (chrome.runtime.lastError && chrome.runtime.lastError.message) || "unknown";
          const hint = _isFileUrl ? _tabsNavigation().fileAccessHint(targetUrl) : "";
          sendResponse({
            ok: false,
            error: "navigate_tab_update_failed",
            detail: `tabs.update: ${updateErrorMsg}; tabs.create: ${createErrorMsg}${hint}`,
            url: targetUrl,
            tabId: currentTabId
          });
          return;
        }

        // tabs.create succeeded — remap pending to the new tab.
        if (_pendingState) {
          pendingPlaybackByTab.set(newTab.id, { ..._pendingState, tabId: newTab.id });
        }
        sendResponse({ ok: true, handoff: true, tabId: newTab.id, usedCreate: true });
      });
    });
    return true;
  }

  if (isBackgroundMessage("PLAYBACK_TAB_ACTION")) {
    const action = String(message.action || "");
    const step = message.step || {};
    const currentTabId = sender && sender.tab && sender.tab.id ? sender.tab.id : null;
    if (!currentTabId) {
      sendResponse({ ok: false, error: "missing_sender_tab" });
      return true;
    }

    const resumeInTab = (tabId) => {
      const targetId = Number(tabId);
      if (!Number.isFinite(targetId) || targetId <= 0) {
        sendResponse({ ok: false, error: "invalid_target_tab" });
        return;
      }
      pendingPlaybackByTab.set(targetId, _tabsNavigation().buildPendingPlaybackState(targetId, {
        ...message,
        steps: Array.isArray(message.steps) ? message.steps : []
      }));

      chrome.tabs.update(targetId, { active: true }, () => {
        void chrome.runtime.lastError;
        chrome.tabs.sendMessage(targetId, { type: "RESUME_PENDING_PLAYBACK" }, (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.ok) {
            injectContentScripts(targetId, (err) => {
              if (err) {
                sendResponse({ ok: false, error: "resume_inject_failed" });
                return;
              }
              chrome.tabs.sendMessage(targetId, { type: "RESUME_PENDING_PLAYBACK" }, () => {
                void chrome.runtime.lastError;
                sendResponse({ ok: true, handoff: true, tabId: targetId });
              });
            });
            return;
          }
          sendResponse({ ok: true, handoff: true, tabId: targetId });
        });
      });
    };

    if (action === "open_tab") {
      const url = String(step.url || "").trim() || String(sender.tab.url || "").trim() || "about:blank";
      const activate = String(step.activate || "true") !== "false";
      chrome.tabs.create({ url, active: activate }, (tab) => {
        if (!tab || !tab.id) {
          sendResponse({ ok: false, error: "open_tab_failed" });
          return;
        }
        if (!activate) {
          sendResponse({ ok: true, handoff: false, tabId: tab.id });
          return;
        }
        resumeInTab(tab.id);
      });
      return true;
    }

    if (action === "switch_tab") {
      const desiredUrl = String(step.url || "").trim();
      const openIfMissing = String(step.openIfMissing || "true") !== "false";
      chrome.tabs.query({}, (tabs) => {
        const found = tabs.find((t) => t && t.id && desiredUrl && _tabsNavigation().urlMatches(t.url || t.pendingUrl || "", desiredUrl));
        if (found && found.id) {
          resumeInTab(found.id);
          return;
        }
        if (!openIfMissing) {
          sendResponse({ ok: false, error: "switch_tab_not_found" });
          return;
        }
        const newUrl = desiredUrl || String(sender.tab.url || "").trim() || "about:blank";
        chrome.tabs.create({ url: newUrl, active: true }, (tab) => {
          if (!tab || !tab.id) {
            sendResponse({ ok: false, error: "switch_tab_open_failed" });
            return;
          }
          resumeInTab(tab.id);
        });
      });
      return true;
    }

    if (action === "close_tab") {
      const target = String(step.target || "current").trim();
      if (target === "match_url") {
        const desiredUrl = String(step.url || "").trim();
        chrome.tabs.query({}, (tabs) => {
          const found = tabs.find((t) => t && t.id && desiredUrl && _tabsNavigation().urlMatches(t.url || t.pendingUrl || "", desiredUrl));
          if (!found || !found.id) {
            sendResponse({ ok: false, error: "close_tab_not_found" });
            return;
          }
          const closingId = found.id;
          const fallback = tabs.find((t) => t && t.id && t.id !== closingId) || null;
          chrome.tabs.remove(closingId, () => {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, error: "close_tab_failed" });
              return;
            }
            if (!fallback || !fallback.id) {
              sendResponse({ ok: true, handoff: false });
              return;
            }
            resumeInTab(fallback.id);
          });
        });
        return true;
      }

      chrome.tabs.query({}, (tabs) => {
        const fallback = tabs.find((t) => t && t.id && t.id !== currentTabId) || null;
        chrome.tabs.remove(currentTabId, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ ok: false, error: "close_current_failed" });
            return;
          }
          if (!fallback || !fallback.id) {
            sendResponse({ ok: true, handoff: false });
            return;
          }
          resumeInTab(fallback.id);
        });
      });
      return true;
    }

    sendResponse({ ok: false, error: "unknown_tab_action" });
    return true;
  }

  if (isBackgroundMessage("RECORD_STEP")) {
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

  if (isBackgroundMessage("FRAME_STEP_CAPTURED")) {
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

  if (isBackgroundMessage("OPEN_HELP_PAGE")) {
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
  if (isBackgroundMessage("INLINE_RECORDING_STARTED")) {
    if (sender && sender.tab && sender.tab.id) {
      inlineRecordingTabId = sender.tab.id;
      inlineBuffer = []; // buffer fresco para esta sesión
      inlineEditorContext = message.editorContext || null;
      chrome.browserAction.setBadgeText({ text: "●REC" });
      chrome.browserAction.setBadgeBackgroundColor({ color: "#ef4444" });
    }
    sendResponse({ ok: true });
    return true;
  }

  // Cada paso capturado en content.js se envía aquí para persistir entre navegaciones
  if (isBackgroundMessage("INLINE_RECORD_STEP")) {
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

  // Solicitud de detención desde content.js: devolver todos los pasos acumulados y el contexto del editor
  if (isBackgroundMessage("INLINE_RECORDING_STOP_REQUEST")) {
    const steps = inlineBuffer.slice();
    const editorContext = inlineEditorContext;
    inlineBuffer = [];
    inlineEditorContext = null;
    inlineRecordingTabId = null;
    if (!isRecording) {
      chrome.browserAction.setBadgeText({ text: "" });
    }
    sendResponse({ ok: true, steps, editorContext });
    return true;
  }

  if (isBackgroundMessage("INLINE_RECORDING_STOPPED")) {
    inlineRecordingTabId = null;
    inlineBuffer = [];
    inlineEditorContext = null;
    if (!isRecording) {
      chrome.browserAction.setBadgeText({ text: "" });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (isBackgroundMessage("QUERY_INLINE_RECORDING_STATE")) {
    sendResponse({ active: inlineRecordingTabId !== null, tabId: inlineRecordingTabId });
    return true;
  }

  if (isBackgroundMessage("STOP_INLINE_RECORDING")) {
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
