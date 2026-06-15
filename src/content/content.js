(function bootstrapWebMatic(globalScope) {
  // ── Shared: flash visual feedback on recorded element ───────────────────
  function flashElement(el) {
    if (!(el instanceof Element)) return;
    try {
      const doc = el.ownerDocument;
      const win = doc && doc.defaultView;
      if (!doc || !win) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const root = doc.documentElement || doc.body;
      const ov = doc.createElement("div");
      ov.setAttribute("data-wm-flash", "1");
      Object.assign(ov.style, {
        position: "fixed",
        top: (rect.top - 3) + "px",
        left: (rect.left - 3) + "px",
        width: (rect.width + 6) + "px",
        height: (rect.height + 6) + "px",
        border: "2px solid #ef4444",
        borderRadius: "4px",
        backgroundColor: "rgba(239,68,68,0.10)",
        zIndex: "2147483647",
        pointerEvents: "none",
        boxSizing: "border-box",
        transition: "opacity 0.45s ease",
        opacity: "1"
      });
      const badge = doc.createElement("span");
      Object.assign(badge.style, {
        position: "absolute",
        top: "-11px",
        right: "-11px",
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        background: "#ef4444",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        color: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,.35)",
        lineHeight: "1",
        userSelect: "none"
      });
      badge.textContent = "⚡";
      ov.appendChild(badge);
      root.appendChild(ov);
      setTimeout(() => { ov.style.opacity = "0"; }, 380);
      setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 820);
    } catch (_) {}
  }

  const SENSITIVE_INPUT_RE = /(pass|password|passwd|pwd|token|secret|cvv|cvc|card|tarjeta|otp|pin|seguridad|security|clave|contrasen|contrasenia|api[-_]?key|authorization|auth)/i;

  function _isSensitiveSelectorText(raw) {
    return SENSITIVE_INPUT_RE.test(String(raw || ""));
  }

  function _isSensitiveInputTarget(target, selector) {
    if (!(target instanceof Element)) return false;
    const type = String(target.getAttribute("type") || "").toLowerCase();
    if (type === "password") return true;

    const attrs = [
      String(selector || ""),
      String(target.id || ""),
      String(target.getAttribute("name") || ""),
      String(target.getAttribute("aria-label") || ""),
      String(target.getAttribute("placeholder") || "")
    ];

    if (target instanceof HTMLInputElement) {
      try {
        if (target.labels && target.labels.length > 0) {
          target.labels.forEach((lbl) => attrs.push(String((lbl && lbl.textContent) || "")));
        }
      } catch (_e) { /* ignore */ }
    }

    return attrs.some((entry) => _isSensitiveSelectorText(entry));
  }

  // ── Sub-frame mode: only attach a lightweight recorder ──────────────────
  // When all_frames:true, this script runs inside every iframe too.
  // We do NOT mount the UI in sub-frames; we just capture events and relay
  // them to the background, which forwards them to the top frame.
  if (window !== window.top) {
    const _Rec = globalScope.WebMaticRecorder;
    let _isRecording = false;
    const _sfLastCheckChangeAt = new WeakMap();
    // Consultar estado inicial (si la grabacion ya estaba activa al cargar el iframe)
    chrome.runtime.sendMessage({ type: "QUERY_RECORDING_STATE" }, (resp) => {
      if (chrome.runtime.lastError) return;
      if (resp && resp.isRecording) _isRecording = true;
    });
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "RECORDING_STATE") _isRecording = msg.active === true;
    });
    function _sel(el) {
      if (_Rec && typeof _Rec.buildSelector === "function") return _Rec.buildSelector(el);
      if (!el || !(el instanceof Element)) return "";
      if (el.id) return "#" + el.id;
      return el.tagName.toLowerCase();
    }
    function _send(step) {
      if (!_isRecording) return;
      chrome.runtime.sendMessage({ type: "FRAME_STEP_CAPTURED", step }, () => { void chrome.runtime.lastError; });
    }
    document.addEventListener("click", (e) => {
      let t = e.target;
      if (!(t instanceof Element)) return;
      let checkTarget = t instanceof HTMLInputElement && (t.type === "checkbox" || t.type === "radio")
        ? t
        : t.closest && t.closest('input[type="checkbox"], input[type="radio"]');
      if (!(checkTarget instanceof HTMLInputElement)) {
        const lbl = t instanceof HTMLLabelElement ? t : (t.closest && t.closest("label[for]"));
        if (lbl && lbl.htmlFor) {
          const linked = (t.ownerDocument || document).getElementById(lbl.htmlFor);
          if (linked instanceof HTMLInputElement && (linked.type === "checkbox" || linked.type === "radio")) {
            checkTarget = linked;
          }
        }
      }
      if (checkTarget instanceof HTMLInputElement) {
        setTimeout(() => {
          const lastTs = _sfLastCheckChangeAt.get(checkTarget) || 0;
          if (Date.now() - lastTs < 120) return;
          if (_isRecording) flashElement(checkTarget);
          _send({ type: "check", selector: _sel(checkTarget), checked: checkTarget.type === "radio" ? true : checkTarget.checked });
        }, 30);
        return;
      }
      const tTag = t.tagName.toLowerCase();
      if (tTag === "img" || (tTag === "input" && t.type === "image" && !t.id)) {
        const anchor = t.closest("a[href]");
        if (anchor) t = anchor;
      }
      if (_isRecording) flashElement(t);
      _send({ type: "click", selector: _sel(t) });
    }, true);
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement) && !(t instanceof HTMLSelectElement)) return;
      if (t.readOnly || t.disabled) return;
      if (_isRecording) flashElement(t);
      if (t instanceof HTMLInputElement && t.type === "checkbox") {
        _sfLastCheckChangeAt.set(t, Date.now());
        _send({ type: "check", selector: _sel(t), checked: t.checked });
        return;
      }
      if (t instanceof HTMLInputElement && t.type === "radio") {
        _sfLastCheckChangeAt.set(t, Date.now());
        _send({ type: "check", selector: _sel(t), checked: true });
        return;
      }
      if (t instanceof HTMLSelectElement) {
        _send({ type: "choose_option", selector: _sel(t), value: t.value });
        return;
      }
      if (_isSensitiveInputTarget(t, _sel(t))) return;
      _send({ type: "input", selector: _sel(t), value: t.value });
    }, true);
    document.addEventListener("keydown", (e) => {
      if (["Enter", "Tab", "Escape"].includes(e.key)) {
        if (_isRecording && e.target instanceof Element) flashElement(e.target);
        _send({ type: "key", key: e.key });
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        if (_isTextEntryCaptureTarget(e.target)) return;
        _send({ type: "text", selector: e.target instanceof Element ? _sel(e.target) : "", value: e.key });
      }
    }, true);
    // Sub-frame copy: capture extract step + track last copied for paste substitution
    let _lastCopiedText = null;
    let _lastCopiedVar = null;
    let _varCounter = 0;
    const INLINE_SF = /^(A|ABBR|B|BDI|BDO|BIG|BR|CITE|CODE|DFN|EM|I|KBD|MARK|Q|S|SAMP|SMALL|SPAN|STRONG|SUB|SUP|TIME|TT|U|VAR)$/;
    const BLOCK_SF  = /^(TD|TH|LI|P|DIV|BLOCKQUOTE|PRE|H[1-6]|DT|DD|ARTICLE|SECTION|ASIDE|HEADER|FOOTER|MAIN|NAV|FIGURE|FIGCAPTION|SUMMARY|DETAILS)$/;
    const BAD_SF    = /^(TABLE|TBODY|THEAD|TFOOT|TR|COLGROUP|COL|UL|OL|DL|FORM|FIELDSET|BODY|HTML)$/;
    function _resolveExtraction(node) {
      let el = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      while (el && el.tagName) {
        const t = el.tagName.toUpperCase();
        if (BAD_SF.test(t)) return null;
        if (BLOCK_SF.test(t) || !INLINE_SF.test(t)) return el;
        el = el.parentElement;
      }
      return null;
    }
    document.addEventListener("copy", (e) => {
      if (!_isRecording) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const txt = sel.toString().trim();
      if (!txt) return;
      const srcEl = _resolveExtraction(sel.anchorNode);
      if (!srcEl) return;
      _varCounter += 1;
      _lastCopiedText = txt;
      _lastCopiedVar = `VAR${_varCounter}`;
      flashElement(srcEl);
      _send({ type: "extract", selector: _sel(srcEl), variable: _lastCopiedVar });
    }, true);
    // Override change listener above to substitute paste value
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement) && !(t instanceof HTMLSelectElement)) return;
      if (t.readOnly || t.disabled) return;
      if (_isSensitiveInputTarget(t, _sel(t))) return;
      if (_isRecording && _lastCopiedText !== null && _lastCopiedVar !== null && t.value.trim() === _lastCopiedText) {
        _send({ type: "input", selector: _sel(t), value: `{{!${_lastCopiedVar}}}` });
      }
    }, true);
    // contenteditable input (debounced — avoids capturing every keystroke)
    let _sfCeTimer = null;
    document.addEventListener("input", (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.isContentEditable) return;
      if (!_isRecording) return;
      clearTimeout(_sfCeTimer);
      _sfCeTimer = setTimeout(() => {
        const val = (t.innerText || t.textContent || "").trim();
        if (_isSensitiveInputTarget(t, _sel(t))) return;
        flashElement(t);
        _send({ type: "input", selector: _sel(t), value: val });
      }, 400);
    }, true);
    // dblclick
    document.addEventListener("dblclick", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (!_isRecording) return;
      flashElement(t);
      _send({ type: "dblclick", selector: _sel(t) });
    }, true);
    // hover: solo graba si el hover despliega contenido nuevo (dropdown/menu/tooltip)
    let _sfHoverEl = null;
    let _sfHoverTimer = null;
    let _sfHoverObs = null;
    let _sfHoverSeen = false;
    document.addEventListener("mouseover", (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !_isRecording || t === _sfHoverEl) return;
      clearTimeout(_sfHoverTimer);
      if (_sfHoverObs) { _sfHoverObs.disconnect(); _sfHoverObs = null; }
      _sfHoverSeen = false;
      _sfHoverEl = t;
      try {
        const _root = document.body || document.documentElement;
        _sfHoverObs = new MutationObserver((muts) => {
          if (_sfHoverSeen) return;
          for (const m of muts) {
            if (m.type === "childList") {
              for (const n of m.addedNodes) {
                if (n instanceof Element && n.offsetWidth > 0 && n.offsetHeight > 0) { _sfHoverSeen = true; return; }
              }
            } else if (m.attributeName === "aria-expanded" && m.target.getAttribute("aria-expanded") === "true") {
              _sfHoverSeen = true; return;
            }
          }
        });
        _sfHoverObs.observe(_root, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
      } catch (_) {}
      _sfHoverTimer = setTimeout(() => {
        if (_sfHoverObs) { _sfHoverObs.disconnect(); _sfHoverObs = null; }
        if (_sfHoverEl !== t || !_sfHoverSeen) return;
        flashElement(t);
        _send({ type: "hover", selector: _sel(t) });
      }, 800);
    }, true);
    // scroll_to: solo graba si el scroll ocurre en un contenedor emergente (dropdown/listbox/menu)
    function _sfIsMenuScroll(el) {
      if (!(el instanceof Element)) return false;
      if (el.tagName.toLowerCase() === "select") return true;
      const role = (el.getAttribute("role") || "").toLowerCase();
      if (["listbox","menu","menubar","tree","combobox","grid","treegrid"].includes(role)) return true;
      if (el.closest("[role='listbox'],[role='menu'],[role='combobox'],[role='tree']")) return true;
      try {
        const cs = window.getComputedStyle(el);
        const pos = cs.position; const ov = cs.overflowY;
        if ((pos === "absolute" || pos === "fixed") && (ov === "auto" || ov === "scroll")) return true;
      } catch (_) {}
      return false;
    }
    let _sfScrollTimer = null;
    document.addEventListener("scroll", (e) => {
      if (!_isRecording) return;
      const scrollEl = e.target instanceof Element ? e.target : null;
      if (!scrollEl || !_sfIsMenuScroll(scrollEl)) return;
      clearTimeout(_sfScrollTimer);
      _sfScrollTimer = setTimeout(() => {
        _send({ type: "scroll_to", selector: _sel(scrollEl) });
      }, 900);
    }, true);
    return; // skip full bootstrap in sub-frames
  }
  // ── Top-frame bootstrap ──────────────────────────────────────────────────

  if (globalScope.__webmaticRuntime && typeof globalScope.__webmaticRuntime.destroy === "function") {
    globalScope.__webmaticRuntime.destroy();
  }

  const contracts = globalScope.WebMaticContracts;
  const storeFactory = globalScope.WebMaticStore;
  const uiShell = globalScope.WebMaticUiShell;
  const geometry = globalScope.WebMaticGeometry;
  const settingsApi = globalScope.WebMaticSettings;
  const fullBackupApi = globalScope.WebMaticFullBackup;
  const macroJsonApi = globalScope.WebMaticMacroJson;
  const macrosGlobalApi = globalScope.WebMaticMacrosGlobal;

  if (!contracts || !storeFactory || !uiShell || !geometry || !settingsApi) {
    console.error("[WebMatic] Modulos base incompletos.");
    return;
  }

  function getLocalStorageValues(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result || {});
      });
    });
  }

  function setLocalStorageValues(patch) {
    return new Promise((resolve) => {
      chrome.storage.local.set(patch || {}, () => resolve());
    });
  }

  const PAGE_META_STORAGE_KEY = "webmaticPageMetadataProfiles";
  const MACROS_STORAGE_KEY = (macrosGlobalApi && typeof macrosGlobalApi.getMacrosStorageKey === "function")
    ? String(macrosGlobalApi.getMacrosStorageKey() || "webmaticMacros")
    : "webmaticMacros";
  const MACROS_SYNC_META_KEY = "webmaticMacrosSyncMeta";
  const MACROS_SYNC_CHUNK_PREFIX = "webmaticMacrosSyncChunk_";
  const MACROS_SYNC_CHUNK_SIZE = 7000;
  const SETTINGS_STORAGE_KEY = "webmaticSettings";
  const SETTINGS_SYNC_KEY = "webmaticSettingsSyncSnapshot";
  const SITE_SURVIVAL_KEY = "webmaticSurvivalSnapshotV1";
  const APP_CONTENT_STATS_KEY = "webmaticAppContentStats";
  const PAGE_META_MAX_DEFAULT = 60;
  const DEFAULT_APP_CONTENT_STATS = Object.freeze({
    fullBackupsCreated: 0,
    fullBackupsImported: 0,
    macroExports: 0,
    macroImports: 0,
    pageMetaExports: 0,
    pageMetaImports: 0
  });
  let pageMetadataProfiles = [];
  let pageMetaMaxProfiles = PAGE_META_MAX_DEFAULT;
  let appContentStats = { ...DEFAULT_APP_CONTENT_STATS };
  let lastMacrosPersistHash = "";
  let lastSettingsPersistHash = "";
  let macrosPersistenceReady = false;
  let settingsPersistenceReady = false;
  let macroSurvivalBackupTimer = null;

  function _readSiteSurvivalSnapshot() {
    try {
      if (!globalScope || !globalScope.localStorage) return null;
      const raw = globalScope.localStorage.getItem(SITE_SURVIVAL_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(String(raw));
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_e) {
      return null;
    }
  }

  function _writeSiteSurvivalSnapshot(patch) {
    try {
      if (!globalScope || !globalScope.localStorage) return false;
      const prev = _readSiteSurvivalSnapshot() || {};
      const next = {
        version: 1,
        updatedAt: Date.now(),
        origin: String((location && location.origin) || ""),
        ...prev,
        ...(patch && typeof patch === "object" ? patch : {})
      };
      globalScope.localStorage.setItem(SITE_SURVIVAL_KEY, JSON.stringify(next));
      return true;
    } catch (_e) {
      return false;
    }
  }

  function _loadSiteSurvivalMacros() {
    const snap = _readSiteSurvivalSnapshot();
    const list = snap && Array.isArray(snap.macros) ? snap.macros : [];
    return Array.isArray(list) ? list : [];
  }

  function _loadSiteSurvivalSettings() {
    const snap = _readSiteSurvivalSnapshot();
    const cfg = snap && snap.settings && typeof snap.settings === "object" ? snap.settings : null;
    return cfg && !Array.isArray(cfg) ? cfg : null;
  }
  const ORIGIN_SURVIVAL_KEY = "webmaticSurvivalBackupV1";

  function _canUseOriginStorage() {
    try {
      const u = new URL(String(location && location.href ? location.href : ""));
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (_e) {
      return false;
    }
  }

  function _readOriginSurvivalSnapshot() {
    try {
      if (!_canUseOriginStorage()) return null;
      const raw = localStorage.getItem(ORIGIN_SURVIVAL_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(String(raw));
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_e) {
      return null;
    }
  }

  function _writeOriginSurvivalSnapshot(snapshot) {
    try {
      if (!_canUseOriginStorage()) return false;
      localStorage.setItem(ORIGIN_SURVIVAL_KEY, JSON.stringify(snapshot || {}));
      return true;
    } catch (_e) {
      return false;
    }
  }

  function _queueOriginSurvivalSnapshot(macros, settings) {
    const list = Array.isArray(macros) ? macros : [];
    const cfg = settings && typeof settings === "object" ? settings : {};
    try {
      _writeOriginSurvivalSnapshot({
        version: 1,
        app: "WebMatic",
        savedAt: Date.now(),
        host: String(location && location.host ? location.host : ""),
        macros: list,
        settings: cfg
      });
    } catch (_e) { /* ignore */ }
  }

  function getSyncStorageValues(keys) {
    return new Promise((resolve) => {
      try {
        if (!chrome.storage || !chrome.storage.sync) {
          resolve({});
          return;
        }
        chrome.storage.sync.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            resolve({});
            return;
          }
          resolve(result || {});
        });
      } catch (_e) {
        resolve({});
      }
    });
  }

  function setSyncStorageValues(patch) {
    return new Promise((resolve) => {
      try {
        if (!chrome.storage || !chrome.storage.sync) {
          resolve(false);
          return;
        }
        chrome.storage.sync.set(patch || {}, () => {
          resolve(!chrome.runtime.lastError);
        });
      } catch (_e) {
        resolve(false);
      }
    });
  }

  function removeSyncStorageKeys(keys) {
    return new Promise((resolve) => {
      try {
        if (!chrome.storage || !chrome.storage.sync) {
          resolve(false);
          return;
        }
        const list = Array.isArray(keys) ? keys : [keys];
        chrome.storage.sync.remove(list, () => {
          resolve(!chrome.runtime.lastError);
        });
      } catch (_e) {
        resolve(false);
      }
    });
  }

  async function _saveMacrosSyncSnapshot(macros) {
    try {
      const list = Array.isArray(macros) ? macros : [];
      const json = JSON.stringify(list);
      const chunks = [];
      for (let i = 0; i < json.length; i += MACROS_SYNC_CHUNK_SIZE) {
        chunks.push(json.slice(i, i + MACROS_SYNC_CHUNK_SIZE));
      }
      const currentMeta = await getSyncStorageValues([MACROS_SYNC_META_KEY]);
      const oldCount = Number(currentMeta && currentMeta[MACROS_SYNC_META_KEY] && currentMeta[MACROS_SYNC_META_KEY].chunkCount) || 0;
      const patch = {};
      for (let i = 0; i < chunks.length; i += 1) {
        patch[`${MACROS_SYNC_CHUNK_PREFIX}${i}`] = chunks[i];
      }
      patch[MACROS_SYNC_META_KEY] = {
        version: 1,
        chunkCount: chunks.length,
        savedAt: Date.now(),
        itemCount: list.length
      };
      const ok = await setSyncStorageValues(patch);
      if (!ok) return false;
      if (oldCount > chunks.length) {
        const stale = [];
        for (let i = chunks.length; i < oldCount; i += 1) stale.push(`${MACROS_SYNC_CHUNK_PREFIX}${i}`);
        if (stale.length > 0) await removeSyncStorageKeys(stale);
      }
      return true;
    } catch (_e) {
      return false;
    }
  }

  async function _loadMacrosSyncSnapshot() {
    try {
      const metaData = await getSyncStorageValues([MACROS_SYNC_META_KEY]);
      const meta = metaData && metaData[MACROS_SYNC_META_KEY];
      const count = Math.max(0, Number(meta && meta.chunkCount) || 0);
      if (!count) return [];
      const keys = [];
      for (let i = 0; i < count; i += 1) keys.push(`${MACROS_SYNC_CHUNK_PREFIX}${i}`);
      const data = await getSyncStorageValues(keys);
      let json = "";
      for (let i = 0; i < count; i += 1) json += String(data[`${MACROS_SYNC_CHUNK_PREFIX}${i}`] || "");
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_e) {
      return [];
    }
  }

  async function _saveSettingsSyncSnapshot(settings) {
    try {
      const payload = settings && typeof settings === "object" ? settings : {};
      return await setSyncStorageValues({ [SETTINGS_SYNC_KEY]: payload });
    } catch (_e) {
      return false;
    }
  }

  async function _loadSettingsSyncSnapshot() {
    try {
      const data = await getSyncStorageValues([SETTINGS_SYNC_KEY]);
      const obj = data && data[SETTINGS_SYNC_KEY];
      return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
    } catch (_e) {
      return null;
    }
  }

  function _queueMacroSurvivalBackup(macros) {
    if (macroSurvivalBackupTimer) {
      clearTimeout(macroSurvivalBackupTimer);
      macroSurvivalBackupTimer = null;
    }
    const list = Array.isArray(macros) ? macros : [];
    if (list.length === 0) return;
    macroSurvivalBackupTimer = setTimeout(() => {
      macroSurvivalBackupTimer = null;
      const payload = {
        version: 1,
        app: "WebMatic",
        kind: "macros-survival",
        exportedAt: new Date().toISOString(),
        macros: list
      };
      chrome.runtime.sendMessage({
        type: "EXPORT_FILE",
        filename: "backup/webmatic-macros-survival-v1.json",
        content: JSON.stringify(payload, null, 2),
        saveAs: false
      }, () => {
        void chrome.runtime.lastError;
      });
    }, 2200);
  }

  async function _restoreMacrosFromInternalSnapshot(mode) {
    let source = "sync";
    let recovered = await _loadMacrosSyncSnapshot();
    if (!Array.isArray(recovered) || recovered.length === 0) {
      recovered = _loadSiteSurvivalMacros();
      source = "site";
    }
    if (!Array.isArray(recovered) || recovered.length === 0) {
      return { ok: false, restored: 0, total: 0, reason: "empty-sync", source: "none" };
    }
    const currentState = store.getState();
    const current = Array.isArray(currentState && currentState.library && currentState.library.macros)
      ? currentState.library.macros
      : [];
    const useMerge = String(mode || "").toLowerCase() === "merge";
    let next = recovered;
    if (useMerge) {
      const byId = new Map();
      current.forEach((m) => { if (m && m.id) byId.set(String(m.id), m); });
      recovered.forEach((m) => {
        const key = String(m && m.id ? m.id : `macro_${Date.now()}_${Math.floor(Math.random() * 10000)}`);
        byId.set(key, m);
      });
      next = Array.from(byId.values());
    }
    store.dispatch({ type: contracts.ActionTypes.LIBRARY_LOADED, payload: next });
    await setLocalStorageValues({ [MACROS_STORAGE_KEY]: next });
    void _saveMacrosSyncSnapshot(next);
    _writeSiteSurvivalSnapshot({ macros: next, macrosSavedAt: Date.now() });
    lastMacrosPersistHash = _simpleStableHash(JSON.stringify(next));
    return { ok: true, restored: recovered.length, total: next.length, reason: useMerge ? "merged" : "replaced", source };
  }

  function _normalizeAppContentStats(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      fullBackupsCreated: Math.max(0, Number(source.fullBackupsCreated) || 0),
      fullBackupsImported: Math.max(0, Number(source.fullBackupsImported) || 0),
      macroExports: Math.max(0, Number(source.macroExports) || 0),
      macroImports: Math.max(0, Number(source.macroImports) || 0),
      pageMetaExports: Math.max(0, Number(source.pageMetaExports) || 0),
      pageMetaImports: Math.max(0, Number(source.pageMetaImports) || 0)
    };
  }

  async function _loadAppContentStats() {
    const data = await getLocalStorageValues([APP_CONTENT_STATS_KEY]);
    appContentStats = _normalizeAppContentStats(data[APP_CONTENT_STATS_KEY]);
    return appContentStats;
  }

  async function _saveAppContentStats(patch) {
    const next = _normalizeAppContentStats({ ...appContentStats, ...(patch && typeof patch === "object" ? patch : {}) });
    appContentStats = next;
    await setLocalStorageValues({ [APP_CONTENT_STATS_KEY]: next });
    return next;
  }

  async function _incrementAppContentStats(patch) {
    const delta = patch && typeof patch === "object" ? patch : {};
    const next = { ...appContentStats };
    Object.keys(DEFAULT_APP_CONTENT_STATS).forEach((key) => {
      next[key] = Math.max(0, Number(next[key]) || 0) + Math.max(0, Number(delta[key]) || 0);
    });
    return _saveAppContentStats(next);
  }

  function _refreshPlaySummary() {
    const panel = document.getElementById("webmatic-panel-root");
    if (!panel) return;
    const summary = panel.querySelector("[data-play-summary-text]");
    if (!summary) return;
    const state = typeof store.getState === "function" ? store.getState() : null;
    const macroCount = Array.isArray(state && state.library && state.library.macros) ? state.library.macros.length : 0;
    const metaCount = Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles.length : 0;
    const fullBackups = Number(appContentStats.fullBackupsCreated) || 0;
    const fullBackupsImported = Number(appContentStats.fullBackupsImported) || 0;
    const macroImports = Number(appContentStats.macroImports) || 0;
    const macroExports = Number(appContentStats.macroExports) || 0;
    const pageMetaImports = Number(appContentStats.pageMetaImports) || 0;
    const pageMetaExports = Number(appContentStats.pageMetaExports) || 0;
    const status = String((state && state.runtime && state.runtime.statusMessage) || "Listo");
    summary.style.whiteSpace = "pre-wrap";
    summary.textContent = [
      `Macros: ${macroCount}`,
      `Metadatos: ${metaCount}`,
      `Backups creados: ${fullBackups}`,
      `Backups importados: ${fullBackupsImported}`,
      `Macros exportadas: ${macroExports}`,
      `Macros importadas: ${macroImports}`,
      `Metadatos exportados: ${pageMetaExports}`,
      `Metadatos importados: ${pageMetaImports}`,
      `Estado: ${status}`
    ].join("\n");
  }

  function _safeUrlParts(rawUrl) {
    try {
      const u = new URL(String(rawUrl || location.href));
      return { url: u.href, origin: u.origin, host: u.host, path: u.pathname || "/" };
    } catch (e) {
      return {
        url: String(rawUrl || (location && location.href) || ""),
        origin: String((location && location.origin) || ""),
        host: String((location && location.host) || ""),
        path: String((location && location.pathname) || "/")
      };
    }
  }

  function _normalizePageMetaMaxProfiles(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return PAGE_META_MAX_DEFAULT;
    return Math.max(10, Math.min(300, Math.round(n)));
  }

  function _simpleStableHash(input) {
    const str = String(input || "");
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function _buildProfileFingerprint(page, selectors) {
    const p = _safeUrlParts(page && page.url ? page.url : "");
    const normalizedSelectors = (Array.isArray(selectors) ? selectors : [])
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .sort();
    return _simpleStableHash(`${p.host}|${p.path}|${normalizedSelectors.join("||")}`);
  }

  function _dedupeOptions(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    list.forEach((o, idx) => {
      const value = String(o && o.value != null ? o.value : "");
      const text = String(o && o.text != null ? o.text : "");
      const key = `${value}||${text}`;
      if (!value && !text) return;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ index: out.length, value, text, selected: !!(o && o.selected), disabled: !!(o && o.disabled) });
    });
    return out;
  }

  function _mergeCatalogMaps(...maps) {
    const out = {};
    maps.forEach((bag) => {
      if (!bag || typeof bag !== "object") return;
      Object.keys(bag).forEach((sel) => {
        const arr = _dedupeOptions(bag[sel]);
        if (!Array.isArray(arr) || arr.length === 0) return;
        out[sel] = _dedupeOptions([...(out[sel] || []), ...arr]);
      });
    });
    return out;
  }

  function _selectorAllowSet(selectors) {
    const list = Array.isArray(selectors) ? selectors : [];
    if (list.length === 0) return null;
    const set = new Set();
    list.forEach((sel) => {
      const v = String(sel || "").trim();
      if (v) set.add(v);
    });
    return set.size > 0 ? set : null;
  }

  function _filterCatalogMapBySelectors(map, selectors) {
    const allowed = _selectorAllowSet(selectors);
    if (!allowed) return map || {};
    const out = {};
    Object.keys(map || {}).forEach((sel) => {
      if (!allowed.has(sel)) return;
      const options = _dedupeOptions(map[sel]);
      if (options.length > 0) out[sel] = options;
    });
    return out;
  }

  function _catalogsFromInventories(inventories, selectors) {
    const allowed = _selectorAllowSet(selectors);
    const out = {};
    (Array.isArray(inventories) ? inventories : []).forEach((inv) => {
      const ctrls = Array.isArray(inv && inv.controls) ? inv.controls : [];
      ctrls.forEach((ctrl) => {
        const sel = String((ctrl && ctrl.selector) || "").trim();
        const options = _dedupeOptions(ctrl && ctrl.options);
        if (!sel || options.length === 0) return;
        if (allowed && !allowed.has(sel)) return;
        out[sel] = _dedupeOptions([...(out[sel] || []), ...options]);
      });
    });
    return out;
  }

  function _normalizePageMetaProfile(raw) {
    if (!raw || typeof raw !== "object") return null;
    const page = _safeUrlParts(raw.page && raw.page.url ? raw.page.url : raw.url || "");
    const inventories = Array.isArray(raw.inventories)
      ? raw.inventories
      : (raw.inventory ? [raw.inventory] : []);
    const defaults = (raw.defaults && typeof raw.defaults === "object" && !Array.isArray(raw.defaults))
      ? raw.defaults
      : {};
    const selectedSelectors = Array.isArray(raw.selectedSelectors) && raw.selectedSelectors.length > 0
      ? raw.selectedSelectors
      : (Object.keys(defaults).length > 0 ? Object.keys(defaults) : null);
    const mergedCatalogs = _mergeCatalogMaps(
      _filterCatalogMapBySelectors(raw.autocompleteCatalogs, selectedSelectors),
      _catalogsFromInventories(inventories, selectedSelectors)
    );
    const domElements = Array.isArray(raw.domElements) ? raw.domElements : [];
    const selectors = Object.keys(mergedCatalogs || {});
    const fingerprint = String(raw.fingerprint || _buildProfileFingerprint(page, selectors));
    // defaults: mapa selector→valor capturado al momento de la captura
    return {
      id: String(raw.id || `pm_${Date.now()}_${Math.floor(Math.random() * 10000)}`),
      capturedAt: Number(raw.capturedAt) || Date.now(),
      page: {
        url: page.url,
        origin: page.origin,
        host: page.host,
        path: page.path,
        title: String((raw.page && raw.page.title) || raw.title || document.title || "")
      },
      inventories: inventories,
      domElements,
      selectedSelectors: selectedSelectors ? selectedSelectors.slice() : [],
      autocompleteCatalogs: mergedCatalogs,
      defaults,
      fingerprint,
      stats: {
        controls: inventories.reduce((acc, inv) => acc + (Array.isArray(inv && inv.controls) ? inv.controls.length : 0), 0),
        selectorsWithOptions: Object.keys(mergedCatalogs).length,
        domElements: domElements.length
      }
    };
  }

  function _safeBuildElementSelector(el) {
    if (!el || !el.tagName) return "";
    const rec = globalScope.WebMaticRecorder;
    if (rec && typeof rec.buildSelector === "function") {
      try {
        const s = rec.buildSelector(el);
        if (s) return String(s);
      } catch (e) { /* ignore */ }
    }
    if (el.id) return `#${el.id}`;
    const tag = String(el.tagName || "").toLowerCase();
    const name = el.getAttribute && el.getAttribute("name");
    if (name) return `${tag}[name="${name}"]`;
    return tag;
  }

  function _captureDomElementsSnapshot(doc, maxElements) {
    const root = doc || document;
    if (!root || typeof root.querySelectorAll !== "function") return { items: [], total: 0, truncated: false };
    const all = Array.from(root.querySelectorAll("*"));
    const total = all.length;
    const limit = Math.max(1000, Number(maxElements) || 8000);
    const slice = all.slice(0, limit);
    const items = slice.map((el, idx) => {
      const text = String(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 140);
      const attrs = [];
      if (el.attributes) {
        for (let i = 0; i < el.attributes.length; i += 1) {
          const a = el.attributes[i];
          if (!a || !a.name) continue;
          const n = String(a.name);
          if (n === "style") continue;
          if (n.startsWith("on")) continue;
          if (n.startsWith("data-") || ["id", "name", "type", "role", "aria-label", "aria-haspopup", "aria-autocomplete", "placeholder", "list", "value", "title", "href"].includes(n)) {
            attrs.push({ name: n, value: String(a.value || "").slice(0, 180) });
          }
          if (attrs.length >= 14) break;
        }
      }
      return {
        index: idx,
        selector: _safeBuildElementSelector(el),
        tag: String(el.tagName || "").toLowerCase(),
        id: el.id || "",
        name: (el.getAttribute && el.getAttribute("name")) || "",
        role: (el.getAttribute && el.getAttribute("role")) || "",
        type: (el.getAttribute && el.getAttribute("type")) || "",
        visible: (function () {
          try {
            if (typeof el.getClientRects === "function") {
              const r = el.getClientRects();
              return !!(r && r.length > 0);
            }
          } catch (e) { /* ignore */ }
          return true;
        })(),
        text,
        attributes: attrs
      };
    });
    return { items, total, truncated: total > slice.length };
  }

  async function _loadPageMetadataProfiles() {
    const data = await getLocalStorageValues([PAGE_META_STORAGE_KEY]);
    const list = Array.isArray(data[PAGE_META_STORAGE_KEY]) ? data[PAGE_META_STORAGE_KEY] : [];
    pageMetadataProfiles = list
      .map(_normalizePageMetaProfile)
      .filter(Boolean)
      .sort((a, b) => (b.capturedAt || 0) - (a.capturedAt || 0));
    _refreshPlaySummary();
  }

  async function _savePageMetadataProfiles(list) {
    const normalized = (Array.isArray(list) ? list : [])
      .map(_normalizePageMetaProfile)
      .filter(Boolean)
      .sort((a, b) => (b.capturedAt || 0) - (a.capturedAt || 0))
      .slice(0, _normalizePageMetaMaxProfiles(pageMetaMaxProfiles));
    pageMetadataProfiles = normalized;
    await setLocalStorageValues({ [PAGE_META_STORAGE_KEY]: normalized });
    _refreshPlaySummary();
    return normalized;
  }

  function _scorePageProfileForTarget(profile, target) {
    const page = _safeUrlParts(profile && profile.page ? profile.page.url : "");
    if (page.url && target.url && page.url === target.url) return 120;
    if (page.origin === target.origin && page.path === target.path) return 100;
    if (page.host === target.host && page.path === target.path) return 90;
    if (page.origin === target.origin && (target.path.startsWith(page.path) || page.path.startsWith(target.path))) return 70;
    if (page.host === target.host) return 40;
    return 0;
  }

  function _collectProfileSelectors(profile) {
    const out = new Set();
    const bag = profile && profile.autocompleteCatalogs && typeof profile.autocompleteCatalogs === "object"
      ? profile.autocompleteCatalogs
      : {};
    Object.keys(bag).forEach((k) => {
      const key = String(k || "").trim();
      if (key) out.add(key);
    });
    const inventories = Array.isArray(profile && profile.inventories) ? profile.inventories : [];
    inventories.forEach((inv) => {
      const ctrls = Array.isArray(inv && inv.controls) ? inv.controls : [];
      ctrls.forEach((ctrl) => {
        const sel = String(ctrl && ctrl.selector ? ctrl.selector : "").trim();
        if (sel) out.add(sel);
      });
    });
    return out;
  }

  function _buildSelectionFingerprint(targetUrl, selectedSelectors) {
    const target = _safeUrlParts(targetUrl || (location && location.href ? location.href : ""));
    const selectors = (Array.isArray(selectedSelectors) ? selectedSelectors : [])
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .sort();
    return _buildProfileFingerprint({ url: target.url }, selectors);
  }

  function _findLikelyDuplicatePageProfile(targetUrl, selectedSelectors) {
    const target = _safeUrlParts(targetUrl || (location && location.href ? location.href : ""));
    const selectors = (Array.isArray(selectedSelectors) ? selectedSelectors : [])
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    const profiles = Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles : [];
    if (profiles.length === 0) return null;
    const targetFingerprint = _buildSelectionFingerprint(target.url, selectors);

    const scored = profiles
      .map((p) => {
        const score = _scorePageProfileForTarget(p, target);
        if (score <= 0) return null;
        const availableSelectors = _collectProfileSelectors(p);
        const matched = selectors.length === 0
          ? 0
          : selectors.reduce((acc, sel) => (availableSelectors.has(sel) ? acc + 1 : acc), 0);
        const coverage = selectors.length === 0 ? 0 : (matched / selectors.length);
        const profileFingerprint = String(p && p.fingerprint ? p.fingerprint : "");
        const exactFingerprint = !!(targetFingerprint && profileFingerprint && targetFingerprint === profileFingerprint);
        return { profile: p, score, coverage, matched, requested: selectors.length, exactFingerprint };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.exactFingerprint) - Number(a.exactFingerprint) || (b.score - a.score) || (b.coverage - a.coverage) || ((b.profile.capturedAt || 0) - (a.profile.capturedAt || 0)));

    if (scored.length === 0) return null;
    const top = scored[0];
    if (top.exactFingerprint) return top;
    if (top.score < 100) return null;
    if (top.requested > 0 && top.coverage < 0.7) return null;
    return top;
  }

  /**
   * Restaura silenciosamente los campos de la página actual a sus valores por
   * defecto usando el perfil más reciente que coincida con la URL actual.
   * Opera 100% en background (_fast): no emite pasos visibles al usuario.
   */
  function _restoreProfileDefaultsForCurrentPage() {
    try {
      const target = _safeUrlParts(location && location.href ? location.href : "");
      const profiles = Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles : [];
      if (profiles.length === 0) return;
      const best = profiles
        .map((p) => ({ p, score: _scorePageProfileForTarget(p, target) }))
        .filter((x) => x.score >= 90)
        .sort((a, b) => (b.score - a.score) || ((b.p.capturedAt || 0) - (a.p.capturedAt || 0)))[0];
      if (!best || !best.p) return;
      const defaults = best.p.defaults;
      if (!defaults || typeof defaults !== "object") return;
      Object.keys(defaults).forEach((sel) => {
        try {
          const el = document.querySelector(sel);
          if (!el) return;
          const tag = String(el.tagName || "").toLowerCase();
          const inputType = String((el.getAttribute && el.getAttribute("type")) || "").toLowerCase();
          const val = defaults[sel];
          if (tag === "input" && (inputType === "checkbox" || inputType === "radio")) {
            const shouldCheck = val === "checked";
            if (el.checked !== shouldCheck) {
              el.checked = shouldCheck;
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          } else if (tag === "select") {
            if (el.value !== String(val)) {
              el.value = String(val);
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          } else {
            if (el.value !== String(val)) {
              el.value = String(val);
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        } catch (_e) { /* campo no accesible, saltar */ }
      });
    } catch (_e) { /* nunca interrumpir la reproducción */ }
  }

  function _listCurrentPageProfiles(limit) {
    const target = _safeUrlParts(location && location.href ? location.href : "");
    const max = Math.max(1, Math.min(30, Number(limit) || 12));
    const profiles = Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles : [];
    return profiles
      .map((p) => ({ profile: p, score: _scorePageProfileForTarget(p, target) }))
      .filter((x) => x.score >= 90)
      .sort((a, b) => (b.score - a.score) || ((b.profile.capturedAt || 0) - (a.profile.capturedAt || 0)))
      .slice(0, max)
      .map((x) => x.profile);
  }

  function _resolveReusableMetadataForUrl(targetUrl) {
    const target = _safeUrlParts(targetUrl || (location && location.href ? location.href : ""));
    const profiles = Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles : [];
    if (profiles.length === 0) return { inventories: [], autocompleteCatalogs: {} };

    const scored = profiles
      .map((p) => {
        const score = _scorePageProfileForTarget(p, target);
        return { profile: p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => (b.score - a.score) || ((b.profile.capturedAt || 0) - (a.profile.capturedAt || 0)));

    if (scored.length === 0) return { inventories: [], autocompleteCatalogs: {} };

    const best = scored[0].score;
    const selected = scored.filter((x) => x.score >= Math.max(best - 10, 40)).slice(0, 6).map((x) => x.profile);

    const mergedInventories = [];
    const mergedCatalogs = {};
    selected.forEach((p) => {
      const inventories = Array.isArray(p && p.inventories) ? p.inventories : [];
      inventories.forEach((inv) => mergedInventories.push(inv));
      Object.assign(mergedCatalogs, _mergeCatalogMaps(mergedCatalogs, p && p.autocompleteCatalogs));
    });
    return { inventories: mergedInventories, autocompleteCatalogs: mergedCatalogs };
  }

  function _resolveReusableMetadataForCurrentPage() {
    return _resolveReusableMetadataForUrl(location && location.href ? location.href : "");
  }

  function _reuseHistoricalCatalogsForSelectors(targetUrl, selectedSelectors, currentCatalogs) {
    const out = _mergeCatalogMaps(currentCatalogs || {});
    const selectors = (Array.isArray(selectedSelectors) ? selectedSelectors : [])
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    if (selectors.length === 0) return out;

    const target = _safeUrlParts(targetUrl || (location && location.href ? location.href : ""));
    const ranked = (Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles : [])
      .map((p) => ({ p, score: _scorePageProfileForTarget(p, target) }))
      .filter((x) => x && x.p && x.score >= 90)
      .sort((a, b) => (b.score - a.score) || ((b.p.capturedAt || 0) - (a.p.capturedAt || 0)))
      .map((x) => x.p);

    selectors.forEach((sel) => {
      const already = _dedupeOptions(out[sel]);
      if (already.length > 0) return;
      for (let i = 0; i < ranked.length; i += 1) {
        const p = ranked[i];
        const bag = (p && p.autocompleteCatalogs && typeof p.autocompleteCatalogs === "object") ? p.autocompleteCatalogs : {};
        const hist = _dedupeOptions(bag[sel]);
        if (hist.length > 0) {
          out[sel] = hist;
          break;
        }
      }
    });

    return out;
  }

  function _bestHistoricalCatalogForSelector(targetUrl, selector, minScore) {
    const sel = String(selector || "").trim();
    if (!sel) return [];
    const target = _safeUrlParts(targetUrl || (location && location.href ? location.href : ""));
    const threshold = Math.max(0, Number(minScore) || 90);
    const ranked = (Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles : [])
      .map((p) => ({ p, score: _scorePageProfileForTarget(p, target) }))
      .filter((x) => x && x.p && x.score >= threshold)
      .sort((a, b) => (b.score - a.score) || ((b.p.capturedAt || 0) - (a.p.capturedAt || 0)))
      .map((x) => x.p);

    let best = [];
    for (let i = 0; i < ranked.length; i += 1) {
      const bag = (ranked[i] && ranked[i].autocompleteCatalogs && typeof ranked[i].autocompleteCatalogs === "object")
        ? ranked[i].autocompleteCatalogs
        : {};
      const arr = _dedupeOptions(bag[sel]);
      if (arr.length > best.length) best = arr;
    }
    return best;
  }

  function _extractNavigateTargets(steps) {
    if (!Array.isArray(steps) || steps.length === 0) return [];
    const out = [];
    const seen = new Set();
    steps.forEach((s) => {
      if (!s || s.type !== "navigate" || !s.url) return;
      const u = String(s.url).trim();
      if (!u || seen.has(u)) return;
      seen.add(u);
      out.push(u);
    });
    return out;
  }

  function _resolveReusableMetadataForSteps(steps) {
    const urls = [location && location.href ? String(location.href) : "", ..._extractNavigateTargets(steps)];
    const mergedInventories = [];
    const mergedCatalogs = {};
    urls.forEach((u) => {
      const hit = _resolveReusableMetadataForUrl(u);
      if (!hit) return;
      (hit.inventories || []).forEach((inv) => mergedInventories.push(inv));
      Object.assign(mergedCatalogs, _mergeCatalogMaps(mergedCatalogs, hit.autocompleteCatalogs));
    });
    return { inventories: mergedInventories, autocompleteCatalogs: mergedCatalogs };
  }

  function _resolveEditorMetadata(macroMeta, steps) {
    const reusable = _resolveReusableMetadataForSteps(steps);
    const macroInventories = Array.isArray(macroMeta && macroMeta.pageInventories) ? macroMeta.pageInventories : [];
    const macroCatalogs = (macroMeta && macroMeta.autocompleteCatalogs && typeof macroMeta.autocompleteCatalogs === "object")
      ? macroMeta.autocompleteCatalogs
      : {};

    return {
      inventories: [...macroInventories, ...(reusable.inventories || [])],
      autocompleteCatalogs: _mergeCatalogMaps(reusable.autocompleteCatalogs, macroCatalogs)
    };
  }

  function _resolveEditorMetaForSteps(macroMeta, steps) {
    const resolved = _resolveEditorMetadata(macroMeta || null, steps);
    const out = (macroMeta && typeof macroMeta === "object") ? JSON.parse(JSON.stringify(macroMeta)) : {};
    if (resolved.inventories.length > 0) {
      out.pageInventories = resolved.inventories;
    } else {
      delete out.pageInventories;
    }
    if (resolved.autocompleteCatalogs && Object.keys(resolved.autocompleteCatalogs).length > 0) {
      out.autocompleteCatalogs = resolved.autocompleteCatalogs;
    } else {
      delete out.autocompleteCatalogs;
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  function _macroPlaybackMeta(macro) {
    const meta = macro && typeof macro.meta === "object" ? macro.meta : null;
    return {
      preRunReset: meta && typeof meta.preRunReset === "object" ? meta.preRunReset : null,
      preRunResetPolicy: meta && typeof meta.preRunResetPolicy === "object" ? meta.preRunResetPolicy : null
    };
  }

  function _serializePageMetadataBackup(profiles) {
    return {
      version: 1,
      app: "WebMatic",
      kind: "page-metadata-backup",
      exportedAt: new Date().toISOString(),
      profiles: Array.isArray(profiles) ? profiles : []
    };
  }

  function _tableCell(raw) {
    return String(raw == null ? "" : raw)
      .replace(/\r?\n/g, " ")
      .replace(/\|/g, "\\|")
      .trim();
  }

  function _serializePageMetadataTablesText(profiles) {
    const list = Array.isArray(profiles) ? profiles : [];
    const lines = [];
    lines.push("WebMatic page metadata tables");
    lines.push(`ExportedAt: ${new Date().toISOString()}`);
    lines.push(`Profiles: ${list.length}`);
    lines.push("");

    list.forEach((p, idx) => {
      const page = _safeUrlParts(p && p.page ? p.page.url : "");
      const title = String((p && p.page && p.page.title) || "");
      const capturedAt = Number(p && p.capturedAt) ? new Date(Number(p.capturedAt)).toISOString() : "";
      const catalogs = (p && p.autocompleteCatalogs && typeof p.autocompleteCatalogs === "object") ? p.autocompleteCatalogs : {};
      const selectors = Object.keys(catalogs).sort((a, b) => a.localeCompare(b));

      lines.push(`## Profile ${idx + 1}`);
      lines.push(`- CapturedAt: ${capturedAt}`);
      lines.push(`- Url: ${page.url}`);
      lines.push(`- Path: ${page.path}`);
      lines.push(`- Title: ${title}`);
      lines.push(`- Fingerprint: ${String((p && p.fingerprint) || "")}`);
      lines.push(`- Selectors: ${selectors.length}`);
      lines.push("");

      lines.push("### Summary by field");
      lines.push("| Field | Options |") ;
      lines.push("|---|---:|");
      selectors.forEach((sel) => {
        const options = _dedupeOptions(catalogs[sel]);
        lines.push(`| ${_tableCell(sel)} | ${options.length} |`);
      });
      lines.push("");

      selectors.forEach((sel) => {
        const options = _dedupeOptions(catalogs[sel]);
        lines.push(`### ${_tableCell(sel)}`);
        lines.push("| # | Value | Text |") ;
        lines.push("|---:|---|---|");
        options.forEach((opt, i) => {
          lines.push(`| ${i + 1} | ${_tableCell(opt && opt.value)} | ${_tableCell(opt && opt.text)} |`);
        });
        if (options.length === 0) lines.push("| 1 |  |  |");
        lines.push("");
      });
      lines.push("---");
      lines.push("");
    });

    return lines.join("\n");
  }

  function _slugifyFilenamePart(raw) {
    const normalized = String(raw == null ? "" : raw)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const clean = normalized
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    return clean || "field";
  }

  function _buildPageMetadataFieldExports(profiles) {
    const list = Array.isArray(profiles) ? profiles : [];
    const bySelector = new Map();
    list.forEach((p) => {
      const page = _safeUrlParts(p && p.page ? p.page.url : "");
      const catalogs = (p && p.autocompleteCatalogs && typeof p.autocompleteCatalogs === "object") ? p.autocompleteCatalogs : {};
      Object.keys(catalogs).forEach((sel) => {
        const selector = String(sel || "").trim();
        if (!selector) return;
        if (!bySelector.has(selector)) {
          bySelector.set(selector, {
            selector,
            optionsMap: new Map(),
            profiles: new Set(),
            pages: new Set()
          });
        }
        const bucket = bySelector.get(selector);
        bucket.profiles.add(String((p && p.id) || `${Number(p && p.capturedAt) || 0}`));
        bucket.pages.add(page.path || page.url || "");
        _dedupeOptions(catalogs[selector]).forEach((opt) => {
          const value = String(opt && opt.value != null ? opt.value : "");
          const text = String(opt && opt.text != null ? opt.text : "");
          const key = `${value}||${text}`;
          if (!bucket.optionsMap.has(key)) bucket.optionsMap.set(key, { value, text });
        });
      });
    });

    const selectors = Array.from(bySelector.keys()).sort((a, b) => a.localeCompare(b));
    const summaryLines = [];
    summaryLines.push("WebMatic page metadata field exports");
    summaryLines.push(`ExportedAt: ${new Date().toISOString()}`);
    summaryLines.push(`Profiles: ${list.length}`);
    summaryLines.push(`Fields: ${selectors.length}`);
    summaryLines.push("");
    summaryLines.push("| Field | Unique options | Profiles | Pages | File |\n|---|---:|---:|---:|---|");

    const files = [];
    selectors.forEach((selector) => {
      const bucket = bySelector.get(selector);
      const options = Array.from(bucket.optionsMap.values())
        .sort((a, b) => String(a.text || a.value).localeCompare(String(b.text || b.value)));
      const slug = _slugifyFilenamePart(selector);
      const fileName = `metadata/fields/${slug}.txt`;

      const lines = [];
      lines.push("WebMatic field table");
      lines.push(`ExportedAt: ${new Date().toISOString()}`);
      lines.push(`Field: ${selector}`);
      lines.push(`UniqueOptions: ${options.length}`);
      lines.push(`Profiles: ${bucket.profiles.size}`);
      lines.push(`Pages: ${bucket.pages.size}`);
      lines.push("");
      lines.push("| # | Value | Text |\n|---:|---|---|");
      options.forEach((opt, idx) => {
        lines.push(`| ${idx + 1} | ${_tableCell(opt.value)} | ${_tableCell(opt.text)} |`);
      });
      if (options.length === 0) lines.push("| 1 |  |  |");

      files.push({ filename: fileName, content: lines.join("\n") });
      summaryLines.push(`| ${_tableCell(selector)} | ${options.length} | ${bucket.profiles.size} | ${bucket.pages.size} | ${fileName} |`);
    });

    files.unshift({
      filename: "metadata/webmatic-page-metadata-fields-summary-v1.txt",
      content: summaryLines.join("\n")
    });
    return files;
  }

  function _coerceCatalogOptionList(rawList) {
    const out = [];
    const seen = new Set();
    (Array.isArray(rawList) ? rawList : []).forEach((o) => {
      const value = String(o && o.value != null ? o.value : (o && o.code != null ? o.code : "")).trim();
      const text = String(o && o.text != null ? o.text : (o && o.label != null ? o.label : value)).trim();
      if (!value && !text) return;
      const key = `${value}||${text}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ value, text });
    });
    return out;
  }

  function _buildProfileFromExternalGeneXusCatalogs(catalogs, fallbackUrl, fallbackTitle) {
    const catalogMap = {};
    Object.keys(catalogs || {}).forEach((sel) => {
      const key = String(sel || "").trim();
      const options = _coerceCatalogOptionList(catalogs[sel]);
      if (!key || options.length === 0) return;
      catalogMap[key] = options;
    });
    const selectors = Object.keys(catalogMap);
    if (selectors.length === 0) return [];

    const controls = selectors.map((sel, idx) => ({
      index: idx,
      selector: sel,
      controlKind: "autocomplete-input",
      label: sel,
      options: _dedupeOptions(catalogMap[sel]),
      currentValue: ""
    }));

    const profile = _normalizePageMetaProfile({
      id: `pm_import_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      capturedAt: Date.now(),
      page: {
        url: String(fallbackUrl || location.href || ""),
        title: String(fallbackTitle || document.title || "")
      },
      inventories: [{
        capturedAt: Date.now(),
        url: String(fallbackUrl || location.href || ""),
        title: String(fallbackTitle || document.title || ""),
        controls
      }],
      autocompleteCatalogs: catalogMap,
      domElements: []
    });
    return profile ? [profile] : [];
  }

  function _parseExternalGeneXusCatalogBackup(obj) {
    const input = obj && typeof obj === "object" ? obj : null;
    if (!input) return null;

    // Formato combinado del extractor: { fields: { key: { selector, options, validations? } } }
    if (input.fields && typeof input.fields === "object") {
      const catalogs = {};
      Object.keys(input.fields).forEach((k) => {
        const f = input.fields[k];
        if (!f || typeof f !== "object") return;
        const selector = String(f.selector || f.field || "").trim();
        if (!selector) return;
        const merged = _coerceCatalogOptionList([...(Array.isArray(f.options) ? f.options : []), ...(Array.isArray(f.validations) ? f.validations : [])]);
        if (merged.length === 0) return;
        catalogs[selector] = _dedupeOptions([...(catalogs[selector] || []), ...merged]);
      });
      const built = _buildProfileFromExternalGeneXusCatalogs(catalogs, input.url, input.title || "IAPOS/GeneXus import");
      if (built.length > 0) return built;
    }

    // Formato por campo del extractor: { field|selector, options, validations? }
    if (Array.isArray(input.options) && (input.field || input.selector)) {
      const selector = String(input.selector || input.field || "").trim();
      if (selector) {
        const merged = _coerceCatalogOptionList([...(Array.isArray(input.options) ? input.options : []), ...(Array.isArray(input.validations) ? input.validations : [])]);
        const built = _buildProfileFromExternalGeneXusCatalogs({ [selector]: merged }, input.url, input.title || input.fieldName || "GeneXus import");
        if (built.length > 0) return built;
      }
    }

    return null;
  }

  function _parsePageMetadataBackup(text) {
    const obj = JSON.parse(String(text || "{}"));
    if (obj && obj.kind === "page-metadata-backup" && Array.isArray(obj.profiles)) {
      return obj.profiles.map(_normalizePageMetaProfile).filter(Boolean);
    }
    const external = _parseExternalGeneXusCatalogBackup(obj);
    if (external && external.length > 0) return external;
    if (obj && typeof obj === "object" && Array.isArray(obj)) return [];
    const one = _normalizePageMetaProfile(obj);
    if (one) return [one];
    throw new Error("Formato de metadatos inválido");
  }

  const store = storeFactory.createStore();
  store.subscribe(() => {
    _refreshPlaySummary();
  });
  store.subscribe((state) => {
    if (!macrosPersistenceReady) return;
    const macros = Array.isArray(state && state.library && state.library.macros)
      ? state.library.macros
      : [];
    const hash = _simpleStableHash(JSON.stringify(macros));
    if (hash === lastMacrosPersistHash) return;
    lastMacrosPersistHash = hash;
    void setLocalStorageValues({ [MACROS_STORAGE_KEY]: macros });
    void _saveMacrosSyncSnapshot(macros);
    _writeSiteSurvivalSnapshot({ macros, macrosSavedAt: Date.now() });
    _queueMacroSurvivalBackup(macros);
  });
  store.subscribe((state) => {
    if (!settingsPersistenceReady) return;
    const settings = state && state.settings && typeof state.settings === "object"
      ? state.settings
      : {};
    const hash = _simpleStableHash(JSON.stringify(settings));
    if (hash === lastSettingsPersistHash) return;
    lastSettingsPersistHash = hash;
    void _saveSettingsSyncSnapshot(settings);
    _writeSiteSurvivalSnapshot({ settings, settingsSavedAt: Date.now() });
  });
  const iimAdapter = globalScope.WebMaticIimAdapter;
  const themePalettes = {
    light: [
      { accentColor: "#059669", surfaceColor: "#f0fdf4" },
      { accentColor: "#0284c7", surfaceColor: "#f0f9ff" },
      { accentColor: "#7c3aed", surfaceColor: "#faf5ff" },
      { accentColor: "#dc2626", surfaceColor: "#fef2f2" }
    ],
    dark: [
      { accentColor: "#34d399", surfaceColor: "#022c22" },
      { accentColor: "#38bdf8", surfaceColor: "#0c1a2e" },
      { accentColor: "#a78bfa", surfaceColor: "#1e1b2e" },
      { accentColor: "#f87171", surfaceColor: "#2a1515" }
    ]
  };

  function resolveTheme(themeMode, themeVariant) {
    const mode = themeMode === "dark" ? "dark" : "light";
    const variant = Number(themeVariant);
    const index = Number.isFinite(variant) && variant >= 1 && variant <= 4 ? variant - 1 : 0;
    return {
      themeMode: mode,
      themeVariant: index + 1,
      ...themePalettes[mode][index]
    };
  }

  const recorderRuntime = {
    cleanup: null,
    varCounter: 0,
    lastCopiedText: null,
    lastCopiedVar: null,
    _ceTimer: null,       // debounce timer for contenteditable input
    _hoverTimer: null,    // debounce timer for hover recording
    _scrollTimer: null,   // debounce timer for scroll_to recording
    pageInventories: [],  // inventario de controles capturado durante la grabación
    autocompleteCatalogs: {},
    _autocompleteActiveSelector: "",
    _autocompleteCollectorInstalled: false,
    _autocompleteExpansionState: {},
    _autocompleteLastTypedBySelector: {},
    _autocompleteExpansionPromises: {},
    preRunReset: null,
    activeBlockKey: "",
    seenBlockKeys: new Set(),
    recordingStartUrl: "",
    dragSourceSelector: ""
  };
  const RECORDER_DYNAMIC_METADATA_ENABLED = false;

  const GX_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];
  const GX_DIGITS = ["0","1","2","3","4","5","6","7","8","9"];
  const GX_EXPANSION_TERMS = GX_LETTERS.concat(GX_DIGITS);
  // Probes con prefijo mínimo 2 (algunas instalaciones de GeneXus exigen 2+ chars).
  // Usamos pares de alta frecuencia en español para detectar rápido la plantilla XHR.
  const GX_PROBE_PAIRS = ["AL","CA","CO","DE","ES","GA","HE","LO","MA","PA","RA","SA","TE","VA"];
  // Wildcards/cadenas que algunas APIs aceptan para devolver TODO el catálogo.
  const GX_WILDCARD_SEEDS = ["", " ", "%", "*", "_", "a", "e"];

  function _buildAllTwoLetterCombos() {
    const out = [];
    for (let i = 0; i < GX_LETTERS.length; i += 1) {
      for (let j = 0; j < GX_LETTERS.length; j += 1) {
        out.push(GX_LETTERS[i] + GX_LETTERS[j]);
      }
    }
    return out;
  }
  const GX_TWO_LETTER_COMBOS = _buildAllTwoLetterCombos();

  const IAPOS_FIELD_PROFILES = {
    "#vAUCAESPEFC": {
      key: "especialidad",
      minExpected: 120,
      terms: [
        "ALO","ALOJ","ALOJAMIENTO","ANA","ANES","ANESTESIA","CAR","CARD","CARDIO","CARDIOLOGIA",
        "CIR","CIRUGIA","CLI","CLINICA","DER","DERM","DERMATO","DIA","DIAB","DIABETES",
        "DOL","DOLOR","ECO","ECOGRAFIA","END","ENDO","ENDOSCOPIA","ENDOCRINO","FIS","FISIO",
        "FISIATRIA","FON","FONO","FONOAUDIOLOGIA","GAS","GASTRO","GASTROENTEROLOGIA","GEN","GENETICA",
        "GIN","GINE","GINECOLOGIA","HEM","HEMA","HEMATOLOGIA","HEMOTERAPIA","INF","INFECTOLOGIA",
        "KIN","KINE","KINESIOLOGIA","LAB","LABORATORIO","MAM","MAMA","MED","MEDICA","MEDICINA",
        "NEF","NEFRO","NEFROLOGIA","NEU","NEUMO","NEUMONOLOGIA","NEURO","NEUROLOGIA","NEUROCIRUGIA",
        "NUT","NUTRICION","OBS","OBST","OBSTETRICIA","ODO","ODON","ODONTOLOGIA","OFT","OFTA",
        "OFTALMOLOGIA","ONC","ONCO","ONCOLOGIA","ORL","ORT","ORTOPEDIA","OTO","OTORRINO","PED",
        "PEDIATRIA","PSI","PSIC","PSICOLOGIA","PSIQ","PSIQUIATRIA","PUL","PULMON","RAD","RADIO",
        "RADIOLOGIA","RADIOTERAPIA","REH","REHABILITACION","RES","RESONANCIA","REU","REUMA","REUMATOLOGIA",
        "SAL","SALUD MENTAL","TAC","TER","TERAPIA","TRA","TRAU","TRAUMA","TRAUMATOLOGIA","URO","UROLOGIA"
      ],
      reject: [
        "IAPOS","AMSAFE","DIPART","SOFSA","SITRAM","DELEG","CENTRAL IAPOS","CASA CENTRAL","GERENCIA MEDICA",
        "BIOQUIMICOS","CONVENIO","CARTERA","ROSARIO","RAFAELA","RECONQUISTA","VENADO","CASILDA","CANADA",
        "GALVEZ","ESPERANZA","HELVECIA","FIRMAT","ALCORTA","SUNCHALES","SAN JAVIER","SAN LORENZO",
        "SANTA FE","BUENOS AIRES","VILLA CONSTITUCION","NO USAR"
      ]
    },
    "#vDELEGACION": {
      key: "delegacion",
      minExpected: 150,
      terms: [
        "IAP","IAPOS","CENTRAL","CASA","ROS","ROSARIO","RAF","RAFAELA","REC","RECONQUISTA","VEN","VENADO",
        "CAS","CASILDA","CAN","CANADA","GAL","GALVEZ","ESP","ESPERANZA","AMSAFE","DIPART","CONVENIO","SOFSA",
        "BIO","BIOQUIMICOS","SAN","SANTA","BE","US","NO USAR","ALC","ALCORTA","BUENOS","CORDOBA","FIRMAT",
        "HELVECIA","LAGUNA","LAS ROSAS","LORENZO","JAVIER","CARLOS","GOBERNADOR","CRESPO","RECREO","FRANCK",
        "TARTAGAL","SUNCHALES","TRIBUNALES","SITRAM","CARTERA","GERENCIA","MEDICA","MUTUAL","HOSP","GOBIERNO",
        "VILLA","GODEKEN","ZENON","MAXIMO","PAZ"
      ],
      reject: [
        "AUDITORIA","AUTORIZACIONES","COBERTURA","MODALIDAD","NRO AUTORIZACION","PAGINA","ORDENADO POR",
        "NOMBRE Y APELLIDO","N AFILIADO","MATRICULA","FICHA DE CONSUMOS","WEBMATIC","NOVEDADES","INICIO"
      ]
    }
  };

  function _selectorForAutocompleteEl(el) {
    if (!el) return "";
    const rec = globalScope.WebMaticRecorder;
    if (rec && typeof rec.buildSelector === "function") {
      try { return rec.buildSelector(el); } catch (e) { /* ignore */ }
    }
    if (el.id) return `#${el.id}`;
    const name = el.getAttribute && el.getAttribute("name");
    return name ? `input[name="${name}"]` : "";
  }

  function _selectorAliasesForElement(el) {
    if (!el) return [];
    const out = [];
    const push = (s) => {
      const v = String(s || "").trim();
      if (!v) return;
      if (!out.includes(v)) out.push(v);
    };
    push(_selectorForAutocompleteEl(el));
    push(_safeBuildElementSelector(el));
    if (el.id) push(`#${el.id}`);
    const name = el.getAttribute && el.getAttribute("name");
    if (name) {
      push(`input[name="${name}"]`);
      push(`[name="${name}"]`);
    }
    return out;
  }

  function _isAutocompleteCandidate(el) {
    if (!el || !el.tagName) return false;
    const tag = String(el.tagName || "").toLowerCase();
    if (tag !== "input") return false;
    const type = String((el.getAttribute && el.getAttribute("type")) || "text").toLowerCase();
    if (type && type !== "text" && type !== "search") return false;
    const role = String((el.getAttribute && el.getAttribute("role")) || "").toLowerCase();
    const ariaAutocomplete = String((el.getAttribute && el.getAttribute("aria-autocomplete")) || "");
    const id = String(el.id || "");
    const name = String((el.getAttribute && el.getAttribute("name")) || "");
    if (role === "combobox" || ariaAutocomplete) return true;
    // Heuristica GeneXus: campos vXXXX tipo texto.
    return /^v[A-Z0-9_]+$/i.test(id) || /^v[A-Z0-9_]+$/i.test(name);
  }

  function _fieldIdentityText(el) {
    if (!el) return "";
    const id = String(el.id || "");
    const name = String((el.getAttribute && el.getAttribute("name")) || "");
    const ph = String((el.getAttribute && el.getAttribute("placeholder")) || "");
    const ar = String((el.getAttribute && el.getAttribute("aria-label")) || "");
    return [id, name, ph, ar].join(" ").toLowerCase();
  }

  function _compactVisibleText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function _inferVisibleFieldLabel(el, doc) {
    if (!el) return "";
    const root = doc || document;
    const aria = _compactVisibleText(el.getAttribute && el.getAttribute("aria-label"));
    if (aria) return aria;

    const id = String(el.id || "").trim();
    if (id && root && typeof root.querySelector === "function") {
      const byFor = root.querySelector(`label[for="${CSS && CSS.escape ? CSS.escape(id) : id}"]`);
      const txt = _compactVisibleText(byFor && (byFor.innerText || byFor.textContent));
      if (txt) return txt;
    }

    const parentLabel = el.closest && el.closest("label");
    const parentText = _compactVisibleText(parentLabel && (parentLabel.innerText || parentLabel.textContent));
    if (parentText) return parentText;

    // GeneXus/table layouts: etiqueta suele estar en celda previa de la misma fila.
    const tr = el.closest && el.closest("tr");
    if (tr) {
      const cells = Array.from(tr.querySelectorAll("th,td"));
      for (let i = 0; i < cells.length; i += 1) {
        const c = cells[i];
        if (!c || c.contains(el)) continue;
        const txt = _compactVisibleText(c.innerText || c.textContent);
        if (txt && txt.length >= 2 && txt.length <= 80) return txt.replace(/[:\s]+$/, "");
      }
    }

    // Fallback contextual: texto cercano de contenedores previos.
    let node = el.parentElement;
    let hops = 0;
    while (node && hops < 4) {
      const siblings = Array.from(node.children || []);
      const selfIdx = siblings.indexOf(el) >= 0 ? siblings.indexOf(el) : siblings.indexOf(node);
      for (let i = selfIdx - 1; i >= 0; i -= 1) {
        const sib = siblings[i];
        const txt = _compactVisibleText(sib && (sib.innerText || sib.textContent));
        if (txt && txt.length >= 2 && txt.length <= 80) return txt.replace(/[:\s]+$/, "");
      }
      node = node.parentElement;
      hops += 1;
    }

    const placeholder = _compactVisibleText(el.getAttribute && el.getAttribute("placeholder"));
    if (placeholder) return placeholder;

    return "";
  }

  function _classifyGeneXusField(el) {
    const raw = _fieldIdentityText(el);
    const normalized = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const allow = /(deleg|especial|espec|prest|pract|servicio|obra\s*social|plan|sucursal|centro|zona|region|localidad|ciudad|prov|depart|diag|diagnost|convenio|financiador|especialidad)/i;
    if (allow.test(normalized)) {
      return { key: true, reason: "key-business-field", score: 100 };
    }

    const maybe = /(codigo|cod|numero|nro|tipo|categoria|seccion|grupo|estado|motivo|causa)/i;
    if (maybe.test(normalized)) {
      return { key: false, reason: "possible-catalog-field", score: 60 };
    }

    return { key: false, reason: "generic-field", score: 20 };
  }

  function _collectFieldsForSelection(doc) {
    const root = doc || document;
    if (!root || typeof root.querySelectorAll !== "function") return [];
    // Excluir el panel de la extensión
    const panelEl = root.getElementById ? root.getElementById("webmatic-panel-root") : null;
    const nodes = Array.from(root.querySelectorAll("input, select, textarea")).filter((el) => !panelEl || !panelEl.contains(el));
    const out = [];
    const seen = new Set();
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      if (!el || el.disabled) continue;
      const selector = _safeBuildElementSelector(el);
      if (!selector || seen.has(selector)) continue;
      seen.add(selector);
      const tag = String(el.tagName || "").toLowerCase();
      const inputType = String((el.getAttribute && el.getAttribute("type")) || "").toLowerCase();
      const allowedInputType = !inputType || ["text", "search", "number", "tel", "email", "url"].includes(inputType);
      if (tag === "input" && !allowedInputType && !_isAutocompleteCandidate(el)) continue;
      if (tag === "input" && ["hidden", "button", "submit", "reset", "image", "file", "password", "checkbox", "radio"].includes(inputType) && !_isAutocompleteCandidate(el)) continue;
      const id = String(el.id || "");
      const name = String((el.getAttribute && el.getAttribute("name")) || "");
      const placeholder = String((el.getAttribute && el.getAttribute("placeholder")) || "");
      const ariaLabel = String((el.getAttribute && el.getAttribute("aria-label")) || "");
      const displayName = _inferVisibleFieldLabel(el, root);
      const cls = _classifyGeneXusField(el);
      const isAuto = _isAutocompleteCandidate(el);
      if (!isAuto && !displayName && tag === "input") continue;
      out.push({
        selector,
        tag,
        inputType,
        id,
        name,
        placeholder,
        ariaLabel,
        displayName,
        autoCandidate: !!isAuto,
        recommended: !!(isAuto && cls && (cls.key || Number(cls.score) >= 60)),
        reason: (cls && cls.reason) || "generic-field"
      });
    }
    return out;
  }

  function _fieldDisplayName(f) {
    const visible = _compactVisibleText(f && f.displayName);
    if (visible) return visible;
    const bits = [];
    if (f.id) bits.push(`#${f.id}`);
    if (f.name) bits.push(`name:${f.name}`);
    if (f.placeholder) bits.push(`ph:${f.placeholder}`);
    if (f.ariaLabel) bits.push(`label:${f.ariaLabel}`);
    if (bits.length === 0) bits.push(f.selector);
    return bits.slice(0, 2).join(" | ");
  }

  function _friendlyCaptureFieldName(fieldOrId) {
    const raw = typeof fieldOrId === "string" ? fieldOrId : ((fieldOrId && (fieldOrId.id || fieldOrId.name || fieldOrId.selector)) || "");
    const key = String(raw || "").replace(/^#/, "").toUpperCase();
    const map = {
      VNFLGVISTA: "VER",
      VAUCATIPPRES: "TIPO AUTORIZACION",
      VAUCAESTADO: "ESTADO",
      VCOBERTURA: "COBERTURA",
      VMDMEDCODIGOSNCHECK: "TIENE ARCHIVO ADJUNTO",
      VMODALIDAD: "MODALIDAD",
      VVERBAJAS: "VER BAJAS",
      VREQCOMPRA: "REQUIERE COMPRA",
      VDELEGACION: "DELEGACION",
      VAUCAESPEFC: "ESPECIALIDAD"
    };
    if (map[key]) return map[key];
    const visible = _compactVisibleText(fieldOrId && fieldOrId.displayName);
    if (visible) return visible.toUpperCase();
    return String(raw || "CAMPO").replace(/^#/, "").toUpperCase();
  }

  function _normalizeFieldId(value) {
    return String(value || "").trim().toUpperCase();
  }

  function _canonicalSelectorForElement(el) {
    if (!el) return "";
    if (el.id) return `#${el.id}`;
    return _safeBuildElementSelector(el) || _selectorForAutocompleteEl(el) || "";
  }

  function _profileForElement(el, selector) {
    if (!el) return null;
    const candidates = [];
    const push = (v) => {
      const s = String(v || "").trim();
      if (s && !candidates.includes(s)) candidates.push(s);
    };
    push(selector);
    push(_safeBuildElementSelector(el));
    push(_selectorForAutocompleteEl(el));
    if (el.id) push(`#${el.id}`);
    const name = el.getAttribute && el.getAttribute("name");
    if (name) {
      push(`input[name="${name}"]`);
      push(`[name="${name}"]`);
    }
    for (let i = 0; i < candidates.length; i += 1) {
      if (IAPOS_FIELD_PROFILES[candidates[i]]) return IAPOS_FIELD_PROFILES[candidates[i]];
    }
    return null;
  }

  function _isVisibleCaptureElement(el) {
    if (!el) return false;
    try {
      const style = globalScope.getComputedStyle ? globalScope.getComputedStyle(el) : null;
      if (style && (style.display === "none" || style.visibility === "hidden")) return false;
      if (typeof el.getClientRects === "function") {
        const rects = el.getClientRects();
        if (rects && rects.length > 0) return true;
      }
      if ("offsetParent" in el) return el.offsetParent !== null;
    } catch (_e) {
      return true;
    }
    return true;
  }

  function _fieldIdentityForCapture(el, displayName) {
    if (!el) return "";
    return [
      displayName,
      el.id || "",
      (el.getAttribute && el.getAttribute("name")) || "",
      (el.getAttribute && el.getAttribute("placeholder")) || "",
      (el.getAttribute && el.getAttribute("aria-label")) || "",
      (el.getAttribute && el.getAttribute("role")) || "",
      (el.getAttribute && el.getAttribute("class")) || ""
    ].join(" ").toLowerCase();
  }

  function _isIaposAuditContext(root) {
    const doc = root || document;
    const path = String(location && location.pathname || "");
    const href = String(location && location.href || "");
    const title = String(doc && doc.title || "");
    const hasSignature = !!(
      doc && typeof doc.getElementById === "function" &&
      (doc.getElementById("vDELEGACION") || doc.querySelector && doc.querySelector('[name="vDELEGACION"]')) &&
      (doc.getElementById("vAUCAESPEFC") || doc.querySelector && doc.querySelector('[name="vAUCAESPEFC"]'))
    );
    return /\/servlet\/auauditcabe_ww/i.test(path) || /auauditcabe_ww/i.test(href) || /autorizaciones/i.test(title) || hasSignature;
  }

  function _classifyCaptureElement(el, root, opts) {
    if (!el || el.disabled) return { include: false, kind: "ignored", reason: "disabled" };
    const tag = String(el.tagName || "").toLowerCase();
    const inputType = String((el.getAttribute && el.getAttribute("type")) || "").toLowerCase();
    const idOrName = _normalizeFieldId(el.id || (el.getAttribute && el.getAttribute("name")) || "");

    if (opts && opts.iaposAudit) {
      const allowSelectIds = new Set(["VNFLGVISTA", "VAUCATIPPRES", "VAUCAESTADO", "VCOBERTURA", "VMDMEDCODIGOSNCHECK", "VMODALIDAD"]);
      const allowCheckIds = new Set(["VVERBAJAS", "VREQCOMPRA"]);
      const allowAutocompleteIds = new Set(["VDELEGACION", "VAUCAESPEFC"]);

      if (allowSelectIds.has(idOrName)) return { include: true, kind: "select", reason: "iapos-allowed-select-id" };
      if (allowCheckIds.has(idOrName)) return { include: true, kind: "check", reason: "iapos-allowed-check-id" };
      if (allowAutocompleteIds.has(idOrName)) return { include: true, kind: "autocomplete", reason: "iapos-allowed-autocomplete-id" };
      return { include: false, kind: "ignored", reason: "iapos-not-in-allowlist" };
    }

    const blockedTypes = new Set(["hidden", "button", "submit", "reset", "image", "file", "password"]);
    if (tag === "input" && blockedTypes.has(inputType)) return { include: false, kind: "ignored", reason: "blocked-input-type" };
    if (!_isVisibleCaptureElement(el)) return { include: false, kind: "ignored", reason: "not-visible" };

    const displayName = _inferVisibleFieldLabel(el, root || document);
    const identity = _fieldIdentityForCapture(el, displayName);
    const selector = _canonicalSelectorForElement(el);
    const profile = _profileForElement(el, selector);
    const role = String((el.getAttribute && el.getAttribute("role")) || "").toLowerCase();
    const hasDomAutocompleteEvidence = !!(
      (el.getAttribute && (el.getAttribute("list") || el.getAttribute("aria-autocomplete") || el.getAttribute("aria-haspopup"))) ||
      role === "combobox" || role === "listbox" ||
      /combobox|autocomplete|typeahead|select2|chosen|smart|lookup/i.test(identity)
    );
    const gxClass = _classifyGeneXusField(el);
    const hasGeneXusCatalogEvidence = _isAutocompleteCandidate(el) && !!(gxClass && (gxClass.key || Number(gxClass.score) >= 60));
    const isAutocomplete = !!profile || hasDomAutocompleteEvidence || hasGeneXusCatalogEvidence;

    const denyTechnical = /(\bbuscar\b|\bsearch\b|ordenado\s*por|vcurrentpage|vk2bmaxpages|pagin|grid|toolbar)/i;
    if (denyTechnical.test(identity)) return { include: false, kind: "ignored", reason: "technical-or-search" };

    if (tag === "select") return { include: true, kind: "select", reason: "native-select" };
    if (tag === "input" && (inputType === "checkbox" || inputType === "radio")) return { include: true, kind: "check", reason: "check-state" };
    if (isAutocomplete) return { include: true, kind: "autocomplete", reason: profile ? "known-profile-autocomplete" : "autocomplete-evidence" };

    return { include: false, kind: "text", reason: "plain-text-no-catalog-evidence" };
  }

  function _collectCensableFieldsForCapture(root) {
    const doc = root || document;
    if (!doc || typeof doc.querySelectorAll !== "function") return { included: [], excluded: [], isIaposAuditPage: false };
    const panelEl = doc.getElementById ? doc.getElementById("webmatic-panel-root") : null;
    const isIaposAuditPage = _isIaposAuditContext(doc);
    const nodes = Array.from(doc.querySelectorAll("input, select, textarea"))
      .filter((el) => !panelEl || !panelEl.contains(el));
    const included = [];
    const excluded = [];
    const seen = new Set();
    const addIncluded = (el, classification) => {
      const selector = _canonicalSelectorForElement(el);
      if (!selector || seen.has(selector)) return;
      seen.add(selector);
      included.push({
        selector,
        tag: String(el.tagName || "").toLowerCase(),
        inputType: String((el.getAttribute && el.getAttribute("type")) || "").toLowerCase(),
        id: el.id || "",
        name: (el.getAttribute && el.getAttribute("name")) || "",
        displayName: isIaposAuditPage ? _friendlyCaptureFieldName(el.id || (el.getAttribute && el.getAttribute("name")) || selector) : _inferVisibleFieldLabel(el, doc),
        autoCandidate: classification.kind === "autocomplete",
        captureKind: classification.kind,
        reason: classification.reason
      });
    };

    nodes.forEach((el) => {
      const classification = _classifyCaptureElement(el, doc, { iaposAudit: isIaposAuditPage });
      if (classification.include) addIncluded(el, classification);
      else excluded.push({ id: el.id || "", name: (el.getAttribute && el.getAttribute("name")) || "", reason: classification.reason });
    });

    if (isIaposAuditPage) {
      ["vDELEGACION", "vAUCAESPEFC"].forEach((id) => {
        let el = null;
        try { el = doc.getElementById(id) || doc.querySelector(`[name="${id}"]`); } catch (_e) { el = null; }
        if (el) addIncluded(el, { kind: "autocomplete", reason: "iapos-forced-priority-autocomplete" });
      });
    }

    return { included, excluded, isIaposAuditPage };
  }

  function _openFieldSelectionModal(fields) {
    return new Promise((resolve) => {
      const list = Array.isArray(fields) ? fields : [];
      const panel = document.getElementById("webmatic-panel-root");
      if (!panel) {
        resolve([]);
        return;
      }

      const overlay = document.createElement("div");
      overlay.className = "webmatic-wm-overlay";
      overlay.style.display = "flex";
      overlay.style.zIndex = "2147483647";

      const dialog = document.createElement("div");
      dialog.className = "webmatic-wm-dialog";
      dialog.style.width = "min(760px, 94vw)";
      dialog.style.maxHeight = "82vh";
      dialog.style.display = "flex";
      dialog.style.flexDirection = "column";
      dialog.style.gap = "10px";

      const title = document.createElement("p");
      title.className = "webmatic-wm-message";
      title.style.margin = "0";
      title.style.fontWeight = "700";
      title.textContent = `Selecciona campos para censar (${list.length} detectados)`;

      const hint = document.createElement("p");
      hint.className = "webmatic-wm-message";
      hint.style.margin = "0";
      hint.style.opacity = "0.85";
      hint.textContent = "Solo se consultarán catálogos ocultos en los campos marcados.";

      const topActions = document.createElement("div");
      topActions.className = "webmatic-wm-btns";
      topActions.style.justifyContent = "space-between";
      const group = document.createElement("div");
      group.className = "webmatic-wm-btns";

      const btnAll = document.createElement("button");
      btnAll.className = "webmatic-action-btn webmatic-btn-ghost";
      btnAll.type = "button";
      btnAll.textContent = "Seleccionar todos";

      const btnNone = document.createElement("button");
      btnNone.className = "webmatic-action-btn webmatic-btn-ghost";
      btnNone.type = "button";
      btnNone.textContent = "Deseleccionar todos";

      const btnPickInPage = document.createElement("button");
      btnPickInPage.className = "webmatic-action-btn webmatic-btn-ghost";
      btnPickInPage.type = "button";
      btnPickInPage.textContent = "Tocar campos en página";

      group.appendChild(btnAll);
      group.appendChild(btnNone);
      group.appendChild(btnPickInPage);
      topActions.appendChild(group);

      const selectedCount = document.createElement("span");
      selectedCount.style.fontSize = "12px";
      selectedCount.style.opacity = "0.85";
      topActions.appendChild(selectedCount);

      const scroller = document.createElement("div");
      scroller.style.overflow = "auto";
      scroller.style.border = "1px solid var(--webmatic-border, rgba(125,125,125,0.35))";
      scroller.style.background = "var(--webmatic-card-bg, transparent)";
      scroller.style.borderRadius = "8px";
      scroller.style.padding = "8px";
      scroller.style.maxHeight = "48vh";

      const rows = [];
      const rowBySelector = new Map();
      const seenDisplayNames = new Set();

      const addRow = (f, startChecked, opts) => {
        const isManual = !!(opts && opts.manual);
        const selector = String(f && f.selector ? f.selector : "").trim();
        if (!selector) return null;
        // Deduplicar por selector exacto (siempre)
        if (rowBySelector.has(selector)) {
          const existing = rowBySelector.get(selector);
          if (isManual && startChecked) existing.cb.checked = true;
          return existing;
        }
        // Dedupe por nombre visible SOLO en listado automático, NO en picker manual
        const displayName = _fieldDisplayName(f);
        const dedupKey = displayName.trim().toLowerCase();
        if (!isManual && dedupKey && seenDisplayNames.has(dedupKey)) return null;
        if (dedupKey) seenDisplayNames.add(dedupKey);

        // Usar div, NO label, para evitar que el click en texto dispare otros checkboxes de la página
        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "20px 1fr";
        row.style.gap = "8px";
        row.style.alignItems = "start";
        row.style.padding = "6px 4px";
        row.style.cursor = "pointer";
        row.style.borderBottom = "1px solid var(--webmatic-border, rgba(150,150,150,0.2))";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!startChecked;
        cb.style.cursor = "pointer";
        cb.style.marginTop = "2px";

        const textWrap = document.createElement("div");
        const line1 = document.createElement("div");
        line1.style.fontSize = "12px";
        line1.style.fontWeight = "700";
        line1.textContent = displayName;

        const line2 = document.createElement("div");
        line2.style.fontSize = "11px";
        line2.style.opacity = "0.75";
        line2.style.color = "var(--webmatic-text-muted, inherit)";
        line2.textContent = f.selector;

        textWrap.appendChild(line1);
        textWrap.appendChild(line2);
        row.appendChild(cb);
        row.appendChild(textWrap);
        scroller.appendChild(row);

        // Click en la fila (no en el checkbox) también alterna
        row.addEventListener("click", (e) => {
          if (e.target === cb) return;
          cb.checked = !cb.checked;
          refresh();
        });

        const entry = { cb, selector };
        rows.push(entry);
        rowBySelector.set(selector, entry);
        cb.addEventListener("change", refresh);
        return entry;
      };

      // Todos los campos empiezan DESELECCIONADOS
      list.forEach((f) => addRow(f, false));

      const bottom = document.createElement("div");
      bottom.className = "webmatic-wm-btns";
      bottom.style.justifyContent = "flex-end";

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "webmatic-action-btn webmatic-btn-ghost";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancelar";

      const continueBtn = document.createElement("button");
      continueBtn.className = "webmatic-action-btn";
      continueBtn.type = "button";
      continueBtn.textContent = "Continuar";

      bottom.appendChild(cancelBtn);
      bottom.appendChild(continueBtn);

      dialog.appendChild(title);
      dialog.appendChild(hint);
      dialog.appendChild(topActions);
      dialog.appendChild(scroller);
      dialog.appendChild(bottom);
      overlay.appendChild(dialog);
      panel.appendChild(overlay);

      const readSelection = () => rows.filter((r) => r.cb.checked).map((r) => r.selector);
      let pickerBar = null;
      let pickerCount = 0;
      let picking = false;

      const closestSelectableField = (target) => {
        if (!target || typeof target.closest !== "function") return null;
        const el = target.closest("input,select,textarea");
        if (!el) return null;
        // Excluir campos dentro del panel de la extensión o la pickerBar
        if (panel.contains(el)) return null;
        if (pickerBar && pickerBar.contains(el)) return null;
        return el;
      };

      const buildFieldFromElement = (el) => {
        if (!el) return null;
        const selector = _safeBuildElementSelector(el);
        if (!selector) return null;
        return {
          selector,
          tag: String(el.tagName || "").toLowerCase(),
          inputType: String((el.getAttribute && el.getAttribute("type")) || "").toLowerCase(),
          id: String(el.id || ""),
          name: String((el.getAttribute && el.getAttribute("name")) || ""),
          placeholder: String((el.getAttribute && el.getAttribute("placeholder")) || ""),
          ariaLabel: String((el.getAttribute && el.getAttribute("aria-label")) || ""),
          displayName: _inferVisibleFieldLabel(el, document)
        };
      };

      const setPicked = (fieldMeta) => {
        if (!fieldMeta || !fieldMeta.selector) return;
        const existing = rowBySelector.get(fieldMeta.selector);
        if (existing) {
          existing.cb.checked = true;
        } else {
          // Manual: ignora dedupe por nombre visible
          addRow(fieldMeta, true, { manual: true });
        }
        refresh();
      };

      const stopPicking = (showModal) => {
        if (!picking) return;
        picking = false;
        try { document.removeEventListener("pointerdown", onPickPointerDown, true); } catch (e) { /* ignore */ }
        try { document.removeEventListener("click", onPickClick, true); } catch (e) { /* ignore */ }
        try { document.removeEventListener("keydown", onPickKey, true); } catch (e) { /* ignore */ }
        if (pickerBar) {
          try { pickerBar.remove(); } catch (e) { /* ignore */ }
          pickerBar = null;
        }
        if (showModal) {
          overlay.style.display = "flex";
          refresh();
        }
      };

      const onPickPointerDown = (ev) => {
        const target = ev && ev.target;
        if (pickerBar && target && pickerBar.contains(target)) return;
        const hit = closestSelectableField(target);
        if (!hit) return;
        // Registrar AQUÍ en pointerdown y prevenir default para no activar el campo
        ev.preventDefault();
        ev.stopPropagation();
        const meta = buildFieldFromElement(hit);
        setPicked(meta);
        pickerCount += 1;
        if (pickerBar) {
          const msg = pickerBar.querySelector("[data-pick-msg]");
          if (msg) msg.textContent = `${pickerCount} campo(s) seleccionado(s) · Listo cuando quieras`;
        }
        try {
          const prevOutline = hit.style.outline;
          const prevBorder = hit.style.outline;
          hit.style.outline = "3px solid var(--webmatic-accent, #059669)";
          hit.style.outlineOffset = "2px";
          setTimeout(() => { try { hit.style.outline = prevOutline; hit.style.outlineOffset = ""; } catch (e) { /* ignore */ } }, 600);
        } catch (e) { /* ignore */ }
      };

      // onPickClick no se usa: pointerdown ya registra y previene el click
      const onPickClick = (ev) => {
        const target = ev && ev.target;
        if (pickerBar && target && pickerBar.contains(target)) return;
        const hit = closestSelectableField(target);
        if (!hit) return;
        ev.preventDefault();
        ev.stopPropagation();
      };

      const onPickKey = (ev) => {
        if (!ev) return;
        if (ev.key === "Escape" || ev.key === "Enter") {
          ev.preventDefault();
          stopPicking(true);
        }
      };

      const startPicking = () => {
        if (picking) return;
        picking = true;
        pickerCount = 0;
        overlay.style.display = "none";

        const panelForStyles = document.getElementById("webmatic-panel-root");
        const ps = panelForStyles ? getComputedStyle(panelForStyles) : null;
        const pAccent = ps ? ps.getPropertyValue("--webmatic-accent").trim() : "#059669";
        const pAccentFg = ps ? ps.getPropertyValue("--webmatic-accent-fg").trim() : "#fff";
        const pSurface = ps ? ps.getPropertyValue("--webmatic-surface").trim() : "#f0fdf4";
        const pText = ps ? ps.getPropertyValue("--webmatic-text").trim() : "#064e3b";
        const pBorder = ps ? ps.getPropertyValue("--webmatic-border").trim() : "#a7f3d0";

        pickerBar = document.createElement("div");
        pickerBar.style.cssText = [
          "position:fixed",
          "top:14px",
          "left:50%",
          "transform:translateX(-50%)",
          `z-index:2147483647`,
          `background:${pSurface}`,
          `color:${pText}`,
          `border:1.5px solid ${pAccent}`,
          "padding:10px 16px",
          "border-radius:999px",
          "display:flex",
          "gap:12px",
          "align-items:center",
          "font-family:system-ui,-apple-system,sans-serif",
          "font-size:12px",
          "font-weight:600",
          "box-shadow:0 8px 24px rgba(0,0,0,0.18)",
          "backdrop-filter:blur(8px)"
        ].join(";");

        const dot = document.createElement("span");
        dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${pAccent};animation:webmatic-pulse 1s infinite`;

        const msg = document.createElement("span");
        msg.setAttribute("data-pick-msg", "1");
        msg.textContent = "Haz clic en los campos de la página";

        const doneBtn = document.createElement("button");
        doneBtn.type = "button";
        doneBtn.textContent = "Listo";
        doneBtn.style.cssText = [
          `background:${pAccent}`,
          `color:${pAccentFg}`,
          "border:none",
          "border-radius:999px",
          "padding:4px 14px",
          "font-size:11px",
          "font-weight:700",
          "cursor:pointer",
          "font-family:inherit"
        ].join(";");
        doneBtn.addEventListener("click", () => stopPicking(true));

        pickerBar.appendChild(dot);
        pickerBar.appendChild(msg);
        pickerBar.appendChild(doneBtn);
        document.documentElement.appendChild(pickerBar);

        document.addEventListener("pointerdown", onPickPointerDown, true);
        document.addEventListener("click", onPickClick, true);
        document.addEventListener("keydown", onPickKey, true);
      };

      function refresh() {
        const count = readSelection().length;
        selectedCount.textContent = `${count} seleccionado(s)`;
        continueBtn.disabled = count === 0;
      }

      const cleanup = (value) => {
        stopPicking(false);
        try { overlay.remove(); } catch (e) { /* ignore */ }
        resolve(value);
      };

      btnAll.addEventListener("click", () => {
        rows.forEach((r) => { r.cb.checked = true; });
        refresh();
      });
      btnNone.addEventListener("click", () => {
        rows.forEach((r) => { r.cb.checked = false; });
        refresh();
      });
      btnPickInPage.addEventListener("click", () => startPicking());
      cancelBtn.addEventListener("click", () => cleanup(null));
      continueBtn.addEventListener("click", () => cleanup(readSelection()));

      refresh();
    });
  }

  function _decodeGeneXusEscapes(text) {
    return String(text || "")
      .replace(/\\042/g, '"')
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");
  }

  function _parseGeneXusOptionsFromResponse(raw) {
    try {
      const adapter = globalScope && globalScope.WebMaticGenexusAutocomplete;
      if (adapter && typeof adapter.parseGeneXusOptionTuples === "function") {
        const parsed = adapter.parseGeneXusOptionTuples(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { /* ignore */ }

    const text = String(raw || "");
    if (!text || text.length < 8) return [];
    const re = /\{c:\"((?:\\\\\"|[^\"])*)\",d:\"((?:\\\\\"|[^\"])*)\"\}/g;
    const out = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      const c = _decodeGeneXusEscapes(m[1]).trim();
      const d = _decodeGeneXusEscapes(m[2]).trim();
      if (!c && !d) continue;
      out.push({ value: c || d, text: d || c });
    }
    return out;
  }

  function _extractJsonLikeOptions(raw) {
    const text = String(raw || "").trim();
    if (!text) return [];
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return [];
    }

    const out = [];
    const seen = new Set();
    const visit = (node) => {
      if (!node) return;
      if (Array.isArray(node)) {
        if (node.length >= 2 && (typeof node[0] === "string" || typeof node[0] === "number") && (typeof node[1] === "string" || typeof node[1] === "number")) {
          const value = String(node[0]);
          const text2 = String(node[1]);
          const key = `${value}||${text2}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ value, text: text2 });
          }
        }
        node.forEach(visit);
        return;
      }
      if (typeof node !== "object") return;
      const value = node.value ?? node.id ?? node.code ?? node.c;
      const label = node.text ?? node.label ?? node.name ?? node.d;
      if ((typeof value === "string" || typeof value === "number") && (typeof label === "string" || typeof label === "number")) {
        const v = String(value);
        const t = String(label);
        const key = `${v}||${t}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ value: v, text: t });
        }
      }
      Object.keys(node).forEach((k) => visit(node[k]));
    };
    visit(parsed);
    return out;
  }

  function _parseAutocompleteOptions(raw) {
    const gx = _parseGeneXusOptionsFromResponse(raw);
    if (gx.length > 0) return gx;
    const json = _extractJsonLikeOptions(raw);
    if (json.length > 0) return json;
    return _extractHtmlLikeOptions(raw);
  }

  function _collectDirectEmbeddedCatalogOptions(field, root, profile) {
    const doc = root || document;
    if (!field || !doc) return [];
    const id = String(field.id || "").trim();
    const name = String((field.getAttribute && field.getAttribute("name")) || "").trim();
    const tokens = _dedupeTerms([
      id,
      name,
      id ? `GXH_${id}` : "",
      name ? `GXH_${name}` : "",
      profile && profile.key
    ]).filter((t) => String(t || "").length >= 3);
    const options = [];
    const pushMany = (items) => {
      _filterCatalogOptions(items).forEach((o) => {
        if (profile && _iaposShouldReject(profile, o && o.value, o && o.text)) return;
        options.push(o);
      });
    };

    pushMany(_collectDomSuggestionOptions(field, doc));

    try {
      const attrNames = ["data-options", "data-source", "data-values", "data-items", "data-autocomplete", "data-gx-options"];
      attrNames.forEach((attr) => {
        const raw = field.getAttribute && field.getAttribute(attr);
        if (raw) pushMany(_parseAutocompleteOptions(raw));
      });
    } catch (e) { /* ignore */ }

    try {
      const scriptNodes = Array.from(doc.querySelectorAll ? doc.querySelectorAll("script, template") : []);
      scriptNodes.forEach((node) => {
        const raw = String(node.textContent || "");
        if (!raw || raw.length > 2000000) return;
        if (tokens.length > 0 && !tokens.some((t) => raw.indexOf(t) >= 0)) return;
        pushMany(_parseAutocompleteOptions(raw));
      });
    } catch (e) { /* ignore */ }

    return _dedupeOptions(options);
  }

  function _extractHtmlLikeOptions(raw) {
    const text = String(raw || "");
    if (!text || text.indexOf("<") < 0) return [];
    const out = [];
    const seen = new Set();
    const push = (value, label) => {
      const v = String(value == null ? "" : value).trim();
      const t = String(label == null ? "" : label).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!v && !t) return;
      const vv = v || t;
      const tt = t || v;
      const key = `${vv}||${tt}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ value: vv, text: tt });
    };

    const optionRe = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
    let m;
    while ((m = optionRe.exec(text)) !== null) {
      const attrs = String(m[1] || "");
      const label = String(m[2] || "");
      const valMatch = attrs.match(/\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const value = valMatch ? (valMatch[1] ?? valMatch[2] ?? valMatch[3] ?? "") : "";
      push(value, label);
    }

    const roleOptRe = /<(?:li|div|span)\b([^>]*)>([\s\S]*?)<\/(?:li|div|span)>/gi;
    while ((m = roleOptRe.exec(text)) !== null) {
      const attrs = String(m[1] || "");
      if (!/\brole\s*=\s*(?:"option"|'option'|option)/i.test(attrs)) continue;
      const label = String(m[2] || "");
      const dataValue = attrs.match(/\b(?:data-value|value)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const value = dataValue ? (dataValue[1] ?? dataValue[2] ?? dataValue[3] ?? "") : "";
      push(value, label);
    }

    return out;
  }

  function _safeCssEscape(value) {
    const v = String(value == null ? "" : value);
    try {
      if (globalScope.CSS && typeof globalScope.CSS.escape === "function") return globalScope.CSS.escape(v);
    } catch (e) { /* ignore */ }
    return v.replace(/(["\\#.;?+*~':!^$\[\]()=>|\/@])/g, "\\$1");
  }

  function _collectDomSuggestionOptions(field, doc) {
    const root = doc || document;
    if (!field || !root || typeof root.querySelectorAll !== "function") return [];
    const out = [];
    const seen = new Set();
    const push = (value, label) => {
      const v = String(value == null ? "" : value).trim();
      const t = String(label == null ? "" : label).replace(/\s+/g, " ").trim();
      if (!v && !t) return;
      const vv = v || t;
      const tt = t || v;
      const key = `${vv}||${tt}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ value: vv, text: tt });
    };

    // 1) datalist nativo asociado al input
    try {
      const listId = String((field.getAttribute && field.getAttribute("list")) || "").trim();
      if (listId) {
        const dl = root.getElementById(listId);
        Array.from((dl && dl.querySelectorAll && dl.querySelectorAll("option")) || []).forEach((o) => {
          push(o.value, o.label || o.textContent || o.value || "");
        });
      }
    } catch (e) { /* ignore */ }

    // 2) combos GeneXus asociados (GXH*/GXHC*)
    try {
      const id = String(field.id || "").trim();
      if (id) {
        const gxIds = [`GXH${id}`, `GXHC${id}_N`];
        gxIds.forEach((gid) => {
          const el = root.getElementById(gid);
          if (!el) return;
          if (String(el.tagName || "").toLowerCase() === "select") {
            Array.from(el.options || []).forEach((o) => push(o.value, o.text || o.value || ""));
          }
        });
      }
    } catch (e) { /* ignore */ }

    // 3) popup por aria-controls/aria-owns
    const popupIds = [];
    ["aria-controls", "aria-owns"].forEach((attr) => {
      const v = String((field.getAttribute && field.getAttribute(attr)) || "").trim();
      v.split(/\s+/).forEach((id) => { if (id) popupIds.push(id); });
    });
    popupIds.forEach((pid) => {
      const box = root.getElementById(pid);
      if (!box) return;
      const nodes = box.querySelectorAll("[role='option'],option,li,div,span");
      Array.from(nodes).forEach((n) => {
        const value = (n.getAttribute && (n.getAttribute("data-value") || n.getAttribute("value"))) || "";
        const label = n.textContent || value;
        push(value, label);
      });
    });

    // 4) fallback genérico: opciones visibles en listbox/menu/combobox
    const generic = root.querySelectorAll("[role='option'], [role='listbox'] [id], [role='combobox'] [id], ul[role='listbox'] li, .ui-menu-item, .autocomplete-suggestion");
    Array.from(generic).forEach((n) => {
      const text = String(n.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      const value = (n.getAttribute && (n.getAttribute("data-value") || n.getAttribute("value"))) || text;
      push(value, text);
    });

    return out;
  }

  function _installTemporaryDomSuggestionCollector(field, onOptions) {
    const cb = typeof onOptions === "function" ? onOptions : () => {};
    const root = document && document.documentElement ? document.documentElement : null;
    if (!field || !root || typeof MutationObserver !== "function") {
      return () => {};
    }

    let timer = null;
    const flush = () => {
      try {
        const options = _collectDomSuggestionOptions(field, document);
        if (options.length > 0) cb(options);
      } catch (e) { /* ignore */ }
    };

    const schedule = () => {
      if (timer != null) return;
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, 90);
    };

    const obs = new MutationObserver(() => schedule());
    try {
      obs.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden", "aria-expanded", "aria-hidden"]
      });
      flush();
    } catch (e) { /* ignore */ }

    return () => {
      try { obs.disconnect(); } catch (e) { /* ignore */ }
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }

  function _buildAdaptiveTermsForField(field, baseTerms) {
    const id = String(field && field.id || "").replace(/[^A-Za-z0-9]+/g, " ").trim();
    const name = String(field && field.getAttribute && field.getAttribute("name") || "").replace(/[^A-Za-z0-9]+/g, " ").trim();
    const ph = String(field && field.getAttribute && field.getAttribute("placeholder") || "").replace(/[^A-Za-z0-9 ]+/g, " ").trim();
    const current = String(field && field.value || "").trim();
    const chunks = [id, name, ph].join(" ").split(/\s+/).filter(Boolean);
    const derived = [];
    chunks.forEach((w) => {
      const up = w.toUpperCase();
      if (up.length >= 2) derived.push(up.slice(0, 2));
      if (up.length >= 3) derived.push(up.slice(0, 3));
    });
    if (current) {
      const up = current.toUpperCase();
      derived.push(up.slice(0, 1), up.slice(0, 2), up.slice(0, 3));
    }
    const commonPairs = ["AL", "AN", "AR", "CA", "CO", "DE", "DI", "EN", "ES", "LA", "MA", "ME", "NE", "PA", "PE", "RA", "RE", "SA", "SE", "TA", "TE", "TR", "UR"];
    const merged = _dedupeTerms([...(Array.isArray(baseTerms) ? baseTerms : []), ...commonPairs, ...derived]);
    return merged.slice(0, 120);
  }

  function _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  function _dedupeTerms(terms) {
    const out = [];
    const seen = new Set();
    (Array.isArray(terms) ? terms : []).forEach((t) => {
      const v = String(t || "").trim();
      if (!v) return;
      const key = v.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(v);
    });
    return out;
  }

  function _minimizeProbeTermsByPrefix(terms, minLen) {
    const minLength = Math.max(1, Number(minLen) || 1);
    const sorted = _dedupeTerms(terms)
      .map((t) => String(t || "").trim().toUpperCase())
      .filter((t) => t.length >= minLength)
      .sort((a, b) => (a.length - b.length) || a.localeCompare(b));
    const kept = [];
    sorted.forEach((term) => {
      const covered = kept.some((k) => term.startsWith(k));
      if (!covered) kept.push(term);
    });
    return kept;
  }

  function _looksLikeNoiseOption(value, text) {
    const v = String(value || "").trim().toLowerCase();
    const t = String(text || "").trim().toLowerCase();
    const merged = `${v} ${t}`.trim();
    if (!merged) return true;
    if (merged.length <= 1) return true;
    if (/(^|\s)(gx\.dom|gx\.|dom\.)($|\s)/i.test(merged)) return true;
    if (/(^|\s)(usuario|organization|organizacion|org\b|window\.|document\.)($|\s)/i.test(merged)) return true;
    return false;
  }

  function _filterCatalogOptions(list) {
    return _dedupeOptions(list).filter((o) => !_looksLikeNoiseOption(o && o.value, o && o.text));
  }

  function _normalizeCatalogText(raw) {
    return String(raw == null ? "" : raw)
      .replace(/\\042/g, '"')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .trim();
  }

  function _noAccentsUpper(raw) {
    return String(raw || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .trim();
  }

  function _isBadCommonCatalogValue(value, text) {
    const s = _noAccentsUpper(`${value} ${text}`);
    if (!s) return true;
    if (s.length > 180) return true;
    if (s === "/") return true;
    return (
      s.includes("GX.DOM") ||
      s.includes("USUARIO") ||
      s.includes("ORGANIZACION") ||
      s.includes("JAVASCRIPT:") ||
      s.includes("FUNCTION(")
    );
  }

  function _iaposShouldReject(profile, value, text) {
    if (_isBadCommonCatalogValue(value, text)) return true;
    const s = _noAccentsUpper(`${value} ${text}`);
    const reject = Array.isArray(profile && profile.reject) ? profile.reject : [];
    for (let i = 0; i < reject.length; i += 1) {
      if (s.includes(_noAccentsUpper(reject[i]))) return true;
    }
    if (profile && profile.key === "especialidad") {
      if (/\b\d-\d/.test(s)) return true;
      if (/\bBE\b/.test(s) || /\bUS\b/.test(s)) return true;
    }
    return false;
  }

  function _parseGeneXusValidationFromResponse(raw) {
    try {
      const adapter = globalScope && globalScope.WebMaticGenexusAutocomplete;
      if (adapter && typeof adapter.parseGeneXusValidation === "function") {
        const v = adapter.parseGeneXusValidation(raw);
        if (v && (v.code || v.text)) {
          return {
            code: _normalizeCatalogText(v.code || ""),
            text: _normalizeCatalogText(v.text || "")
          };
        }
      }
    } catch (e) { /* ignore */ }
    const txt = String(raw || "").trim();
    const m = txt.match(/^\["([^"]*)","([^"]*)","([^"]*)"\]$/);
    if (!m) return null;
    return { code: _normalizeCatalogText(m[1]), text: _normalizeCatalogText(m[2]) };
  }

  async function _triggerGeneXusAutocompleteCycle(field, term, cfg) {
    if (!field) return;
    const config = cfg || {};
    const settleMs = Math.max(120, Number(config.settleMs) || 220);
    const value = String(term == null ? "" : term);
    const previousActive = document.activeElement;
    try {
      if (typeof field.focus === "function") field.focus();
      if (typeof field.onfocus === "function") {
        try { field.onfocus(); } catch (_e) { /* ignore */ }
      }
      const proto = Object.getPrototypeOf(field);
      const d = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
      if (d && typeof d.set === "function") d.set.call(field, value); else field.value = value;
      try { field.dispatchEvent(new Event("input", { bubbles: true, cancelable: true })); } catch (_e) { /* ignore */ }
      try { field.dispatchEvent(new Event("change", { bubbles: true, cancelable: true })); } catch (_e) { /* ignore */ }
      if (typeof field.onchange === "function") {
        try { field.onchange(); } catch (_e) { /* ignore */ }
      }
      await _sleep(settleMs);
      if (typeof field.onblur === "function") {
        try { field.onblur(); } catch (_e) { /* ignore */ }
      }
      await _sleep(settleMs);
    } finally {
      if (previousActive && typeof previousActive.focus === "function") {
        try { previousActive.focus(); } catch (_e) { /* ignore */ }
      }
    }
  }

  async function _captureIaposViaGeneXusHandlers(field, selector, profile, cfg) {
    const config = cfg || {};
    const maxOptions = Math.max(200, Number(config.maxOptions) || 60000);
    const maxTerms = Math.max(6, Number(config.maxTerms) || 18);
    const settleMs = Math.max(120, Number(config.settleMs) || 220);
    const terms = _minimizeProbeTermsByPrefix(
      _fastTermsForField(field, _dedupeTerms(profile && profile.terms)),
      4
    ).slice(0, maxTerms);
    const bag = new Map();
    let requestCount = 0;
    let captureCount = 0;
    const startedAt = Date.now();

    const add = (value, text) => {
      const v = _normalizeCatalogText(value);
      const t = _normalizeCatalogText(text || value);
      if (!v && !t) return;
      if (_iaposShouldReject(profile, v, t)) return;
      const key = `${v || t}||${t || v}`;
      if (!bag.has(key)) bag.set(key, { value: v || t, text: t || v });
    };

    const stopDomCollector = _installTemporaryDomSuggestionCollector(field, (domOptions) => {
      _filterCatalogOptions(domOptions).forEach((o) => add(o.value, o.text));
    });

    const restoreCollector = _installTemporaryNetworkCollector((payload) => {
      const raw = String(payload || "");
      const opts = _filterCatalogOptions(_parseGeneXusOptionsFromResponse(raw));
      if (opts.length > 0) {
        captureCount += 1;
        opts.forEach((o) => add(o.value, o.text));
      }
      const val = _parseGeneXusValidationFromResponse(raw);
      if (val && !_iaposShouldReject(profile, val.code, val.text)) {
        const code = String(val.code || "").trim();
        const text = String(val.text || "").trim();
        const useful = (code && code !== "0") || (text.length >= 3 && text.toUpperCase() !== code.toUpperCase());
        if (useful) add(code, text);
      }
    }, () => {
      requestCount += 1;
    });

    const previousValue = String(field.value == null ? "" : field.value);
    try {
      for (let i = 0; i < terms.length; i += 1) {
        if (bag.size >= maxOptions) break;
        await _triggerGeneXusAutocompleteCycle(field, terms[i], { settleMs });
      }
      _filterCatalogOptions(_collectDomSuggestionOptions(field, document)).forEach((o) => add(o.value, o.text));
    } finally {
      stopDomCollector();
      restoreCollector();
      try {
        const proto = Object.getPrototypeOf(field);
        const d = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
        if (d && typeof d.set === "function") d.set.call(field, previousValue); else field.value = previousValue;
      } catch (_e) { /* ignore */ }
    }

    return {
      selector,
      options: _dedupeOptions(Array.from(bag.values())),
      requests: requestCount,
      captures: captureCount,
      termsTried: terms.length,
      elapsedMs: Date.now() - startedAt,
      mode: "iapos-gx-event-pipeline"
    };
  }

  async function _captureIaposProfiledCatalogForField(field, selector, profile, cfg) {
    const config = cfg || {};
    const profileTerms = _dedupeTerms(profile && profile.terms);
    const isCriticalIaposCatalog = !!(profile && (profile.key === "delegacion" || profile.key === "especialidad"));
    const historicalOptions = _dedupeOptions(_bestHistoricalCatalogForSelector(location && location.href ? location.href : "", selector, 90)
      .filter((o) => !_iaposShouldReject(profile, o && o.value, o && o.text)));
    const useReplay = config.useReplay === true;
    const runReplayCapture = async (seedTerms, replayCfg) => {
      const sA = seedTerms[0] || "ABC";
      const sB = seedTerms.find((t) => String(t).toUpperCase() !== String(sA).toUpperCase()) || "ABD";
      return _captureAutocompleteCatalogForField(field, seedTerms, {
        seedA: sA,
        seedB: sB,
        probeWaitMs: Math.max(260, Number(replayCfg && replayCfg.probeWaitMs) || 320),
        finalSettleMs: Math.max(380, Number(replayCfg && replayCfg.finalSettleMs) || 500),
        typeWaitMs: Math.max(140, Number(replayCfg && replayCfg.typeWaitMs) || 180),
        perCharMs: Math.max(20, Number(replayCfg && replayCfg.perCharMs) || 30),
        maxOptions: Number(config.maxOptions) || 60000,
        maxParallelRequests: Math.max(8, Number(replayCfg && replayCfg.maxParallelRequests) || 10),
        forceTerms: replayCfg && replayCfg.forceTerms === true,
        maxTerms: Math.max(0, Number(replayCfg && replayCfg.maxTerms) || 0),
        expandToCombos: false,
        comboThreshold: 999999
      });
    };
    const directOptions = _dedupeOptions(_collectDirectEmbeddedCatalogOptions(field, document, profile)
      .filter((o) => !_iaposShouldReject(profile, o && o.value, o && o.text)));

    let fast = { options: [], requests: 0, captures: 0, termsTried: 0, elapsedMs: 0 };
    if (useReplay) {
      fast = await runReplayCapture(profileTerms, { maxParallelRequests: 8 });
    }
    const fastOptions = _dedupeOptions([...directOptions, ...(Array.isArray(fast.options) ? fast.options : [])]
      .filter((o) => !_iaposShouldReject(profile, o && o.value, o && o.text)));
    const aggregateMap = new Map();
    const pushAggregate = (list) => {
      _dedupeOptions(Array.isArray(list) ? list : []).forEach((o) => {
        const v = String(o && o.value != null ? o.value : "").trim();
        const t = String(o && o.text != null ? o.text : "").trim();
        if (!v && !t) return;
        const key = `${v || t}||${t || v}`;
        if (!aggregateMap.has(key)) aggregateMap.set(key, { value: v || t, text: t || v });
      });
    };
    pushAggregate(historicalOptions);
    pushAggregate(fastOptions);
    let aggRequests = Number(fast.requests) || 0;
    let aggCaptures = Number(fast.captures) || 0;
    let aggTerms = Number(fast.termsTried) || profileTerms.length;
    let aggElapsed = Number(fast.elapsedMs) || 0;
    const expectedMin = Math.max(0, Number(profile && profile.minExpected) || 0);
    const hasStrongHistorical = expectedMin > 0 && historicalOptions.length >= expectedMin;

    if (fastOptions.length > 0 && !isCriticalIaposCatalog) {
      return {
        selector,
        options: fastOptions,
        requests: Number(fast.requests) || 0,
        captures: Number(fast.captures) || 0,
        termsTried: Number(fast.termsTried) || profileTerms.length,
        elapsedMs: Number(fast.elapsedMs) || 0,
        mode: directOptions.length > 0 ? "iapos-profiled-direct-fast" : "iapos-profiled-fast"
      };
    }

    const gxEventRun = await _captureIaposViaGeneXusHandlers(field, selector, profile, {
      maxOptions: Number(config.maxOptions) || 60000,
      maxTerms: isCriticalIaposCatalog ? Math.max(14, Number(config.maxTerms) || 32) : Math.max(4, Number(config.maxTerms) || 8),
      settleMs: isCriticalIaposCatalog ? Math.max(240, Number(config.eventSettleMs) || 420) : Math.max(90, Number(config.eventSettleMs) || 140)
    });
    pushAggregate((gxEventRun && gxEventRun.options) || []);
    aggRequests += Number(gxEventRun.requests) || 0;
    aggCaptures += Number(gxEventRun.captures) || 0;
    aggTerms += Number(gxEventRun.termsTried) || 0;
    aggElapsed += Number(gxEventRun.elapsedMs) || 0;
    if (Array.isArray(gxEventRun.options) && gxEventRun.options.length > 0 && !isCriticalIaposCatalog) {
      return gxEventRun;
    }

    // Escalada puntual para campos críticos IAPOS: si siguen en 0,
    // intentamos una pasada de replay más agresiva antes de declarar vacío.
    let escalation = { options: [], requests: 0, captures: 0, termsTried: 0, elapsedMs: 0 };
    if (profile && isCriticalIaposCatalog) {
      escalation = await runReplayCapture(profileTerms, {
        probeWaitMs: 520,
        finalSettleMs: 1400,
        typeWaitMs: 480,
        perCharMs: 45,
        maxParallelRequests: 8
      });
      const escOptions = _dedupeOptions((Array.isArray(escalation.options) ? escalation.options : [])
        .filter((o) => !_iaposShouldReject(profile, o && o.value, o && o.text)));
      pushAggregate(escOptions);
      aggRequests += Number(escalation.requests) || 0;
      aggCaptures += Number(escalation.captures) || 0;
      aggTerms += Number(escalation.termsTried) || 0;
      aggElapsed += Number(escalation.elapsedMs) || 0;

      const mergedBeforeDeep = _dedupeOptions(Array.from(aggregateMap.values()));
      if (hasStrongHistorical && mergedBeforeDeep.length >= expectedMin) {
        return {
          selector,
          options: mergedBeforeDeep,
          requests: aggRequests,
          captures: aggCaptures,
          termsTried: aggTerms,
          elapsedMs: aggElapsed,
          mode: "iapos-critical-history-accelerated"
        };
      }

      // Escaneo profundo con términos de 4+ letras (1-2 letras en IAPOS no disparan resultados útiles).
      const longProbeTerms = _minimizeProbeTermsByPrefix([
        ...profileTerms,
        ...profileTerms.map((t) => String(t || "").trim().toUpperCase()).filter(Boolean).map((t) => t.slice(0, 4)),
        ...profileTerms.map((t) => String(t || "").trim().toUpperCase()).filter((t) => t.length >= 5).map((t) => t.slice(0, 5))
      ], 4);

      const prefixScan = await runReplayCapture(longProbeTerms, {
        probeWaitMs: 620,
        finalSettleMs: 1800,
        typeWaitMs: 550,
        perCharMs: 45,
        maxParallelRequests: 6,
        forceTerms: true,
        maxTerms: Math.max(60, longProbeTerms.length)
      });
      const prefixOptions = _dedupeOptions((Array.isArray(prefixScan.options) ? prefixScan.options : [])
        .filter((o) => !_iaposShouldReject(profile, o && o.value, o && o.text)));
      pushAggregate(prefixOptions);
      aggRequests += Number(prefixScan.requests) || 0;
      aggCaptures += Number(prefixScan.captures) || 0;
      aggTerms += Number(prefixScan.termsTried) || 0;
      aggElapsed += Number(prefixScan.elapsedMs) || 0;

      const mergedCritical = _dedupeOptions(Array.from(aggregateMap.values()));
      if (mergedCritical.length > 0) {
        return {
          selector,
          options: mergedCritical,
          requests: aggRequests,
          captures: aggCaptures,
          termsTried: aggTerms,
          elapsedMs: aggElapsed,
          mode: "iapos-critical-full-scan"
        };
      }
    }

    if (config.fastOnly !== false) {
      return {
        selector,
        options: [],
        requests: aggRequests,
        captures: aggCaptures,
        termsTried: aggTerms,
        elapsedMs: aggElapsed,
        mode: "iapos-profiled-fast-empty"
      };
    }

    const typeWaitMs = Math.max(450, Number(config.typeWaitMs) || 700);
    const perCharMs = Math.max(25, Number(config.perCharMs) || 55);
    const maxOptions = Math.max(500, Number(config.maxOptions) || 60000);
    const startedAt = Date.now();
    const bag = new Map();
    let requestCount = 0;
    let captureCount = 0;

    const add = (value, text) => {
      const v = _normalizeCatalogText(value);
      const t = _normalizeCatalogText(text || value);
      if (!v && !t) return;
      if (_iaposShouldReject(profile, v, t)) return;
      const key = `${v || t}||${t || v}`;
      if (!bag.has(key)) bag.set(key, { value: v || t, text: t || v });
    };

    const stopDomCollector = _installTemporaryDomSuggestionCollector(field, (domOptions) => {
      _filterCatalogOptions(domOptions).forEach((o) => add(o.value, o.text));
    });

    const restoreCollector = _installTemporaryNetworkCollector((payload) => {
      const raw = String(payload || "");
      const opts = _filterCatalogOptions(_parseGeneXusOptionsFromResponse(raw));
      if (opts.length > 0) {
        captureCount += 1;
        opts.forEach((o) => add(o.value, o.text));
      }
      const val = _parseGeneXusValidationFromResponse(raw);
      if (val) add(val.code, val.text);
    }, () => {
      requestCount += 1;
    });

    const previousValue = String(field.value == null ? "" : field.value);
    const previousActive = document.activeElement;
    const terms = profileTerms;

    try {
      try { if (typeof field.focus === "function") field.focus(); } catch (e) { /* ignore */ }
      await _sleep(180);
      for (let i = 0; i < terms.length; i += 1) {
        if (bag.size >= maxOptions) break;
        await _simulateTypingTerm(field, terms[i], perCharMs);
        await _sleep(typeWaitMs);
      }
      await _sleep(220);
    } finally {
      stopDomCollector();
      restoreCollector();
      try {
        const proto = Object.getPrototypeOf(field);
        const d = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
        if (d && typeof d.set === "function") d.set.call(field, previousValue); else field.value = previousValue;
      } catch (e) { /* ignore */ }
      if (previousActive && typeof previousActive.focus === "function") {
        try { previousActive.focus(); } catch (e) { /* ignore */ }
      }
    }

    return {
      selector,
      options: _dedupeOptions(Array.from(bag.values())),
      requests: requestCount,
      captures: captureCount,
      termsTried: terms.length,
      elapsedMs: Date.now() - startedAt,
      mode: "iapos-profiled"
    };
  }

  function _dispatchAutocompleteEvents(el, typedTerm) {
    if (!el) return;
    const value = String(typedTerm == null ? "" : typedTerm);
    try {
      if (typeof el.focus === "function") el.focus();
    } catch (e) { /* ignore */ }

    try {
      const proto = Object.getPrototypeOf(el);
      const valueDesc = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
      if (valueDesc && typeof valueDesc.set === "function") valueDesc.set.call(el, value);
      else el.value = value;
    } catch (e) {
      try { el.value = value; } catch (e2) { /* ignore */ }
    }

    try {
      const ie = typeof InputEvent === "function"
        ? new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: value.slice(-1) })
        : new Event("input", { bubbles: true, cancelable: true });
      el.dispatchEvent(ie);
    } catch (e) {
      try { el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true })); } catch (e2) { /* ignore */ }
    }

    try {
      el.dispatchEvent(new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        key: value.length > 0 ? value.slice(-1) : "",
        code: value.length > 0 ? `Key${value.slice(-1).toUpperCase()}` : "",
        keyCode: value.length > 0 ? value.toUpperCase().charCodeAt(value.length - 1) : 0,
        which: value.length > 0 ? value.toUpperCase().charCodeAt(value.length - 1) : 0
      }));
    } catch (e) { /* ignore */ }

    try { el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true })); } catch (e) { /* ignore */ }
  }

  // Simula tipeo carácter por carácter con secuencia COMPLETA de eventos
  // (keydown → keypress → value setter → input → keyup) que es la única forma
  // confiable de disparar listeners de autocompletado tipo GeneXus.
  async function _simulateTypingTerm(el, term, perCharMs) {
    if (!el) return;
    const text = String(term == null ? "" : term);
    const delay = Math.max(20, Number(perCharMs) || 60);
    const setValueDescriptor = (() => {
      try {
        const proto = Object.getPrototypeOf(el);
        const d = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
        return d && typeof d.set === "function" ? d.set : null;
      } catch (e) { return null; }
    })();
    try { if (typeof el.focus === "function") el.focus(); } catch (e) { /* ignore */ }
    // Limpiar valor previo emitiendo eventos también
    try {
      if (setValueDescriptor) setValueDescriptor.call(el, ""); else el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    } catch (e) { /* ignore */ }
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const code = ch.toUpperCase().charCodeAt(0);
      const next = text.slice(0, i + 1);
      const keyInit = {
        bubbles: true, cancelable: true,
        key: ch, code: /[a-zA-Z]/.test(ch) ? `Key${ch.toUpperCase()}` : /[0-9]/.test(ch) ? `Digit${ch}` : ch,
        keyCode: code, which: code, charCode: 0
      };
      try { el.dispatchEvent(new KeyboardEvent("keydown", keyInit)); } catch (e) { /* ignore */ }
      try { el.dispatchEvent(new KeyboardEvent("keypress", Object.assign({}, keyInit, { charCode: ch.charCodeAt(0) }))); } catch (e) { /* ignore */ }
      try {
        if (setValueDescriptor) setValueDescriptor.call(el, next); else el.value = next;
      } catch (e) { /* ignore */ }
      try {
        const ie = typeof InputEvent === "function"
          ? new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: ch })
          : new Event("input", { bubbles: true, cancelable: true });
        el.dispatchEvent(ie);
      } catch (e) { /* ignore */ }
      try { el.dispatchEvent(new KeyboardEvent("keyup", keyInit)); } catch (e) { /* ignore */ }
      if (delay > 0) await _sleep(delay);
    }
  }


  function _installTemporaryNetworkCollector(onPayload, onRequestInfo) {
    const payloadCb = typeof onPayload === "function" ? onPayload : () => {};
    const requestCb = typeof onRequestInfo === "function" ? onRequestInfo : () => {};
    const restoreFns = [];

    try {
      const adapter = globalScope && globalScope.WebMaticGenexusAutocomplete;
      if (adapter && typeof adapter.ensurePageBridgeInstalled === "function" && typeof adapter.subscribeNetwork === "function") {
        adapter.ensurePageBridgeInstalled(document);
        const unsubscribe = adapter.subscribeNetwork((evt) => {
          if (!evt) return;
          const method = String(evt.method || "GET").toUpperCase();
          const url = String(evt.url || "");
          const body = String(evt.body || "");
          const responseText = String(evt.responseText || "");
          const source = evt.kind === "fetch" ? "page-fetch" : "page-xhr";
          try { requestCb(method, url, body, source); } catch (e) { /* ignore */ }
          try { payloadCb(responseText, method, url, body, source); } catch (e) { /* ignore */ }
        });
        restoreFns.push(() => {
          try { unsubscribe(); } catch (e) { /* ignore */ }
        });
      }
    } catch (e) { /* ignore */ }

    const XHR = globalScope.XMLHttpRequest;
    if (XHR && XHR.prototype) {
      const originalOpen = XHR.prototype.open;
      const originalSend = XHR.prototype.send;
      XHR.prototype.open = function patchedOpen(method, url, async, user, password) {
        try {
          this.__wmTmpMethod = String(method || "GET").toUpperCase();
          this.__wmTmpUrl = String(url || "");
        } catch (e) { /* ignore */ }
        return originalOpen.call(this, method, url, async, user, password);
      };
      XHR.prototype.send = function patchedSend(body) {
        let bodyText = "";
        try { bodyText = body == null ? "" : String(body); } catch (e) { bodyText = ""; }
        try { requestCb(this.__wmTmpMethod || "GET", this.__wmTmpUrl || "", bodyText || "", "xhr"); } catch (e) { /* ignore */ }
        try {
          this.addEventListener("loadend", function onLoadEnd() {
            try { payloadCb(this.responseText || "", this.__wmTmpMethod || "GET", this.__wmTmpUrl || "", bodyText || "", "xhr"); } catch (e) { /* ignore */ }
          });
        } catch (e) { /* ignore */ }
        return originalSend.call(this, body);
      };
      restoreFns.push(() => {
        XHR.prototype.open = originalOpen;
        XHR.prototype.send = originalSend;
      });
    }

    if (typeof globalScope.fetch === "function") {
      const originalFetch = globalScope.fetch.bind(globalScope);
      globalScope.fetch = async function patchedFetch(input, init) {
        const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
        const url = String((typeof input === "string" ? input : (input && input.url)) || "");
        const body = (init && init.body != null) ? String(init.body) : "";
        try { requestCb(method, url, body, "fetch"); } catch (e) { /* ignore */ }
        const resp = await originalFetch(input, init);
        try {
          const clone = resp && typeof resp.clone === "function" ? resp.clone() : null;
          if (clone && typeof clone.text === "function") {
            void clone.text().then((txt) => {
              try { payloadCb(txt || "", method, url, body, "fetch"); } catch (e) { /* ignore */ }
            }).catch(() => {});
          }
        } catch (e) { /* ignore */ }
        return resp;
      };
      restoreFns.push(() => {
        globalScope.fetch = originalFetch;
      });
    }

    return function restoreCollector() {
      restoreFns.reverse().forEach((fn) => {
        try { fn(); } catch (e) { /* ignore */ }
      });
    };
  }

  async function _runPromisePool(items, limit, worker) {
    const list = Array.isArray(items) ? items : [];
    const maxWorkers = Math.max(1, Number(limit) || 1);
    let idx = 0;
    const runners = Array.from({ length: Math.min(maxWorkers, list.length) }, async () => {
      while (idx < list.length) {
        const at = idx;
        idx += 1;
        await worker(list[at], at);
      }
    });
    await Promise.all(runners);
  }

  function _fastTermsForField(field, terms) {
    return _dedupeTerms(terms).slice(0, 36);
  }

  // Detección por DIFERENCIA: dadas 2 requests (URL/body) generadas por 2 seeds únicos,
  // encuentra el segmento exacto donde GeneXus inserta el término. Soporta seed literal
  // o url-encoded. Si no logra ubicar la diferencia exacta, devuelve null.
  function _findTermInsertionMarker(strA, strB, seedA, seedB) {
    const a = String(strA == null ? "" : strA);
    const b = String(strB == null ? "" : strB);
    if (!a || !b || a === b) return null;
    let i = 0;
    const max = Math.min(a.length, b.length);
    while (i < max && a[i] === b[i]) i += 1;
    let jA = a.length - 1;
    let jB = b.length - 1;
    while (jA >= i && jB >= i && a[jA] === b[jB]) { jA -= 1; jB -= 1; }
    const fragA = a.slice(i, jA + 1);
    const fragB = b.slice(i, jB + 1);
    const encA = encodeURIComponent(seedA);
    const encB = encodeURIComponent(seedB);
    // Caso 1: el fragmento es exactamente el seed (literal o encoded)
    if (fragA === seedA && fragB === seedB) {
      return { prefix: a.slice(0, i), suffix: a.slice(jA + 1), encoded: false };
    }
    if (fragA === encA && fragB === encB) {
      return { prefix: a.slice(0, i), suffix: a.slice(jA + 1), encoded: true };
    }
    // Caso 2: el fragmento contiene el seed (típico en URLs con sufijos comunes)
    if (fragA.indexOf(seedA) >= 0 && fragB.indexOf(seedB) >= 0) {
      // Acotar al seed exacto dentro del fragmento
      const offA = fragA.indexOf(seedA);
      return {
        prefix: a.slice(0, i + offA),
        suffix: a.slice(i + offA + seedA.length),
        encoded: false
      };
    }
    if (fragA.indexOf(encA) >= 0 && fragB.indexOf(encB) >= 0) {
      const offA = fragA.indexOf(encA);
      return {
        prefix: a.slice(0, i + offA),
        suffix: a.slice(i + offA + encA.length),
        encoded: true
      };
    }
    return null;
  }

  function _buildRequestFromDiffTemplate(template, term) {
    const t = String(term == null ? "" : term);
    let url = "";
    let body = "";
    if (template.urlMarker) {
      const inserted = template.urlMarker.encoded ? encodeURIComponent(t) : t;
      url = template.urlMarker.prefix + inserted + template.urlMarker.suffix;
    } else {
      url = template.url;
    }
    if (template.bodyMarker) {
      const inserted = template.bodyMarker.encoded ? encodeURIComponent(t) : t;
      body = template.bodyMarker.prefix + inserted + template.bodyMarker.suffix;
    } else {
      body = template.body || "";
    }
    return { method: template.method, url, body };
  }

  async function _captureAutocompleteCatalogForField(field, terms, cfg) {
    const selector = _selectorForAutocompleteEl(field) || _safeBuildElementSelector(field);
    if (!selector) {
      return { selector: "", options: [], requests: 0, captures: 0, termsTried: 0, elapsedMs: 0 };
    }
    const config = cfg || {};
    const probeWaitMs = Math.max(400, Number(config.probeWaitMs) || 800);
    const finalSettleMs = Math.max(800, Number(config.finalSettleMs) || 1500);
    const typeWaitMs = Math.max(200, Number(config.typeWaitMs) || 400);
    const perCharMs = Math.max(20, Number(config.perCharMs) || 80);
    const maxOptions = Math.max(500, Number(config.maxOptions) || 60000);
    const maxParallelRequests = Math.max(4, Number(config.maxParallelRequests) || 16);
    const expandToCombos = config.expandToCombos !== false;
    const comboThreshold = Math.max(0, Number(config.comboThreshold) || 200);
    const forceTerms = config.forceTerms === true;
    const maxTerms = Math.max(0, Number(config.maxTerms) || 0);
    const adaptiveTerms = forceTerms
      ? _dedupeTerms(Array.isArray(terms) ? terms : [])
      : _buildAdaptiveTermsForField(field, terms);
    const replayTerms = maxTerms > 0 ? adaptiveTerms.slice(0, maxTerms) : adaptiveTerms;
    const startedAt = Date.now();
    const bag = new Map();
    let requestCount = 0;
    let captureCount = 0;

    // Diagnóstico: se expone en window.__webmaticCatalogDebug para inspección
    const debug = {
      selector,
      tagName: String(field.tagName || ""),
      probeSeeds: [],
      requestsByPhase: { seedA: [], seedB: [], replay: 0 },
      payloadsBySeed: { seedA: [], seedB: [] },
      diffTemplatesFound: 0,
      diffTemplateSample: null,
      fallbackTyping: false,
      optionsAdded: 0,
      startedAt
    };

    // Probes: 2 strings que comparten prefijo y difieren en última parte.
    // En perfiles conocidos usamos seeds reales del dominio para disparar GeneXus más rápido.
    const seedA = String(config.seedA || "ABC");
    const seedB = String(config.seedB || "ABD");
    debug.probeSeeds = [seedA, seedB];

    let activeSeed = "";
    const requestsBySeed = { [seedA]: [], [seedB]: [] };
    const seenReqKeys = new Set();

    const addOptions = (parsed) => {
      if (!parsed || parsed.length === 0) return;
      parsed.forEach((o) => {
        const v = String(o && o.value != null ? o.value : "").trim();
        const t = String(o && o.text != null ? o.text : "").trim();
        if (!v && !t) return;
        const key = `${v || t}||${t || v}`;
        if (!bag.has(key)) bag.set(key, { value: v || t, text: t || v });
      });
    };

    addOptions(_filterCatalogOptions(_collectDomSuggestionOptions(field, document)));
    const stopDomCollector = _installTemporaryDomSuggestionCollector(field, (domOptions) => {
      addOptions(_filterCatalogOptions(domOptions));
    });

    const restore = _installTemporaryNetworkCollector((payload) => {
      const raw = String(payload || "");
      if (raw.length > 0 && activeSeed && debug.payloadsBySeed[activeSeed === seedA ? "seedA" : "seedB"]) {
        const sample = raw.slice(0, 400);
        debug.payloadsBySeed[activeSeed === seedA ? "seedA" : "seedB"].push(sample);
      }
      const parsed = _filterCatalogOptions(_parseAutocompleteOptions(raw));
      if (!parsed || parsed.length === 0) return;
      captureCount += 1;
      const prev = bag.size;
      addOptions(parsed);
      debug.optionsAdded += (bag.size - prev);
    }, (method, url, body) => {
      requestCount += 1;
      const m = String(method || "GET").toUpperCase();
      const u = String(url || "");
      if (!u) return;
      const b = body == null ? "" : String(body);
      const k = `${activeSeed}||${m}||${u}||${b}`;
      if (seenReqKeys.has(k)) return;
      seenReqKeys.add(k);
      if (activeSeed && requestsBySeed[activeSeed]) {
        requestsBySeed[activeSeed].push({ method: m, url: u, body: b });
        const bucket = activeSeed === seedA ? "seedA" : "seedB";
        debug.requestsByPhase[bucket].push({ method: m, url: u.slice(0, 200), bodyPreview: b.slice(0, 200) });
      }
    });

    const previousValue = String(field.value == null ? "" : field.value);
    const previousActive = document.activeElement;

    try {
      try { if (typeof field.focus === "function") field.focus(); } catch (e) { /* ignore */ }
      await _sleep(200);

      // FASE 1: probe A — tipeo char-by-char con secuencia completa de eventos
      activeSeed = seedA;
      await _simulateTypingTerm(field, seedA, perCharMs);
      await _sleep(probeWaitMs);

      // FASE 1b: probe B
      activeSeed = seedB;
      await _simulateTypingTerm(field, seedB, perCharMs);
      await _sleep(probeWaitMs);
      activeSeed = "";

      // FASE 2: detección por diferencia
      const reqsA = requestsBySeed[seedA] || [];
      const reqsB = requestsBySeed[seedB] || [];
      const diffTemplates = [];
      const usedB = new Set();
      reqsA.forEach((rA) => {
        for (let i = 0; i < reqsB.length; i += 1) {
          if (usedB.has(i)) continue;
          const rB = reqsB[i];
          if (rB.method !== rA.method) continue;
          const urlMarker = _findTermInsertionMarker(rA.url, rB.url, seedA, seedB);
          const bodyMarker = _findTermInsertionMarker(rA.body, rB.body, seedA, seedB);
          if (!urlMarker && !bodyMarker) continue;
          const aHasSeedInUrl = rA.url.indexOf(seedA) >= 0 || rA.url.indexOf(encodeURIComponent(seedA)) >= 0;
          const aHasSeedInBody = rA.body.indexOf(seedA) >= 0 || rA.body.indexOf(encodeURIComponent(seedA)) >= 0;
          if (aHasSeedInUrl && !urlMarker) continue;
          if (aHasSeedInBody && !bodyMarker) continue;
          usedB.add(i);
          diffTemplates.push({
            method: rA.method, url: rA.url, body: rA.body, urlMarker, bodyMarker
          });
          break;
        }
      });
      debug.diffTemplatesFound = diffTemplates.length;
      if (diffTemplates.length > 0) {
        debug.diffTemplateSample = {
          method: diffTemplates[0].method,
          urlPreview: diffTemplates[0].url.slice(0, 200),
          bodyPreview: (diffTemplates[0].body || "").slice(0, 200),
          urlMarker: !!diffTemplates[0].urlMarker,
          bodyMarker: !!diffTemplates[0].bodyMarker
        };
      }

      // FASE 3: replay paralelo o fallback de tipeo completo
      if (diffTemplates.length > 0) {
        const singles = replayTerms.length > 0 ? replayTerms : GX_EXPANSION_TERMS;
        const tasks1 = [];
        diffTemplates.forEach((tpl) => {
          singles.forEach((term) => tasks1.push({ tpl, term }));
        });
        await _runPromisePool(tasks1, maxParallelRequests, async (task) => {
          if (bag.size >= maxOptions) return;
          debug.requestsByPhase.replay += 1;
          const req = _buildRequestFromDiffTemplate(task.tpl, task.term);
          const resp = await _issueSilentAutocompleteRequest(req.method, req.url, req.body);
          const parsed = _filterCatalogOptions(_parseAutocompleteOptions(resp));
          addOptions(parsed);
        });
        if (expandToCombos && bag.size >= comboThreshold && bag.size < maxOptions) {
          const tasks2 = [];
          diffTemplates.forEach((tpl) => {
            GX_TWO_LETTER_COMBOS.forEach((term) => tasks2.push({ tpl, term }));
          });
          await _runPromisePool(tasks2, maxParallelRequests, async (task) => {
            if (bag.size >= maxOptions) return;
            debug.requestsByPhase.replay += 1;
            const req = _buildRequestFromDiffTemplate(task.tpl, task.term);
            const resp = await _issueSilentAutocompleteRequest(req.method, req.url, req.body);
            const parsed = _filterCatalogOptions(_parseAutocompleteOptions(resp));
            addOptions(parsed);
          });
        }
      } else {
        // Fallback genérico: tipear términos adaptativos por campo.
        // Las XHRs y opciones visibles se capturan con los colectores temporales.
        debug.fallbackTyping = true;
        const fallbackTerms = replayTerms.length > 0 ? replayTerms : GX_EXPANSION_TERMS;
        for (let i = 0; i < fallbackTerms.length; i += 1) {
          if (bag.size >= maxOptions) break;
          activeSeed = "";
          await _simulateTypingTerm(field, fallbackTerms[i], perCharMs);
          await _sleep(typeWaitMs);
          addOptions(_filterCatalogOptions(_collectDomSuggestionOptions(field, document)));
        }
      }

      await _sleep(finalSettleMs);
    } finally {
      stopDomCollector();
      restore();
      try {
        const proto = Object.getPrototypeOf(field);
        const d = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
        if (d && typeof d.set === "function") d.set.call(field, previousValue); else field.value = previousValue;
      } catch (e) { /* ignore */ }
      if (previousActive && typeof previousActive.focus === "function") {
        try { previousActive.focus(); } catch (e) { /* ignore */ }
      }
    }

    debug.elapsedMs = Date.now() - startedAt;
    debug.optionsTotal = bag.size;
    debug.requestsTotal = requestCount;
    debug.capturesTotal = captureCount;
    try {
      if (!globalScope.__webmaticCatalogDebug) globalScope.__webmaticCatalogDebug = [];
      globalScope.__webmaticCatalogDebug.push(debug);
      console.log("[WebMatic][catalog]", selector, debug);
    } catch (e) { /* ignore */ }

    const options = _dedupeOptions(Array.from(bag.values()));
    return {
      selector,
      options,
      requests: requestCount,
      captures: captureCount,
      termsTried: replayTerms.length > 0 ? replayTerms.length : GX_EXPANSION_TERMS.length,
      elapsedMs: Date.now() - startedAt
    };
  }

  async function _captureGeneXusHiddenCatalogs(doc, onProgress, selectedSelectors) {
    const root = doc || document;
    if (!root || typeof root.querySelector !== "function") {
      return { catalogs: {}, summary: { fieldsScanned: 0, fieldsWithOptions: 0, requests: 0, options: 0, elapsedMs: 0, fieldsDetected: 0, fieldsSelected: 0 } };
    }
    const startedAt = Date.now();
    const selectedList = (Array.isArray(selectedSelectors) ? selectedSelectors : [])
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    const selectedSet = new Set(selectedList);

    // Resolver cada selector elegido por el usuario directamente desde el DOM.
    // No filtramos por _isAutocompleteCandidate: si el usuario lo eligió, lo censamos.
    const candidates = [];
    const seenEls = new Set();
    selectedList.forEach((sel) => {
      let el = null;
      try { el = root.querySelector(sel); } catch (e) { /* selector inválido */ }
      if (!el || seenEls.has(el)) return;
      seenEls.add(el);
      candidates.push({ selector: sel, el });
    });

    const catalogs = {};
    let requests = 0;
    let fieldsWithOptions = 0;
    let optionsTotal = 0;
    let extractionMode = "runtime";

    for (let i = 0; i < candidates.length; i += 1) {
      const { selector: pickedSelector, el: field } = candidates[i];
      if (typeof onProgress === "function") {
        try {
          const step = Math.round(((i + 1) / Math.max(1, candidates.length)) * 100);
          onProgress(step, { phase: "geneXus-hidden-catalog", scanned: i + 1, total: candidates.length });
        } catch (e) { /* ignore */ }
      }
      // Solo tipeamos sobre inputs/textareas; en selects nativos saltamos extracción por XHR
      const tag = String(field.tagName || "").toLowerCase();
      const inputType = String((field.getAttribute && field.getAttribute("type")) || "").toLowerCase();
      if (tag === "select") {
        // Para <select>, leemos opciones directamente del DOM
        const opts = Array.from(field.options || []).map((o) => ({
          value: String(o.value != null ? o.value : ""),
          text: String(o.text != null ? o.text : "")
        })).filter((o) => o.value || o.text);
        if (opts.length > 0) {
          fieldsWithOptions += 1;
          optionsTotal += opts.length;
          catalogs[pickedSelector] = _dedupeOptions(opts);
          _selectorAliasesForElement(field).forEach((a) => {
            if (a !== pickedSelector) catalogs[a] = _dedupeOptions([...(catalogs[a] || []), ...opts]);
          });
        }
        continue;
      }

      // Nunca intentar extracción de catálogo sobre checks/radios u otros inputs no textuales.
      if (tag === "input" && (inputType === "checkbox" || inputType === "radio")) {
        continue;
      }

      const profileBySelector = IAPOS_FIELD_PROFILES[pickedSelector] || (field.id ? IAPOS_FIELD_PROFILES[`#${field.id}`] : null);
      if (!profileBySelector && tag === "input" && !["", "text", "search"].includes(inputType) && !_isAutocompleteCandidate(field)) {
        continue;
      }

      const domBefore = _filterCatalogOptions(_collectDomSuggestionOptions(field, root));
      if (domBefore.length > 0) {
        catalogs[pickedSelector] = _dedupeOptions([...(catalogs[pickedSelector] || []), ...domBefore]);
        _selectorAliasesForElement(field).forEach((alias) => {
          if (alias !== pickedSelector) {
            catalogs[alias] = _dedupeOptions([...(catalogs[alias] || []), ...domBefore]);
          }
        });
      }

      let res;
      if (profileBySelector) {
        extractionMode = "iapos-profiled";
        res = await _captureIaposProfiledCatalogForField(field, pickedSelector, profileBySelector, {
          typeWaitMs: 260,
          perCharMs: 40,
          maxOptions: 60000
        });
      } else {
        const adaptiveTerms = _buildAdaptiveTermsForField(field, GX_EXPANSION_TERMS);
        res = await _captureAutocompleteCatalogForField(field, adaptiveTerms, {
          probeWaitMs: 380,
          finalSettleMs: 1500,
          typeWaitMs: 300,
          maxOptions: 60000,
          maxParallelRequests: 16,
          expandToCombos: true,
          comboThreshold: 200
        });
      }
      requests += Number(res.requests) || 0;
      if (Array.isArray(res.options) && res.options.length > 0) {
        fieldsWithOptions += 1;
        optionsTotal += res.options.length;
        // Guardar bajo el selector que el usuario eligió + alias del elemento
        catalogs[pickedSelector] = _dedupeOptions([...(catalogs[pickedSelector] || []), ...res.options]);
        _selectorAliasesForElement(field).forEach((alias) => {
          if (alias !== pickedSelector) {
            catalogs[alias] = _dedupeOptions([...(catalogs[alias] || []), ...res.options]);
          }
        });
      }

      const domAfter = _filterCatalogOptions(_collectDomSuggestionOptions(field, root));
      if (domAfter.length > 0) {
        catalogs[pickedSelector] = _dedupeOptions([...(catalogs[pickedSelector] || []), ...domAfter]);
        _selectorAliasesForElement(field).forEach((alias) => {
          if (alias !== pickedSelector) {
            catalogs[alias] = _dedupeOptions([...(catalogs[alias] || []), ...domAfter]);
          }
        });
      }

      if (Array.isArray(catalogs[pickedSelector]) && catalogs[pickedSelector].length > 0) {
        fieldsWithOptions += 1;
        optionsTotal += catalogs[pickedSelector].length;
      }
    }

    let fieldsWithOptionsFinal = 0;
    let optionsTotalFinal = 0;
    candidates.forEach(({ selector }) => {
      const arr = catalogs[selector];
      const count = Array.isArray(arr) ? arr.length : 0;
      if (count <= 0) return;
      fieldsWithOptionsFinal += 1;
      optionsTotalFinal += count;
    });

    return {
      catalogs,
      summary: {
        fieldsScanned: candidates.length,
        fieldsWithOptions: fieldsWithOptionsFinal,
        requests,
        options: optionsTotalFinal,
        elapsedMs: Date.now() - startedAt,
        fieldsDetected: candidates.length,
        fieldsSelected: selectedSet.size,
        mode: extractionMode
      }
    };
  }

  function _replaceAllSafe(raw, from, to) {
    if (!raw || !from || from === to) return raw;
    return String(raw).split(from).join(to);
  }

  function _rewriteQueryStringTerm(raw, prevTerm, nextTerm) {
    const text = String(raw || "");
    if (!text || text.indexOf("=") < 0) return null;
    const keys = ["term", "query", "search", "text", "q", "filtro", "filter", "valor", "value", "v", "keyword", "kw"];
    const parts = text.split("&");
    let changed = false;
    const out = parts.map((p) => {
      const eq = p.indexOf("=");
      if (eq <= 0) return p;
      const k = decodeURIComponent(p.slice(0, eq));
      const key = k.toLowerCase();
      const vRaw = p.slice(eq + 1);
      const v = decodeURIComponent(vRaw || "");
      const keyMatch = keys.some((x) => key === x || key.endsWith(`.${x}`) || key.includes(x));
      const valueMatch = String(v || "") === String(prevTerm || "");
      if (!keyMatch && !valueMatch) return p;
      changed = true;
      return `${encodeURIComponent(k)}=${encodeURIComponent(String(nextTerm || ""))}`;
    });
    return changed ? out.join("&") : null;
  }

  function _rewriteJsonTerm(raw, prevTerm, nextTerm) {
    const text = String(raw || "").trim();
    if (!text || (text[0] !== "{" && text[0] !== "[")) return null;
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { return null; }
    const keys = ["term", "query", "search", "text", "q", "filtro", "filter", "valor", "value", "v", "keyword", "kw"];
    let changed = false;
    const visit = (node, parentKey) => {
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i += 1) node[i] = visit(node[i], parentKey);
        return node;
      }
      if (!node || typeof node !== "object") {
        if (typeof node === "string" && node === String(prevTerm || "")) {
          changed = true;
          return String(nextTerm || "");
        }
        return node;
      }
      Object.keys(node).forEach((k) => {
        const lower = k.toLowerCase();
        const keyMatch = keys.some((x) => lower === x || lower.endsWith(`.${x}`) || lower.includes(x));
        const val = node[k];
        if (keyMatch && (typeof val === "string" || typeof val === "number")) {
          node[k] = String(nextTerm || "");
          changed = true;
        } else {
          node[k] = visit(val, k);
        }
      });
      return node;
    };
    const walked = visit(parsed, "");
    if (!changed) return null;
    try { return JSON.stringify(walked); } catch (e) { return null; }
  }

  function _buildExpandedRequest(raw, prevTerm, nextTerm) {
    if (raw == null) return raw;
    let out = String(raw);
    const from = String(prevTerm || "");
    const to = String(nextTerm || "");
    if (!from || from === to) return out;

    const qs = _rewriteQueryStringTerm(out, from, to);
    if (qs != null) return qs;

    const json = _rewriteJsonTerm(out, from, to);
    if (json != null) return json;

    out = _replaceAllSafe(out, encodeURIComponent(from), encodeURIComponent(to));
    out = _replaceAllSafe(out, from, to);
    return out;
  }

  function _issueSilentAutocompleteRequest(method, url, body) {
    return new Promise((resolve) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open(method || "GET", url, true);
        xhr.onloadend = () => resolve(String(xhr.responseText || ""));
        xhr.onerror = () => resolve("");
        if ((method || "GET") === "GET") xhr.send();
        else xhr.send(body);
      } catch (e) {
        resolve("");
      }
    });
  }

  async function _expandCatalogSilently(selector, requestMethod, requestUrl, requestBody, lastTyped) {
    const st = recorderRuntime._autocompleteExpansionState[selector] || { running: false, done: false };
    if (st.running || st.done) return;
    st.running = true;
    recorderRuntime._autocompleteExpansionState[selector] = st;
    const run = (async () => {
      try {
        const seed = String(lastTyped || "").trim() || "A";
        for (const term of GX_EXPANSION_TERMS) {
          if (term === seed) continue;
          const body = _buildExpandedRequest(requestBody, seed, term);
          const url = _buildExpandedRequest(requestUrl, seed, term);
          const method = String(requestMethod || "POST").toUpperCase();
          const resp = await _issueSilentAutocompleteRequest(method, url, body);
          const options = _parseAutocompleteOptions(resp);
          if (options.length > 0) _addCatalogOptions(selector, options);
        }
        st.done = true;
      } catch (e) {
        // Silent path: never break user flow.
      } finally {
        st.running = false;
        recorderRuntime._autocompleteExpansionState[selector] = st;
        delete recorderRuntime._autocompleteExpansionPromises[selector];
      }
    })();
    recorderRuntime._autocompleteExpansionPromises[selector] = run;
    await run;
  }

  async function _waitForAutocompleteExpansion(maxMs) {
    if (!RECORDER_DYNAMIC_METADATA_ENABLED) return;
    const promises = Object.values(recorderRuntime._autocompleteExpansionPromises || {})
      .filter((p) => p && typeof p.then === "function");
    if (promises.length === 0) return;

    const timeout = new Promise((resolve) => setTimeout(resolve, Math.max(150, Number(maxMs) || 1400)));
    try {
      await Promise.race([Promise.allSettled(promises), timeout]);
    } catch (e) {
      // Never block the recorder flow due to background catalog expansion.
    }
  }

  function _serializeAutocompleteCatalogs() {
    const raw = recorderRuntime.autocompleteCatalogs || {};
    const out = {};
    Object.keys(raw).forEach((sel) => {
      const map = raw[sel];
      if (!map || typeof map.values !== "function") return;
      const arr = Array.from(map.values()).map((o, idx) => ({
        index: idx,
        value: String(o && o.value != null ? o.value : ""),
        text: String(o && o.text != null ? o.text : ""),
        selected: false,
        disabled: false
      })).filter((o) => o.value || o.text);
      if (arr.length > 0) out[sel] = arr;
    });
    return out;
  }

  function _catalogForSelector(selector) {
    if (!selector) return null;
    if (!recorderRuntime.autocompleteCatalogs[selector]) {
      recorderRuntime.autocompleteCatalogs[selector] = new Map();
    }
    return recorderRuntime.autocompleteCatalogs[selector];
  }

  function _addCatalogOptions(selector, options) {
    if (!selector || !Array.isArray(options) || options.length === 0) return;
    const bucket = _catalogForSelector(selector);
    if (!bucket) return;
    options.forEach((o) => {
      const v = String(o && o.value != null ? o.value : "").trim();
      const t = String(o && o.text != null ? o.text : "").trim();
      if (!v && !t) return;
      const key = `${v}||${t}`;
      if (!bucket.has(key)) bucket.set(key, { value: v || t, text: t || v });
    });
  }

  function _catalogOptionsForControl(ctrl) {
    if (!ctrl) return null;
    const trySelectors = [];
    if (ctrl.selector) trySelectors.push(String(ctrl.selector));
    if (ctrl.id) trySelectors.push(`#${ctrl.id}`);
    if (ctrl.name) trySelectors.push(`input[name="${ctrl.name}"]`);

    for (const sel of trySelectors) {
      const map = recorderRuntime.autocompleteCatalogs[sel];
      if (!map || map.size === 0) continue;
      let idx = 0;
      return Array.from(map.values()).map((o) => ({
        index: idx++,
        value: o.value,
        text: o.text,
        selected: false,
        disabled: false
      }));
    }
    return null;
  }

  function _installAutocompleteCollector() {
    if (!RECORDER_DYNAMIC_METADATA_ENABLED) return;
    if (recorderRuntime._autocompleteCollectorInstalled) return;
    recorderRuntime._autocompleteCollectorInstalled = true;

    const onFieldInput = (ev) => {
      const t = ev && ev.target;
      if (!_isAutocompleteCandidate(t)) return;
      const sel = _selectorForAutocompleteEl(t);
      if (sel) {
        recorderRuntime._autocompleteActiveSelector = sel;
        recorderRuntime._autocompleteLastTypedBySelector[sel] = String(t.value == null ? "" : t.value);
      }
    };
    document.addEventListener("input", onFieldInput, true);
    document.addEventListener("keyup", onFieldInput, true);
    document.addEventListener("change", onFieldInput, true);

    const consumeAutocompletePayload = (method, url, body, responseText) => {
      try {
        const sel = recorderRuntime._autocompleteActiveSelector;
        if (!sel) return;
        const options = _parseAutocompleteOptions(responseText || "");
        if (options.length === 0) return;
        _addCatalogOptions(sel, options);
        const lastTyped = recorderRuntime._autocompleteLastTypedBySelector[sel] || "";
        if (url) {
          void _expandCatalogSilently(sel, method || "POST", url, body || "", lastTyped);
        }
      } catch (e) { /* ignore */ }
    };

    const XHR = globalScope.XMLHttpRequest;
    if (XHR && XHR.prototype && !XHR.prototype.__webmaticCollectorInstalled) {
      XHR.prototype.__webmaticCollectorInstalled = true;

      const _open = XHR.prototype.open;
      const _send = XHR.prototype.send;
      XHR.prototype.open = function patchedOpen(method, url, async, user, password) {
        try {
          this.__wmMethod = String(method || "GET").toUpperCase();
          this.__wmUrl = String(url || "");
        } catch (e) { /* ignore */ }
        return _open.call(this, method, url, async, user, password);
      };
      XHR.prototype.send = function patchedSend(body) {
        try { this.__wmBody = body == null ? "" : String(body); } catch (e) { this.__wmBody = ""; }
        try {
          this.addEventListener("loadend", function onLoadEnd() {
            consumeAutocompletePayload(this.__wmMethod || "POST", this.__wmUrl || "", this.__wmBody || "", this.responseText || "");
          });
        } catch (e) { /* ignore */ }
        return _send.call(this, body);
      };
    }

    if (typeof globalScope.fetch === "function" && !globalScope.__webmaticFetchCollectorInstalled) {
      globalScope.__webmaticFetchCollectorInstalled = true;
      const _fetch = globalScope.fetch.bind(globalScope);
      globalScope.fetch = async function patchedFetch(input, init) {
        const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
        const url = String((typeof input === "string" ? input : (input && input.url)) || "");
        const body = (init && init.body != null)
          ? String(init.body)
          : ((input && input.body != null) ? String(input.body) : "");
        const resp = await _fetch(input, init);
        try {
          const clone = resp && typeof resp.clone === "function" ? resp.clone() : null;
          if (clone && typeof clone.text === "function") {
            void clone.text().then((txt) => {
              consumeAutocompletePayload(method, url, body, txt || "");
            }).catch(() => {});
          }
        } catch (e) { /* ignore */ }
        return resp;
      };
    }
  }

  /**
   * Captura el inventario de la pantalla actual y lo acumula en el runtime de
   * grabación (evitando duplicados consecutivos de la misma url).
   */
  function captureScreenInventory() {
    const inv = globalScope.WebMaticPageInventory;
    if (!inv || typeof inv.captureInventory !== "function") return;
    try {
      const snapshot = inv.captureInventory(document);
      if (snapshot && Array.isArray(snapshot.controls)) {
        snapshot.controls.forEach((ctrl) => {
          if (!ctrl || (Array.isArray(ctrl.options) && ctrl.options.length > 0)) return;
          const extra = _catalogOptionsForControl(ctrl);
          if (extra && extra.length > 0) ctrl.options = extra;
        });
      }
      recorderRuntime.pageInventories = inv.appendInventory(recorderRuntime.pageInventories, snapshot);
    } catch (e) { /* nunca interrumpir la grabación por el inventario */ }
  }

  const PRE_RUN_RESET_SENSITIVE_RE = /(pass|password|passwd|pwd|token|secret|cvv|cvc|card|tarjeta|otp|pin|seguridad|security|clave|contrasen|contrasenia|api[-_]?key|authorization|auth)/i;

  function _isSensitivePreRunField(el) {
    if (!(el instanceof Element)) return false;
    const type = String(el.getAttribute("type") || "").toLowerCase();
    const id = String(el.id || "");
    const name = String(el.getAttribute("name") || "");
    const ariaLabel = String(el.getAttribute("aria-label") || "");
    return type === "password" ||
      PRE_RUN_RESET_SENSITIVE_RE.test(id) ||
      PRE_RUN_RESET_SENSITIVE_RE.test(name) ||
      PRE_RUN_RESET_SENSITIVE_RE.test(ariaLabel);
  }

  function _capturePreRunControlsInDoc(doc, out, seen) {
    if (!doc) return;
    let fields = [];
    try {
      fields = Array.from(doc.querySelectorAll("input, select, textarea"));
    } catch (_e) {
      fields = [];
    }

    fields.forEach((el) => {
      try {
        if (el.closest && (el.closest("#webmatic-panel-root") || el.closest("#webmatic-floating-recorder-global") || el.closest("#webmatic-floating-player-global"))) {
          return;
        }
        const tag = String(el.tagName || "").toLowerCase();
        const type = String(el.type || "").toLowerCase();
        if (type === "hidden" || type === "submit" || type === "button" || type === "image" || type === "file" || type === "reset") return;
        if (el.disabled || el.readOnly) return;

        const selector = buildSelector(el);
        if (!selector || seen.has(selector)) return;
        seen.add(selector);

        const ctrl = {
          selector,
          tag,
          type,
          id: String(el.id || ""),
          name: String(el.getAttribute("name") || "")
        };

        if (_isSensitivePreRunField(el)) {
          out.push(ctrl);
          return;
        }

        if (tag === "select") {
          ctrl.value = String(el.value == null ? "" : el.value);
          ctrl.selectedIndex = Number.isFinite(Number(el.selectedIndex)) ? Number(el.selectedIndex) : 0;
        } else if (type === "checkbox" || type === "radio") {
          ctrl.checked = Boolean(el.checked);
        } else {
          ctrl.value = String(el.value == null ? "" : el.value);
        }
        out.push(ctrl);
      } catch (_e) { /* ignore single field */ }
    });

    try {
      const frames = doc.querySelectorAll("iframe, frame");
      frames.forEach((fr) => {
        try {
          _capturePreRunControlsInDoc(fr.contentDocument || (fr.contentWindow && fr.contentWindow.document), out, seen);
        } catch (_e) { /* cross-origin */ }
      });
    } catch (_e) { /* ignore */ }
  }

  function _captureInitialPreRunReset() {
    const RecorderClass = globalScope.WebMaticRecorder;
    if (RecorderClass && typeof RecorderClass.captureInitialPreRunReset === "function") {
      return RecorderClass.captureInitialPreRunReset(
        document,
        String(location && location.href ? location.href : ""),
        String(document && document.title ? document.title : ""),
        buildSelector
      );
    }
    const controls = [];
    _capturePreRunControlsInDoc(document, controls, new Set());
    if (controls.length === 0) return null;
    return {
      version: 1,
      capturedAt: Date.now(),
      url: String(location && location.href ? location.href : ""),
      title: String(document && document.title ? document.title : ""),
      controls
    };
  }

  /**
   * Recaptura el inventario final y asocia cada step con su control (controlRef).
   * Devuelve los steps con controlRef cuando hay coincidencia; si no hay módulo
   * de inventario disponible, devuelve los steps sin tocar.
   */
  function _finalizeWithInventory(steps) {
    const inv = globalScope.WebMaticPageInventory;
    if (!inv) return steps;
    captureScreenInventory();
    try {
      return inv.associateSteps(steps, recorderRuntime.pageInventories);
    } catch (e) {
      return steps;
    }
  }

  /** Construye el bloque meta de la macro a partir del inventario acumulado. */
  function _recordingMeta() {
    let list = recorderRuntime.pageInventories;
    if (!Array.isArray(list) || list.length === 0) {
      // Last chance capture so save/export paths don't lose inventory metadata.
      captureScreenInventory();
      list = recorderRuntime.pageInventories;
    }
    const catalogs = _serializeAutocompleteCatalogs();
    const hasCatalogs = Object.keys(catalogs).length > 0;
    const preRunReset = recorderRuntime.preRunReset && typeof recorderRuntime.preRunReset === "object"
      ? recorderRuntime.preRunReset
      : null;
    if ((!Array.isArray(list) || list.length === 0) && !hasCatalogs && !preRunReset) return undefined;
    const meta = {};
    if (Array.isArray(list) && list.length > 0) meta.pageInventories = list.slice();
    if (hasCatalogs) meta.autocompleteCatalogs = catalogs;
    if (preRunReset) meta.preRunReset = JSON.parse(JSON.stringify(preRunReset));
    return meta;
  }

  async function _captureAndStoreReusablePageMetadata(selectedSelectors) {
    const emit = (pct, phase) => {
      if (typeof _captureAndStoreReusablePageMetadata._progressCb === "function") {
        try { _captureAndStoreReusablePageMetadata._progressCb(pct, phase || ""); } catch (e) { /* ignore */ }
      }
    };
    emit(5, "init");
    const inv = globalScope.WebMaticPageInventory;
    if (!inv || typeof inv.captureInventory !== "function") {
      throw new Error("Inventario no disponible");
    }

    const snapshot = inv.captureInventory(document);
    emit(20, "inventory");
    const domSnap = _captureDomElementsSnapshot(document, 12000);
    emit(30, "dom-snapshot");
    const hiddenCatalogs = await _captureGeneXusHiddenCatalogs(document, (innerPct) => {
      const p = 30 + Math.round((Math.max(0, Math.min(100, Number(innerPct) || 0)) * 55) / 100);
      emit(p, "hidden-catalogs");
    }, selectedSelectors);
    emit(88, "merge-catalogs");
    const invCatalogs = _catalogsFromInventories([snapshot], selectedSelectors);
    const runtimeCatalogs = _filterCatalogMapBySelectors(_serializeAutocompleteCatalogs(), selectedSelectors);
    const hiddenCatalogMap = _filterCatalogMapBySelectors(hiddenCatalogs.catalogs, selectedSelectors);
    const mergedCatalogs = _mergeCatalogMaps(invCatalogs, runtimeCatalogs, hiddenCatalogMap);
    const page = _safeUrlParts((snapshot && snapshot.url) || (location && location.href) || "");
    const mergedWithHistory = _reuseHistoricalCatalogsForSelectors(page.url, selectedSelectors, mergedCatalogs);
    const isIaposAuditPage = _isIaposAuditContext(document);
    if (isIaposAuditPage) {
      const criticalSelectors = ["#vDELEGACION", "#vAUCAESPEFC"];
      const selectedSet = new Set((Array.isArray(selectedSelectors) ? selectedSelectors : []).map((s) => String(s || "").trim()));
      const missingCritical = criticalSelectors.filter((sel) => {
        if (!selectedSet.has(sel)) return false;
        return _dedupeOptions(mergedWithHistory[sel]).length === 0;
      });
      if (missingCritical.length > 0) {
        throw new Error(`IAPOS sin catalogos criticos: ${missingCritical.join(", ")}. No se guarda perfil incompleto.`);
      }
    }
    const selectionFingerprint = _buildSelectionFingerprint(page.url, selectedSelectors);
    const profile = _normalizePageMetaProfile({
      capturedAt: Date.now(),
      fingerprint: selectionFingerprint,
      page: {
        url: page.url,
        origin: page.origin,
        host: page.host,
        path: page.path,
        title: (snapshot && snapshot.title) || document.title || ""
      },
      inventories: [snapshot],
      domElements: domSnap.items,
      selectedSelectors,
      autocompleteCatalogs: mergedWithHistory
    });

    // Construir mapa de defaults: selector → valor actual al momento de captura
    const defaultsMap = {};
    selectedSelectors.forEach((sel) => {
      try {
        const el = document.querySelector(sel);
        if (!el) return;
        const tag = String(el.tagName || "").toLowerCase();
        const inputType = String((el.getAttribute && el.getAttribute("type")) || "").toLowerCase();
        if (tag === "input" && (inputType === "checkbox" || inputType === "radio")) {
          defaultsMap[sel] = el.checked ? "checked" : "unchecked";
        } else if (tag === "select") {
          defaultsMap[sel] = el.value != null ? String(el.value) : "";
        } else {
          defaultsMap[sel] = String(el.value != null ? el.value : "");
        }
      } catch (_e) { /* ignore */ }
    });

    const profileWithDefaults = _normalizePageMetaProfile({ ...profile, defaults: defaultsMap });
    const current = Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles.slice() : [];
    current.unshift(profileWithDefaults);
    emit(95, "persist");
    const saved = await _savePageMetadataProfiles(current);
    emit(100, "done");
    return {
      profile: profileWithDefaults,
      total: saved.length,
      domElementsTotal: domSnap.total,
      domElementsStored: domSnap.items.length,
      domElementsTruncated: !!domSnap.truncated,
      hiddenCatalogSummary: hiddenCatalogs.summary
    };
  }

  function _setPageMetaCaptureButtonProgress(percent, busy) {
    const panel = document.getElementById("webmatic-panel-root");
    const btn = panel && panel.querySelector('[data-action="page-meta-capture"]');
    if (!btn) return;
    if (busy) {
      if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.textContent || "Capturar contenido";
      btn.disabled = true;
      btn.classList.add("is-busy");
      btn.setAttribute("aria-busy", "true");
      btn.replaceChildren();
      const spinner = document.createElement("span");
      spinner.className = "wm-capture-spinner";
      const label = document.createElement("span");
      label.textContent = "Capturando";
      btn.appendChild(spinner);
      btn.appendChild(label);
      return;
    }
    const orig = btn.dataset.origLabel || "Capturar contenido";
    btn.textContent = orig;
    btn.disabled = false;
    btn.classList.remove("is-busy");
    btn.removeAttribute("aria-busy");
    delete btn.dataset.origLabel;
  }

  function _setPageMetaCaptureOverlayProgress(percent, busy, text) {
    const id = "webmatic-page-meta-progress";
    let box = document.getElementById(id);
    if (!busy) {
      if (box) {
        box.style.opacity = "0";
        box.style.transition = "opacity 0.2s";
        setTimeout(() => { try { box.remove(); } catch (e) { /* ignore */ } }, 220);
      }
      return;
    }
    if (!box) {
      const panel = document.getElementById("webmatic-panel-root");
      const ps = panel ? getComputedStyle(panel) : null;
      const cSurface = ps ? ps.getPropertyValue("--webmatic-surface").trim() : "#f0fdf4";
      const cText = ps ? ps.getPropertyValue("--webmatic-text").trim() : "#1e293b";
      const cBorder = ps ? ps.getPropertyValue("--webmatic-border").trim() : "#a7f3d0";
      const cAccent = ps ? ps.getPropertyValue("--webmatic-accent").trim() : "#059669";

      box = document.createElement("div");
      box.id = id;
      box.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483646",
        "background:rgba(0,0,0,0.55)",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "backdrop-filter:blur(4px)",
        "pointer-events:all",
        "opacity:1",
        "transition:opacity 0.2s"
      ].join(";");

      const card = document.createElement("div");
      card.setAttribute("data-progress-card", "1");
      card.style.cssText = [
        "min-width:300px",
        "max-width:480px",
        "width:min(90vw,480px)",
        `background:${cSurface}`,
        `color:${cText}`,
        `border:1px solid ${cBorder}`,
        "border-radius:16px",
        "padding:24px 28px",
        "box-shadow:0 24px 64px rgba(0,0,0,0.35)",
        "font-family:system-ui,-apple-system,sans-serif"
      ].join(";");

      const titleEl = document.createElement("div");
      titleEl.setAttribute("data-progress-title", "1");
      titleEl.style.cssText = "font-size:14px;font-weight:700;margin-bottom:14px;";
      titleEl.textContent = "Analizando campos";

      const barWrap = document.createElement("div");
      barWrap.style.cssText = [
        `background:${cBorder}`,
        "border-radius:999px",
        "height:8px",
        "overflow:hidden",
        "margin-bottom:10px"
      ].join(";");

      const barFill = document.createElement("div");
      barFill.setAttribute("data-progress-bar", "1");
      barFill.style.cssText = [
        "height:100%",
        `background:${cAccent}`,
        "border-radius:999px",
        "width:0%",
        "transition:width 0.25s ease"
      ].join(";");

      barWrap.appendChild(barFill);

      const lineEl = document.createElement("div");
      lineEl.setAttribute("data-progress-line", "1");
      lineEl.style.cssText = "font-size:11px;opacity:0.7;";

      card.appendChild(titleEl);
      card.appendChild(barWrap);
      card.appendChild(lineEl);
      box.appendChild(card);
      document.documentElement.appendChild(box);
    }
    const pct = Math.max(0, Math.min(100, Number(percent) || 0));
    const barEl = box.querySelector("[data-progress-bar]");
    const lineEl = box.querySelector("[data-progress-line]");
    const titleEl = box.querySelector("[data-progress-title]");
    const phaseMap = {
      init: "Iniciando",
      inventory: "Leyendo controles",
      hidden_catalogs: "Catalogos ocultos",
      "hidden-catalogs": "Catalogos ocultos",
      dom_snapshot: "Snapshot del DOM",
      "dom-snapshot": "Snapshot del DOM",
      persist: "Guardando",
      done: "Finalizando"
    };
    if (barEl) barEl.style.width = `${pct}%`;
    if (titleEl) titleEl.textContent = pct < 100 ? "Analizando campos" : "Completado";
    if (lineEl) {
      const raw = String(text || "Procesando").trim();
      const pretty = phaseMap[raw] || raw.replace(/[-_]+/g, " ");
      lineEl.textContent = `${pretty} · ${pct}%`;
    }
  }

  const playerRuntime = {
    activePlayer: null,
    runtimeAutoFillLocks: new Map(),
    lastFallbacks: [],
    lastDurationMs: null,
    playStartedAtMs: null
  };
  const PLAY_START_VAR = "__WEBMATIC_PLAY_START_MS__";

  function _isPlaybackHandoffSummary(summary) {
    return !!(summary && summary.handoff === true);
  }

  function _resolvePlayStartFromVars(baseVars) {
    const v = baseVars && Number(baseVars[PLAY_START_VAR]);
    return Number.isFinite(v) && v > 0 ? v : Date.now();
  }

  function _formatPlaybackDuration(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n < 100) return "";
    const totalSec = n / 1000;
    if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = Math.round(totalSec % 60);
    return `${mins}m ${String(secs).padStart(2, "0")}s`;
  }

  // ── Visual step editor state ─────────────────────────────────────────
  let seEditor = null;           // WebMaticStepEditor instance
  let _seActiveTab = "visual";  // which tab is active: "visual" | "script"
  let _prevScriptEditorOpen = false;

  /** Sync tab button active state and show/hide visual/script panes. */
  function _applyScriptTab(overlay, tab) {
    if (!overlay) return;
    const container = overlay.querySelector("[data-step-visual-container]");
    const area = overlay.querySelector("[data-script-editor-area]");
    const scriptShell = overlay.querySelector("[data-script-editor-shell]");
    overlay.querySelectorAll("[data-script-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.scriptTab === tab);
    });
    if (container) container.style.display = tab === "visual" ? "" : "none";
    if (scriptShell) scriptShell.style.display = tab === "script" ? "flex" : "none";
    if (area) area.style.display = tab === "script" ? "" : "none";
    _seActiveTab = tab;
  }

  function _stripWmJsonLine(scriptText) {
    return String(scriptText || "").split("\n")
      .filter((line) => !line.trimStart().startsWith("// WM_JSON:"))
      .join("\n");
  }

  function _getDefaultScriptLines(sourceScript) {
    if (!iimAdapter) return [];
    let steps = [];
    try {
      const parsed = iimAdapter.importFromIim(sourceScript || "");
      steps = Array.isArray(parsed && parsed.steps) ? parsed.steps : [];
    } catch (_e) {
      return [];
    }
    if (steps.length === 0) return [];

    const lines = [];
    let lineNo = 2; // VERSION + TAB
    for (let i = 0; i < steps.length; i += 1) {
      lineNo += 1; // exportToIim emits one human-readable line per step
      const step = steps[i];
      if (step && step._baselineDefault === true) lines.push(lineNo);
    }
    return lines;
  }

  function _ensureScriptDefaultLayer(overlay) {
    if (!overlay) return null;
    const area = overlay.querySelector("[data-script-editor-area]");
    if (!area || !area.parentElement) return null;

    let shell = overlay.querySelector("[data-script-editor-shell]");
    let layer = overlay.querySelector("[data-script-default-layer]");
    let inner = overlay.querySelector("[data-script-default-layer-inner]");

    if (!shell) {
      shell = document.createElement("div");
      shell.className = "webmatic-script-code-shell";
      shell.dataset.scriptEditorShell = "1";
      area.parentElement.insertBefore(shell, area);
      shell.appendChild(area);
    }

    if (!layer) {
      layer = document.createElement("div");
      layer.className = "webmatic-script-default-layer";
      layer.dataset.scriptDefaultLayer = "1";
      shell.insertBefore(layer, area);
    }

    if (!inner) {
      inner = document.createElement("div");
      inner.className = "webmatic-script-default-layer-inner";
      inner.dataset.scriptDefaultLayerInner = "1";
      layer.appendChild(inner);
    }

    if (!area.dataset.wmDefaultLayerBound) {
      area.dataset.wmDefaultLayerBound = "1";
      area.addEventListener("scroll", () => {
        const wrap = _ensureScriptDefaultLayer(overlay);
        if (!wrap) return;
        wrap.inner.style.transform = `translateY(${-wrap.area.scrollTop}px)`;
      });
      area.addEventListener("input", () => {
        const fullScript = String(area.dataset.wmFullScript || "");
        const canKeep = fullScript && _stripWmJsonLine(fullScript).trim() === String(area.value || "").trim();
        area.dataset.wmDefaultLines = canKeep ? area.dataset.wmDefaultLines || "[]" : "[]";
        _renderScriptDefaultLayer(overlay);
      });
    }

    return { shell, layer, inner, area };
  }

  function _renderScriptDefaultLayer(overlay) {
    const wrap = _ensureScriptDefaultLayer(overlay);
    if (!wrap) return;

    const linesRaw = String(wrap.area.dataset.wmDefaultLines || "[]");
    let lines = [];
    try { lines = JSON.parse(linesRaw); } catch (_e) { lines = []; }
    lines = Array.isArray(lines) ? lines.filter((n) => Number.isFinite(Number(n)) && Number(n) >= 1).map((n) => Number(n)) : [];

    wrap.inner.replaceChildren();
    const cs = window.getComputedStyle(wrap.area);
    const lineHeight = Math.max(parseFloat(cs.lineHeight) || 20, 14);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const contentHeight = Math.max(wrap.area.scrollHeight, wrap.area.clientHeight);
    wrap.inner.style.height = `${contentHeight}px`;
    wrap.inner.style.transform = `translateY(${-wrap.area.scrollTop}px)`;

    if (lines.length === 0) return;

    const unique = Array.from(new Set(lines)).sort((a, b) => a - b);
    unique.forEach((lineNo) => {
      const mark = document.createElement("div");
      mark.className = "webmatic-script-default-line";
      mark.style.top = `${padTop + (lineNo - 1) * lineHeight}px`;
      mark.style.height = `${lineHeight}px`;
      wrap.inner.appendChild(mark);
    });
  }

  function _syncScriptDefaultLayer(overlay, sourceScript) {
    if (!overlay) return;
    const wrap = _ensureScriptDefaultLayer(overlay);
    if (!wrap) return;
    const lines = _getDefaultScriptLines(sourceScript || "");
    wrap.area.dataset.wmDefaultLines = JSON.stringify(lines);
    _renderScriptDefaultLayer(overlay);
  }

  /** Get steps from the active editor mode (visual or script IIM). */
  function _resolveEditorSteps(area, seState, fallbackSteps) {
    if (_seActiveTab === "visual" && seEditor) {
      return seEditor.getSteps();
    }
    const rawScript = area ? area.value : "";
    const _wmStrip = (s) => (s || "").split("\n")
      .filter((l) => !l.trimStart().startsWith("// WM_JSON:")).join("\n");
    const scriptUnchanged = rawScript.trim() === _wmStrip(seState.script).trim();
    if (scriptUnchanged && fallbackSteps && fallbackSteps.length > 0) return fallbackSteps;
    return iimAdapter ? iimAdapter.importFromIim(rawScript).steps : [];
  }

  function _openSelectedMacroInEditorWithReusableMetadata(macroId) {
    const currentState = store.getState();
    const targetId = macroId || currentState.library.selectedMacroId;
    const macro = currentState.library.macros.find((m) => m.id === targetId);
    if (!macro || !iimAdapter) return false;

    const baseSteps = Array.isArray(macro.steps) && macro.steps.length > 0
      ? macro.steps
      : ((iimAdapter.importFromIim(macro.script || "") || {}).steps || []);
    const resolvedMeta = _resolveEditorMetadata(macro.meta || null, baseSteps);
    const promotedSteps = _promoteChooseOptionWithInventories(baseSteps, resolvedMeta.inventories);
    const editorMeta = _resolveEditorMetaForSteps(macro.meta || null, baseSteps);
    const script = iimAdapter.exportToIim({ steps: promotedSteps, meta: editorMeta || macro.meta || null });

    store.dispatch({
      type: contracts.ActionTypes.SCRIPT_EDITOR_OPENED,
      payload: {
        script,
        macroId: macro.id,
        draftSteps: promotedSteps,
        meta: editorMeta || {
          ...(macro.meta || {}),
          pageInventories: resolvedMeta.inventories,
          autocompleteCatalogs: resolvedMeta.autocompleteCatalogs
        }
      }
    });
    return true;
  }

  const FLOATING_BTN_ID = "webmatic-floating-recorder-global";
  const FLOATING_PLAYER_ID = "webmatic-floating-player-global";

  function normalizeRuntimeDataType(type) {
    const t = String(type || "generic").toLowerCase();
    if (t === "dni") return "dni";
    if (t === "affiliate") return "affiliate";
    if (t === "authorization") return "authorization";
    if (t === "name") return "name";
    if (t === "password") return "password";
    if (t.startsWith("custom:")) return t;
    return "generic";
  }

  function normalizeRuntimeCustomTypes(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    list.forEach((raw) => {
      const label = String(raw || "").trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(label);
    });
    return out;
  }

  function normalizeRuntimeDataItems(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((raw) => ({
        enabled: raw && typeof raw.enabled !== "undefined" ? Boolean(raw.enabled) : true,
        type: normalizeRuntimeDataType(raw && raw.type),
        data: String(raw && raw.data ? raw.data : "")
      }));
  }

  function normalizeRuntimeTemplate(template) {
    if (!template || typeof template !== "object") return null;
    const id = String(template.id || "").trim();
    const name = String(template.name || "").trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      runtimeDataEnabled: typeof template.runtimeDataEnabled !== "undefined" ? Boolean(template.runtimeDataEnabled) : true,
      runtimeDataType: normalizeRuntimeDataType(template.runtimeDataType),
      runtimeData: String(template.runtimeData || ""),
      runtimeDataItems: normalizeRuntimeDataItems(template.runtimeDataItems)
    };
  }

  function normalizeRuntimeDataTemplates(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    list.forEach((raw) => {
      const tpl = normalizeRuntimeTemplate(raw);
      if (!tpl || seen.has(tpl.id)) return;
      seen.add(tpl.id);
      out.push(tpl);
    });
    return out;
  }

  function sanitizeRuntimeTemplateSelectedId(selectedId, templates) {
    const id = String(selectedId || "");
    if (!id) return "";
    return templates.some((tpl) => String(tpl.id) === id) ? id : "";
  }

  function getActiveRuntimeDataEntries(settings) {
    if (!isRuntimeDataEnabled(settings)) return [];

    const out = [];
    const primaryData = String((settings && settings.runtimeData) || "").trim();
    if (primaryData) {
      out.push({
        type: normalizeRuntimeDataType(settings && settings.runtimeDataType),
        data: primaryData
      });
    }

    const extraItems = normalizeRuntimeDataItems(settings && settings.runtimeDataItems);
    extraItems.forEach((item) => {
      if (!item.enabled) return;
      const data = String(item.data || "").trim();
      if (!data) return;
      out.push({ type: normalizeRuntimeDataType(item.type), data });
    });

    return out;
  }

  function isRuntimeDataEnabled(settings) {
    return Boolean(settings && settings.runtimeDataEnabled);
  }

  function getRuntimeSelectorMatcher(type) {
    if (type === "dni") {
      return (selector) => /(dni|documento|document|nrodoc|numero.?doc|cuil|cuit|afiliado|nro.?afili)/i.test(selector);
    }
    if (type === "affiliate") {
      return (selector) => /(afiliado|affiliate|nro.?afili|numero.?afili|socio|nro.?socio|numero.?socio)/i.test(selector);
    }
    if (type === "authorization") {
      return (selector) => /(autoriz|autorizacion|authorization|nroaut|numero.?aut)/i.test(selector);
    }
    if (type === "name") {
      return (selector) => /(nombre|name|apellido|afiliado|titular)/i.test(selector);
    }
    if (type === "password") {
      return (selector) => /(password|pass|clave|contrasena|contrasenia)/i.test(selector);
    }
    return null;
  }

  function normalizeSelectorMatchText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function selectorHasAny(text, words) {
    return words.some((w) => w && text.includes(w));
  }

  function isRuntimeStepSelectorMatch(type, selector) {
    const text = normalizeSelectorMatchText(selector);
    if (!text) return false;

    const hasNegativeName = selectorHasAny(text, ["nombre", "apellido", "name", "razon social", "titular"]);

    if (type === "affiliate") {
      const positive = selectorHasAny(text, ["afiliado", "affiliate", "nro afili", "numero afili", "socio", "nro socio", "numero socio"]);
      if (!positive) return false;
      // Blindaje: si parece campo de nombre/apellido, no reemplazar por afiliado.
      if (hasNegativeName) return false;
      return true;
    }

    if (type === "dni") {
      const positive = selectorHasAny(text, ["dni", "documento", "nro doc", "numero doc", "cuil", "cuit"]);
      if (!positive) return false;
      if (hasNegativeName) return false;
      return true;
    }

    if (type === "authorization") {
      const positive = selectorHasAny(text, ["autoriz", "autorizacion", "authorization", "nro aut", "numero aut"]);
      if (!positive) return false;
      if (hasNegativeName) return false;
      return true;
    }

    const matcher = getRuntimeSelectorMatcher(type);
    return Boolean(matcher && matcher(selector));
  }

  function buildRuntimeVars(baseVars, settings) {
    const merged = { ...(baseVars || {}) };
    const entries = getActiveRuntimeDataEntries(settings);
    if (entries.length === 0) return merged;

    const applyRuntimeVars = (type, runtimeData) => {
      if (type === "dni") {
        merged.DNI = runtimeData;
        merged.DOCUMENTO = runtimeData;
        merged.AFFILIATE_DNI = runtimeData;
        merged.AFILIADO = runtimeData;
      } else if (type === "affiliate") {
        merged.AFILIADO = runtimeData;
        merged.AFFILIATE = runtimeData;
        merged.NRO_AFILIADO = runtimeData;
        merged.SOCIO = runtimeData;
      } else if (type === "authorization") {
        merged.AUTORIZACION = runtimeData;
        merged.AUTHORIZATION = runtimeData;
        merged.NRO_AUTORIZACION = runtimeData;
      } else if (type === "name") {
        merged.NOMBRE = runtimeData;
        merged.NAME = runtimeData;
      } else if (type === "password") {
        merged.PASSWORD = runtimeData;
        merged.CLAVE = runtimeData;
      } else if (type.startsWith("custom:")) {
        const customLabel = type.slice(7).trim();
        if (customLabel) {
          const customVar = customLabel
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .toUpperCase();
          if (customVar) merged[customVar] = runtimeData;
        }
      }
    };

    entries.forEach((entry, index) => {
      if (index === 0) {
        merged.DATO = entry.data;
      }
      applyRuntimeVars(entry.type, entry.data);
    });

    return merged;
  }

  function applyRuntimeDataToSteps(steps, settings) {
    if (!Array.isArray(steps) || steps.length === 0) return steps;
    const entries = getActiveRuntimeDataEntries(settings);
    if (entries.length === 0) return steps;

    return steps.map((step) => {
      if (!step || (step.type !== "input" && step.type !== "text")) return step;
      const selector = String(step.selector || "");
      if (!selector) return step;

      for (const entry of entries) {
        if (isRuntimeStepSelectorMatch(entry.type, selector)) {
          return { ...step, value: entry.data };
        }
      }
      return step;
    });
  }

  function getRuntimeFieldKeywords(type) {
    if (type === "dni") {
      return ["dni", "documento", "doc", "cuil", "cuit", "afiliado", "nro afiliado", "numero afiliado", "nroafili"];
    }
    if (type === "affiliate") {
      return ["afiliado", "affiliate", "nro afiliado", "numero afiliado", "nroafili", "socio", "nro socio", "numero socio"];
    }
    if (type === "authorization") {
      return ["autoriz", "autorizacion", "authorization", "nro autoriz", "numero autoriz", "nroaut"];
    }
    if (type === "name") {
      return ["nombre", "name", "apellido", "titular", "afiliado"];
    }
    if (type === "password") {
      return ["password", "pass", "clave", "contrasena", "contrasenia"];
    }
    if (type.startsWith("custom:")) {
      const label = type.slice(7).trim();
      if (!label) return [];
      const normalized = label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const tokens = normalized.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
      return [normalized, ...tokens];
    }
    return [];
  }

  function normalizeRuntimeMatchText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(n[º°]\.?|nro\.?|nro|num\.?|n\.)\b/g, " numero ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeRuntimeKeywords(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    list.forEach((k) => {
      const nk = normalizeRuntimeMatchText(k);
      if (!nk || seen.has(nk)) return;
      seen.add(nk);
      out.push(nk);
    });
    return out;
  }

  function scoreRuntimeFieldContext(context, type, keywords, negativeKeywords) {
    if (!context) return Number.NEGATIVE_INFINITY;

    let score = 0;
    let matched = false;

    keywords.forEach((k) => {
      if (!k) return;
      if (context === k) {
        score += 14;
        matched = true;
        return;
      }
      if (context.startsWith(`${k} `) || context.endsWith(` ${k}`) || context.includes(` ${k} `)) {
        score += k.length >= 10 ? 9 : 7;
        matched = true;
        return;
      }
      if (context.includes(k)) {
        score += k.length >= 10 ? 7 : 5;
        matched = true;
      }
    });

    if (!matched) return Number.NEGATIVE_INFINITY;

    negativeKeywords.forEach((k) => {
      if (!k) return;
      if (context.includes(k)) {
        score -= 14;
      }
    });

    // Refuerzos semanticos por tipo: suben precision, pero con fallback posterior.
    if (type === "affiliate") {
      if (context.includes("numero afiliado") || context.includes("afiliado numero")) score += 20;
      if (context.includes("afiliado")) score += 8;
      if (context.includes("nombre apellido") || context.includes("nombre y apellido")) score -= 32;
    }
    if (type === "dni") {
      if (context.includes("dni") || context.includes("documento")) score += 16;
      if (context.includes("nombre apellido") || context.includes("nombre y apellido")) score -= 30;
    }
    if (type === "authorization") {
      if (context.includes("autorizacion") || context.includes("autorizacion numero") || context.includes("numero autorizacion")) score += 16;
      if (context.includes("nombre apellido") || context.includes("nombre y apellido")) score -= 26;
    }

    return score;
  }

  function getRuntimeFieldNegativeKeywords(type) {
    if (type === "dni" || type === "affiliate" || type === "authorization") {
      return ["nombre", "apellido", "name", "razon social", "titular", "medico"]; 
    }
    return [];
  }

  function getFieldContextText(el) {
    const id = el.id || "";
    const name = String(el.getAttribute && el.getAttribute("name") || "");
    const placeholder = String(el.getAttribute && el.getAttribute("placeholder") || "");
    const aria = String(el.getAttribute && el.getAttribute("aria-label") || "");
    const title = String(el.getAttribute && el.getAttribute("title") || "");
    let labelsText = "";

    try {
      if (el.labels && el.labels.length) {
        labelsText = Array.from(el.labels).map((l) => (l.textContent || "")).join(" ");
      } else if (el.id) {
        const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (forLabel) labelsText = forLabel.textContent || "";
      }
    } catch (e) { /* ignore */ }

    return normalizeRuntimeMatchText([id, name, placeholder, aria, title, labelsText].filter(Boolean).join(" "));
  }

  function setRuntimeFieldValue(el, value) {
    const str = String(value == null ? "" : value);
    const tag = (el.tagName || "").toLowerCase();

    if (el.isContentEditable) {
      el.focus && el.focus();
      el.textContent = str;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    if (tag === "select") {
      el.value = str;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      try { el.setAttribute("data-webmatic-runtime-autofill", "1"); } catch (e) { /* ignore */ }
      return;
    }

    const proto = el.constructor && el.constructor.prototype;
    const desc = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
    if (desc && desc.set) desc.set.call(el, str);
    else el.value = str;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    try { el.setAttribute("data-webmatic-runtime-autofill", "1"); } catch (e) { /* ignore */ }
  }

  function clearRuntimeAutofilledFields() {
    const fields = document.querySelectorAll("[data-webmatic-runtime-autofill='1']");
    fields.forEach((el) => {
      try {
        const tag = String(el.tagName || "").toLowerCase();
        if (tag === "select") {
          if (el.options && el.options.length > 0) {
            el.selectedIndex = 0;
          } else {
            el.value = "";
          }
        } else if ("value" in el) {
          el.value = "";
        } else if (el.isContentEditable) {
          el.textContent = "";
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e) { /* ignore */ }
      try { el.removeAttribute("data-webmatic-runtime-autofill"); } catch (e) { /* ignore */ }
    });
  }

  function resetRuntimeAutoFillSession() {
    playerRuntime.runtimeAutoFillLocks = new Map();
    clearRuntimeAutofilledFields();
  }

  function tryAutoFillRuntimeEntryOnPage(entry, usedElements) {
    const runtimeData = String((entry && entry.data) || "").trim();
    if (!runtimeData) return false;

    const type = normalizeRuntimeDataType(entry && entry.type);
    const entryKey = `${type}::${runtimeData}`;
    const lockedTarget = playerRuntime.runtimeAutoFillLocks && playerRuntime.runtimeAutoFillLocks.get(entryKey);
    if (lockedTarget && lockedTarget.isConnected) {
      if (usedElements && usedElements.has(lockedTarget)) return false;
      if (!("disabled" in lockedTarget) || !lockedTarget.disabled) {
        if (!("readOnly" in lockedTarget) || !lockedTarget.readOnly) {
          const currentLocked = ("value" in lockedTarget ? String(lockedTarget.value || "") : String(lockedTarget.textContent || "")).trim();
          if (currentLocked !== runtimeData) {
            setRuntimeFieldValue(lockedTarget, runtimeData);
          }
          if (usedElements) usedElements.add(lockedTarget);
          return true;
        }
      }
      playerRuntime.runtimeAutoFillLocks.delete(entryKey);
    }

    const keywords = normalizeRuntimeKeywords(getRuntimeFieldKeywords(type));
    if (keywords.length === 0) return false;
    const negativeKeywords = normalizeRuntimeKeywords(getRuntimeFieldNegativeKeywords(type));

    const fields = document.querySelectorAll("input, textarea, select, [contenteditable='true'], [contenteditable='']");
    const candidates = [];

    fields.forEach((el) => {
      if (!(el instanceof Element)) return;
      if (usedElements && usedElements.has(el)) return;
      if (el.closest && el.closest("#webmatic-panel-root")) return;
      if (el instanceof HTMLInputElement) {
        const itype = (el.type || "").toLowerCase();
        if (["hidden", "submit", "button", "checkbox", "radio", "file"].includes(itype)) return;
      }
      if ("disabled" in el && el.disabled) return;
      if ("readOnly" in el && el.readOnly) return;

      const context = getFieldContextText(el);
      if (!context) return;
      if (!keywords.some((k) => context.includes(k))) return;

      // Para tipos numericos, si un campo tiene contexto negativo sin ancla positiva,
      // no se considera candidato para evitar contaminar campos de nombre/apellido.
      if (type === "dni" || type === "affiliate" || type === "authorization") {
        const hasNegative = negativeKeywords.some((k) => k && context.includes(k));
        const hasPositiveAnchor =
          (type === "affiliate" && (context.includes("numero afiliado") || context.includes("afiliado numero") || context.includes("afiliado"))) ||
          (type === "dni" && (context.includes("dni") || context.includes("documento"))) ||
          (type === "authorization" && (context.includes("autorizacion") || context.includes("numero autorizacion") || context.includes("autorizacion numero")));
        if (hasNegative && !hasPositiveAnchor) return;
      }

      const current = ("value" in el ? String(el.value || "") : String(el.textContent || "")).trim();
      if (current === runtimeData) return;
      if (current && type !== "password") return;

      let score = scoreRuntimeFieldContext(context, type, keywords, negativeKeywords);

      if ((type === "dni" || type === "affiliate" || type === "authorization") && /^\d+$/.test(runtimeData)) {
        if (el instanceof HTMLInputElement) {
          const itype = String(el.type || "text").toLowerCase();
          if (["text", "search", "tel", "number"].includes(itype)) {
            score += 2;
          }
        }
      }

      candidates.push({ el, score, context });
    });

    if (candidates.length === 0) return false;
    candidates.sort((a, b) => b.score - a.score);
    let best = candidates.find((c) => c.score >= 10);
    if (!best) {
      // Fallback: si no hay coincidencia fuerte, usa la mejor positiva para no bloquear.
      best = candidates.find((c) => c.score > 0) || null;
    }
    if (!best) return false;

    setRuntimeFieldValue(best.el, runtimeData);
    if (playerRuntime.runtimeAutoFillLocks) {
      playerRuntime.runtimeAutoFillLocks.set(entryKey, best.el);
    }
    if (usedElements) usedElements.add(best.el);

    return true;
  }

  function tryAutoFillRuntimeDataOnPage(settings) {
    const entries = getActiveRuntimeDataEntries(settings);
    if (entries.length === 0) return false;

    let applied = false;
    const usedElements = new Set();
    entries.forEach((entry) => {
      if (tryAutoFillRuntimeEntryOnPage(entry, usedElements)) {
        applied = true;
      }
    });
    return applied;
  }

  // ── Playback floating panel ─────────────────────────────────────────────
  function _stepLabel(s) {
    if (!s) return "";
    if (s.type === "navigate")    return "\uD83C\uDF10 " + (s.url || "");
    if (s.type === "click")       return "\uD83D\uDDB1 " + (s.selector || "");
    if (s.type === "dblclick")    return "\uD83D\uDDB1\uD83D\uDDB1 " + (s.selector || "");
    if (s.type === "input" || s.type === "text")
                                  return "\u270E " + (s.selector || "") + (s.value ? " = \"" + s.value + "\"" : "");
    if (s.type === "wait")        return "\u23F1 " + (s.seconds != null ? s.seconds + "s" : (s.ms || 0) + "ms");
    if (s.type === "check")       return "\u2611 " + (s.selector || "");
    if (s.type === "choose_option") return "\u{1F4CB} elegir " + (s.selector || "") + (s.value ? ` = ${s.value}` : "");
    if (s.type === "key")         return "\u2328 " + (s.key || "");
    if (s.type === "extract")     return "\u270F " + (s.selector || "") + (s.variable ? " \u2192 " + s.variable : "");
    if (s.type === "wait_for")    return "\u23F3 esperar " + (s.selector || "");
    if (s.type === "scroll_to")   return "\u21E9 scroll \u2192 " + (s.selector || "");
    if (s.type === "hover")       return "\u25B7 hover " + (s.selector || "");
    if (s.type === "drag_drop")   return "\u2194 drag " + (s.from || "") + " \u2192 " + (s.to || "");
    if (s.type === "set_variable")return "= " + (s.variable || "") + " \u2190 " + (s.value || "");
    if (s.type === "prompt")      return "? " + (s.label || "prompt") + (s.variable ? " \u2192 " + s.variable : "");
    if (s.type === "if_exists")   return "? si existe " + (s.selector || "");
    if (s.type === "loop_until")  return "\u21BA bucle " + (s.selector || "");
    if (s.type === "capture_defaults") return "\u2699 defaults " + (s.exclude ? `(excepto ${s.exclude})` : "");
    if (s.type === "try_fallback")return "\u26A0 try/fallback";
    if (s.type === "call_macro")  return "\u21AA llamar \"" + (s.macro_name || "") + "\"";
    if (s.type === "for_each_row")return "\u25A6 " + ((s.dataset || []).length) + " filas \u00D7 " + ((s.columns || []).join(", "));
    return s.type;
  }

  function createPlaybackFloating(onStop, onAddWait, onReplay, onClose, onLoopReplay) {
    if (document.getElementById(FLOATING_PLAYER_ID)) return;
    const PANEL_HEIGHT = 52;
    const panel = document.createElement("div");
    panel.id = FLOATING_PLAYER_ID;
    panel.style.cssText = [
      "all:initial",
      "display:flex",
      "align-items:center",
      "gap:8px",
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "height:" + PANEL_HEIGHT + "px",
      "z-index:2147483646",
      "border-bottom:2px solid rgba(37,99,235,0.35)",
      "background:rgba(255,255,255,0.97)",
      "backdrop-filter:blur(12px)",
      "padding:0 12px",
      "font-family:system-ui,sans-serif",
      "font-size:12px",
      "box-shadow:0 3px 14px rgba(37,99,235,0.18)",
      "box-sizing:border-box"
    ].join(";");

    if (!document.getElementById("webmatic-floating-keyframes")) {
      const style = document.createElement("style");
      style.id = "webmatic-floating-keyframes";
      style.textContent = "@keyframes webmatic-pulse{0%,100%{opacity:1}50%{opacity:0.35}}";
      document.head.appendChild(style);
    }

    // Spinner dot
    const dot = document.createElement("span");
    dot.id = "wm-play-dot";
    dot.style.cssText = "display:inline-block;width:10px;height:10px;border-radius:999px;background:#2563eb;animation:webmatic-pulse 1s infinite;flex-shrink:0";
    panel.appendChild(dot);

    // Macro name label
    const nameEl = document.createElement("span");
    nameEl.id = "wm-play-name";
    nameEl.style.cssText = "font-weight:700;color:#2563eb;white-space:nowrap;flex-shrink:0;max-width:140px;overflow:hidden;text-overflow:ellipsis";
    nameEl.textContent = "Reproduciendo";
    panel.appendChild(nameEl);

    // Divider
    const div1 = document.createElement("span");
    div1.style.cssText = "color:#cbd5e1;flex-shrink:0";
    div1.textContent = "|";
    panel.appendChild(div1);

    // Current step info text
    const infoEl = document.createElement("span");
    infoEl.id = "wm-play-info";
    infoEl.style.cssText = "flex:1;min-width:0;font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:system-ui,sans-serif";
    infoEl.textContent = "Iniciando...";
    panel.appendChild(infoEl);

    // Progress bar at bottom of panel
    const progressBar = document.createElement("div");
    progressBar.id = "wm-play-progress";
    progressBar.style.cssText = "position:absolute;bottom:0;left:0;height:3px;background:#2563eb;transition:width 0.35s ease;width:0%";
    panel.appendChild(progressBar);

    // +1s button
    const addWaitEl = document.createElement("button");
    addWaitEl.id = "wm-play-addwait";
    addWaitEl.style.cssText = [
      "all:initial",
      "display:none",
      "align-items:center",
      "gap:4px",
      "flex-shrink:0",
      "border:1px solid #f59e0b",
      "background:rgba(245,158,11,0.1)",
      "color:#b45309",
      "border-radius:6px",
      "padding:3px 9px",
      "font-size:11px",
      "font-weight:700",
      "font-family:system-ui,sans-serif",
      "cursor:pointer",
      "white-space:nowrap"
    ].join(";");
    addWaitEl.textContent = "\u23F1 +1s aqu\xED";
    addWaitEl.addEventListener("click", (e) => { e.stopPropagation(); if (typeof onAddWait === "function") onAddWait(); });
    panel.appendChild(addWaitEl);

    // Replay button (visible when stopped)
    const replayEl = document.createElement("button");
    replayEl.id = "wm-play-replay";
    replayEl.style.cssText = [
      "all:initial",
      "display:none",
      "align-items:center",
      "gap:4px",
      "flex-shrink:0",
      "border:1px solid rgba(37,99,235,0.4)",
      "background:rgba(37,99,235,0.08)",
      "color:#2563eb",
      "border-radius:6px",
      "padding:3px 9px",
      "font-size:11px",
      "font-weight:700",
      "font-family:system-ui,sans-serif",
      "cursor:pointer",
      "white-space:nowrap"
    ].join(";");
    replayEl.textContent = "\u25B6 Repetir";
    replayEl.addEventListener("click", (e) => { e.stopPropagation(); if (typeof onReplay === "function") onReplay(); });
    panel.appendChild(replayEl);

    // Loop count input (visible when stopped/completed)
    const loopCountEl = document.createElement("input");
    loopCountEl.id = "wm-play-loop-count";
    loopCountEl.type = "number";
    loopCountEl.min = "2";
    loopCountEl.max = "99";
    loopCountEl.value = "2";
    loopCountEl.style.cssText = [
      "all:initial",
      "display:none",
      "width:44px",
      "border:1px solid rgba(37,99,235,0.35)",
      "border-radius:6px",
      "padding:3px 6px",
      "font-size:12px",
      "font-family:system-ui,sans-serif",
      "color:#2563eb",
      "background:rgba(37,99,235,0.06)",
      "text-align:center",
      "flex-shrink:0"
    ].join(";");
    panel.appendChild(loopCountEl);

    // Loop replay button
    const loopReplayEl = document.createElement("button");
    loopReplayEl.id = "wm-play-loop-replay";
    loopReplayEl.style.cssText = [
      "all:initial",
      "display:none",
      "align-items:center",
      "gap:4px",
      "flex-shrink:0",
      "border:1px solid rgba(37,99,235,0.4)",
      "background:rgba(37,99,235,0.08)",
      "color:#2563eb",
      "border-radius:6px",
      "padding:3px 9px",
      "font-size:11px",
      "font-weight:700",
      "font-family:system-ui,sans-serif",
      "cursor:pointer",
      "white-space:nowrap"
    ].join(";");
    loopReplayEl.textContent = "\u25B6\u25B6 Bucle";
    loopReplayEl.title = "Repetir la macro N veces seguidas";
    loopReplayEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const n = Math.max(2, Math.min(99, parseInt(loopCountEl.value, 10) || 2));
      if (typeof onLoopReplay === "function") onLoopReplay(n);
    });
    panel.appendChild(loopReplayEl);

    // Stop button
    const stopEl = document.createElement("button");
    stopEl.id = "wm-play-stop";
    stopEl.style.cssText = [
      "all:initial",
      "display:inline-flex",
      "align-items:center",
      "gap:4px",
      "flex-shrink:0",
      "border:1px solid rgba(220,38,38,0.4)",
      "background:rgba(220,38,38,0.07)",
      "color:#dc2626",
      "border-radius:6px",
      "padding:3px 9px",
      "font-size:11px",
      "font-weight:700",
      "font-family:system-ui,sans-serif",
      "cursor:pointer",
      "white-space:nowrap"
    ].join(";");
    stopEl.textContent = "\u25A0 Detener";
    stopEl.addEventListener("click", (e) => { e.stopPropagation(); if (typeof onStop === "function") onStop(); });
    panel.appendChild(stopEl);

    // Close button
    const closeEl = document.createElement("button");
    closeEl.id = "wm-play-close";
    closeEl.style.cssText = [
      "all:initial",
      "display:inline-flex",
      "align-items:center",
      "flex-shrink:0",
      "border:1px solid rgba(100,116,139,0.3)",
      "background:rgba(100,116,139,0.07)",
      "color:#64748b",
      "border-radius:6px",
      "padding:3px 8px",
      "font-size:13px",
      "font-weight:700",
      "font-family:system-ui,sans-serif",
      "cursor:pointer",
      "line-height:1"
    ].join(";");
    closeEl.textContent = "\u00D7";
    closeEl.title = "Cerrar panel de reproduccion";
    closeEl.addEventListener("click", (e) => { e.stopPropagation(); if (typeof onClose === "function") onClose(); });
    panel.appendChild(closeEl);

    document.documentElement.style.marginTop = PANEL_HEIGHT + "px";
    document.documentElement.appendChild(panel);
  }

  function updatePlaybackFloating(state) {
    const panel = document.getElementById(FLOATING_PLAYER_ID);
    if (!panel) return;
    const { isPlaying, currentSteps, currentStepIndex, errorMessage } = state.playback;
    const macroId = state.library.selectedMacroId;
    const macro = state.library.macros.find((m) => m.id === macroId);
    const total = (currentSteps || []).length;

    const nameEl = panel.querySelector("#wm-play-name");
    if (nameEl && macro) nameEl.textContent = macro.name;

    const dot = panel.querySelector("#wm-play-dot");
    const infoEl = panel.querySelector("#wm-play-info");
    const progress = panel.querySelector("#wm-play-progress");
    const addWaitEl = panel.querySelector("#wm-play-addwait");
    const stopEl = panel.querySelector("#wm-play-stop");
    const replayEl = panel.querySelector("#wm-play-replay");
    const loopCountEl = panel.querySelector("#wm-play-loop-count");
    const loopReplayEl = panel.querySelector("#wm-play-loop-replay");

    if (errorMessage) {
      // Error state — keep panel open, show error, allow fix and replay
      if (dot) { dot.style.background = "#dc2626"; dot.style.animation = "none"; }
      if (infoEl) { infoEl.textContent = "\u2717 " + errorMessage; infoEl.style.color = "#dc2626"; infoEl.style.fontWeight = "600"; infoEl.title = errorMessage; }
      if (progress) { progress.style.background = "#dc2626"; }
      if (addWaitEl) addWaitEl.style.display = "inline-flex";
      if (stopEl) stopEl.style.display = "none";
      if (replayEl) replayEl.style.display = "inline-flex";
      if (loopCountEl) loopCountEl.style.display = "inline-flex";
      if (loopReplayEl) loopReplayEl.style.display = "inline-flex";
    } else if (isPlaying) {
      // Playing — show current step
      if (dot) { dot.style.background = "#2563eb"; dot.style.animation = "webmatic-pulse 1s infinite"; }
      const step = currentStepIndex >= 0 && currentStepIndex < total ? currentSteps[currentStepIndex] : null;
      const label = step ? _stepLabel(step) : "Iniciando...";
      const counter = total > 0 ? ` (${Math.min(currentStepIndex + 1, total)}/${total})` : "";
      if (infoEl) { infoEl.textContent = "\u25B8 " + label + counter; infoEl.style.color = "#1e293b"; infoEl.style.fontWeight = "500"; infoEl.title = label; }
      if (progress && total > 0) progress.style.width = Math.round(((currentStepIndex + 1) / total) * 100) + "%";
      if (progress) progress.style.background = "#2563eb";
      if (addWaitEl) addWaitEl.style.display = "inline-flex";
      if (stopEl) stopEl.style.display = "inline-flex";
      if (replayEl) replayEl.style.display = "none";
      if (loopCountEl) loopCountEl.style.display = "none";
      if (loopReplayEl) loopReplayEl.style.display = "none";
    } else if (!isPlaying && currentStepIndex >= total && total > 0) {
      // Completed successfully
      if (dot) { dot.style.background = "#16a34a"; dot.style.animation = "none"; }
      const _fbList = (playerRuntime && Array.isArray(playerRuntime.lastFallbacks)) ? playerRuntime.lastFallbacks : [];
      const _fbCount = _fbList.length;
      const _dur = _formatPlaybackDuration(playerRuntime && playerRuntime.lastDurationMs);
      const _durSuffix = _dur ? ` · ${_dur}` : "";
      if (infoEl) {
        if (_fbCount > 0) {
          const _label = _fbCount === 1 ? "fallback aplicado" : "fallbacks aplicados";
          infoEl.textContent = "\u2713 Completado con " + _fbCount + " " + _label + " \u2014 " + total + "/" + total + " pasos" + _durSuffix;
          infoEl.style.color = "#b45309";
          infoEl.style.fontWeight = "700";
          try {
            const _detail = _fbList.map((f) => `${f.kind}${f.action ? ":" + f.action : ""}${f.selector ? " " + f.selector : ""}`).join("\n");
            infoEl.title = _detail;
          } catch (_e) { infoEl.title = ""; }
        } else {
          infoEl.textContent = "\u2713 Completado sin errores \u2014 " + total + "/" + total + " pasos" + _durSuffix;
          infoEl.style.color = "#16a34a";
          infoEl.style.fontWeight = "700";
          infoEl.title = "";
        }
      }
      if (progress) { progress.style.width = "100%"; progress.style.background = _fbCount > 0 ? "#f59e0b" : "#16a34a"; }
      if (addWaitEl) addWaitEl.style.display = "none";
      if (stopEl) stopEl.style.display = "none";
      if (replayEl) replayEl.style.display = "inline-flex";
      if (loopCountEl) loopCountEl.style.display = "inline-flex";
      if (loopReplayEl) loopReplayEl.style.display = "inline-flex";
    } else {
      // Idle / initial
      if (dot) { dot.style.background = "#2563eb"; dot.style.animation = "webmatic-pulse 1s infinite"; }
      if (infoEl) { infoEl.textContent = "Iniciando..."; infoEl.style.color = "#64748b"; infoEl.style.fontWeight = "400"; }
      if (stopEl) stopEl.style.display = "inline-flex";
      if (replayEl) replayEl.style.display = "none";
      if (addWaitEl) addWaitEl.style.display = "none";
      if (loopCountEl) loopCountEl.style.display = "none";
      if (loopReplayEl) loopReplayEl.style.display = "none";
    }
  }

  function removePlaybackFloating() {
    const el = document.getElementById(FLOATING_PLAYER_ID);
    if (el) el.parentNode.removeChild(el);
    // Only remove margin-top if the recorder floating btn isn't also showing
    if (!document.getElementById(FLOATING_BTN_ID)) {
      document.documentElement.style.marginTop = "";
    }
    // Restore sidebar now that the floating panel is gone
    store.dispatch({ type: contracts.ActionTypes.PANEL_SHOWN });
  }

  function createFloatingBtn(onStop) {
    if (document.getElementById(FLOATING_BTN_ID)) return;
    const btn = document.createElement("button");
    btn.id = FLOATING_BTN_ID;
    btn.setAttribute("aria-label", "Grabando — Clic para detener");
    const BTN_HEIGHT = 30;
    btn.style.cssText = [
      "all:initial",
      "display:flex",
      "align-items:center",
      "gap:8px",
      "position:fixed",
      "top:0",
      "right:80px",
      "height:" + BTN_HEIGHT + "px",
      "z-index:2147483646",
      "border:1px solid rgba(220,38,38,0.30)",
      "border-top:none",
      "background:rgba(255,255,255,0.97)",
      "backdrop-filter:blur(10px)",
      "color:#dc2626",
      "border-radius:0 0 10px 10px",
      "padding:0 14px",
      "font-size:12px",
      "font-weight:700",
      "font-family:system-ui,sans-serif",
      "letter-spacing:0.2px",
      "box-shadow:0 3px 10px rgba(220,38,38,0.18)",
      "cursor:pointer",
      "white-space:nowrap"
    ].join(";");
    // Push page content down so the button doesn't overlap anything
    document.documentElement.style.marginTop = BTN_HEIGHT + "px";

    const dot = document.createElement("span");
    dot.style.cssText = [
      "display:inline-block",
      "width:10px",
      "height:10px",
      "border-radius:999px",
      "background:#dc2626",
      "animation:webmatic-pulse 1s infinite",
      "flex-shrink:0"
    ].join(";");

    // inject keyframe only once
    if (!document.getElementById("webmatic-floating-keyframes")) {
      const style = document.createElement("style");
      style.id = "webmatic-floating-keyframes";
      style.textContent = "@keyframes webmatic-pulse{0%,100%{opacity:1}50%{opacity:0.35}}";
      document.head.appendChild(style);
    }

    const label = document.createElement("span");
    label.textContent = "Grabando — Clic para detener";

    btn.appendChild(dot);
    btn.appendChild(label);

    btn.addEventListener("click", () => {
      if (typeof onStop === "function") onStop();
    });

    document.documentElement.appendChild(btn);
  }

  function removeFloatingBtn() {
    const el = document.getElementById(FLOATING_BTN_ID);
    if (el) el.parentNode.removeChild(el);
    document.documentElement.style.marginTop = "";
  }

  function filterMacros(macros, query) {
    if (!query || !query.trim()) {
      return macros;
    }
    const q = query.trim().toLowerCase();
    const prefix = macros.filter((m) => m.name.toLowerCase().startsWith(q));
    if (prefix.length > 0) {
      return prefix;
    }
    return macros.filter((m) => m.name.toLowerCase().includes(q));
  }

  const RecorderClass = globalScope.WebMaticRecorder;

  function buildSelector(element) {
    if (RecorderClass && typeof RecorderClass.buildSelector === "function") {
      return RecorderClass.buildSelector(element);
    }
    // fallback (should not happen if scripts loaded correctly)
    if (!element || !(element instanceof Element)) return "";
    if (element.id) return `#${element.id}`;
    const tag = element.tagName.toLowerCase();
    const classes = Array.from(element.classList || []).slice(0, 2).join(".");
    return classes ? `${tag}.${classes}` : tag;
  }

  function normalizeCaptureTarget(element) {
    if (!(element instanceof Element)) return element;

    let target = element;
    const svgTag = (el) => {
      const t = String(el && el.tagName ? el.tagName : "").toLowerCase();
      return t === "path" || t === "svg" || t === "g" || t === "use";
    };

    if (svgTag(target)) {
      const promoted = target.closest("button, a[href], [role='button'], [role='link'], input, textarea, select, label, [aria-label]");
      if (promoted instanceof Element) {
        target = promoted;
      } else {
        let walker = target.parentElement;
        while (walker && svgTag(walker)) walker = walker.parentElement;
        if (walker instanceof Element) target = walker;
      }
    }

    return target;
  }

  function _isInteractableCaptureTarget(el) {
    try {
      if (!(el instanceof Element)) return false;
      if (el instanceof HTMLElement && el.hidden) return false;
      const view = (el.ownerDocument && el.ownerDocument.defaultView) || window;
      const cs = view && typeof view.getComputedStyle === "function"
        ? view.getComputedStyle(el)
        : null;
      if (cs && (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none")) return false;
      if (el.getClientRects && el.getClientRects().length === 0) return false;
      return true;
    } catch (_e) {
      return false;
    }
  }

  function _isTextEntryCaptureTarget(el) {
    if (el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLInputElement) {
      const t = String(el.type || "text").toLowerCase();
      return t === "" || t === "text" || t === "search" || t === "email" || t === "number" || t === "tel" || t === "url";
    }
    return false;
  }

  function _shouldPreferClickOverCheck(originalTarget, checkTarget) {
    if (!(originalTarget instanceof Element) || !(checkTarget instanceof HTMLInputElement)) return false;

    // If user directly clicks the control, keep check semantics.
    if (originalTarget === checkTarget) return false;

    const type = String(checkTarget.type || "").toLowerCase();
    if (type !== "checkbox" && type !== "radio") return false;

    const normalized = normalizeCaptureTarget(originalTarget);
    const explicitClickable = normalized instanceof Element
      && !!normalized.closest("a[href], button, [role='button'], [role='link']");
    const checkIsHidden = !_isInteractableCaptureTarget(checkTarget);

    // For custom galleries/carousels (visible links controlling hidden radios),
    // recording click is more robust than recording check on hidden input.
    return explicitClickable && checkIsHidden;
  }

  function _contextKeyFromUrl(rawUrl) {
    try {
      const u = new URL(String(rawUrl || ""), window.location.href);
      const host = String(u.host || "").toLowerCase();
      const path = String(u.pathname || "").replace(/\/+$/, "") || "/";
      return `${host}${path}`;
    } catch (_e) {
      return "";
    }
  }

  function _resolveStepBlockKey(step) {
    if (!step || typeof step !== "object") return recorderRuntime.activeBlockKey || _contextKeyFromUrl(window.location.href);
    if (step.type === "navigate") return _contextKeyFromUrl(step.url || window.location.href);
    if (step.type === "open_tab" || step.type === "switch_tab") {
      const candidate = step.url || window.location.href;
      return _contextKeyFromUrl(candidate);
    }
    if (step.type === "close_tab") return recorderRuntime.activeBlockKey || _contextKeyFromUrl(window.location.href);
    return recorderRuntime.activeBlockKey || _contextKeyFromUrl(window.location.href);
  }

  // ── Auto wait_for injection ────────────────────────────────────────────────
  // When the user clicks something and the NEXT element they interact with was
  // not present in the DOM at click time, inject a wait_for before that step.
  // This covers buttons that open modals, dropdowns, or sections with delay.
  const _clickSnapshot = {
    ts: 0,
    selector: "",
    missingAtClick: new Set()
  };

  function _snapshotMissingAfterClick(clickedSelector) {
    _clickSnapshot.ts = Date.now();
    _clickSnapshot.selector = clickedSelector;
    _clickSnapshot.missingAtClick.clear();
  }

  function _checkAndInjectWaitFor(targetSelector, emitStep) {
    if (!_clickSnapshot.ts || !targetSelector) return;
    const emit = typeof emitStep === "function" ? emitStep : captureStep;
    const elapsed = Date.now() - _clickSnapshot.ts;
    // Only relevant if we click then interact within 30s
    if (elapsed > 30000) { _clickSnapshot.ts = 0; return; }
    // Check if the target element was absent right after the click.
    // We do it now (before the interaction fires) — if it exists now but
    // a MutationObserver hasn't flagged it as "was missing", we rely on
    // _clickSnapshot.missingAtClick which was populated by the observer.
    if (_clickSnapshot.missingAtClick.has(targetSelector)) {
      _clickSnapshot.missingAtClick.delete(targetSelector);
      _clickSnapshot.ts = 0;
      emit({ type: "wait_for", selector: targetSelector, timeout: 10000 });
    }
  }

  let _postClickObserver = null;
  function _startPostClickObserver(clickedSelector) {
    if (_postClickObserver) { _postClickObserver.disconnect(); _postClickObserver = null; }
    _snapshotMissingAfterClick(clickedSelector);

    // Collect selectors for all currently-present interactive elements.
    const _presentNow = new Set();
    try {
      document.querySelectorAll("input,select,textarea,button,[contenteditable]").forEach((el) => {
        const id = el.id ? `#${el.id}` : "";
        if (id) _presentNow.add(id);
      });
    } catch (_) {}

    _postClickObserver = new MutationObserver(() => {
      // When new elements appear, mark their selectors as "were missing at click"
      try {
        document.querySelectorAll("input,select,textarea,button,[contenteditable]").forEach((el) => {
          if (!el.id) return;
          const id = `#${el.id}`;
          if (!_presentNow.has(id)) {
            _clickSnapshot.missingAtClick.add(id);
            _presentNow.add(id);
          }
        });
      } catch (_) {}
    });
    try {
      _postClickObserver.observe(document.body || document.documentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden", "display"]
      });
    } catch (_) {}

    // Stop observing after 15s regardless
    setTimeout(() => {
      if (_postClickObserver) { _postClickObserver.disconnect(); _postClickObserver = null; }
    }, 15000);
  }

  function captureStep(step) {
    const blockKey = _resolveStepBlockKey(step);
    const stamped = Object.assign({ _ts: Date.now() }, step);
    if (blockKey) {
      stamped._wmBlockKey = blockKey;
      const prevKey = recorderRuntime.activeBlockKey || "";
      if (!prevKey || prevKey !== blockKey) {
        stamped._wmBlockStart = true;
      }
      recorderRuntime.activeBlockKey = blockKey;
      recorderRuntime.seenBlockKeys.add(blockKey);
    }
    if (step && step.type === "close_tab") {
      stamped._wmBlockEnd = true;
      recorderRuntime.activeBlockKey = "";
    }
    chrome.runtime.sendMessage({ type: "RECORD_STEP", step: stamped }, () => { void chrome.runtime.lastError; });
    store.dispatch({ type: contracts.ActionTypes.STEP_CAPTURED, payload: stamped });
  }

  function startRecorderSession() {
    if (recorderRuntime.cleanup) {
      recorderRuntime.cleanup();
    }

    if (!recorderRuntime.recordingStartUrl) {
      recorderRuntime.recordingStartUrl = window.location.href;
    }

    recorderRuntime.activeBlockKey = _contextKeyFromUrl(window.location.href);
    recorderRuntime.seenBlockKeys = new Set(recorderRuntime.activeBlockKey ? [recorderRuntime.activeBlockKey] : []);

    // Capture current URL as first step (only if not already the last step)
    const currentSteps = store.getState().draft.steps;
    const lastStep = currentSteps[currentSteps.length - 1];
    if (!lastStep || lastStep.type !== "navigate" || lastStep.url !== window.location.href) {
      captureStep({ type: "navigate", url: window.location.href });
    }

    const _lastCheckChangeAt = new WeakMap();
    const _preferClickOnCheckTargetAt = new WeakMap();

    const onClick = (event) => {
      let target = event.target;
      if (!(target instanceof Element) || target.closest("#webmatic-panel-root") || target.closest("#webmatic-floating-recorder-global") || target.closest("#webmatic-floating-player-global")) {
        return;
      }
      let checkTarget = target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio")
        ? target
        : target.closest && target.closest('input[type="checkbox"], input[type="radio"]');
      if (!(checkTarget instanceof HTMLInputElement)) {
        const lbl = target instanceof HTMLLabelElement ? target : (target.closest && target.closest("label[for]"));
        if (lbl && lbl.htmlFor) {
          const linked = (target.ownerDocument || document).getElementById(lbl.htmlFor);
          if (linked instanceof HTMLInputElement && (linked.type === "checkbox" || linked.type === "radio")) {
            checkTarget = linked;
          }
        }
      }
      if (checkTarget instanceof HTMLInputElement) {
        if (_shouldPreferClickOverCheck(target, checkTarget)) {
          _preferClickOnCheckTargetAt.set(checkTarget, Date.now());
          // Fall through and capture clickable target below.
        } else {
        // Some legacy UIs toggle checkbox/radio without emitting change reliably.
        // Capture from click as a fallback, but skip if change was already captured.
        setTimeout(() => {
          const lastTs = _lastCheckChangeAt.get(checkTarget) || 0;
          if (Date.now() - lastTs < 120) return;
          flashElement(checkTarget);
          captureStep({ type: "check", selector: buildSelector(checkTarget), checked: checkTarget.type === "radio" ? true : checkTarget.checked });
        }, 30);
        return;
        }
      }
      // For <img> and imageless clicks inside <a>, bubble up to the anchor
      const tag = target.tagName.toLowerCase();
      if (tag === "img" || (tag === "input" && target.type === "image" && !target.id)) {
        const anchor = target.closest("a[href]");
        if (anchor) target = anchor;
      }
      // If clicking a link that opens a new tab, record navigate instead of click
      // (the player can't follow a new tab; navigate keeps the flow in the same tab)
      const navAnchor = target.tagName.toLowerCase() === "a" ? target : target.closest("a[href]");
      if (navAnchor && navAnchor.getAttribute("target") === "_blank") {
        try {
          const navUrl = new URL(navAnchor.getAttribute("href") || "", window.location.href).href;
          if (navUrl && !navUrl.startsWith("javascript:")) {
            flashElement(navAnchor);
            captureStep({ type: "navigate", url: navUrl });
            return;
          }
        } catch (_e) {}
      }
      target = normalizeCaptureTarget(target);
      flashElement(target);
      const clickSel = buildSelector(target);
      // If this click is on an element that wasn't present at the previous click,
      // inject a wait_for so playback waits for it to appear.
      _checkAndInjectWaitFor(target.id ? `#${target.id}` : clickSel);
      captureStep({ type: "click", selector: clickSel });
      _startPostClickObserver(clickSel);
    };

    const onChange = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLSelectElement)) {
        return;
      }
      if (target.closest("#webmatic-panel-root") || target.closest("#webmatic-floating-recorder-global") || target.closest("#webmatic-floating-player-global")) {
        return;
      }
      // Skip readonly and disabled fields — value can't be set by user
      if (target.readOnly || target.disabled) return;
      flashElement(target);
      // For checkboxes capture the boolean checked state, not the raw .value attr
      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        const preferTs = _preferClickOnCheckTargetAt.get(target) || 0;
        if (Date.now() - preferTs < 600) return;
        if (!_isInteractableCaptureTarget(target)) return;
        _lastCheckChangeAt.set(target, Date.now());
        captureStep({ type: "check", selector: buildSelector(target), checked: target.checked });
        return;
      }
      // Radio buttons: record as check with checked:true (the selected option)
      if (target instanceof HTMLInputElement && target.type === "radio") {
        const preferTs = _preferClickOnCheckTargetAt.get(target) || 0;
        if (Date.now() - preferTs < 600) return;
        if (!_isInteractableCaptureTarget(target)) return;
        _lastCheckChangeAt.set(target, Date.now());
        captureStep({ type: "check", selector: buildSelector(target), checked: true });
        return;
      }
      if (target instanceof HTMLSelectElement) {
        const selSel = buildSelector(target);
        _checkAndInjectWaitFor(target.id ? `#${target.id}` : selSel);
        captureStep({ type: "choose_option", selector: selSel, value: target.value });
        return;
      }
      // Dynamic copy/paste: if pasted value matches last copied text, use variable reference
      const rawValue = target.value;
      let recordedValue = rawValue;
      if (
        recorderRuntime.lastCopiedText !== null &&
        recorderRuntime.lastCopiedVar !== null &&
        rawValue.trim() === recorderRuntime.lastCopiedText
      ) {
        recordedValue = `{{!${recorderRuntime.lastCopiedVar}}}`;
      }
      const inpSel = buildSelector(target);
      if (_isSensitiveInputTarget(target, inpSel)) return;
      _checkAndInjectWaitFor(target.id ? `#${target.id}` : inpSel);
      captureStep({ type: "input", selector: inpSel, value: recordedValue });
    };

    const onKeydown = (event) => {
      const target = event.target;
      if (target instanceof Element && (target.closest("#webmatic-panel-root") || target.closest("#webmatic-floating-recorder-global") || target.closest("#webmatic-floating-player-global"))) {
        return;
      }
      // Special navigation keys → capture as key step
      if (["Enter", "Tab", "Escape"].includes(event.key)) {
        if (target instanceof Element) flashElement(target);
        captureStep({ type: "key", key: event.key });
        return;
      }
      // Printable chars → capture as text step; store will merge via Recorder.mergeKeySteps
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        if (_isTextEntryCaptureTarget(target)) return;
        const selector = target instanceof Element ? buildSelector(target) : "";
        if (target instanceof Element && target.id) {
          _checkAndInjectWaitFor(`#${target.id}`);
        } else if (selector) {
          _checkAndInjectWaitFor(selector);
        }
        const currentSteps = store.getState().draft.steps;
        const lastStep = currentSteps[currentSteps.length - 1];
        if (lastStep && lastStep.type === "text" && lastStep.selector === selector) {
          // merge into last step
          captureStep({ type: "text", selector, value: lastStep.value + event.key, _merge: true });
        } else {
          captureStep({ type: "text", selector, value: event.key });
        }
      }
    };

    const _resolveDropTarget = (el) => {
      if (!(el instanceof Element)) return null;
      const dz = el.closest && el.closest(".drag-zone,[ondrop],[data-dropzone],[role='listbox']");
      return dz || normalizeCaptureTarget(el);
    };

    const onDragStart = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("#webmatic-panel-root") || target.closest("#webmatic-floating-recorder-global") || target.closest("#webmatic-floating-player-global")) return;
      recorderRuntime.dragSourceSelector = buildSelector(normalizeCaptureTarget(target)) || "";
    };

    const onDrop = (event) => {
      const src = recorderRuntime.dragSourceSelector || "";
      recorderRuntime.dragSourceSelector = "";
      if (!src) return;
      const rawTarget = event.target;
      if (!(rawTarget instanceof Element)) return;
      if (rawTarget.closest("#webmatic-panel-root") || rawTarget.closest("#webmatic-floating-recorder-global") || rawTarget.closest("#webmatic-floating-player-global")) return;
      const dropTarget = _resolveDropTarget(rawTarget);
      if (!(dropTarget instanceof Element)) return;
      const to = buildSelector(dropTarget) || "";
      if (!to || to === src) return;
      flashElement(dropTarget);
      captureStep({ type: "drag_drop", from: src, to });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("drop", onDrop, true);

    // ── Copy listener: record EXTRACT step + set up variable for paste substitution ──
    const onCopy = (event) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const copiedText = sel.toString().trim();
      if (!copiedText) return;

      // Walk up from anchor node to find a meaningful block element
      function resolveExtractionTarget(node) {
        if (!node) return null;
        const INLINE = /^(A|ABBR|B|BDI|BDO|BIG|BR|CITE|CODE|DFN|EM|I|KBD|MARK|Q|S|SAMP|SMALL|SPAN|STRONG|SUB|SUP|TIME|TT|U|VAR)$/;
        const BLOCK = /^(TD|TH|LI|P|DIV|BLOCKQUOTE|PRE|H[1-6]|DT|DD|ARTICLE|SECTION|ASIDE|HEADER|FOOTER|MAIN|NAV|FIGURE|FIGCAPTION|SUMMARY|DETAILS)$/;
        const BAD  = /^(TABLE|TBODY|THEAD|TFOOT|TR|COLGROUP|COL|UL|OL|DL|FORM|FIELDSET|BODY|HTML)$/;
        let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        while (el && el.tagName) {
          const tag = el.tagName.toUpperCase();
          if (BAD.test(tag)) return null;
          if (BLOCK.test(tag) || !INLINE.test(tag)) return el;
          el = el.parentElement;
        }
        return null;
      }

      const srcEl = resolveExtractionTarget(sel.anchorNode);
      if (!srcEl || srcEl.closest("#webmatic-panel-root")) return;

      recorderRuntime.varCounter += 1;
      const varName = `VAR${recorderRuntime.varCounter}`;
      recorderRuntime.lastCopiedText = copiedText;
      recorderRuntime.lastCopiedVar = varName;

      flashElement(srcEl);
      captureStep({ type: "extract", selector: buildSelector(srcEl), variable: varName });
    };

    document.addEventListener("copy", onCopy, true);

    // ── contenteditable input (debounced 400ms) ──────────────────────────────
    const onContentEditableInput = (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.isContentEditable) return;
      if (target.closest("#webmatic-panel-root") || target.closest("#webmatic-floating-recorder-global") || target.closest("#webmatic-floating-player-global")) return;
      clearTimeout(recorderRuntime._ceTimer);
      recorderRuntime._ceTimer = setTimeout(() => {
        const val = (target.innerText || target.textContent || "").trim();
        if (_isSensitiveInputTarget(target, buildSelector(target))) return;
        flashElement(target);
        captureStep({ type: "input", selector: buildSelector(target), value: val });
      }, 400);
    };
    document.addEventListener("input", onContentEditableInput, true);

    // ── dblclick ─────────────────────────────────────────────────────────────
    const onDblClick = (event) => {
      let target = event.target;
      if (!(target instanceof Element) || target.closest("#webmatic-panel-root") || target.closest("#webmatic-floating-recorder-global") || target.closest("#webmatic-floating-player-global")) return;
      const tagDbl = target.tagName.toLowerCase();
      if (tagDbl === "img" || (tagDbl === "input" && target.type === "image" && !target.id)) {
        const anchor = target.closest("a[href]");
        if (anchor) target = anchor;
      }
      target = normalizeCaptureTarget(target);
      flashElement(target);
      captureStep({ type: "dblclick", selector: buildSelector(target) });
    };
    document.addEventListener("dblclick", onDblClick, true);

    // ── hover: solo graba si el hover despliega contenido nuevo (dropdown/menu/tooltip) ─
    let _hoverEl   = null;
    let _hoverObs  = null;
    let _hoverSeen = false;
    const onMouseOver = (event) => {
      const t = event.target;
      if (!(t instanceof Element)) return;
      if (t === _hoverEl) return;
      if (t.closest("#webmatic-panel-root") || t.closest("#webmatic-floating-recorder-global") || t.closest("#webmatic-floating-player-global")) return;
      clearTimeout(recorderRuntime._hoverTimer);
      if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
      _hoverSeen = false;
      _hoverEl = t;
      try {
        const _root = document.body || document.documentElement;
        _hoverObs = new MutationObserver((muts) => {
          if (_hoverSeen) return;
          for (const m of muts) {
            if (m.type === "childList") {
              for (const n of m.addedNodes) {
                if (n instanceof Element && n.offsetWidth > 0 && n.offsetHeight > 0) { _hoverSeen = true; return; }
              }
            } else if (m.attributeName === "aria-expanded" && m.target.getAttribute("aria-expanded") === "true") {
              _hoverSeen = true; return;
            }
          }
        });
        _hoverObs.observe(_root, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
      } catch (_) {}
      recorderRuntime._hoverTimer = setTimeout(() => {
        if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
        if (_hoverEl !== t || !_hoverSeen) return;
        flashElement(t);
        captureStep({ type: "hover", selector: buildSelector(t) });
      }, 800);
    };
    document.addEventListener("mouseover", onMouseOver, true);

    // ── scroll_to: solo graba si ocurre en un contenedor emergente (dropdown/listbox/menu) ─
    function _isMenuScroll(el) {
      if (!(el instanceof Element)) return false;
      if (el.tagName.toLowerCase() === "select") return true;
      const role = (el.getAttribute("role") || "").toLowerCase();
      if (["listbox","menu","menubar","tree","combobox","grid","treegrid"].includes(role)) return true;
      if (el.closest("[role='listbox'],[role='menu'],[role='combobox'],[role='tree']")) return true;
      try {
        const cs = window.getComputedStyle(el);
        const pos = cs.position; const ov = cs.overflowY;
        if ((pos === "absolute" || pos === "fixed") && (ov === "auto" || ov === "scroll")) return true;
      } catch (_) {}
      return false;
    }
    const onScroll = (e) => {
      const scrollEl = e.target instanceof Element ? e.target : null;
      if (!scrollEl || !_isMenuScroll(scrollEl)) return;
      if (scrollEl.closest("#webmatic-panel-root") || scrollEl.closest("#webmatic-floating-recorder-global") || scrollEl.closest("#webmatic-floating-player-global")) return;
      clearTimeout(recorderRuntime._scrollTimer);
      recorderRuntime._scrollTimer = setTimeout(() => {
        captureStep({ type: "scroll_to", selector: buildSelector(scrollEl) });
      }, 900);
    };
    document.addEventListener("scroll", onScroll, true);

    // ── SPA navigation: patch history API to capture pushState/replaceState ──
    const _origPushState    = history.pushState.bind(history);
    const _origReplaceState = history.replaceState.bind(history);
    const _captureSpaNav = (rawUrl) => {
      try {
        const url = new URL(String(rawUrl || ""), window.location.href).href;
        const st  = store.getState().draft.steps;
        const last = st[st.length - 1];
        if (!last || last.type !== "navigate" || last.url !== url) {
          captureStep({ type: "navigate", url });
        }
      } catch (e) { /* malformed URL — skip */ }
    };
    history.pushState = function(state, title, url) {
      _origPushState(state, title, url);
      if (url != null) _captureSpaNav(url);
    };
    history.replaceState = function(state, title, url) {
      _origReplaceState(state, title, url);
      if (url != null) _captureSpaNav(url);
    };
    const _onPopState = () => _captureSpaNav(window.location.href);
    window.addEventListener("popstate", _onPopState);

    recorderRuntime.cleanup = () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("keydown", onKeydown, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("drop", onDrop, true);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("input", onContentEditableInput, true);
      document.removeEventListener("dblclick", onDblClick, true);
      document.removeEventListener("mouseover", onMouseOver, true);
      window.removeEventListener("scroll", onScroll, true);
      history.pushState    = _origPushState;
      history.replaceState = _origReplaceState;
      window.removeEventListener("popstate", _onPopState);
      clearTimeout(recorderRuntime._ceTimer);
      clearTimeout(recorderRuntime._hoverTimer);
      clearTimeout(recorderRuntime._scrollTimer);
      recorderRuntime.lastCopiedText = null;
      recorderRuntime.lastCopiedVar  = null;
      recorderRuntime._ceTimer       = null;
      recorderRuntime._hoverTimer    = null;
      recorderRuntime._scrollTimer   = null;
      recorderRuntime.dragSourceSelector = "";
      recorderRuntime.cleanup        = null;
    };
  }

  function stopRecorderSession() {
    if (recorderRuntime.cleanup) {
      recorderRuntime.cleanup();
    }
  }

  const INLINE_REC_PANEL_ID = "webmatic-inline-rec-panel";
  let _activeInlineStop = null; // función _stop() de la grabación inline activa
  let _pickerActive = false;

  /**
   * Activa el picker visual: oculta el panel, espera que el usuario haga clic
   * en cualquier elemento de la página (en esta pestaña u otras), y luego
   * restaura el panel y llama onPicked(selector).
   */
  function startElementPicker(fieldName, onPicked) {
    if (_pickerActive) return;
    _pickerActive = true;

    // Minimizar panel
    const panelWasVisible = store.getState().ui.panelVisible;
    if (panelWasVisible) {
      store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
    }

    // Banner flotante
    const banner = document.createElement("div");
    banner.id = "webmatic-picker-banner";
    banner.style.cssText = [
      "all:initial", "position:fixed", "top:12px", "left:50%", "transform:translateX(-50%)",
      "z-index:2147483647", "background:rgba(14,165,233,0.97)", "color:#fff",
      "border-radius:10px", "padding:10px 20px",
      "font-family:system-ui,sans-serif", "font-size:13px", "font-weight:700",
      "box-shadow:0 4px 20px rgba(0,0,0,0.3)", "pointer-events:none", "white-space:nowrap",
      "text-align:center"
    ].join(";");
    banner.textContent = "\uD83C\uDFAF Hac\u00e9 clic en el elemento que quer\u00e9s  \u00B7  ESC para cancelar";
    document.documentElement.appendChild(banner);

    // Estilos de resaltado
    const styleEl = document.createElement("style");
    styleEl.id = "webmatic-picker-hl-style";
    styleEl.textContent = ".wm-picker-hl{outline:3px solid #0ea5e9 !important;outline-offset:2px !important;cursor:crosshair !important;background-color:rgba(14,165,233,0.10) !important;}";
    document.head.appendChild(styleEl);

    let highlighted = null;

    function _over(e) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.id === "webmatic-picker-banner" || t.closest("#webmatic-panel-root")) return;
      if (highlighted && highlighted !== t) highlighted.classList.remove("wm-picker-hl");
      t.classList.add("wm-picker-hl");
      highlighted = t;
    }

    function _cleanup() {
      _pickerActive = false;
      document.removeEventListener("mouseover", _over, true);
      document.removeEventListener("click", _pick, true);
      document.removeEventListener("keydown", _esc, true);
      if (highlighted) { highlighted.classList.remove("wm-picker-hl"); highlighted = null; }
      const b = document.getElementById("webmatic-picker-banner");
      if (b && b.parentNode) b.parentNode.removeChild(b);
      const s = document.getElementById("webmatic-picker-hl-style");
      if (s && s.parentNode) s.parentNode.removeChild(s);
      // Restaurar panel
      if (panelWasVisible && !store.getState().ui.panelVisible) {
        store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
      }
    }

    function _pick(e) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.id === "webmatic-picker-banner" || t.closest("#webmatic-panel-root")) return;
      e.preventDefault();
      e.stopPropagation();
      const selector = buildSelector(t);
      _cleanup();
      onPicked(selector);
    }

    function _esc(e) {
      if (e.key === "Escape") { e.preventDefault(); _cleanup(); }
    }

    document.addEventListener("mouseover", _over, true);
    document.addEventListener("click", _pick, true);
    document.addEventListener("keydown", _esc, true);
  }


  function startInlineRecording(onDone, _priorStepCount, _isReinjection) {
    // Remove any leftover panel
    const oldPanel = document.getElementById(INLINE_REC_PANEL_ID);
    if (oldPanel && oldPanel.parentNode) oldPanel.parentNode.removeChild(oldPanel);

    // Ocultar el panel para liberar la página durante la grabación
    const _wasVisible = store.getState().ui.panelVisible;
    if (_wasVisible) {
      store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
    }

    const buffer = [];
    const _priorCount = (_priorStepCount || 0); // pasos acumulados en páginas anteriores
    let _ceTimer = null;
    let _hoverEl = null, _hoverObs = null, _hoverSeen = false, _hoverTimer = null;
    let _scrollTimer = null;
    let _inlineDragSource = "";
    let lastCopiedText = null, lastCopiedVar = null, varCounter = 0;
    const _lastInlineCheckChangeAt = new WeakMap();
    const _preferInlineClickOnCheckTargetAt = new WeakMap();

    function _updateCount() {
      const countEl = document.getElementById(INLINE_REC_PANEL_ID + "-count");
      if (countEl) {
        const total = _priorCount + buffer.length;
        countEl.textContent = total + (total === 1 ? " paso" : " pasos");
      }
    }

    function addStep(step) {
      const fullStep = Object.assign({ _ts: Date.now() }, step);
      buffer.push(fullStep);
      // Persistir en background para sobrevivir navegaciones
      try { chrome.runtime.sendMessage({ type: "INLINE_RECORD_STEP", step: fullStep }, () => { void chrome.runtime.lastError; }); } catch (_) {}
      _updateCount();
    }

    // ── Event handlers (same logic as startRecorderSession but writing to buffer) ──
    const _onClick = (e) => {
      let t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID) ||
          t.closest("#webmatic-floating-recorder-global") || t.closest("#webmatic-floating-player-global")) return;
      let checkTarget = t instanceof HTMLInputElement && (t.type === "checkbox" || t.type === "radio")
        ? t
        : t.closest && t.closest('input[type="checkbox"], input[type="radio"]');
      if (!(checkTarget instanceof HTMLInputElement)) {
        const lbl = t instanceof HTMLLabelElement ? t : (t.closest && t.closest("label[for]"));
        if (lbl && lbl.htmlFor) {
          const linked = (t.ownerDocument || document).getElementById(lbl.htmlFor);
          if (linked instanceof HTMLInputElement && (linked.type === "checkbox" || linked.type === "radio")) {
            checkTarget = linked;
          }
        }
      }
      if (checkTarget instanceof HTMLInputElement) {
        if (_shouldPreferClickOverCheck(t, checkTarget)) {
          _preferInlineClickOnCheckTargetAt.set(checkTarget, Date.now());
          // Fall through and capture clickable target below.
        } else {
        setTimeout(() => {
          const lastTs = _lastInlineCheckChangeAt.get(checkTarget) || 0;
          if (Date.now() - lastTs < 120) return;
          flashElement(checkTarget);
          addStep({ type: "check", selector: buildSelector(checkTarget), checked: checkTarget.type === "radio" ? true : checkTarget.checked });
        }, 30);
        return;
        }
      }
      const tag = t.tagName.toLowerCase();
      if (tag === "img" || (tag === "input" && t.type === "image" && !t.id)) {
        const anchor = t.closest("a[href]"); if (anchor) t = anchor;
      }
      // Si el enlace abre una pestaña nueva, grabar navigate en lugar de click
      const navAnchor = t.tagName.toLowerCase() === "a" ? t : t.closest("a[href]");
      if (navAnchor && navAnchor.getAttribute("target") === "_blank") {
        try {
          const navUrl = new URL(navAnchor.getAttribute("href") || "", window.location.href).href;
          if (navUrl && !navUrl.startsWith("javascript:")) {
            flashElement(navAnchor);
            addStep({ type: "navigate", url: navUrl });
            return;
          }
        } catch (_e) {}
      }
      t = normalizeCaptureTarget(t);
      flashElement(t);
      const clickSel = buildSelector(t);
      _checkAndInjectWaitFor(t.id ? `#${t.id}` : clickSel, addStep);
      addStep({ type: "click", selector: clickSel });
      _startPostClickObserver(clickSel);
    };

    const _onChange = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement) && !(t instanceof HTMLSelectElement)) return;
      if (t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID)) return;
      if (t.readOnly || t.disabled) return;
      flashElement(t);
      if (t instanceof HTMLInputElement && t.type === "checkbox") {
        const preferTs = _preferInlineClickOnCheckTargetAt.get(t) || 0;
        if (Date.now() - preferTs < 600) return;
        if (!_isInteractableCaptureTarget(t)) return;
        _lastInlineCheckChangeAt.set(t, Date.now());
        addStep({ type: "check", selector: buildSelector(t), checked: t.checked });
        return;
      }
      if (t instanceof HTMLInputElement && t.type === "radio") {
        const preferTs = _preferInlineClickOnCheckTargetAt.get(t) || 0;
        if (Date.now() - preferTs < 600) return;
        if (!_isInteractableCaptureTarget(t)) return;
        _lastInlineCheckChangeAt.set(t, Date.now());
        addStep({ type: "check", selector: buildSelector(t), checked: true });
        return;
      }
      if (t instanceof HTMLSelectElement) {
        const sel = buildSelector(t);
        _checkAndInjectWaitFor(t.id ? `#${t.id}` : sel, addStep);
        addStep({ type: "choose_option", selector: sel, value: t.value });
        return;
      }
      const raw = t.value;
      const val = (lastCopiedText !== null && lastCopiedVar !== null && raw.trim() === lastCopiedText)
        ? `{{!${lastCopiedVar}}}` : raw;
      const sel = buildSelector(t);
      if (_isSensitiveInputTarget(t, sel)) return;
      _checkAndInjectWaitFor(t.id ? `#${t.id}` : sel, addStep);
      addStep({ type: "input", selector: sel, value: val });
    };

    const _onKeydown = (e) => {
      const t = e.target;
      if (t instanceof Element && (t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID))) return;
      if (["Enter", "Tab", "Escape"].includes(e.key)) {
        if (t instanceof Element) flashElement(t);
        addStep({ type: "key", key: e.key }); return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        if (_isTextEntryCaptureTarget(t)) return;
        const sel = t instanceof Element ? buildSelector(t) : "";
        if (t instanceof Element && t.id) {
          _checkAndInjectWaitFor(`#${t.id}`, addStep);
        } else if (sel) {
          _checkAndInjectWaitFor(sel, addStep);
        }
        const last = buffer[buffer.length - 1];
        if (last && last.type === "text" && last.selector === sel) {
          last.value = (last.value || "") + e.key; // merge text
          // Actualizar el último paso en background con el valor acumulado
          try { chrome.runtime.sendMessage({ type: "INLINE_RECORD_STEP", step: { _merge: true, type: "text", selector: sel, value: last.value } }, () => { void chrome.runtime.lastError; }); } catch (_) {}
          _updateCount();
        } else {
          addStep({ type: "text", selector: sel, value: e.key });
        }
      }
    };

    const _resolveInlineDropTarget = (el) => {
      if (!(el instanceof Element)) return null;
      const dz = el.closest && el.closest(".drag-zone,[ondrop],[data-dropzone],[role='listbox']");
      return dz || normalizeCaptureTarget(el);
    };

    const _onDragStart = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID)) return;
      _inlineDragSource = buildSelector(normalizeCaptureTarget(t)) || "";
    };

    const _onDrop = (e) => {
      const src = _inlineDragSource || "";
      _inlineDragSource = "";
      if (!src) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID)) return;
      const dropTarget = _resolveInlineDropTarget(t);
      if (!(dropTarget instanceof Element)) return;
      const to = buildSelector(dropTarget) || "";
      if (!to || to === src) return;
      flashElement(dropTarget);
      addStep({ type: "drag_drop", from: src, to });
    };

    const _onDblClick = (e) => {
      let t = e.target;
      if (!(t instanceof Element) || t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID)) return;
      const tag = t.tagName.toLowerCase();
      if (tag === "img" || (tag === "input" && t.type === "image" && !t.id)) {
        const anchor = t.closest("a[href]"); if (anchor) t = anchor;
      }
      t = normalizeCaptureTarget(t);
      flashElement(t);
      addStep({ type: "dblclick", selector: buildSelector(t) });
    };

    const _onCopy = (e) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const txt = sel.toString().trim(); if (!txt) return;
      const INLINE = /^(A|ABBR|B|CITE|CODE|EM|I|KBD|MARK|Q|S|SAMP|SMALL|SPAN|STRONG|SUB|SUP|U|VAR)$/;
      const BLOCK  = /^(TD|TH|LI|P|DIV|BLOCKQUOTE|PRE|H[1-6]|DT|DD|ARTICLE|SECTION|ASIDE|HEADER|FOOTER|MAIN)$/;
      const BAD    = /^(TABLE|TBODY|THEAD|TFOOT|TR|UL|OL|DL|FORM|BODY|HTML)$/;
      let el = sel.anchorNode && sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : sel.anchorNode;
      while (el && el.tagName) {
        const tag = el.tagName.toUpperCase();
        if (BAD.test(tag)) { el = null; break; }
        if (BLOCK.test(tag) || !INLINE.test(tag)) break;
        el = el.parentElement;
      }
      if (!el || !(el instanceof Element) || el.closest("#webmatic-panel-root")) return;
      varCounter++; const vn = `VAR${varCounter}`;
      lastCopiedText = txt; lastCopiedVar = vn;
      flashElement(el); addStep({ type: "extract", selector: buildSelector(el), variable: vn });
    };

    const _onCeInput = (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.isContentEditable) return;
      if (t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID)) return;
      clearTimeout(_ceTimer);
      _ceTimer = setTimeout(() => {
        const val = (t.innerText || t.textContent || "").trim();
        if (_isSensitiveInputTarget(t, buildSelector(t))) return;
        flashElement(t); addStep({ type: "input", selector: buildSelector(t), value: val });
      }, 400);
    };

    const _onMouseOver = (e) => {
      const t = e.target;
      if (!(t instanceof Element) || t === _hoverEl) return;
      if (t.closest("#webmatic-panel-root") || t.closest("#" + INLINE_REC_PANEL_ID)) return;
      clearTimeout(_hoverTimer);
      if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
      _hoverSeen = false; _hoverEl = t;
      try {
        _hoverObs = new MutationObserver((muts) => {
          if (_hoverSeen) return;
          for (const m of muts) {
            if (m.type === "childList") {
              for (const n of m.addedNodes) {
                if (n instanceof Element && n.offsetWidth > 0 && n.offsetHeight > 0) { _hoverSeen = true; return; }
              }
            } else if (m.attributeName === "aria-expanded" && m.target.getAttribute("aria-expanded") === "true") {
              _hoverSeen = true; return;
            }
          }
        });
        _hoverObs.observe(document.body || document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
      } catch (_) {}
      _hoverTimer = setTimeout(() => {
        if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
        if (_hoverEl !== t || !_hoverSeen) return;
        flashElement(t); addStep({ type: "hover", selector: buildSelector(t) });
      }, 800);
    };

    const _onScroll = (e) => {
      const scrollEl = e.target instanceof Element ? e.target : null;
      if (!scrollEl) return;
      const role = (scrollEl.getAttribute("role") || "").toLowerCase();
      const isMenu = scrollEl.tagName.toLowerCase() === "select" ||
        ["listbox","menu","combobox","tree"].includes(role) ||
        scrollEl.closest("[role='listbox'],[role='menu'],[role='combobox'],[role='tree']");
      if (!isMenu) return;
      if (scrollEl.closest("#webmatic-panel-root") || scrollEl.closest("#" + INLINE_REC_PANEL_ID)) return;
      clearTimeout(_scrollTimer);
      _scrollTimer = setTimeout(() => { addStep({ type: "scroll_to", selector: buildSelector(scrollEl) }); }, 900);
    };

    document.addEventListener("click",     _onClick,    true);
    document.addEventListener("change",    _onChange,   true);
    document.addEventListener("keydown",   _onKeydown,  true);
    document.addEventListener("dblclick",  _onDblClick, true);
    document.addEventListener("copy",      _onCopy,     true);
    document.addEventListener("input",     _onCeInput,  true);
    document.addEventListener("mouseover", _onMouseOver,true);
    document.addEventListener("scroll",    _onScroll,   true);
    document.addEventListener("dragstart", _onDragStart,true);
    document.addEventListener("drop",      _onDrop,     true);

    // ── Captura de eventos en iframes del mismo origen ──
    const _attachedFrameDocs = new WeakSet();

    function _attachToFrameDoc(frameDoc) {
      if (!frameDoc || _attachedFrameDocs.has(frameDoc)) return;
      try {
        frameDoc.addEventListener("click",    _onClick,    true);
        frameDoc.addEventListener("change",   _onChange,   true);
        frameDoc.addEventListener("keydown",  _onKeydown,  true);
        frameDoc.addEventListener("dblclick", _onDblClick, true);
        frameDoc.addEventListener("copy",     _onCopy,     true);
        frameDoc.addEventListener("input",    _onCeInput,  true);
        frameDoc.addEventListener("dragstart", _onDragStart, true);
        frameDoc.addEventListener("drop", _onDrop, true);
        _attachedFrameDocs.add(frameDoc);
      } catch (_e) { /* iframe de origen cruzado — sin acceso */ }
    }

    function _detachFromFrameDoc(frameDoc) {
      if (!frameDoc) return;
      try {
        frameDoc.removeEventListener("click",    _onClick,    true);
        frameDoc.removeEventListener("change",   _onChange,   true);
        frameDoc.removeEventListener("keydown",  _onKeydown,  true);
        frameDoc.removeEventListener("dblclick", _onDblClick, true);
        frameDoc.removeEventListener("copy",     _onCopy,     true);
        frameDoc.removeEventListener("input",    _onCeInput,  true);
        frameDoc.removeEventListener("dragstart", _onDragStart, true);
        frameDoc.removeEventListener("drop", _onDrop, true);
      } catch (_e) {}
    }

    function _attachToAllFrames() {
      try {
        document.querySelectorAll("iframe").forEach((ifr) => {
          try { if (ifr.contentDocument) _attachToFrameDoc(ifr.contentDocument); } catch (_e) {}
        });
      } catch (_e) {}
    }

    _attachToAllFrames();

    // Observar iframes que se añadan dinámicamente
    let _frameObs = null;
    try {
      _frameObs = new MutationObserver(_attachToAllFrames);
      _frameObs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (_e) {}

    // ── Cleanup ──
    function _cleanup() {
      document.removeEventListener("click",     _onClick,    true);
      document.removeEventListener("change",    _onChange,   true);
      document.removeEventListener("keydown",   _onKeydown,  true);
      document.removeEventListener("dblclick",  _onDblClick, true);
      document.removeEventListener("copy",      _onCopy,     true);
      document.removeEventListener("input",     _onCeInput,  true);
      document.removeEventListener("mouseover", _onMouseOver,true);
      document.removeEventListener("scroll",    _onScroll,   true);
      document.removeEventListener("dragstart", _onDragStart,true);
      document.removeEventListener("drop",      _onDrop,     true);
      // Desengancharse de todos los iframes
      if (_frameObs) { _frameObs.disconnect(); _frameObs = null; }
      try {
        document.querySelectorAll("iframe").forEach((ifr) => {
          try { if (ifr.contentDocument) _detachFromFrameDoc(ifr.contentDocument); } catch (_e) {}
        });
      } catch (_e) {}
      clearTimeout(_ceTimer); clearTimeout(_hoverTimer); clearTimeout(_scrollTimer);
      if (_hoverObs) { _hoverObs.disconnect(); _hoverObs = null; }
      _inlineDragSource = "";
      const p = document.getElementById(INLINE_REC_PANEL_ID);
      if (p && p.parentNode) p.parentNode.removeChild(p);
    }

    function _stop() {
      _activeInlineStop = null;
      _cleanup();
      // Restaurar el panel si estaba visible antes de grabar
      if (_wasVisible && !store.getState().ui.panelVisible) {
        store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
      }
      // Solicitar todos los pasos acumulados al background (incluye páginas anteriores)
      try {
        chrome.runtime.sendMessage({ type: "INLINE_RECORDING_STOP_REQUEST" }, (resp) => {
          if (chrome.runtime.lastError) {
            // Fallback: usar buffer local
            const filtered = _cleanupSteps(buffer);
            try { if (typeof onDone === "function") onDone(filtered, null); } catch (e) { console.error("[WebMatic] onDone error:", e); }
            return;
          }
          const allSteps = (resp && Array.isArray(resp.steps) && resp.steps.length > 0) ? resp.steps : buffer;
          const editorCtx = (resp && resp.editorContext) || null;
          const filtered = _cleanupSteps(allSteps);
          try { if (typeof onDone === "function") onDone(filtered, editorCtx); } catch (e) { console.error("[WebMatic] onDone error:", e); }
        });
      } catch (e) {
        const filtered = _cleanupSteps(buffer);
        try { if (typeof onDone === "function") onDone(filtered, null); } catch (e2) { console.error("[WebMatic] onDone error:", e2); }
      }
    }

    // ── Floating stop panel ──
    const panel = document.createElement("div");
    panel.id = INLINE_REC_PANEL_ID;
    panel.style.cssText = [
      "all:initial", "position:fixed", "bottom:16px", "right:16px", "z-index:2147483647",
      "display:flex", "align-items:center", "gap:8px",
      "background:rgba(239,68,68,0.95)", "color:#fff",
      "border-radius:10px", "padding:10px 14px",
      "font-family:system-ui,sans-serif", "font-size:13px", "font-weight:600",
      "box-shadow:0 4px 20px rgba(239,68,68,0.4)",
      "cursor:default", "user-select:none"
    ].join(";");

    if (!document.getElementById("webmatic-floating-keyframes")) {
      const style = document.createElement("style");
      style.id = "webmatic-floating-keyframes";
      style.textContent = "@keyframes webmatic-pulse{0%,100%{opacity:1}50%{opacity:0.35}}";
      document.head.appendChild(style);
    }

    const dot = document.createElement("span");
    dot.style.cssText = "display:inline-block;width:10px;height:10px;border-radius:50%;background:#fff;animation:webmatic-pulse 0.8s infinite;flex-shrink:0";
    panel.appendChild(dot);

    const lbl = document.createElement("span");
    lbl.textContent = "Grabando pasos nuevos";
    panel.appendChild(lbl);

    const countEl = document.createElement("span");
    countEl.id = INLINE_REC_PANEL_ID + "-count";
    countEl.style.cssText = "font-size:11px;opacity:0.85;margin-left:2px";
    countEl.textContent = "0 pasos";
    panel.appendChild(countEl);

    const stopBtn = document.createElement("button");
    stopBtn.style.cssText = [
      "all:initial", "display:inline-flex", "align-items:center", "gap:4px",
      "background:#fff", "color:#dc2626", "border-radius:6px",
      "padding:4px 10px", "font-size:12px", "font-weight:700",
      "font-family:system-ui,sans-serif", "cursor:pointer",
      "margin-left:6px", "white-space:nowrap"
    ].join(";");
    stopBtn.textContent = "⏹ Detener";
    stopBtn.title = "Detener grabaci\u00f3n e insertar pasos en el editor";
    stopBtn.addEventListener("click", (e) => { e.stopPropagation(); _stop(); });
    panel.appendChild(stopBtn);

    document.documentElement.appendChild(panel);

    // Notificar al background que empezó la grabación inline, enviando el contexto del editor actual.
    // Si es re-inyección (el content script recargó por navegación), NO enviar INLINE_RECORDING_STARTED
    // para no pisar el inlineEditorContext y el inlineBuffer ya acumulados en background.
    _activeInlineStop = _stop;
    if (!_isReinjection) {
      try {
        const editorState = store.getState().ui.scriptEditor;
        const currentEditorSteps = (seEditor && typeof seEditor.getSteps === "function")
          ? seEditor.getSteps()
          : (editorState.draftSteps || []);
        chrome.runtime.sendMessage({
          type: "INLINE_RECORDING_STARTED",
          editorContext: {
            macroId: editorState.macroId || null,
            script: editorState.script || "",
            draftSteps: currentEditorSteps
          }
        }, () => { void chrome.runtime.lastError; });
      } catch (e) { /* ignore */ }
    }
  }

  /**
   * Cleans up recorded steps before saving:
   * 1. Removes "focus clicks" — CLICK(X) immediately before TYPE/CHECK(X) on same selector
   * 2. Removes clicks on <option> elements (handled by direct SELECT value setting)
   * 3. Removes "defocus clicks" — clicks on body/html (used to close autocomplete dropdowns)
   * 4. Deduplicates TYPE/CHECK steps per selector — keeps only the last value
   *    (handles both "input" steps from blur/change and "text" steps from keypresses)
   * 5. Promotes input/text to choose_option when selector has known options and
   *    the typed value matches an existing catalog option.
   */
  function _cleanupSteps(steps) {
    const isTypeLike = (t) => t === "input" || t === "text";
    const _navigateKey = (rawUrl) => {
      try {
        const u = new URL(String(rawUrl || ""), location.href);
        const keep = ["q", "query", "search", "text", "wd", "p", "s", "page", "id", "v"];
        const picked = [];
        keep.forEach((k) => {
          const v = u.searchParams.get(k);
          if (v != null && v !== "") picked.push(`${k}=${v}`);
        });
        return `${u.origin}${u.pathname}?${picked.join("&")}`;
      } catch (_e) {
        return String(rawUrl || "");
      }
    };
    const _norm = (v) => String(v == null ? "" : v)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    // Pass 0: remove single click steps that are precursors of a dblclick
    // (double-click fires: click → click → dblclick; keep only the dblclick)
    const hasDblClick = steps.some((s) => s.type === "dblclick");
    const pass0 = hasDblClick ? (() => {
      const out = [];
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        if (s.type === "click" && s.selector) {
          let isDblPrecursor = false;
          for (let k = i + 1; k <= Math.min(i + 2, steps.length - 1); k++) {
            if (steps[k].type === "dblclick" && steps[k].selector === s.selector) {
              isDblPrecursor = true;
              break;
            }
          }
          if (isDblPrecursor) continue;
        }
        out.push(s);
      }
      return out;
    })() : steps;

    // Pass 0b: remove Tab navigation noise.
    // Tab is useful for manual navigation, but as recorded macro steps it is
    // highly brittle across pages/layouts and creates flaky replays.
    const pass0b = pass0.filter((step) => !(step && step.type === "key" && step.key === "Tab"));

    // Pass 1: remove focus/defocus/option clicks
    const pass1 = pass0b.filter((step, i) => {
      if (step.type !== "click") return true;
      // Remove clicks on <option> — SELECT value is set directly via TYPE
      if (step.selector && /^option[\[.]/i.test(step.selector)) return false;
      // Remove defocus clicks on body/html — used to close autocomplete popups
      if (step.selector && /^(body|html)[\s.#[\]$]?/i.test(step.selector)) return false;
      // Remove focus click: CLICK(X) before TYPE/CHECK(X) on same selector,
      // even if separated by WAIT steps
      for (let j = i + 1; j < pass0b.length; j++) {
        const nx = pass0b[j];
        if (nx.type === "wait") continue; // skip auto-generated waits
        if ((isTypeLike(nx.type) || nx.type === "check") &&
            nx.selector && nx.selector === step.selector) return false;
        break; // first non-wait step doesn't match — keep the click
      }
      return true;
    });

    // Pass 2: deduplicate only local runs for the same selector.
    // Do not collapse edits of the same field separated by later interactions.
    const pass2 = RecorderClass && typeof RecorderClass.dedupeFieldRuns === "function"
      ? RecorderClass.dedupeFieldRuns(pass1)
      : pass1;

    // Pass 2b: promote recorded text/input to choose_option only when we can
    // prove the value belongs to a known option catalog.
    const pass2b = pass2.map((step) => {
      if (!isTypeLike(step.type) || !step.selector) return step;
      const raw = String(step.value == null ? "" : step.value).trim();
      if (!raw) return step;

      const invApi = globalScope.WebMaticPageInventory;
      const inventories = recorderRuntime.pageInventories;
      if (!invApi || !Array.isArray(inventories) || inventories.length === 0) return step;

      let options = null;
      try {
        if (typeof invApi.findOptionsForStep === "function") {
          options = invApi.findOptionsForStep(step, inventories);
        } else if (typeof invApi.findOptionsForSelector === "function") {
          options = invApi.findOptionsForSelector(step.selector, inventories);
        }
      } catch (e) {
        options = null;
      }
      if (!Array.isArray(options) || options.length === 0) return step;

      const hit = options.find((o) => {
        const ov = String(o && o.value != null ? o.value : "");
        const ot = String(o && o.text != null ? o.text : "");
        return raw === ov || raw === ot || _norm(raw) === _norm(ov) || _norm(raw) === _norm(ot);
      });
      if (!hit) return step;

      return {
        ...step,
        type: "choose_option",
        value: String(hit.value != null ? hit.value : raw),
        text: String(hit.text != null ? hit.text : raw),
        inputMode: "autocomplete"
      };
    });

    // Pass 3: deduplicate consecutive hover / scroll_to steps on the same selector
    // (mouse-over and scroll events fire rapidly; keep the last occurrence in each run)
    const _dedupHoverScroll = new Set(["hover", "scroll_to"]);
    const pass3 = pass2b.filter((step, i, arr) => {
      if (!_dedupHoverScroll.has(step.type) || !step.selector) return true;
      // Remove if a later step with the same type+selector appears before any
      // non-wait step of a different type or different selector
      for (let j = i + 1; j < arr.length; j++) {
        const nx = arr[j];
        if (nx.type === "wait") continue;
        if (nx.type === step.type && nx.selector === step.selector) return false; // later dup exists
        break;
      }
      return true;
    });

    // Pass 3b: deduplicate near-duplicate navigates by canonical key.
    // Keeps first navigate when multiple navigates point to the same logical
    // destination before any interaction step.
    const pass3b = pass3.filter((step, i, arr) => {
      if (step.type !== "navigate" || !step.url) return true;
      const key = _navigateKey(step.url);
      for (let j = i - 1; j >= 0; j--) {
        const prev = arr[j];
        if (!prev) break;
        if (prev.type === "wait" || prev.type === "wait_for") continue;
        if (prev.type === "navigate") {
          return _navigateKey(prev.url) !== key;
        }
        break;
      }
      return true;
    });

    // Pass 3c: remove click steps that are only a prelude to a navigate.
    // This keeps the replay deterministic when the click already caused the
    // navigation and a later navigate step encodes the real destination.
    const pass3c = pass3b.filter((step, i, arr) => {
      if (step.type !== "click" || !step.selector) return true;

      let nextStep = null;
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[j].type === "wait" || arr[j].type === "wait_for") continue;
        nextStep = arr[j];
        break;
      }

      if (!nextStep || nextStep.type !== "navigate" || !nextStep.url) return true;
      // If navigation is explicitly recorded next, the prior click is redundant
      // and often brittle across locales/AB-tests. Keep navigate as source of truth.
      return false;
    });

    // Pass 3d: remove transient wait_for near navigate jumps.
    // Patterns removed:
    // 1) navigate(A) -> wait_for(X) -> navigate(B)
    // 2) navigate(A) -> wait_for(X) -> (hover/scroll/wait)* -> navigate(B)
    // In these cases X is usually a transient UI control (next/close button,
    // carousel arrow, overlay actions, etc.) and waiting for it can break
    // deterministic replay across locales, experiments or responsive variants.
    const pass3d = pass3c.filter((step, i, arr) => {
      if (step.type !== "wait_for") return true;

      let prev = null;
      for (let j = i - 1; j >= 0; j--) {
        if (arr[j].type === "wait") continue;
        prev = arr[j];
        break;
      }

      let next = null;
      let onlyTransientBeforeNavigate = true;
      for (let j = i + 1; j < arr.length; j++) {
        const cand = arr[j];
        if (cand.type === "wait") continue;
        if (cand.type === "navigate") {
          next = cand;
          break;
        }
        if (cand.type === "hover" || cand.type === "scroll_to") {
          continue;
        }
        onlyTransientBeforeNavigate = false;
        break;
      }

      if (
        prev &&
        next &&
        prev.type === "navigate" &&
        next.type === "navigate" &&
        onlyTransientBeforeNavigate
      ) {
        return false;
      }
      return true;
    });

    // Pass 4: auto-inject wait_for after navigate steps
    // Inserts wait_for for the first selector-bearing step after each navigate,
    // making macros robust on full page loads and SPA transitions.
    const _stableWaitTargetTypes = new Set(["input", "text", "check", "choose_option", "extract"]);
    const pass4 = [];
    for (let i = 0; i < pass3d.length; i++) {
      pass4.push(pass3d[i]);
      if (pass3d[i].type === "navigate") {
        const nextStep = pass3d[i + 1];
        // Skip if already followed by a wait/wait_for or another navigate.
        if (nextStep && nextStep.type !== "wait" && nextStep.type !== "wait_for" && nextStep.type !== "navigate") {
          let waitSelector = null;
          let sawAnotherNavigate = false;
          for (let j = i + 1; j < pass3d.length; j++) {
            const cand = pass3d[j];
            if (cand.type === "wait") continue;
            if (cand.type === "navigate") {
              sawAnotherNavigate = true;
              break;
            }
            if (cand.selector && _stableWaitTargetTypes.has(cand.type)) {
              waitSelector = cand.selector;
            }
            break;
          }
          if (waitSelector && !sawAnotherNavigate) {
            pass4.push({ type: "wait_for", selector: waitSelector, timeout: 10000 });
          }
        }
      }
    }
    // Pass 4b: auto-inject wait_for after click steps that open modals/dialogs
    // When a click is followed by check/input on a DIFFERENT selector, the click
    // likely opened new content (modal, panel, dynamic form). Inject wait_for so
    // the macro waits for that element to appear instead of failing on timing.
    const pass4b = [];
    for (let i = 0; i < pass4.length; i++) {
      pass4b.push(pass4[i]);
      const cur = pass4[i];
      if (cur.type === "click" && cur.selector) {
        // Find next non-wait step
        let nextStep = null;
        for (let j = i + 1; j < pass4.length; j++) {
          if (pass4[j].type === "wait" || pass4[j].type === "wait_for") continue;
          nextStep = pass4[j];
          break;
        }
        // Inject wait_for if: next step is check/input on a DIFFERENT selector
        // AND not already followed immediately by a wait_for
        if (
          nextStep &&
          (nextStep.type === "check" || nextStep.type === "input") &&
          nextStep.selector &&
          nextStep.selector !== cur.selector
        ) {
          const immNext = pass4[i + 1];
          if (!immNext || immNext.type !== "wait_for") {
            pass4b.push({ type: "wait_for", selector: nextStep.selector, timeout: 10000 });
          }
        }
      }
    }

    // Pass 5: deduplicate consecutive navigate steps with the same logical URL
    // (SPA nav patch or manual re-triggers can emit duplicate navigates)
    const pass5 = pass4b.filter((step, i, arr) => {
      if (step.type !== "navigate" || !step.url) return true;
      // Remove if the immediately preceding non-wait step is also a navigate to the same logical URL
      for (let j = i - 1; j >= 0; j--) {
        if (arr[j].type === "wait" || arr[j].type === "wait_for") continue;
        return !(arr[j].type === "navigate" && _navigateKey(arr[j].url) === _navigateKey(step.url));
      }
      return true;
    });

    // Pass 6: deduplicate repeated wait_for on same selector (keeping first)
    const pass6 = pass5.filter((step, i, arr) => {
      if (step.type !== "wait_for" || !step.selector) return true;
      for (let j = i - 1; j >= 0; j--) {
        const prev = arr[j];
        if (prev.type === "wait") continue;
        if (prev.type === "wait_for") {
          return prev.selector !== step.selector;
        }
        break;
      }
      return true;
    });
    return pass6;
  }

  /**
   * Promueve pasos input/text a choose_option usando inventario persistido
   * (macro.meta.pageInventories), cuando el valor matchea una opción real.
   */
  function _promoteChooseOptionWithInventories(steps, inventories) {
    if (!Array.isArray(steps) || steps.length === 0) return Array.isArray(steps) ? steps : [];
    const invApi = globalScope.WebMaticPageInventory;
    if (!invApi || !Array.isArray(inventories) || inventories.length === 0) return steps.slice();

    const _norm = (v) => String(v == null ? "" : v)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    const isTypeLike = (t) => t === "input" || t === "text";

    return steps.map((step) => {
      if (!step || !isTypeLike(step.type) || !step.selector) return step;
      const raw = String(step.value == null ? "" : step.value).trim();
      if (!raw) return step;

      let options = null;
      try {
        if (typeof invApi.findOptionsForStep === "function") {
          options = invApi.findOptionsForStep(step, inventories);
        } else if (typeof invApi.findOptionsForSelector === "function") {
          options = invApi.findOptionsForSelector(step.selector, inventories);
        }
      } catch (e) {
        options = null;
      }
      if (!Array.isArray(options) || options.length === 0) return step;

      const hit = options.find((o) => {
        const ov = String(o && o.value != null ? o.value : "");
        const ot = String(o && o.text != null ? o.text : "");
        return raw === ov || raw === ot || _norm(raw) === _norm(ov) || _norm(raw) === _norm(ot);
      });
      if (!hit) return step;

      return {
        ...step,
        type: "choose_option",
        value: String(hit.value != null ? hit.value : raw),
        text: String(hit.text != null ? hit.text : raw),
        inputMode: "autocomplete"
      };
    });
  }

  /**
   * Recursively resolves call_macro.steps by looking up macro_name in the library.
   * Also descends into nested sub-step arrays (steps/then/else/fallback) so that
   * call_macro references inside if_exists, loop_until, etc. are resolved too.
   * Depth guard prevents infinite loops from circular macro references (max 8 levels).
   */
  function _resolveCallMacros(steps, macros, _depth) {
    if (!Array.isArray(steps)) return steps;
    if ((_depth || 0) > 8) return steps;
    return steps.map((step) => {
      const d = (_depth || 0) + 1;
      if (step.type === "call_macro") {
        const ref = macros.find((m) => m.name === step.macro_name);
        if (ref && Array.isArray(ref.steps) && ref.steps.length > 0) {
          return { ...step, steps: _resolveCallMacros(ref.steps, macros, d) };
        }
        return step;
      }
      const resolved = { ...step };
      if (Array.isArray(step.steps))    resolved.steps    = _resolveCallMacros(step.steps, macros, d);
      if (Array.isArray(step.then))     resolved.then     = _resolveCallMacros(step.then, macros, d);
      if (Array.isArray(step.else))     resolved.else     = _resolveCallMacros(step.else, macros, d);
      if (Array.isArray(step.fallback)) resolved.fallback = _resolveCallMacros(step.fallback, macros, d);
      return resolved;
    });
  }

  /**
   * Scans all form fields on the current page and returns steps for those
   * whose selectors are not already present in capturedSelectors.
   * Includes fields with default/empty values so the script is complete.
   */
  function capturePageDefaults(capturedSelectors) {
    const RecorderClass = globalScope.WebMaticRecorder;
    const seen = new Set(capturedSelectors);
    const extraSteps = [];

    const fields = Array.from(document.querySelectorAll("input, select, textarea"));
    for (const el of fields) {
      // Skip hidden, submit, button, image, file, reset inputs
      const tag = el.tagName.toLowerCase();
      const type = (el.type || "").toLowerCase();
      if (type === "submit" || type === "button" || type === "image" ||
          type === "file" || type === "reset" || type === "hidden") continue;
      // Skip invisible elements
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      // Skip our own panel elements
      if (el.closest("#webmatic-panel-root")) continue;
      // Skip readonly/disabled
      if (el.readOnly || el.disabled) continue;

      const sel = RecorderClass ? RecorderClass.buildSelector(el) : (el.id ? `#${el.id}` : "");
      if (!sel || seen.has(sel)) continue;
      seen.add(sel);
      if (_isSensitiveInputTarget(el, sel)) continue;

      if (tag === "select") {
        extraSteps.push({ type: "input", selector: sel, value: el.value, _fast: true, _baselineDefault: true });
      } else if (type === "checkbox") {
        extraSteps.push({ type: "check", selector: sel, checked: el.checked, _fast: true, _baselineDefault: true });
      } else if (type === "radio") {
        if (el.checked) extraSteps.push({ type: "check", selector: sel, checked: true, _fast: true, _baselineDefault: true });
      } else {
        extraSteps.push({ type: "input", selector: sel, value: el.value || "", _fast: true, _baselineDefault: true });
      }
    }
    return extraSteps;
  }

  function _collectRecordedFieldSelectors(steps) {
    const out = new Set();
    if (!Array.isArray(steps)) return out;
    steps.forEach((step) => {
      if (!step || typeof step !== "object") return;
      if ((step.type === "input" || step.type === "text" || step.type === "check" || step.type === "choose_option") && step.selector) {
        out.add(String(step.selector));
      }
      if (Array.isArray(step.steps)) _collectRecordedFieldSelectors(step.steps).forEach((sel) => out.add(sel));
      if (Array.isArray(step.then)) _collectRecordedFieldSelectors(step.then).forEach((sel) => out.add(sel));
      if (Array.isArray(step.else)) _collectRecordedFieldSelectors(step.else).forEach((sel) => out.add(sel));
      if (Array.isArray(step.fallback)) _collectRecordedFieldSelectors(step.fallback).forEach((sel) => out.add(sel));
    });
    return out;
  }

  function _withCapturedPageDefaults(recordedSteps) {
    const baseSteps = Array.isArray(recordedSteps) ? recordedSteps.slice() : [];
    const withBootstrap = _ensureRecordingBootstrapNavigate(baseSteps);

    const touchedSelectors = _collectRecordedFieldSelectors(withBootstrap);
    const defaults = capturePageDefaults(touchedSelectors);
    if (!Array.isArray(defaults) || defaults.length === 0) return withBootstrap;
    const fallbackKey = _contextKeyFromUrl(window.location.href);
    const firstStepKey = withBootstrap.find((s) => s && typeof s === "object" && s._wmBlockKey)
      ? String(withBootstrap.find((s) => s && typeof s === "object" && s._wmBlockKey)._wmBlockKey || "")
      : "";
    const blockKey = firstStepKey || fallbackKey;
    const normalizedDefaults = blockKey
      ? defaults.map((s) => ({ ...s, _wmBlockKey: blockKey }))
      : defaults;

    // Keep bootstrap navigation first, then defaults, then the rest.
    const insertAt = withBootstrap[0] && _isNavigationLikeStep(withBootstrap[0]) ? 1 : 0;
    return [
      ...withBootstrap.slice(0, insertAt),
      ...normalizedDefaults,
      ...withBootstrap.slice(insertAt)
    ];
  }

  function _isNavigationLikeStep(step) {
    if (!step || typeof step !== "object") return false;
    return step.type === "navigate" || step.type === "open_tab" || step.type === "switch_tab";
  }

  function _ensureRecordingBootstrapNavigate(steps) {
    const list = Array.isArray(steps) ? steps.slice() : [];
    if (list.length === 0 && !recorderRuntime.recordingStartUrl) return list;
    if (list[0] && _isNavigationLikeStep(list[0])) return list;

    const startUrl = recorderRuntime.recordingStartUrl || window.location.href;
    if (!startUrl) return list;

    const bootstrap = { type: "navigate", url: startUrl };
    const startKey = _contextKeyFromUrl(startUrl);
    if (startKey) {
      bootstrap._wmBlockKey = startKey;
      bootstrap._wmBlockStart = true;
    }
    return [bootstrap, ...list];
  }

  function addWaitHere() {
    const currentState = store.getState();
    const stepIdx = currentState.playback.currentStepIndex;
    const macroId = currentState.library.selectedMacroId;
    const macro = currentState.library.macros.find((m) => m.id === macroId);
    if (!macro || stepIdx < 0) return;
    const steps = [...macro.steps];
    if (stepIdx > 0 && steps[stepIdx - 1].type === "wait") {
      steps[stepIdx - 1] = { ...steps[stepIdx - 1], seconds: steps[stepIdx - 1].seconds + 1 };
    } else {
      steps.splice(stepIdx, 0, { type: "wait", seconds: 1 });
    }
    const updatedMacro = { ...macro, steps };
    const updatedMacros = currentState.library.macros.map((m) => m.id === macroId ? updatedMacro : m);
    store.dispatch({ type: contracts.ActionTypes.LIBRARY_LOADED, payload: updatedMacros });
    store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `+1s agregado antes del paso ${stepIdx + 1}` });
    chrome.storage.local.set({ webmaticMacros: updatedMacros });
  }

  uiShell.unmount();
  uiShell.mount();
  uiShell.bindModeEvents(
    (mode) => {
      store.dispatch({ type: contracts.ActionTypes.MODE_SET, payload: mode });
    },
    async (actionId, meta) => {

      if (actionId === "record-toggle") {
        const currentState = store.getState();
        if (currentState.recorder.isRecording) {
          stopRecorderSession();
          removeFloatingBtn();
          await _waitForAutocompleteExpansion(1800);
          chrome.runtime.sendMessage({ type: "RECORDING_STATE", active: false }, () => { void chrome.runtime.lastError; });
          store.dispatch({ type: contracts.ActionTypes.RECORD_STOPPED });
          const afterStop = store.getState();
          if (afterStop.draft.steps.length > 0 && iimAdapter) {
            const utils = globalScope.WebMaticUtils;
            const threshold = (afterStop.settings && afterStop.settings.waitThreshold) || 3;
            const recorded = afterStop.draft.steps;
            const allSteps = _cleanupSteps(_withCapturedPageDefaults(recorded));
            const processedSteps = _finalizeWithInventory(utils ? utils.injectWaitSteps(allSteps, threshold * 1000) : allSteps);
            const resolvedInv = [
              ...recorderRuntime.pageInventories,
              ..._resolveReusableMetadataForSteps(processedSteps).inventories
            ];
            const promotedSteps = _promoteChooseOptionWithInventories(processedSteps, resolvedInv);
            const script = iimAdapter.exportToIim({ steps: promotedSteps, meta: _recordingMeta() });
            store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_OPENED, payload: { script, macroId: null, draftSteps: promotedSteps, meta: _recordingMeta() } });
          }
        } else {
          store.dispatch({ type: contracts.ActionTypes.RECORD_STARTED });
          recorderRuntime.recordingStartUrl = window.location.href;
          recorderRuntime.autocompleteCatalogs = {};
          recorderRuntime._autocompleteExpansionState = {};
          recorderRuntime._autocompleteLastTypedBySelector = {};
          recorderRuntime._autocompleteExpansionPromises = {};
          recorderRuntime.pageInventories = [];
          recorderRuntime.preRunReset = _captureInitialPreRunReset();
          captureScreenInventory();
          startRecorderSession();
          createFloatingBtn(() => {
            stopRecorderSession();
            removeFloatingBtn();
            void _waitForAutocompleteExpansion(1800).then(() => {
            chrome.runtime.sendMessage({ type: "RECORDING_STATE", active: false }, () => { void chrome.runtime.lastError; });
            store.dispatch({ type: contracts.ActionTypes.RECORD_STOPPED });
            const afterStop = store.getState();
            if (afterStop.draft.steps.length > 0 && iimAdapter) {
              const utils = globalScope.WebMaticUtils;
              const threshold = (afterStop.settings && afterStop.settings.waitThreshold) || 3;
              const recorded = afterStop.draft.steps;
              const allSteps = _cleanupSteps(_withCapturedPageDefaults(recorded));
              const processedSteps = _finalizeWithInventory(utils ? utils.injectWaitSteps(allSteps, threshold * 1000) : allSteps);
              const resolvedInv = [
                ...recorderRuntime.pageInventories,
                ..._resolveReusableMetadataForSteps(processedSteps).inventories
              ];
              const promotedSteps = _promoteChooseOptionWithInventories(processedSteps, resolvedInv);
              const script = iimAdapter.exportToIim({ steps: promotedSteps, meta: _recordingMeta() });
              store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_OPENED, payload: { script, macroId: null, draftSteps: promotedSteps, meta: _recordingMeta() } });
            }
            });
          });
          chrome.runtime.sendMessage({ type: "RECORDING_STATE", active: true }, () => { void chrome.runtime.lastError; });
        }
      }

      if (actionId === "play-start") {
        store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
      }

      if (actionId === "play-stop") {
        if (playerRuntime.activePlayer) {
          playerRuntime.activePlayer.stop();
          playerRuntime.activePlayer = null;
        }
        store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
      }

      if (actionId === "close-panel") {
        const currentState = store.getState();
        if (currentState.ui.panelVisible) {
          store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
        }
      }

      if (actionId === "help") {
        const _hs = store.getState().settings;
        chrome.runtime.sendMessage({
          type: "OPEN_HELP_PAGE",
          themeMode: _hs.themeMode || "light",
          themeVariant: _hs.themeVariant || 1
        });
      }

      if (actionId === "settings-side-left") {
        store.dispatch({ type: contracts.ActionTypes.PANEL_SIDE_SET, payload: "left" });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Vista izquierda aplicada" });
        settingsApi.saveSettings({ panelSide: "left", panelWidth: 260 });
      }

      if (actionId === "settings-side-right") {
        store.dispatch({ type: contracts.ActionTypes.PANEL_SIDE_SET, payload: "right" });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Vista derecha aplicada" });
        settingsApi.saveSettings({ panelSide: "right", panelWidth: 260 });
      }

      if (actionId === "settings-theme-mode") {
        const nextMode = meta?.checked ? "dark" : "light";
        const current = store.getState().settings;
        const nextVariant = current.themeVariant;
        const themeSettings = resolveTheme(nextMode, nextVariant);
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: themeSettings });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Tema ${nextMode === "dark" ? "oscuro" : "claro"} aplicado` });
        settingsApi.saveSettings({ panelWidth: 260, panelSide: store.getState().ui.panelSide, ...themeSettings });
      }

      if (actionId === "settings-theme-variant") {
        const variant = Number(meta?.variant || 1);
        const current = store.getState().settings;
        const themeSettings = resolveTheme(current.themeMode, variant);
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: themeSettings });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Variante ${themeSettings.themeVariant} aplicada` });
        settingsApi.saveSettings({ panelWidth: 260, panelSide: store.getState().ui.panelSide, ...themeSettings });
      }

      if (actionId === "settings-speed") {
        const raw = parseFloat(meta?.value ?? 1);
        const speed = Math.min(3, Math.max(0.5, isNaN(raw) ? 1 : raw));
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { speed } });
        settingsApi.saveSettings({ speed });
      }

      if (actionId === "settings-opacity") {
        const raw = parseFloat(meta?.value ?? 1);
        const panelOpacity = Math.min(1, Math.max(0.7, isNaN(raw) ? 1 : raw));
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { panelOpacity } });
        settingsApi.saveSettings({ panelOpacity });
      }

      if (actionId === "settings-wait-threshold") {
        const raw = parseFloat(meta?.value ?? 3);
        const waitThreshold = Math.min(10, Math.max(1, isNaN(raw) ? 3 : raw));
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { waitThreshold } });
        settingsApi.saveSettings({ waitThreshold });
      }

      if (actionId === "settings-page-meta-max") {
        const nextLimit = _normalizePageMetaMaxProfiles(meta?.value);
        pageMetaMaxProfiles = nextLimit;
        settingsApi.saveSettings({ pageMetaMaxProfiles: nextLimit });
        if (Array.isArray(pageMetadataProfiles) && pageMetadataProfiles.length > nextLimit) {
          void _savePageMetadataProfiles(pageMetadataProfiles.slice(0, nextLimit));
        }
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { pageMetaMaxProfiles: nextLimit } });
      }

      if (actionId === "play-runtime-enabled") {
        const runtimeDataEnabled = Boolean(meta?.checked);
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { runtimeDataEnabled } });
        settingsApi.saveSettings({ runtimeDataEnabled });
      }

      if (actionId === "play-runtime-type") {
        const runtimeDataType = normalizeRuntimeDataType(meta?.value);
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { runtimeDataType } });
        settingsApi.saveSettings({ runtimeDataType });
      }

      if (actionId === "play-runtime-item-add") {
        const current = store.getState().settings;
        const next = [...normalizeRuntimeDataItems(current.runtimeDataItems), { enabled: true, type: "generic", data: "" }];
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { runtimeDataItems: next } });
        settingsApi.saveSettings({ runtimeDataItems: next });
      }

      if (actionId === "play-runtime-item-remove") {
        const current = store.getState().settings;
        const index = Number(meta?.index);
        if (!Number.isFinite(index) || index < 0) return;
        const currentItems = normalizeRuntimeDataItems(current.runtimeDataItems);
        const next = currentItems.filter((_, i) => i !== index);
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { runtimeDataItems: next } });
        settingsApi.saveSettings({ runtimeDataItems: next });
      }

      if (actionId === "play-runtime-item-type") {
        const current = store.getState().settings;
        const index = Number(meta?.index);
        if (!Number.isFinite(index) || index < 0) return;
        const currentItems = normalizeRuntimeDataItems(current.runtimeDataItems);
        if (!currentItems[index]) return;
        currentItems[index] = { ...currentItems[index], type: normalizeRuntimeDataType(meta?.value) };
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { runtimeDataItems: currentItems } });
        settingsApi.saveSettings({ runtimeDataItems: currentItems });
      }

      if (actionId === "play-runtime-item-enabled") {
        const current = store.getState().settings;
        const index = Number(meta?.index);
        if (!Number.isFinite(index) || index < 0) return;
        const currentItems = normalizeRuntimeDataItems(current.runtimeDataItems);
        if (!currentItems[index]) return;
        currentItems[index] = { ...currentItems[index], enabled: Boolean(meta?.checked) };
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { runtimeDataItems: currentItems } });
        settingsApi.saveSettings({ runtimeDataItems: currentItems });
      }

      if (actionId === "play-runtime-template-select") {
        const current = store.getState().settings;
        const templates = normalizeRuntimeDataTemplates(current.runtimeDataTemplates);
        const runtimeTemplateSelectedId = sanitizeRuntimeTemplateSelectedId(meta?.value, templates);
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { runtimeTemplateSelectedId } });
        settingsApi.saveSettings({ runtimeTemplateSelectedId });
      }

      if (actionId === "play-runtime-template-save") {
        const current = store.getState().settings;
        const templates = normalizeRuntimeDataTemplates(current.runtimeDataTemplates);
        const selectedId = sanitizeRuntimeTemplateSelectedId(current.runtimeTemplateSelectedId, templates);
        const selected = templates.find((tpl) => tpl.id === selectedId);
        const defaultName = selected ? selected.name : "Plantilla";
        const askedName = await uiShell.wmModal("prompt", {
          message: "Nombre de la plantilla:",
          defaultValue: defaultName,
          okLabel: "Guardar"
        });
        const name = String(askedName || "").trim();
        if (!name) return;

        const snapshot = {
          id: selected ? selected.id : `rtpl_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          name,
          runtimeDataEnabled: Boolean(current.runtimeDataEnabled),
          runtimeDataType: normalizeRuntimeDataType(current.runtimeDataType),
          runtimeData: String(current.runtimeData || ""),
          runtimeDataItems: normalizeRuntimeDataItems(current.runtimeDataItems)
        };

        const byNameIdx = templates.findIndex((tpl) => String(tpl.name).toLowerCase() === name.toLowerCase());
        const byIdIdx = templates.findIndex((tpl) => tpl.id === snapshot.id);
        const nextTemplates = [...templates];
        if (byIdIdx >= 0) {
          nextTemplates[byIdIdx] = snapshot;
        } else if (byNameIdx >= 0) {
          nextTemplates[byNameIdx] = { ...snapshot, id: nextTemplates[byNameIdx].id };
        } else {
          nextTemplates.push(snapshot);
        }

        const runtimeTemplateSelectedId = snapshot.id;
        store.dispatch({
          type: contracts.ActionTypes.SETTINGS_UPDATED,
          payload: { runtimeDataTemplates: nextTemplates, runtimeTemplateSelectedId }
        });
        settingsApi.saveSettings({ runtimeDataTemplates: nextTemplates, runtimeTemplateSelectedId });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Plantilla "${name}" guardada` });
      }

      if (actionId === "play-runtime-template-apply") {
        const current = store.getState().settings;
        const templates = normalizeRuntimeDataTemplates(current.runtimeDataTemplates);
        const selectedId = sanitizeRuntimeTemplateSelectedId(current.runtimeTemplateSelectedId, templates);
        const selected = templates.find((tpl) => tpl.id === selectedId);
        if (!selected) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Selecciona una plantilla para aplicar" });
          return;
        }

        const patch = {
          runtimeDataEnabled: Boolean(selected.runtimeDataEnabled),
          runtimeDataType: normalizeRuntimeDataType(selected.runtimeDataType),
          runtimeData: String(selected.runtimeData || ""),
          runtimeDataItems: normalizeRuntimeDataItems(selected.runtimeDataItems),
          runtimeTemplateSelectedId: selected.id
        };
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: patch });
        settingsApi.saveSettings(patch);
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Plantilla "${selected.name}" aplicada` });
      }

      if (actionId === "play-runtime-template-delete") {
        const current = store.getState().settings;
        const templates = normalizeRuntimeDataTemplates(current.runtimeDataTemplates);
        const selectedId = sanitizeRuntimeTemplateSelectedId(current.runtimeTemplateSelectedId, templates);
        const selected = templates.find((tpl) => tpl.id === selectedId);
        if (!selected) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "No hay plantilla seleccionada" });
          return;
        }
        const ok = await uiShell.wmModal("confirm", {
          message: `¿Eliminar la plantilla \"${selected.name}\"?`,
          okLabel: "Eliminar",
          cancelLabel: "Cancelar"
        });
        if (!ok) return;
        const nextTemplates = templates.filter((tpl) => tpl.id !== selected.id);
        store.dispatch({
          type: contracts.ActionTypes.SETTINGS_UPDATED,
          payload: { runtimeDataTemplates: nextTemplates, runtimeTemplateSelectedId: "" }
        });
        settingsApi.saveSettings({ runtimeDataTemplates: nextTemplates, runtimeTemplateSelectedId: "" });
      }

      if (actionId === "settings-custom-type-add") {
        const current = store.getState().settings;
        const label = String(meta?.value || "").trim();
        if (label.length < 3) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "El tipo personalizado debe tener al menos 3 caracteres" });
          return;
        }
        const next = normalizeRuntimeCustomTypes([...(current.runtimeCustomTypes || []), label]);
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { runtimeCustomTypes: next } });
        settingsApi.saveSettings({ runtimeCustomTypes: next });
      }

      if (actionId === "settings-custom-type-remove") {
        const current = store.getState().settings;
        const label = String(meta?.customLabel || "").trim();
        const next = normalizeRuntimeCustomTypes((current.runtimeCustomTypes || []).filter((x) => String(x).toLowerCase() !== label.toLowerCase()));
        const nextType = String(current.runtimeDataType || "generic").toLowerCase() === `custom:${label.toLowerCase()}`
          ? "generic"
          : current.runtimeDataType;
        const nextItems = normalizeRuntimeDataItems(current.runtimeDataItems).map((item) => {
          if (String(item.type || "").toLowerCase() === `custom:${label.toLowerCase()}`) {
            return { ...item, type: "generic" };
          }
          return item;
        });
        const nextTemplates = normalizeRuntimeDataTemplates(current.runtimeDataTemplates).map((tpl) => {
          const normalizedType = String(tpl.runtimeDataType || "").toLowerCase() === `custom:${label.toLowerCase()}`
            ? "generic"
            : tpl.runtimeDataType;
          const normalizedItems = normalizeRuntimeDataItems(tpl.runtimeDataItems).map((item) => {
            if (String(item.type || "").toLowerCase() === `custom:${label.toLowerCase()}`) {
              return { ...item, type: "generic" };
            }
            return item;
          });
          return { ...tpl, runtimeDataType: normalizedType, runtimeDataItems: normalizedItems };
        });
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { runtimeCustomTypes: next, runtimeDataType: nextType, runtimeDataItems: nextItems, runtimeDataTemplates: nextTemplates } });
        settingsApi.saveSettings({ runtimeCustomTypes: next, runtimeDataType: nextType, runtimeDataItems: nextItems, runtimeDataTemplates: nextTemplates });
      }

      if (actionId === "play-runtime-data" || actionId === "settings-runtime-data") {
        const runtimeData = String(meta?.value || "");
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { runtimeData } });
        settingsApi.saveSettings({ runtimeData });
      }

      if (actionId === "play-runtime-item-data") {
        const current = store.getState().settings;
        const index = Number(meta?.index);
        if (!Number.isFinite(index) || index < 0) return;
        const currentItems = normalizeRuntimeDataItems(current.runtimeDataItems);
        if (!currentItems[index]) return;
        currentItems[index] = { ...currentItems[index], data: String(meta?.value || "") };
        store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { runtimeDataItems: currentItems } });
        settingsApi.saveSettings({ runtimeDataItems: currentItems });
      }

      if (actionId === "folder-pick") {
        chrome.runtime.sendMessage({ type: "OPEN_OPTIONS_PAGE" }, () => { void chrome.runtime.lastError; });
      }

      if (actionId === "library-search") {
        const query = String(meta?.value || "");
        store.dispatch({ type: contracts.ActionTypes.LIBRARY_FILTERED, payload: query });
        const macros = store.getState().library.macros;
        const filtered = filterMacros(macros, query);
        if (filtered.length === 1) {
          store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: filtered[0].id });
        } else {
          store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: null });
        }
      }

      if (actionId === "library-select") {
        store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: meta?.value || null });
      }

      if (actionId === "loop-toggle") {
        store.dispatch({ type: contracts.ActionTypes.PLAYBACK_LOOP_TOGGLED });
      }

      if (actionId === "repeat-count") {
        store.dispatch({ type: contracts.ActionTypes.PLAYBACK_REPEAT_SET, payload: Number(meta?.value || 5) });
      }

      if (actionId === "macro-duplicate") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro) return;
        const copyName = macro.name + " (copia)";
        const copySteps = macro.steps ? JSON.parse(JSON.stringify(macro.steps)) : [];
        const copyScript = iimAdapter ? iimAdapter.exportToIim({ steps: copySteps }) : (macro.script || "");
        const copy = {
          id: `macro_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          name: copyName,
          steps: copySteps,
          script: copyScript,
          createdAt: Date.now()
        };
        store.dispatch({ type: contracts.ActionTypes.MACRO_SAVED, payload: copy });
        store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: copy.id });
        chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Macro duplicada: "${copyName}"` });
      }

      if (actionId === "macro-concat") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro) return;

        const availableNames = currentState.library.macros
          .filter((m) => m.id !== selectedId)
          .map((m) => m.name)
          .join(", ");

        const input = await uiShell.wmModal("prompt", {
          message: `Concatenar al final de "${macro.name}".\n\nNombre(s) de macro a agregar (separados por coma):`,
          defaultValue: "",
          okLabel: "Concatenar",
          cancelLabel: "Cancelar"
        });

        if (!input || !String(input).trim()) return;

        const names = String(input).split(",").map((n) => n.trim()).filter(Boolean);
        const toMerge = names
          .map((name) => currentState.library.macros.find((m) => m.name.toLowerCase() === name.toLowerCase()))
          .filter(Boolean);

        if (toMerge.length === 0) {
          await uiShell.wmModal("alert", { message: `No se encontró ninguna macro con esos nombres.\nMacros disponibles: ${availableNames}` });
          return;
        }

        const _tagConcatenatedMacroSegment = (steps) => {
          const out = Array.isArray(steps) ? JSON.parse(JSON.stringify(steps)) : [];
          if (out.length > 0 && out[0] && typeof out[0] === "object") {
            // Marca interna para que el editor visual delimite por macro concatenada.
            out[0]._wmBlockStart = true;
            out[0]._wmCollapsed = true;
          }
          return out;
        };

        const mergedSteps = [
          ..._tagConcatenatedMacroSegment(macro.steps || []),
          ...toMerge.flatMap((m) => _tagConcatenatedMacroSegment(m.steps || []))
        ];
        const mergedName = [macro.name, ...toMerge.map((m) => m.name)].join(" + ");
        const mergedScript = iimAdapter ? iimAdapter.exportToIim({ steps: mergedSteps }) : "";
        const mergedMacro = {
          id: `macro_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          name: mergedName,
          steps: mergedSteps,
          script: mergedScript,
          createdAt: Date.now()
        };
        store.dispatch({ type: contracts.ActionTypes.MACRO_SAVED, payload: mergedMacro });
        store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: mergedMacro.id });
        chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Macro "${mergedName}" creada — ${mergedSteps.length} pasos` });
      }

      if (actionId === "add-wait-here") {
        addWaitHere();
        return;
      }

      if (actionId === "macro-play") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro) return;
        function _startMacroPlay() {
          const _state = store.getState();
          const _macro = _state.library.macros.find((m) => m.id === selectedId);
          if (!_macro) return;
          if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
          store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Reproduciendo "${_macro.name}"` });
          const _PlayerClass = globalScope.WebMaticPlayer;
          if (!_PlayerClass || !Array.isArray(_macro.steps) || _macro.steps.length === 0) return;
          const _player = new _PlayerClass();
          playerRuntime.activePlayer = _player;
          playerRuntime.lastFallbacks = [];
          playerRuntime.lastDurationMs = null;
          playerRuntime.playStartedAtMs = Date.now();
          resetRuntimeAutoFillSession();
          // Initialize panel with all steps before starting (call_macro references resolved)
          const _resolvedSteps = _resolveCallMacros(_macro.steps, _state.library.macros);
          const _preparedSteps = applyRuntimeDataToSteps(_resolvedSteps, _state.settings);
          store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: 0, steps: _preparedSteps } });
          const _playVars = buildRuntimeVars(null, _state.settings);
          _playVars[PLAY_START_VAR] = playerRuntime.playStartedAtMs;
          _player.play(_preparedSteps, {
            speed: _state.settings.speed ?? 1,
            vars: _playVars,
            macroId: _macro.id,
            ..._macroPlaybackMeta(_macro),
            onStep: (step, index) => {
              tryAutoFillRuntimeDataOnPage(_state.settings);
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: _preparedSteps } });
            },
            onDone: (summary) => {
              if (_isPlaybackHandoffSummary(summary)) {
                playerRuntime.activePlayer = null;
                store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
                store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Continuando en otra pestaña..." });
                removePlaybackFloating();
                return;
              }
              playerRuntime.activePlayer = null;
              const _fb = (summary && Array.isArray(summary.fallbacks)) ? summary.fallbacks : [];
              playerRuntime.lastFallbacks = _fb;
              const _summaryDuration = (summary && Number.isFinite(Number(summary.durationMs))) ? Number(summary.durationMs) : null;
              const _fallbackDuration = playerRuntime.playStartedAtMs ? Math.max(0, Date.now() - playerRuntime.playStartedAtMs) : null;
              playerRuntime.lastDurationMs = (_summaryDuration && _summaryDuration >= 100) ? _summaryDuration : _fallbackDuration;
              // Mark all steps done, then stop
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: _preparedSteps.length, steps: _preparedSteps } });
              store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
              const _statusMsg = _fb.length > 0
                ? `Reproduccion completada con ${_fb.length} ${_fb.length === 1 ? "fallback aplicado" : "fallbacks aplicados"}`
                : "Reproduccion completada";
              store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: _statusMsg });
              try { console.info("[WebMatic][playback] summary", summary || {}); } catch (_e) { /* ignore */ }
            },
            onError: (err) => {
              playerRuntime.activePlayer = null;
              const errIdx = store.getState().playback.currentStepIndex;
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
              store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Error: ${err.message}` });
            }
          });
        }
        createPlaybackFloating(
          () => {
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
          },
          () => addWaitHere(),
          () => { _startMacroPlay(); },
          () => {
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
            removePlaybackFloating();
          },
          (n) => {
            // Repetir N veces desde el flotante
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            const _fbState = store.getState();
            const _fbMacro = _fbState.library.macros.find((m) => m.id === selectedId);
            if (!_fbMacro) return;
            store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
            store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Bucle x${n}: "${_fbMacro.name}"` });
            const _fbPlayer = new (globalScope.WebMaticPlayer)();
            playerRuntime.activePlayer = _fbPlayer;
            resetRuntimeAutoFillSession();
            let _fbIter = 0;
            const _fbResolved = _resolveCallMacros(_fbMacro.steps, _fbState.library.macros);
            const _fbPrepared = applyRuntimeDataToSteps(_fbResolved, _fbState.settings);
            store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: 0, steps: _fbPrepared } });
            function _fbNext() {
              if (_fbIter >= n || _fbPlayer._abort) {
                playerRuntime.activePlayer = null;
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: _fbPrepared.length, steps: _fbPrepared } });
                store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
                return;
              }
              _fbIter++;
              _fbPlayer._abort = false;
              _fbPlayer.play(_fbPrepared, {
                speed: _fbState.settings.speed ?? 1,
                vars: buildRuntimeVars(null, _fbState.settings),
                macroId: _fbMacro.id,
                ..._macroPlaybackMeta(_fbMacro),
                onStep: (step, index) => {
                  tryAutoFillRuntimeDataOnPage(_fbState.settings);
                  store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: _fbPrepared } });
                },
                onDone: _fbNext,
                onError: (err) => {
                  playerRuntime.activePlayer = null;
                  const errIdx = store.getState().playback.currentStepIndex;
                  store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
                }
              });
            }
            _fbNext();
          }
        );
        _startMacroPlay();
      }

      if (actionId === "macro-play-loop") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro) return;
        function _startLoopPlay() {
          const _lstate = store.getState();
          const _lmacro = _lstate.library.macros.find((m) => m.id === selectedId);
          if (!_lmacro) return;
          if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
          const _lCount = _lstate.playback.repeatCount;
          store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Reproduciendo "${_lmacro.name}" en bucle x${_lCount}` });
          const _LPlayerClass = globalScope.WebMaticPlayer;
          if (!_LPlayerClass || !Array.isArray(_lmacro.steps) || _lmacro.steps.length === 0) return;
          const _lPlayer = new _LPlayerClass();
          playerRuntime.activePlayer = _lPlayer;
          resetRuntimeAutoFillSession();
          let _lIter = 0;
          // Initialize panel with all steps before starting (call_macro references resolved)
          const _lResolvedSteps = _resolveCallMacros(_lmacro.steps, _lstate.library.macros);
          const _lPreparedSteps = applyRuntimeDataToSteps(_lResolvedSteps, _lstate.settings);
          store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: 0, steps: _lPreparedSteps } });
          function _lNext() {
            if (_lIter >= _lCount || _lPlayer._abort) {
              playerRuntime.activePlayer = null;
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: _lPreparedSteps.length, steps: _lPreparedSteps } });
              store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
              return;
            }
            _lIter++;
            _lPlayer._abort = false;
            _lPlayer.play(_lPreparedSteps, {
              speed: _lstate.settings.speed ?? 1,
              vars: buildRuntimeVars(null, _lstate.settings),
              macroId: _lmacro.id,
              ..._macroPlaybackMeta(_lmacro),
              onStep: (step, index) => {
                tryAutoFillRuntimeDataOnPage(_lstate.settings);
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: _lPreparedSteps } });
              },
              onDone: _lNext,
              onError: (err) => {
                playerRuntime.activePlayer = null;
                const errIdx = store.getState().playback.currentStepIndex;
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
                store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Error: ${err.message}` });
              }
            });
          }
          _lNext();
        }
        function _startLoopPlayN(n) {
          const _lnstate = store.getState();
          const _lnmacro = _lnstate.library.macros.find((m) => m.id === selectedId);
          if (!_lnmacro) return;
          if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
          store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Bucle x${n}: "${_lnmacro.name}"` });
          const _lnPlayer = new (globalScope.WebMaticPlayer)();
          playerRuntime.activePlayer = _lnPlayer;
          resetRuntimeAutoFillSession();
          let _lnIter = 0;
          const _lnResolved = _resolveCallMacros(_lnmacro.steps, _lnstate.library.macros);
          const _lnPrepared = applyRuntimeDataToSteps(_lnResolved, _lnstate.settings);
          store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: 0, steps: _lnPrepared } });
          function _lnNext() {
            if (_lnIter >= n || _lnPlayer._abort) {
              playerRuntime.activePlayer = null;
              store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: _lnPrepared.length, steps: _lnPrepared } });
              store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
              return;
            }
            _lnIter++;
            _lnPlayer._abort = false;
            _lnPlayer.play(_lnPrepared, {
              speed: _lnstate.settings.speed ?? 1,
              vars: buildRuntimeVars(null, _lnstate.settings),
              macroId: _lnmacro.id,
              ..._macroPlaybackMeta(_lnmacro),
              onStep: (step, index) => {
                tryAutoFillRuntimeDataOnPage(_lnstate.settings);
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: _lnPrepared } });
              },
              onDone: _lnNext,
              onError: (err) => {
                playerRuntime.activePlayer = null;
                const errIdx = store.getState().playback.currentStepIndex;
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
              }
            });
          }
          _lnNext();
        }
        createPlaybackFloating(
          () => {
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
          },
          () => addWaitHere(),
          () => { _startLoopPlay(); },
          () => {
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
            removePlaybackFloating();
          },
          (n) => { _startLoopPlayN(n); }
        );
        _startLoopPlay();
      }

      if (actionId === "macro-edit") {
        const opened = _openSelectedMacroInEditorWithReusableMetadata(meta?.macroId || null);
        if (!opened) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "No hay macro seleccionada para editar." });
        }
      }

      if (actionId === "script-editor-close") {
        store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_CLOSED });
      }

      if (actionId === "script-editor-tab") {
        const tab = meta?.tab || "visual";
        const panel = document.getElementById("webmatic-panel-root");
        const overlay = panel && panel.querySelector("[data-script-editor]");
        if (!overlay) return;
        const area = overlay.querySelector("[data-script-editor-area]");
        const container = overlay.querySelector("[data-step-visual-container]");
        const _stripWmJson = (s) => _stripWmJsonLine(s);
        if (tab === "visual" && seEditor && iimAdapter && area) {
          // Script → Visual: parse current textarea into step editor
          const storedFull = area.dataset ? String(area.dataset.wmFullScript || "") : "";
          const typedText = String(area.value || "");
          const canUseStoredFull = storedFull && _stripWmJson(storedFull).trim() === typedText.trim();
          const sourceScript = canUseStoredFull ? storedFull : typedText;
          const parsed = iimAdapter.importFromIim(sourceScript);
          seEditor.setSteps((parsed && parsed.steps) || []);
          if (typeof seEditor.setInventory === "function") {
            const _se = store.getState().ui.scriptEditor;
            const resolvedMeta = _resolveEditorMetadata(_se.meta || null, (parsed && parsed.steps) || []);
            seEditor.setInventory(resolvedMeta.inventories);
            if (typeof seEditor.setAutocompleteCatalogs === "function") {
              seEditor.setAutocompleteCatalogs(resolvedMeta.autocompleteCatalogs);
            }
            if (typeof seEditor.setMeta === "function") {
              seEditor.setMeta(_se.meta || null);
            }
          }
          if (!seEditor._onRecordRequest) {
            seEditor.setRecordRequestHandler((onDone) => { startInlineRecording(onDone); });
            seEditor.setPickerHandler((fieldName, onPicked) => { startElementPicker(fieldName, onPicked); });
          }
          _applyScriptTab(overlay, "visual");
          if (container) seEditor.mount(container, () => {});
        } else if (tab === "script" && seEditor && iimAdapter && area) {
          // Visual → Script: export current steps to textarea
          const steps = seEditor.getSteps();
          const script = iimAdapter.exportToIim({ steps, meta: typeof seEditor.getMeta === "function" ? seEditor.getMeta() : null });
          const displayScript = script.split("\n")
            .filter((l) => !l.trimStart().startsWith("// WM_JSON:")).join("\n");
          area.value = displayScript;
          area.dataset.wmFullScript = script;
          _syncScriptDefaultLayer(overlay, script);
          _applyScriptTab(overlay, "script");
        } else if (tab === "script" && area) {
          // Fallback: seEditor no disponible — volcar script desde store o wmFullScript
          const _se = store.getState().ui.scriptEditor;
          let _fbScript = String(area.dataset ? area.dataset.wmFullScript || "" : "");
          if (!_fbScript) _fbScript = String(_se.script || "");
          if (!_fbScript && Array.isArray(_se.draftSteps) && _se.draftSteps.length > 0 && iimAdapter) {
            try { _fbScript = iimAdapter.exportToIim({ steps: _se.draftSteps, meta: _se.meta || null }) || ""; } catch (_) {}
          }
          const _fbDisplay = _fbScript.split("\n").filter((l) => !l.trimStart().startsWith("// WM_JSON:")).join("\n");
          if (_fbDisplay.trim()) area.value = _fbDisplay;
          if (area.dataset) area.dataset.wmFullScript = _fbScript;
          _syncScriptDefaultLayer(overlay, _fbScript);
          _applyScriptTab(overlay, "script");
        } else {
          _applyScriptTab(overlay, tab);
        }
      }

      if (actionId === "script-editor-copy") {
        const panel = document.getElementById("webmatic-panel-root");
        let textToCopy = "";
        if (_seActiveTab === "visual" && seEditor && iimAdapter) {
          textToCopy = iimAdapter.exportToIim({ steps: seEditor.getSteps(), meta: typeof seEditor.getMeta === "function" ? seEditor.getMeta() : null });
        } else {
          const area = panel && panel.querySelector("[data-script-editor-area]");
          // Use the full script (with WM_JSON) stored in dataset; fall back to visible value
          textToCopy = (area && area.dataset && area.dataset.wmFullScript) ? area.dataset.wmFullScript : (area ? area.value : "");
        }
        navigator.clipboard.writeText(textToCopy).catch(() => {
          const area = panel && panel.querySelector("[data-script-editor-area]");
          if (area) { area.select(); document.execCommand("copy"); }
        });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Script copiado al portapapeles" });
      }

      if (actionId === "script-editor-save") {
        const panel = document.getElementById("webmatic-panel-root");
        const area = panel && panel.querySelector("[data-script-editor-area]");
        const currentState = store.getState();
        const macroId = currentState.ui.scriptEditor.macroId;
        const seState = currentState.ui.scriptEditor;
        const editorMeta = (seEditor && typeof seEditor.getMeta === "function") ? seEditor.getMeta() : (seState.meta || null);
        if (!macroId) {
          // No existing macro: act as Save As
          const name = await uiShell.wmModal("prompt", { message: "Nombre para la macro:", okLabel: "Guardar" });
          if (!name || !name.trim()) return;
          const stepsRaw = _resolveEditorSteps(area, seState, seState.draftSteps);
          const resolvedMeta = _resolveEditorMetadata(editorMeta, stepsRaw);
          const steps = _promoteChooseOptionWithInventories(stepsRaw, resolvedMeta.inventories);
          const macroMeta = _resolveEditorMetaForSteps(editorMeta, stepsRaw);
          const scriptToStore = iimAdapter ? iimAdapter.exportToIim({ steps, meta: macroMeta }) : (area ? area.value : "");
          const macro = {
            id: `macro_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            name: name.trim(),
            steps,
            script: scriptToStore,
            createdAt: Date.now()
          };
          if (macroMeta) macro.meta = macroMeta;
          store.dispatch({ type: contracts.ActionTypes.MACRO_SAVED, payload: macro });
          store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_CLOSED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Macro "${macro.name}" guardada` });
          chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
        } else {
          const originalSteps = currentState.library.macros.find((m) => m.id === macroId)?.steps || [];
          const stepsRaw = _resolveEditorSteps(area, seState, originalSteps);
          const resolvedMeta = _resolveEditorMetadata(editorMeta, stepsRaw);
          const steps = _promoteChooseOptionWithInventories(stepsRaw, resolvedMeta.inventories);
          const macroMeta = _resolveEditorMetaForSteps(editorMeta, stepsRaw);
          const scriptToStore = iimAdapter ? iimAdapter.exportToIim({ steps, meta: macroMeta }) : (area ? area.value : "");
          const updatedMacros = currentState.library.macros.map((m) =>
            m.id === macroId ? { ...m, script: scriptToStore, steps, ...(macroMeta ? { meta: macroMeta } : {}) } : m
          );
          store.dispatch({ type: contracts.ActionTypes.LIBRARY_LOADED, payload: updatedMacros });
          store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_CLOSED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Macro guardada" });
          chrome.storage.local.set({ webmaticMacros: updatedMacros });
        }
      }

      if (actionId === "script-editor-saveas") {
        const panel = document.getElementById("webmatic-panel-root");
        const area = panel && panel.querySelector("[data-script-editor-area]");
        const name = await uiShell.wmModal("prompt", { message: "Nombre para la nueva macro:", okLabel: "Guardar" });
        if (!name || !name.trim()) return;
        const seStateSa = store.getState().ui.scriptEditor;
        const editorMetaSa = (seEditor && typeof seEditor.getMeta === "function") ? seEditor.getMeta() : (seStateSa.meta || null);
        const stepsRaw = _resolveEditorSteps(area, seStateSa, seStateSa.draftSteps);
        const resolvedMetaSa = _resolveEditorMetadata(editorMetaSa, stepsRaw);
        const steps = _promoteChooseOptionWithInventories(stepsRaw, resolvedMetaSa.inventories);
        const macroMetaSa = _resolveEditorMetaForSteps(editorMetaSa, stepsRaw);
        const scriptToStoreSa = iimAdapter ? iimAdapter.exportToIim({ steps, meta: macroMetaSa }) : (area ? area.value : "");
        const macro = {
          id: `macro_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          name: name.trim(),
          steps,
          script: scriptToStoreSa,
          createdAt: Date.now()
        };
        if (macroMetaSa) macro.meta = macroMetaSa;
        store.dispatch({ type: contracts.ActionTypes.MACRO_SAVED, payload: macro });
        store.dispatch({ type: contracts.ActionTypes.SCRIPT_EDITOR_CLOSED });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Macro "${macro.name}" guardada` });
        chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
      }

      if (actionId === "macro-rename") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro) {
          return;
        }
        const newName = await uiShell.wmModal("prompt", { message: "Nuevo nombre para la macro:", defaultValue: macro.name, okLabel: "Renombrar" });
        if (newName && newName.trim()) {
          store.dispatch({ type: contracts.ActionTypes.MACRO_RENAMED, payload: { id: selectedId, name: newName.trim() } });
          chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
        }
      }

      if (actionId === "macro-delete") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro) {
          return;
        }
        const ok = await uiShell.wmModal("confirm", { message: `¿Eliminar la macro "${macro.name}"?`, okLabel: "Eliminar", cancelLabel: "Cancelar" });
        if (ok) {
          store.dispatch({ type: contracts.ActionTypes.MACRO_DELETED, payload: selectedId });
          chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
        }
      }

      if (actionId === "macro-export") {
        const currentState = store.getState();
        const selectedId = currentState.library.selectedMacroId;
        const macro = currentState.library.macros.find((m) => m.id === selectedId);
        if (!macro || !macroJsonApi) return;

        // Export defensivo: si la macro fue guardada antes de una mejora de
        // promoción, recalculamos steps promovidos usando el inventario persistido.
        const exportSteps = macro.steps || [];
        const resolvedMetaForExport = _resolveEditorMetadata(macro.meta || null, exportSteps);
        const promotedSteps = _promoteChooseOptionWithInventories(exportSteps, resolvedMetaForExport.inventories);
        const exportMacro = {
          ...macro,
          steps: promotedSteps,
          script: iimAdapter
            ? iimAdapter.exportToIim({ steps: promotedSteps, meta: _resolveEditorMetaForSteps(macro.meta || null, exportSteps) })
            : String(macro.script || "")
        };

        const payload = macroJsonApi.createMacroPayload(exportMacro);
        const content = JSON.stringify(payload, null, 2);
        const safeName = macro.name.replace(/[^a-z0-9_\-]/gi, "_") + ".json";
        chrome.runtime.sendMessage({ type: "EXPORT_FILE", filename: `macros/${safeName}`, content, saveAs: true }, (resp) => {
          void chrome.runtime.lastError;
          void _incrementAppContentStats({ macroExports: 1 });
          if (resp && resp.folder) {
            store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Guardado en ${resp.folder}` });
          }
        });
      }

      if (actionId === "macro-import-json" || actionId === "macro-import-iim") {
        if (!macroJsonApi) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Importación JSON no disponible." });
          return;
        }
        const panel = document.getElementById("webmatic-panel-root");
        const fileInput = panel && panel.querySelector("[data-import-json-file-input]");
        if (!fileInput) return;

        const onJsonChosen = (e) => {
          fileInput.removeEventListener("change", onJsonChosen);
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const raw = String(ev.target.result || "");
              const parsedMacro = macroJsonApi.parseMacroJson(raw);
              const rawSteps = Array.isArray(parsedMacro.steps) ? parsedMacro.steps : [];
              const inventories = _resolveEditorMetadata(parsedMacro.meta || null, rawSteps).inventories;
              const steps = _promoteChooseOptionWithInventories(rawSteps, inventories);
              if (steps.length === 0) {
                store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "El archivo JSON no contiene pasos válidos." });
                return;
              }

              const baseName = String(parsedMacro.name || file.name || "macro")
                .replace(/\.[^.]+$/, "")
                .trim() || "macro_importada";
              const existingNames = new Set((store.getState().library.macros || []).map((m) => String(m.name || "").toLowerCase()));
              let macroName = baseName;
              let idx = 2;
              while (existingNames.has(macroName.toLowerCase())) {
                macroName = `${baseName} (${idx})`;
                idx += 1;
              }

              const script = (iimAdapter && typeof iimAdapter.exportToIim === "function")
                ? iimAdapter.exportToIim({ steps, meta: _resolveEditorMetaForSteps(parsedMacro.meta || null, rawSteps) })
                : String(parsedMacro.script || "");

              const macro = {
                id: `macro_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                name: macroName,
                steps,
                script,
                createdAt: Number(parsedMacro.createdAt) || Date.now()
              };
              if (parsedMacro.meta && typeof parsedMacro.meta === "object") {
                macro.meta = parsedMacro.meta;
              }

              store.dispatch({ type: contracts.ActionTypes.MACRO_SAVED, payload: macro });
              store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: macro.id });
              chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
              void _incrementAppContentStats({ macroImports: 1 });
              store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Macro JSON importada: "${macroName}"` });
            } catch (err) {
              store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Error al importar archivo JSON." });
            } finally {
              fileInput.value = "";
            }
          };
          reader.readAsText(file);
        };

        fileInput.addEventListener("change", onJsonChosen);
        fileInput.click();
      }

      if (actionId === "macros-restore-internal") {
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Restaurando macros internas..." });
        const restored = await _restoreMacrosFromInternalSnapshot("replace");
        if (!restored || !restored.ok) {
          const reason = restored && restored.reason === "empty-sync"
            ? "No hay backup interno disponible en este navegador/perfil."
            : "No se pudo restaurar desde backup interno.";
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: reason });
          await uiShell.wmModal("alert", {
            message: `${reason}\n\nSugerencia: usa "Importar backup (.json)" con tu archivo de backup.` ,
            okLabel: "Aceptar"
          });
          return;
        }
        const sourceLabel = restored.source === "site" ? "sitio" : "sync";
        store.dispatch({
          type: contracts.ActionTypes.STATUS_MESSAGE_SET,
          payload: `Restauradas ${restored.restored} macro(s) desde ${sourceLabel}. Total actual: ${restored.total}.`
        });
        await uiShell.wmModal("alert", {
          message: `Restauración interna completada.\nFuente: ${sourceLabel}\nMacros recuperadas: ${restored.restored}\nTotal actual: ${restored.total}`,
          okLabel: "Aceptar"
        });
      }

      if (actionId === "macros-backup-all") {
        const currentState = store.getState();
        const backupApi = fullBackupApi;
        if (!backupApi) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Modulo de backup no disponible." });
          return;
        }
        const settings = await settingsApi.getSettings();
        const storage = await getLocalStorageValues(["webmaticExportFolder", "webmaticHelpTheme"]);
        const payload = backupApi.createFullBackupPayload({
          macros: currentState.library.macros || [],
          settings,
          ui: {
            panelSide: currentState.ui.panelSide,
            panelWidth: currentState.ui.panelWidth,
            mode: currentState.ui.mode
          },
          metadata: {
            profiles: Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles : [],
            storage: {
              webmaticExportFolder: storage.webmaticExportFolder || "",
              webmaticHelpTheme: storage.webmaticHelpTheme || null
            }
          }
        });
        const filename = "backup/webmatic-full-backup-v1.json";
        const content = JSON.stringify(payload, null, 2);
        chrome.runtime.sendMessage({ type: "EXPORT_FILE", filename, content, saveAs: true }, (resp) => {
          void chrome.runtime.lastError;
          void _incrementAppContentStats({ fullBackupsCreated: 1 });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Backup completo guardado: ${filename}` });
        });
      }

      if (actionId === "macros-import-all") {
        // Trigger the hidden file input inside the panel
        const panel = document.getElementById("webmatic-panel-root");
        const fileInput = panel && panel.querySelector("[data-import-file-input]");
        if (!fileInput) return;

        // One-shot listener: resolves when the user picks a file
        const onFileChosen = (e) => {
          fileInput.removeEventListener("change", onFileChosen);
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            (async () => {
              try {
                const backupApi = fullBackupApi;
                if (!backupApi) throw new Error("Modulo de backup no disponible");
                const parsedJson = backupApi.safeParseJson(ev.target.result);
                const parsed = backupApi.parseBackupObject(parsedJson);

                if (parsed.kind === "macros-only") {
                  const importedMacros = parsed.data.macros;
                  if (importedMacros.length === 0) {
                    store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Archivo sin macros válidas." });
                    return;
                  }
                  const existingMacros = store.getState().library.macros;
                  const importedIds = new Set(importedMacros.map((m) => m.id));
                  const kept = existingMacros.filter((m) => !importedIds.has(m.id));
                  const merged = [...kept, ...importedMacros];
                  store.dispatch({ type: contracts.ActionTypes.LIBRARY_LOADED, payload: merged });
                  chrome.storage.local.set({ webmaticMacros: merged });
                  void _incrementAppContentStats({ macroImports: 1 });
                  store.dispatch({
                    type: contracts.ActionTypes.STATUS_MESSAGE_SET,
                    payload: `${importedMacros.length} macro${importedMacros.length !== 1 ? "s" : ""} importada${importedMacros.length !== 1 ? "s" : ""} (backup legacy)`
                  });
                  return;
                }

                const full = parsed.data;
                const importedMacros = full.macros || [];
                const importedProfiles = Array.isArray(full.metadata && full.metadata.profiles) ? full.metadata.profiles : [];
                const ok = await uiShell.wmModal("confirm", {
                  message: `Se importarán ${importedMacros.length} macro(s) y ${importedProfiles.length} perfil(es) de metadatos. Las macros con el mismo ID se actualizarán, sin borrar macros no incluidas.`,
                  okLabel: "Restaurar",
                  cancelLabel: "Cancelar"
                });
                if (!ok) return;

                const existingMacrosForMerge = Array.isArray(store.getState().library.macros) ? store.getState().library.macros : [];
                const importedIdsFull = new Set(importedMacros.map((m) => m.id));
                const keptFull = existingMacrosForMerge.filter((m) => !importedIdsFull.has(m.id));
                const mergedFull = [...keptFull, ...importedMacros];
                store.dispatch({ type: contracts.ActionTypes.LIBRARY_LOADED, payload: mergedFull });
                chrome.storage.local.set({ webmaticMacros: mergedFull });
                await _savePageMetadataProfiles(importedProfiles);

                const mergedSettings = await settingsApi.saveSettings(full.settings || {});
                const themeSettings = resolveTheme(mergedSettings.themeMode, mergedSettings.themeVariant);
                const runtimeDataTemplates = normalizeRuntimeDataTemplates(mergedSettings.runtimeDataTemplates);
                const runtimeTemplateSelectedId = sanitizeRuntimeTemplateSelectedId(mergedSettings.runtimeTemplateSelectedId, runtimeDataTemplates);
                pageMetaMaxProfiles = _normalizePageMetaMaxProfiles(mergedSettings.pageMetaMaxProfiles);
                store.dispatch({ type: contracts.ActionTypes.PANEL_SIDE_SET, payload: mergedSettings.panelSide || "left" });
                store.dispatch({ type: contracts.ActionTypes.PANEL_WIDTH_SET, payload: 260 });
                store.dispatch({
                  type: contracts.ActionTypes.SETTINGS_UPDATED,
                  payload: {
                    ...themeSettings,
                    speed: mergedSettings.speed ?? 1,
                    panelOpacity: mergedSettings.panelOpacity ?? 1,
                    waitThreshold: mergedSettings.waitThreshold ?? 3,
                    runtimeDataEnabled: Boolean(mergedSettings.runtimeDataEnabled),
                    runtimeDataType: normalizeRuntimeDataType(mergedSettings.runtimeDataType),
                    runtimeCustomTypes: normalizeRuntimeCustomTypes(mergedSettings.runtimeCustomTypes),
                    runtimeData: mergedSettings.runtimeData || "",
                    runtimeDataItems: normalizeRuntimeDataItems(mergedSettings.runtimeDataItems),
                    runtimeDataTemplates,
                    runtimeTemplateSelectedId,
                    downloadFolder: mergedSettings.downloadFolder || "",
                    pageMetaMaxProfiles
                  }
                });

                const metaStorage = (full.metadata && full.metadata.storage) ? full.metadata.storage : {};
                const patch = {};
                if (Object.prototype.hasOwnProperty.call(metaStorage, "webmaticExportFolder")) {
                  patch.webmaticExportFolder = metaStorage.webmaticExportFolder || "";
                }
                if (Object.prototype.hasOwnProperty.call(metaStorage, "webmaticHelpTheme")) {
                  patch.webmaticHelpTheme = metaStorage.webmaticHelpTheme || null;
                }
                if (Object.keys(patch).length > 0) {
                  chrome.storage.local.set(patch);
                }

                void _incrementAppContentStats({ fullBackupsImported: 1 });
                store.dispatch({
                  type: contracts.ActionTypes.STATUS_MESSAGE_SET,
                  payload: `Importación completa OK: ${importedMacros.length} macro(s), ${importedProfiles.length} perfil(es) y settings`
                });
              } catch (err) {
                store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Error al importar backup." });
              } finally {
                fileInput.value = "";
              }
            })();
          };
          reader.readAsText(file);
        };

        fileInput.addEventListener("change", onFileChosen);
        fileInput.click();
      }

      if (actionId === "page-meta-capture") {
        const classification = _collectCensableFieldsForCapture(document);
        try {
          globalScope.__webmaticLastCaptureClassification = {
            at: Date.now(),
            isIaposAuditPage: !!classification.isIaposAuditPage,
            included: classification.included.map((f) => ({ selector: f.selector, id: f.id, name: f.name, kind: f.captureKind, reason: f.reason })),
            excluded: classification.excluded.slice(0, 80)
          };
        } catch (_e) { /* ignore */ }
        const autoSelected = classification.included;

        if (autoSelected.length === 0) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "No se detectaron campos censables en esta página." });
          return;
        }

        // Confirmación breve y limpia, sin listar todos los campos.
        const autoSelectedCounts = autoSelected.reduce((acc, f) => {
          const el = (() => { try { return document.querySelector(f.selector); } catch (_e) { return null; } })();
          const tag = String(el && el.tagName ? el.tagName : "").toLowerCase();
          const inputType = String((el && el.getAttribute && el.getAttribute("type")) || "").toLowerCase();
          if (tag === "select") acc.selects += 1;
          else if (tag === "input" && (inputType === "checkbox" || inputType === "radio")) acc.checks += 1;
          else acc.autocomplete += 1;
          return acc;
        }, { selects: 0, checks: 0, autocomplete: 0 });
        const okCapture = await uiShell.wmModal("confirm", {
          message: `Se censarán ${autoSelected.length} campos de la página.\nSelects: ${autoSelectedCounts.selects} · Checks: ${autoSelectedCounts.checks} · Autocomplete: ${autoSelectedCounts.autocomplete}\n\n¿Continuar?`,
          okLabel: "Capturar",
          cancelLabel: "Cancelar"
        });
        if (!okCapture) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Captura cancelada." });
          return;
        }

        const selectedFieldBySelector = new Map(autoSelected.map((f) => [f.selector, f]));
        const selectedSelectors = autoSelected.map((f) => f.selector);
        if (selectedSelectors.length === 0) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "No hay selectores válidos para censar." });
          return;
        }

        const duplicate = _findLikelyDuplicatePageProfile(location && location.href ? location.href : "", selectedSelectors);
        if (duplicate) {
          const p = duplicate.profile || {};
          const capturedAtIso = Number(p.capturedAt) ? new Date(Number(p.capturedAt)).toLocaleString() : "desconocido";
          const stats = p.stats || {};
          const okRecapture = await uiShell.wmModal("confirm", {
            message: `Ya existe un perfil similar para esta página.\nÚltima captura: ${capturedAtIso}\nControles: ${Number(stats.controls) || 0}\nSelectores con opciones: ${Number(stats.selectorsWithOptions) || 0}\nCoincidencia de campos: ${duplicate.matched}/${duplicate.requested}\n\n¿Deseas recapturar igual?`,
            okLabel: "Recapturar",
            cancelLabel: "Reutilizar"
          });
          if (!okRecapture) {
            const opened = _openSelectedMacroInEditorWithReusableMetadata();
            if (opened) {
              store.dispatch({
                type: contracts.ActionTypes.STATUS_MESSAGE_SET,
                payload: `Reutilizando metadatos existentes (${duplicate.matched}/${duplicate.requested} campos). Editor abierto.`
              });
            } else {
              store.dispatch({
                type: contracts.ActionTypes.STATUS_MESSAGE_SET,
                payload: `Reutilizando metadatos existentes (${duplicate.matched}/${duplicate.requested} campos ya cubiertos).`
              });
            }
            return;
          }
        }

        _setPageMetaCaptureButtonProgress(1, true);
        _setPageMetaCaptureOverlayProgress(1, true, "Capturando");
        try {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Capturando metadatos..." });
          _captureAndStoreReusablePageMetadata._progressCb = (pct, phase) => {
            _setPageMetaCaptureButtonProgress(pct, true);
            _setPageMetaCaptureOverlayProgress(pct, true, phase || "Capturando");
          };
          const captureStartedAt = Date.now();
          const res = await _captureAndStoreReusablePageMetadata(selectedSelectors);
          const captureElapsedMs = Math.max(0, Date.now() - captureStartedAt);
          const captureElapsedSeconds = Math.round((captureElapsedMs / 100)) / 10;
          const controls = res && res.profile && res.profile.stats ? res.profile.stats.controls : 0;
          const opts = res && res.profile && res.profile.stats ? res.profile.stats.selectorsWithOptions : 0;
          const hidden = (res && res.hiddenCatalogSummary) || {};
          const hiddenFields = Number(hidden.fieldsWithOptions) || 0;
          const hiddenScanned = Number(hidden.fieldsScanned) || 0;
          const hiddenOptions = Number(hidden.options) || 0;
          const hiddenMode = String(hidden.mode || "runtime");
          const hiddenSelected = Number(hidden.fieldsSelected) || selectedSelectors.length;
          const total = res && Number.isFinite(res.total) ? res.total : (Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles.length : 0);
          store.dispatch({
            type: contracts.ActionTypes.STATUS_MESSAGE_SET,
            payload: `Captura lista: ${controls} controles, ${opts} selectores y ${hiddenOptions} opciones (${hiddenScanned} campos, modo: ${hiddenMode}). Perfiles: ${total}`
          });
          // Cerrar overlay ANTES del modal
          _setPageMetaCaptureOverlayProgress(100, false);
          _setPageMetaCaptureButtonProgress(100, false);

          // Armar badges por campo seleccionado con su conteo de opciones
          const catalogs = (res && res.profile && res.profile.autocompleteCatalogs) || {};
          const fieldRows = selectedSelectors.map((sel) => {
            const label = _friendlyCaptureFieldName(selectedFieldBySelector.get(sel) || sel);
            const optCount = Array.isArray(catalogs[sel]) ? catalogs[sel].length : 0;
            return { label, optCount };
          });

          // Agregar por nombre normalizado para evitar badges duplicados.
          const grouped = new Map();
          fieldRows.forEach((r) => {
            const key = String(r.label || "").toLowerCase().replace(/\s+/g, " ").trim();
            const prev = grouped.get(key) || { label: r.label, optCount: 0 };
            prev.optCount += Number(r.optCount) || 0;
            grouped.set(key, prev);
          });
          const uniqueRows = Array.from(grouped.values());
          const fieldBadgesHtml = uniqueRows.map((r) => {
            const safeLabel = String(r.label || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const safeCount = Number(r.optCount) || 0;
            return `<span class="wm-badge"><span>${safeLabel}</span><span class="wm-badge-count">${safeCount}</span></span>`;
          }).join("");

          const totalOpts = uniqueRows.reduce((acc, r) => {
            return acc + (Number(r.optCount) || 0);
          }, 0) || hiddenOptions;

          await uiShell.wmModal("alert", {
            messageHtml: `<span class="wm-line-title">Metadatos guardados correctamente.</span><span>Campos censados: ${uniqueRows.length}</span><span>Tiempo total de recoleccion: ${captureElapsedSeconds}s</span><span style="display:block;margin-top:6px;">Nombres de campo:</span><span class="wm-badge-wrap">${fieldBadgesHtml}</span><span>Total opciones ocultas capturadas: ${totalOpts}</span>`,
            okLabel: "Aceptar"
          });
        } catch (err) {
          const detail = err && err.message ? String(err.message) : "sin detalle";
          console.error("[WebMatic] page-meta-capture error:", err);
          _setPageMetaCaptureOverlayProgress(100, false);
          _setPageMetaCaptureButtonProgress(100, false);
          store.dispatch({
            type: contracts.ActionTypes.STATUS_MESSAGE_SET,
            payload: `No se pudo capturar metadatos (${detail}).`
          });
          await uiShell.wmModal("alert", {
            message: `Error al capturar metadatos.\nDetalle: ${detail}`,
            okLabel: "Aceptar"
          });
        } finally {
          _captureAndStoreReusablePageMetadata._progressCb = null;
          _setPageMetaCaptureOverlayProgress(100, false);
          _setPageMetaCaptureButtonProgress(100, false);
        }
      }

      if (actionId === "page-meta-export") {
        const list = Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles : [];
        if (list.length === 0) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "No hay metadatos para exportar." });
          return;
        }
        const payload = _serializePageMetadataBackup(list);
        const content = JSON.stringify(payload, null, 2);
        chrome.runtime.sendMessage({ type: "GET_FOLDER_NAME" }, (resp) => {
          void chrome.runtime.lastError;
          const hasConfiguredFolder = !!(resp && typeof resp.name === "string" && resp.name.trim());
          const filename = hasConfiguredFolder
            ? "metadata/webmatic-page-metadata-v1.json"
            : "WebMatic/metadata/webmatic-page-metadata-v1.json";
          chrome.runtime.sendMessage({ type: "EXPORT_FILE", filename, content, saveAs: true }, () => {
            void chrome.runtime.lastError;
            void _incrementAppContentStats({ pageMetaExports: 1 });
            store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Metadatos exportados: ${filename}` });
          });
        });
      }

      if (actionId === "page-meta-export-tables") {
        const list = Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles : [];
        if (list.length === 0) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "No hay metadatos para exportar en tablas." });
          return;
        }
        const files = _buildPageMetadataFieldExports(list);
        if (!Array.isArray(files) || files.length === 0) {
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "No se generaron tablas de metadatos." });
          return;
        }
        chrome.runtime.sendMessage({ type: "GET_FOLDER_NAME" }, (resp) => {
          void chrome.runtime.lastError;
          let pending = files.length;
          files.forEach((f, idx) => {
            chrome.runtime.sendMessage({
              type: "EXPORT_FILE",
              filename: String(f && f.filename ? f.filename : "metadata/fields/field.txt"),
              content: String(f && f.content ? f.content : ""),
              saveAs: false
            }, () => {
              void chrome.runtime.lastError;
              pending -= 1;
              if (pending > 0) return;
              void _incrementAppContentStats({ pageMetaExports: 1 });
              store.dispatch({
                type: contracts.ActionTypes.STATUS_MESSAGE_SET,
                payload: `Tablas de metadatos exportadas (${files.length} archivo(s), ${Math.max(0, files.length - 1)} campo(s)).`
              });
            });
          });
          if (files.length === 0) {
            void chrome.runtime.lastError;
            store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "No se generaron archivos de tablas." });
          }
        });
      }

      if (actionId === "page-meta-import") {
        const panel = document.getElementById("webmatic-panel-root");
        const fileInput = panel && panel.querySelector("[data-import-page-meta-file-input]");
        if (!fileInput) return;

        const onFileChosen = (e) => {
          fileInput.removeEventListener("change", onFileChosen);
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            (async () => {
              try {
                const imported = _parsePageMetadataBackup(ev.target.result);
                if (!Array.isArray(imported) || imported.length === 0) {
                  store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Archivo sin perfiles de metadatos válidos." });
                  return;
                }
                const existing = Array.isArray(pageMetadataProfiles) ? pageMetadataProfiles.slice() : [];
                const merged = [...imported, ...existing];
                const saved = await _savePageMetadataProfiles(merged);
                void _incrementAppContentStats({ pageMetaImports: 1 });
                store.dispatch({
                  type: contracts.ActionTypes.STATUS_MESSAGE_SET,
                  payload: `Metadatos importados: ${imported.length} perfil(es). Total: ${saved.length}`
                });
              } catch (err) {
                store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Error al importar metadatos." });
              } finally {
                fileInput.value = "";
              }
            })();
          };
          reader.readAsText(file);
        };

        fileInput.addEventListener("change", onFileChosen);
        fileInput.click();
      }

      if (actionId === "save-confirm") {
        const name = String(meta?.name || "").trim();
        if (!name) {
          return;
        }
        const currentState = store.getState();
        const invList = Array.isArray(recorderRuntime.pageInventories) ? recorderRuntime.pageInventories : [];
        const reusableMeta = _resolveReusableMetadataForSteps(currentState.draft.steps);
        const promotedSteps = _promoteChooseOptionWithInventories(
          currentState.draft.steps,
          [...invList, ...(reusableMeta.inventories || [])]
        );
        const runtimeMeta = _recordingMeta() || {};
        const mergedInventories = [
          ...(Array.isArray(runtimeMeta.pageInventories) ? runtimeMeta.pageInventories : []),
          ...(reusableMeta.inventories || [])
        ];
        const mergedCatalogs = _mergeCatalogMaps(
          reusableMeta.autocompleteCatalogs || {},
          runtimeMeta.autocompleteCatalogs || {}
        );
        const fallbackMeta = (mergedInventories.length > 0 || Object.keys(mergedCatalogs).length > 0)
          ? {
              ...(runtimeMeta && typeof runtimeMeta === "object" ? runtimeMeta : {}),
              ...(mergedInventories.length > 0 ? { pageInventories: mergedInventories } : {}),
              ...(Object.keys(mergedCatalogs).length > 0 ? { autocompleteCatalogs: mergedCatalogs } : {})
            }
          : undefined;
        const scriptWithMeta = iimAdapter
          ? iimAdapter.exportToIim({ steps: promotedSteps, meta: fallbackMeta || null })
          : String(meta?.script || currentState.ui.saveModal.script || "");
        const macro = {
          id: `macro_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          name,
          steps: promotedSteps,
          script: scriptWithMeta,
          createdAt: Date.now()
        };
        if (fallbackMeta) macro.meta = fallbackMeta;
        store.dispatch({ type: contracts.ActionTypes.MACRO_SAVED, payload: macro });
        store.dispatch({ type: contracts.ActionTypes.SAVE_MODAL_CLOSED });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Macro "${name}" guardada` });
        chrome.storage.local.set({ webmaticMacros: store.getState().library.macros });
      }

      if (actionId === "save-cancel") {
        store.dispatch({ type: contracts.ActionTypes.SAVE_MODAL_CLOSED });
      }
    }
  );

  let _prevPanelVisible = false;

  const unsubscribeRender = store.subscribe((state) => {
    uiShell.render(state);

    // Mount / unmount visual step editor when script editor opens or closes
    const seOpen = state.ui.scriptEditor.open;
    if (seOpen && !_prevScriptEditorOpen) {
      // Script editor just opened — initialize step editor in visual tab
      const panel = document.getElementById("webmatic-panel-root");
      const overlay = panel && panel.querySelector("[data-script-editor]");
      const container = overlay && overlay.querySelector("[data-step-visual-container]");
      if (container && globalScope.WebMaticStepEditor) {
        if (!seEditor) {
          seEditor = new globalScope.WebMaticStepEditor();
          seEditor.setRecordRequestHandler((onDone) => {
            startInlineRecording(onDone);
          });
          seEditor.setPickerHandler((fieldName, onPicked) => { startElementPicker(fieldName, onPicked); });
        }
        const seState = state.ui.scriptEditor;
        const steps = seState.draftSteps && seState.draftSteps.length > 0
          ? seState.draftSteps
          : (iimAdapter ? iimAdapter.importFromIim(seState.script || "").steps : []);
        seEditor.setSteps(steps);
        if (typeof seEditor.setInventory === "function") {
          const resolvedMeta = _resolveEditorMetadata(seState.meta || null, steps);
          seEditor.setInventory(resolvedMeta.inventories);
          if (typeof seEditor.setAutocompleteCatalogs === "function") {
            seEditor.setAutocompleteCatalogs(resolvedMeta.autocompleteCatalogs);
          }
        }
        if (typeof seEditor.setMeta === "function") {
          seEditor.setMeta(seState.meta || null);
        }
        const area = overlay && overlay.querySelector("[data-script-editor-area]");
        if (area) {
          let openScript = String(seState.script || "");
          if (!openScript && Array.isArray(steps) && steps.length > 0 && iimAdapter) {
            try {
              openScript = iimAdapter.exportToIim({
                steps,
                meta: typeof seEditor.getMeta === "function" ? seEditor.getMeta() : (seState.meta || null)
              }) || "";
            } catch (_e) {
              openScript = "";
            }
          }
          if (area.dataset) area.dataset.wmFullScript = openScript;
          const displayScript = String(openScript || "").split("\n")
            .filter((l) => !l.trimStart().startsWith("// WM_JSON:"))
            .join("\n");
          area.value = displayScript;
          _syncScriptDefaultLayer(overlay, openScript);
        }
        _applyScriptTab(overlay, "visual");
        seEditor.mount(container, () => {});
      }
    }
    if (!seOpen && _prevScriptEditorOpen) {
      if (seEditor) seEditor.unmount();
      _seActiveTab = "visual";
    }
    _prevScriptEditorOpen = seOpen;

    // Notify background when panel visibility changes so it can restore it after navigation
    if (state.ui.panelVisible !== _prevPanelVisible) {
      _prevPanelVisible = state.ui.panelVisible;
      chrome.runtime.sendMessage({ type: "PANEL_STATE_CHANGED", visible: state.ui.panelVisible }, () => {
        void chrome.runtime.lastError;
      });
    }

    // Update global floating button label with live step count
    const floatingBtn = document.getElementById(FLOATING_BTN_ID);
    if (floatingBtn && state.recorder.isRecording) {
      const label = floatingBtn.querySelector("span:last-child");
      if (label) {
        const count = state.draft.steps.length;
        label.textContent = count > 0
          ? `Grabando (${count} paso${count !== 1 ? "s" : ""}) — Clic para detener`
          : "Grabando — Clic para detener";
      }
    }

    // Update playback floating panel whenever it exists (playing OR stopped)
    if (document.getElementById(FLOATING_PLAYER_ID)) {
      updatePlaybackFloating(state);
    }

    if (state.ui.panelVisible && !state.ui.isFloatingRecorderVisible) {
      const layout = geometry.calculateLayout(
        window.innerWidth,
        window.innerHeight,
        state.ui.panelWidth,
        state.ui.panelSide
      );
      geometry.applyLayoutToDocument(layout, state.ui.panelSide);
    } else {
      document.documentElement.style.marginLeft = "0px";
      document.documentElement.style.marginRight = "0px";
    }
  });

  (async () => {
    const localSettingsRaw = await getLocalStorageValues([SETTINGS_STORAGE_KEY]);
    const hasLocalSettings = !!(localSettingsRaw && localSettingsRaw[SETTINGS_STORAGE_KEY] && typeof localSettingsRaw[SETTINGS_STORAGE_KEY] === "object");
    let settings = await settingsApi.getSettings();
    let restoredSettingsFrom = "local";
    if (!hasLocalSettings) {
      const recoveredSettings = await _loadSettingsSyncSnapshot();
      if (recoveredSettings && typeof recoveredSettings === "object") {
        settings = { ...settings, ...recoveredSettings };
        restoredSettingsFrom = "sync";
        await setLocalStorageValues({ [SETTINGS_STORAGE_KEY]: settings });
      } else {
        const siteSettings = _loadSiteSurvivalSettings();
        if (siteSettings && typeof siteSettings === "object") {
          settings = { ...settings, ...siteSettings };
          restoredSettingsFrom = "site";
          await setLocalStorageValues({ [SETTINGS_STORAGE_KEY]: settings });
        }
      }
    }
    const themeSettings = resolveTheme(settings.themeMode, settings.themeVariant);
    const runtimeDataTemplates = normalizeRuntimeDataTemplates(settings.runtimeDataTemplates);
    const runtimeTemplateSelectedId = sanitizeRuntimeTemplateSelectedId(settings.runtimeTemplateSelectedId, runtimeDataTemplates);
    pageMetaMaxProfiles = _normalizePageMetaMaxProfiles(settings.pageMetaMaxProfiles);
    store.dispatch({ type: contracts.ActionTypes.PANEL_WIDTH_SET, payload: 260 });
    store.dispatch({ type: contracts.ActionTypes.PANEL_SIDE_SET, payload: settings.panelSide });
    store.dispatch({
      type: contracts.ActionTypes.SETTINGS_UPDATED,
      payload: {
        ...themeSettings,
        speed: settings.speed ?? 1,
        panelOpacity: settings.panelOpacity ?? 1,
        waitThreshold: settings.waitThreshold ?? 3,
        runtimeDataEnabled: Boolean(settings.runtimeDataEnabled),
        runtimeDataType: normalizeRuntimeDataType(settings.runtimeDataType),
        runtimeCustomTypes: normalizeRuntimeCustomTypes(settings.runtimeCustomTypes),
        runtimeData: settings.runtimeData || "",
        runtimeDataItems: normalizeRuntimeDataItems(settings.runtimeDataItems),
        runtimeDataTemplates,
        runtimeTemplateSelectedId,
        downloadFolder: settings.downloadFolder || "",
        pageMetaMaxProfiles
      }
    });
    if (Array.isArray(pageMetadataProfiles) && pageMetadataProfiles.length > pageMetaMaxProfiles) {
      void _savePageMetadataProfiles(pageMetadataProfiles.slice(0, pageMetaMaxProfiles));
    }
    lastSettingsPersistHash = _simpleStableHash(JSON.stringify(settings && typeof settings === "object" ? settings : {}));
    settingsPersistenceReady = true;
    store.dispatch({
      type: contracts.ActionTypes.STATUS_MESSAGE_SET,
      payload: restoredSettingsFrom === "local"
        ? "Configuracion cargada"
        : `Configuracion restaurada desde backup ${restoredSettingsFrom}.`
    });
  })();

  _loadAppContentStats().then(() => {
    _refreshPlaySummary();
  }).catch(() => {
    appContentStats = { ...DEFAULT_APP_CONTENT_STATS };
    _refreshPlaySummary();
  });

  _loadPageMetadataProfiles().catch(() => {
    pageMetadataProfiles = [];
    _refreshPlaySummary();
  });

  // Restore saved export folder name from background (extension-origin IndexedDB)
  chrome.runtime.sendMessage({ type: "GET_FOLDER_NAME" }, (resp) => {
    void chrome.runtime.lastError;
    if (resp && resp.name) {
      store.dispatch({ type: contracts.ActionTypes.SETTINGS_UPDATED, payload: { downloadFolder: resp.name } });
    }
  });

  (async () => {
    const local = await getLocalStorageValues([MACROS_STORAGE_KEY]);
    let macros = Array.isArray(local[MACROS_STORAGE_KEY]) ? local[MACROS_STORAGE_KEY] : [];
    let recoveredFromInternal = false;
    let recoveredSource = "local";
    if (macros.length === 0) {
      const recovered = await _loadMacrosSyncSnapshot();
      if (Array.isArray(recovered) && recovered.length > 0) {
        macros = recovered;
        recoveredFromInternal = true;
        recoveredSource = "sync";
        await setLocalStorageValues({ [MACROS_STORAGE_KEY]: recovered });
        store.dispatch({
          type: contracts.ActionTypes.STATUS_MESSAGE_SET,
          payload: `Recuperadas ${recovered.length} macro(s) desde backup interno.`
        });
      } else {
        const recoveredSite = _loadSiteSurvivalMacros();
        if (Array.isArray(recoveredSite) && recoveredSite.length > 0) {
          macros = recoveredSite;
          recoveredFromInternal = true;
          recoveredSource = "site";
          await setLocalStorageValues({ [MACROS_STORAGE_KEY]: recoveredSite });
          store.dispatch({
            type: contracts.ActionTypes.STATUS_MESSAGE_SET,
            payload: `Recuperadas ${recoveredSite.length} macro(s) desde backup del sitio.`
          });
        }
      }
    }
    store.dispatch({ type: contracts.ActionTypes.LIBRARY_LOADED, payload: macros });
    if (!recoveredFromInternal && macros.length === 0) {
      store.dispatch({
        type: contracts.ActionTypes.STATUS_MESSAGE_SET,
        payload: "Sin macros locales ni backup interno. Importa un backup JSON para restaurar."
      });
    }
    lastMacrosPersistHash = _simpleStableHash(JSON.stringify(Array.isArray(macros) ? macros : []));
    if (recoveredSource !== "local") {
      void _saveMacrosSyncSnapshot(macros);
      _writeSiteSurvivalSnapshot({ macros, macrosSavedAt: Date.now() });
    }
    macrosPersistenceReady = true;
  })();

  function _resumePendingPlaybackIfAny() {
    chrome.runtime.sendMessage({ type: "QUERY_PENDING_PLAYBACK" }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.pending) return;
      const p = resp.pending;
      const PlayerClass = globalScope.WebMaticPlayer;
      if (!PlayerClass || !Array.isArray(p.steps)) return;

      if (p.index >= p.steps.length) {
        setTimeout(() => {
          const _resumeVars = buildRuntimeVars(p.vars, store.getState().settings);
          playerRuntime.playStartedAtMs = _resolvePlayStartFromVars(_resumeVars);
          const _durNow = playerRuntime.playStartedAtMs
            ? Math.max(0, Date.now() - playerRuntime.playStartedAtMs)
            : null;
          playerRuntime.lastDurationMs = (_durNow && _durNow >= 100) ? _durNow : null;
          if (p.macroId) store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: p.macroId });
          createPlaybackFloating(
            () => { store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED }); removePlaybackFloating(); },
            null,
            null,
            () => { store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED }); removePlaybackFloating(); },
            null
          );
          store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
          store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: p.steps.length, steps: p.steps } });
          store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
          store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Reproduccion completada" });
        }, 800);
        return;
      }

      setTimeout(() => {
        store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
        store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Reanudando reproduccion..." });
        if (p.macroId) store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: p.macroId });

        createPlaybackFloating(
          () => {
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
            removePlaybackFloating();
          },
          () => addWaitHere(),
          () => {
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            const _rstate = store.getState();
            const _rmacro = _rstate.library.macros.find((m) => m.id === p.macroId);
            if (!_rmacro) return;
            store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
            store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Reproduciendo "${_rmacro.name}"` });
            const _RPlayerClass = globalScope.WebMaticPlayer;
            if (!_RPlayerClass) return;
            const _rPlayer = new _RPlayerClass();
            playerRuntime.activePlayer = _rPlayer;
            const _resumeVars = buildRuntimeVars(p.vars, _rstate.settings);
            playerRuntime.playStartedAtMs = _resolvePlayStartFromVars(_resumeVars);
            _resumeVars[PLAY_START_VAR] = playerRuntime.playStartedAtMs;
            resetRuntimeAutoFillSession();
            const _rResolvedSteps = _resolveCallMacros(_rmacro.steps, _rstate.library.macros);
            const _rPreparedSteps = applyRuntimeDataToSteps(_rResolvedSteps, _rstate.settings);
            _rPlayer.play(_rPreparedSteps, {
              speed: p.speed,
              vars: _resumeVars,
              macroId: p.macroId,
              ..._macroPlaybackMeta(_rmacro),
              onStep: (step, index) => {
                tryAutoFillRuntimeDataOnPage(_rstate.settings);
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: _rPreparedSteps } });
              },
              onDone: (summary) => {
                if (_isPlaybackHandoffSummary(summary)) {
                  playerRuntime.activePlayer = null;
                  store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
                  store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Continuando en otra pestaña..." });
                  removePlaybackFloating();
                  return;
                }
                playerRuntime.activePlayer = null;
                const _summaryDuration = (summary && Number.isFinite(Number(summary.durationMs))) ? Number(summary.durationMs) : null;
                const _fallbackDuration = playerRuntime.playStartedAtMs ? Math.max(0, Date.now() - playerRuntime.playStartedAtMs) : null;
                playerRuntime.lastDurationMs = (_summaryDuration && _summaryDuration >= 100) ? _summaryDuration : _fallbackDuration;
                store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
                store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Reproduccion completada" });
              },
              onError: (err) => {
                playerRuntime.activePlayer = null;
                const errIdx = store.getState().playback.currentStepIndex;
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
                store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Error: ${err.message}` });
              }
            });
          },
          () => {
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
            removePlaybackFloating();
          },
          (n) => {
            if (playerRuntime.activePlayer) { playerRuntime.activePlayer.stop(); playerRuntime.activePlayer = null; }
            const _rnstate = store.getState();
            const _rnmacro = _rnstate.library.macros.find((m) => m.id === p.macroId);
            if (!_rnmacro) return;
            store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
            store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Bucle x${n}: "${_rnmacro.name}"` });
            const _rnPlayer = new (globalScope.WebMaticPlayer)();
            playerRuntime.activePlayer = _rnPlayer;
            resetRuntimeAutoFillSession();
            let _rnIter = 0;
            const _rnResolved = _resolveCallMacros(_rnmacro.steps, _rnstate.library.macros);
            const _rnPrepared = applyRuntimeDataToSteps(_rnResolved, _rnstate.settings);
            store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: 0, steps: _rnPrepared } });
            function _rnNext() {
              if (_rnIter >= n || _rnPlayer._abort) {
                playerRuntime.activePlayer = null;
                store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: _rnPrepared.length, steps: _rnPrepared } });
                store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
                return;
              }
              _rnIter++;
              _rnPlayer._abort = false;
              _rnPlayer.play(_rnPrepared, {
                speed: p.speed,
                vars: buildRuntimeVars(p.vars, _rnstate.settings),
                macroId: p.macroId,
                ..._macroPlaybackMeta(_rnmacro),
                onStep: (step, index) => {
                  tryAutoFillRuntimeDataOnPage(_rnstate.settings);
                  store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: _rnPrepared } });
                },
                onDone: _rnNext,
                onError: (err) => {
                  playerRuntime.activePlayer = null;
                  const errIdx = store.getState().playback.currentStepIndex;
                  store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
                }
              });
            }
            _rnNext();
          }
        );

        if (p.macroId) {
          const foundMacro = store.getState().library.macros.find((m) => m.id === p.macroId);
          const nameEl = document.getElementById("wm-play-name");
          if (nameEl && foundMacro) nameEl.textContent = foundMacro.name;
        }

        const player = new PlayerClass();
        playerRuntime.activePlayer = player;
        const _resumeVars = buildRuntimeVars(p.vars, store.getState().settings);
        playerRuntime.playStartedAtMs = _resolvePlayStartFromVars(_resumeVars);
        _resumeVars[PLAY_START_VAR] = playerRuntime.playStartedAtMs;
        resetRuntimeAutoFillSession();
        player.play(p.steps, {
          speed: p.speed,
          startIndex: p.index,
          vars: _resumeVars,
          macroId: p.macroId,
          ..._macroPlaybackMeta(store.getState().library.macros.find((m) => m.id === p.macroId) || null),
          onStep: (step, index) => {
            tryAutoFillRuntimeDataOnPage(store.getState().settings);
            store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index, steps: p.steps } });
          },
          onDone: (summary) => {
            if (_isPlaybackHandoffSummary(summary)) {
              playerRuntime.activePlayer = null;
              store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
              store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Continuando en otra pestaña..." });
              removePlaybackFloating();
              return;
            }
            playerRuntime.activePlayer = null;
            const _summaryDuration = (summary && Number.isFinite(Number(summary.durationMs))) ? Number(summary.durationMs) : null;
            const _fallbackDuration = playerRuntime.playStartedAtMs ? Math.max(0, Date.now() - playerRuntime.playStartedAtMs) : null;
            playerRuntime.lastDurationMs = (_summaryDuration && _summaryDuration >= 100) ? _summaryDuration : _fallbackDuration;
            store.dispatch({ type: contracts.ActionTypes.PLAYBACK_STEP_STARTED, payload: { index: p.steps.length, steps: p.steps } });
            store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
            store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: "Reproduccion completada" });
          },
          onError: (err) => {
            playerRuntime.activePlayer = null;
            const errIdx = store.getState().playback.currentStepIndex;
            store.dispatch({ type: contracts.ActionTypes.PLAYBACK_ERROR, payload: `Paso ${errIdx + 1}: ${err.message}` });
            store.dispatch({ type: contracts.ActionTypes.STATUS_MESSAGE_SET, payload: `Error: ${err.message}` });
          }
        });
      }, 800);
    });
  }

  _resumePendingPlaybackIfAny();

  const onStorageChanged = (changes, areaName) => {
    const incomingMacros = (macrosGlobalApi && typeof macrosGlobalApi.extractMacrosFromStorageChange === "function")
      ? macrosGlobalApi.extractMacrosFromStorageChange(changes, areaName)
      : (areaName === "local" && changes && changes[MACROS_STORAGE_KEY] ? (Array.isArray(changes[MACROS_STORAGE_KEY].newValue) ? changes[MACROS_STORAGE_KEY].newValue : []) : null);

    if (Array.isArray(incomingMacros)) {
      const currentMacros = Array.isArray(store.getState().library.macros) ? store.getState().library.macros : [];
      const nextHash = _simpleStableHash(JSON.stringify(incomingMacros));
      const currentHash = _simpleStableHash(JSON.stringify(currentMacros));
      if (nextHash !== currentHash) {
        lastMacrosPersistHash = nextHash;
        store.dispatch({ type: contracts.ActionTypes.LIBRARY_LOADED, payload: incomingMacros });
      }
    }

    if (areaName !== "local" || !changes.webmaticSettings) return;

    const nextSettings = changes.webmaticSettings.newValue || {};
    const runtimeDataTemplates = normalizeRuntimeDataTemplates(nextSettings.runtimeDataTemplates);
    const runtimeTemplateSelectedId = sanitizeRuntimeTemplateSelectedId(nextSettings.runtimeTemplateSelectedId, runtimeDataTemplates);
    store.dispatch({ type: contracts.ActionTypes.PANEL_WIDTH_SET, payload: 260 });
    if (typeof nextSettings.panelSide !== "undefined") {
      store.dispatch({ type: contracts.ActionTypes.PANEL_SIDE_SET, payload: nextSettings.panelSide });
    }
    store.dispatch({
      type: contracts.ActionTypes.SETTINGS_UPDATED,
      payload: {
        ...resolveTheme(nextSettings.themeMode, nextSettings.themeVariant),
        speed: nextSettings.speed ?? 1,
        panelOpacity: nextSettings.panelOpacity ?? 1,
        runtimeDataEnabled: Boolean(nextSettings.runtimeDataEnabled),
        runtimeDataType: normalizeRuntimeDataType(nextSettings.runtimeDataType),
        runtimeCustomTypes: normalizeRuntimeCustomTypes(nextSettings.runtimeCustomTypes),
        runtimeData: nextSettings.runtimeData || "",
        runtimeDataItems: normalizeRuntimeDataItems(nextSettings.runtimeDataItems),
        runtimeDataTemplates,
        runtimeTemplateSelectedId
      }
    });
  };

  chrome.storage.onChanged.addListener(onStorageChanged);

  const onRuntimeMessage = (message, sender, sendResponse) => {
    if (message?.type === "STOP_INLINE_RECORDING") {
      if (typeof _activeInlineStop === "function") {
        _activeInlineStop();
      } else {
        // La página navegó y se perdió el contexto — limpiar el estado en background
        const mirrorPanel = document.getElementById(INLINE_REC_PANEL_ID + "-mirror");
        if (mirrorPanel && mirrorPanel.parentNode) mirrorPanel.parentNode.removeChild(mirrorPanel);
        try { chrome.runtime.sendMessage({ type: "INLINE_RECORDING_STOPPED" }, () => { void chrome.runtime.lastError; }); } catch (e) { /* ignore */ }
      }
      sendResponse({ ok: true });
      return true;
    }

    // Re-inyección del panel flotante al navegar a una subpágina
    if (message?.type === "SHOW_INLINE_REC_PANEL") {
      if (typeof _activeInlineStop === "function" && document.getElementById(INLINE_REC_PANEL_ID)) {
        // El panel sobrevivió (SPA sin recarga completa) — solo actualizar contador
        const countEl = document.getElementById(INLINE_REC_PANEL_ID + "-count");
        if (countEl && message.priorStepCount !== undefined) {
          const t = message.priorStepCount;
          countEl.textContent = t + (t === 1 ? " paso" : " pasos");
        }
        sendResponse({ ok: true }); return true;
      }
      // La página recargó — re-iniciar la grabación en esta página
      // _stop() llama onDone(filteredNewSteps, editorContext) — editorContext tiene los pasos previos
      startInlineRecording(function _crossPageOnDone(newSteps, editorContext) {
        if (!store.getState().ui.panelVisible) {
          store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
        }
        const prior = (editorContext && Array.isArray(editorContext.draftSteps)) ? editorContext.draftSteps : [];
        const combined = prior.concat(newSteps); // newSteps ya fueron limpiados por _stop()
        const combinedMeta = (editorContext && editorContext.meta && typeof editorContext.meta === "object")
          ? editorContext.meta
          : _recordingMeta();
        const combinedScript = (editorContext && editorContext.script)
          ? String(editorContext.script)
          : (iimAdapter ? iimAdapter.exportToIim({ steps: combined, meta: combinedMeta || null }) : "");
        store.dispatch({
          type: contracts.ActionTypes.SCRIPT_EDITOR_OPENED,
          payload: {
            macroId: (editorContext && editorContext.macroId) || null,
            script: combinedScript,
            draftSteps: combined,
            meta: combinedMeta || null
          }
        });
      }, message.priorStepCount || 0, true); // true = re-inyección, no resetear estado en background
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "SHOW_INLINE_REC_MIRROR") {
      // Si somos la pestaña original y el panel ya existe, no hacer nada
      if (typeof _activeInlineStop === "function" && document.getElementById(INLINE_REC_PANEL_ID)) {
        sendResponse({ ok: true }); return true;
      }
      // Eliminar mirror anterior si existe
      const old = document.getElementById(INLINE_REC_PANEL_ID + "-mirror");
      if (old && old.parentNode) old.parentNode.removeChild(old);
      // Crear panel espejo flotante con solo el botón Detener
      const mp = document.createElement("div");
      mp.id = INLINE_REC_PANEL_ID + "-mirror";
      mp.style.cssText = [
        "all:initial","position:fixed","bottom:16px","right:16px","z-index:2147483647",
        "display:flex","align-items:center","gap:8px",
        "background:rgba(239,68,68,0.95)","color:#fff",
        "border-radius:10px","padding:10px 14px",
        "font-family:system-ui,sans-serif","font-size:13px","font-weight:600",
        "box-shadow:0 4px 20px rgba(239,68,68,0.4)",
        "cursor:default","user-select:none"
      ].join(";");
      if (!document.getElementById("webmatic-floating-keyframes")) {
        const ks = document.createElement("style");
        ks.id = "webmatic-floating-keyframes";
        ks.textContent = "@keyframes webmatic-pulse{0%,100%{opacity:1}50%{opacity:0.35}}";
        document.head.appendChild(ks);
      }
      const mdot = document.createElement("span");
      mdot.style.cssText = "display:inline-block;width:10px;height:10px;border-radius:50%;background:#fff;animation:webmatic-pulse 0.8s infinite;flex-shrink:0";
      mp.appendChild(mdot);
      const mlbl = document.createElement("span");
      mlbl.textContent = "Grabando pasos nuevos";
      mp.appendChild(mlbl);
      const mstop = document.createElement("button");
      mstop.style.cssText = [
        "all:initial","display:inline-flex","align-items:center","gap:4px",
        "background:#fff","color:#dc2626","border-radius:6px",
        "padding:4px 10px","font-size:12px","font-weight:700",
        "font-family:system-ui,sans-serif","cursor:pointer",
        "margin-left:6px","white-space:nowrap"
      ].join(";");
      mstop.textContent = "\u23F9 Detener";
      mstop.addEventListener("click", (e) => {
        e.stopPropagation();
        mp.parentNode && mp.parentNode.removeChild(mp);
        chrome.runtime.sendMessage({ type: "STOP_INLINE_RECORDING" }, () => { void chrome.runtime.lastError; });
      });
      mp.appendChild(mstop);
      document.documentElement.appendChild(mp);
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "TOGGLE_PANEL") {
      store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "OPEN_PANEL") {
      if (!store.getState().ui.panelVisible) {
        store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });
      }
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "RESUME_PENDING_PLAYBACK") {
      _resumePendingPlaybackIfAny();
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "SET_PANEL_SIDE") {
      store.dispatch({ type: contracts.ActionTypes.PANEL_SIDE_SET, payload: message.payload });
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "SHOW_FLOATING_BTN") {
      // Background signals recording is active (new page load or tab switch during recording).
      // We must (re)start the recorder session on this page so events are captured.
      store.dispatch({ type: contracts.ActionTypes.RECORD_STARTED });
      recorderRuntime.pageInventories = [];
      if (!recorderRuntime.preRunReset) {
        recorderRuntime.preRunReset = _captureInitialPreRunReset();
      }
      captureScreenInventory();
      // Restore steps accumulated on previous pages in this recording session
      if (message.steps && message.steps.length > 0) {
        const restored = message.steps.map((step) => {
          const clean = Object.assign({}, step);
          delete clean._merge;
          return clean;
        });
        store.dispatch({ type: contracts.ActionTypes.DRAFT_RESTORED, payload: restored });
      }
      startRecorderSession();
      createFloatingBtn(() => {
        stopRecorderSession();
        removeFloatingBtn();
        chrome.runtime.sendMessage({ type: "RECORDING_STATE", active: false }, () => { void chrome.runtime.lastError; });
        store.dispatch({ type: contracts.ActionTypes.RECORD_STOPPED });
        const afterStop = store.getState();
        if (afterStop.draft.steps.length > 0 && iimAdapter) {
          const utils = globalScope.WebMaticUtils;
          const threshold = (afterStop.settings && afterStop.settings.waitThreshold) || 3;
          const recorded = afterStop.draft.steps;
          const allSteps = _cleanupSteps(_withCapturedPageDefaults(recorded));
          const waitedSteps = utils ? utils.injectWaitSteps(allSteps, threshold * 1000) : allSteps;
          const processedSteps = _finalizeWithInventory(waitedSteps);
              const resolvedInv = [
                ...recorderRuntime.pageInventories,
                ..._resolveReusableMetadataForSteps(processedSteps).inventories
              ];
                const promotedSteps = _promoteChooseOptionWithInventories(processedSteps, resolvedInv);
              const script = iimAdapter.exportToIim({ steps: promotedSteps, meta: _recordingMeta() });
          store.dispatch({
            type: contracts.ActionTypes.SCRIPT_EDITOR_OPENED,
            payload: { script, macroId: null, draftSteps: promotedSteps, meta: _recordingMeta() }
          });
        }
      });
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "HIDE_FLOATING_BTN") {
      removeFloatingBtn();
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "FRAME_STEP_CAPTURED") {
      if (store.getState().recorder.isRecording) {
        const step = message.step;
        const currentSteps = store.getState().draft.steps;
        const lastStep = currentSteps[currentSteps.length - 1];
        // Merge consecutive text steps on the same selector
        if (step.type === "text" && lastStep && lastStep.type === "text" && lastStep.selector === step.selector) {
          captureStep({ type: "text", selector: step.selector, value: lastStep.value + step.value, _merge: true });
        } else {
          captureStep(step);
        }
      }
      return false;
    }

    return false;
  };

  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  globalScope.__webmaticRuntime = {
    destroy() {
      stopRecorderSession();
      removeFloatingBtn();
      if (playerRuntime.activePlayer) {
        playerRuntime.activePlayer.stop();
        playerRuntime.activePlayer = null;
      }
      // IMPORTANT: do not force RECORDING_STATE=false here.
      // This destroy path also runs during content-script reinjection/navigation,
      // and forcing a global stop would wipe recorded steps accumulated in background.
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
      chrome.storage.onChanged.removeListener(onStorageChanged);
      if (typeof unsubscribeRender === "function") {
        unsubscribeRender();
      }
      uiShell.unmount();
      document.documentElement.style.marginLeft = "0px";
      document.documentElement.style.marginRight = "0px";
    }
  };

  console.log("[WebMatic] Bootstrap completado.");
})(typeof globalThis !== "undefined" ? globalThis : window);