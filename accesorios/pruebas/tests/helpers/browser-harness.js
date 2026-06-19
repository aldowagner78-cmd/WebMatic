const fs = require("node:fs");
const path = require("node:path");
const { Window } = require("happy-dom");

const TESTS_FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const PRUEBAS_FIXTURES_DIR = path.resolve(__dirname, "../../fixtures");

function loadFixture(relativePath) {
  const rel = String(relativePath || "");
  const candidates = [
    path.resolve(PRUEBAS_FIXTURES_DIR, rel),
    path.resolve(TESTS_FIXTURES_DIR, rel)
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) throw new Error(`Fixture no encontrado: ${rel}`);
  return fs.readFileSync(file, "utf8");
}

function installDomGlobals(win) {
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.navigator = win.navigator;
  globalThis.Element = win.Element;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.HTMLInputElement = win.HTMLInputElement;
  globalThis.HTMLTextAreaElement = win.HTMLTextAreaElement;
  globalThis.HTMLSelectElement = win.HTMLSelectElement;
  globalThis.HTMLLabelElement = win.HTMLLabelElement;
  globalThis.Event = win.Event;
  globalThis.InputEvent = win.InputEvent;
  globalThis.MouseEvent = win.MouseEvent;
  globalThis.KeyboardEvent = win.KeyboardEvent;
  globalThis.CustomEvent = win.CustomEvent;

  if (win.DragEvent) {
    globalThis.DragEvent = win.DragEvent;
    globalThis.DataTransfer = win.DataTransfer;
  } else {
    globalThis.DataTransfer = class {
      constructor() { this._data = {}; }
      setData(key, value) { this._data[key] = String(value); }
      getData(key) { return this._data[key] || ""; }
      clearData() { this._data = {}; }
    };
    globalThis.DragEvent = class extends win.Event {
      constructor(type, init) {
        super(type, init);
        this.dataTransfer = init && init.dataTransfer ? init.dataTransfer : null;
      }
    };
  }

  if (typeof win.Element.prototype.scrollIntoView !== "function") {
    win.Element.prototype.scrollIntoView = function scrollIntoView() {};
  }

  win.Element.prototype.getClientRects = function getClientRects() {
    const style = win.getComputedStyle(this);
    if (this.hidden || style.display === "none" || style.visibility === "hidden") return [];
    return [{ left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 }];
  };

  win.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    const rects = this.getClientRects();
    return rects[0] || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  };
}

function createDomHarness(options) {
  const opts = options && typeof options === "object" ? options : {};
  const win = new Window({ url: opts.url || "https://example.test/" });
  installDomGlobals(win);
  win.document.body.innerHTML = opts.html || "";
  return {
    window: win,
    document: win.document,
    setBody(html) {
      win.document.body.innerHTML = html || "";
    },
    loadFixture(relativePath) {
      win.document.body.innerHTML = loadFixture(relativePath);
    }
  };
}

function createEvent() {
  const listeners = [];
  return {
    addListener(fn) {
      listeners.push(fn);
    },
    removeListener(fn) {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    emit(...args) {
      listeners.slice().forEach((fn) => fn(...args));
    },
    listenerCount() {
      return listeners.length;
    }
  };
}

function createChromeMock(options) {
  const opts = options && typeof options === "object" ? options : {};
  const storageData = { ...(opts.storage || {}) };
  const tabsMap = new Map((opts.tabs || []).map((tab) => [tab.id, { ...tab }]));
  const sentRuntimeMessages = [];
  const sentTabMessages = [];
  const runtimeOnMessage = createEvent();
  const storageOnChanged = createEvent();
  const tabsOnActivated = createEvent();
  const tabsOnCreated = createEvent();
  const tabsOnUpdated = createEvent();
  const tabsOnRemoved = createEvent();

  function readStorage(keys) {
    if (keys == null) return { ...storageData };
    if (typeof keys === "string") return { [keys]: storageData[keys] };
    if (Array.isArray(keys)) {
      return keys.reduce((out, key) => {
        out[key] = storageData[key];
        return out;
      }, {});
    }
    if (typeof keys === "object") {
      return Object.keys(keys).reduce((out, key) => {
        out[key] = Object.prototype.hasOwnProperty.call(storageData, key) ? storageData[key] : keys[key];
        return out;
      }, {});
    }
    return {};
  }

  const chrome = {
    runtime: {
      lastError: null,
      onMessage: runtimeOnMessage,
      onInstalled: createEvent(),
      sendMessage(message, cb) {
        sentRuntimeMessages.push(message);
        if (typeof cb === "function") cb({ ok: true });
      },
      openOptionsPage(cb) {
        if (typeof cb === "function") cb();
      },
      getURL(filePath) {
        return `moz-extension://webmatic-test/${String(filePath || "")}`;
      }
    },
    storage: {
      onChanged: storageOnChanged,
      local: {
        get(keys, cb) {
          if (typeof cb === "function") cb(readStorage(keys));
        },
        set(patch, cb) {
          const changes = {};
          Object.keys(patch || {}).forEach((key) => {
            changes[key] = { oldValue: storageData[key], newValue: patch[key] };
            storageData[key] = patch[key];
          });
          storageOnChanged.emit(changes, "local");
          if (typeof cb === "function") cb();
        },
        remove(keys, cb) {
          const list = Array.isArray(keys) ? keys : [keys];
          const changes = {};
          list.forEach((key) => {
            changes[key] = { oldValue: storageData[key], newValue: undefined };
            delete storageData[key];
          });
          storageOnChanged.emit(changes, "local");
          if (typeof cb === "function") cb();
        }
      }
    },
    tabs: {
      onActivated: tabsOnActivated,
      onCreated: tabsOnCreated,
      onUpdated: tabsOnUpdated,
      onRemoved: tabsOnRemoved,
      query(_queryInfo, cb) {
        cb(Array.from(tabsMap.values()));
      },
      get(tabId, cb) {
        cb(tabsMap.get(tabId) || null);
      },
      create(createProperties, cb) {
        chrome.runtime.lastError = null;
        const id = Math.max(0, ...Array.from(tabsMap.keys())) + 1;
        const tab = {
          id,
          url: String(createProperties && createProperties.url ? createProperties.url : "about:blank"),
          active: !createProperties || createProperties.active !== false
        };
        tabsMap.set(id, tab);
        tabsOnCreated.emit(tab);
        if (typeof cb === "function") cb(tab);
      },
      update(tabId, updateProperties, cb) {
        chrome.runtime.lastError = null;
        const prev = tabsMap.get(tabId) || { id: tabId, url: "about:blank", active: false };
        const next = { ...prev, ...(updateProperties || {}) };
        tabsMap.set(tabId, next);
        if (typeof cb === "function") cb(next);
      },
      remove(tabId, cb) {
        chrome.runtime.lastError = null;
        tabsMap.delete(tabId);
        tabsOnRemoved.emit(tabId);
        if (typeof cb === "function") cb();
      },
      sendMessage(tabId, message, optionsOrCb, maybeCb) {
        sentTabMessages.push({ tabId, message });
        const cb = typeof optionsOrCb === "function" ? optionsOrCb : maybeCb;
        if (typeof cb === "function") cb({ ok: true });
      },
      executeScript(_tabId, _details, cb) {
        if (typeof cb === "function") cb();
      }
    },
    browserAction: {
      onClicked: createEvent(),
      setBadgeText() {},
      setBadgeBackgroundColor() {}
    },
    downloads: {
      download(_opts, cb) {
        if (typeof cb === "function") cb();
      }
    }
  };

  globalThis.chrome = chrome;

  return {
    chrome,
    storageData,
    tabsMap,
    sentRuntimeMessages,
    sentTabMessages,
    emitRuntimeMessage(message, sender) {
      let response;
      runtimeOnMessage.emit(message, sender || {}, (payload) => { response = payload; });
      return response;
    }
  };
}

function freshRequire(modulePath) {
  const resolved = require.resolve(modulePath);
  delete require.cache[resolved];
  return require(resolved);
}

module.exports = {
  createChromeMock,
  createDomHarness,
  freshRequire,
  loadFixture
};
