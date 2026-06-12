const test = require("node:test");
const assert = require("node:assert/strict");

function createEvent() {
  const listeners = [];
  return {
    addListener(fn) {
      listeners.push(fn);
    },
    emit(...args) {
      listeners.forEach((fn) => fn(...args));
    }
  };
}

function createChromeMock(initialTabs = []) {
  const runtimeOnInstalled = createEvent();
  const runtimeOnMessage = createEvent();
  const browserActionOnClicked = createEvent();
  const tabsOnActivated = createEvent();
  const tabsOnCreated = createEvent();
  const tabsOnUpdated = createEvent();
  const tabsOnRemoved = createEvent();

  const tabsMap = new Map(initialTabs.map((t) => [t.id, { ...t }]));
  const sentMessages = [];

  const chrome = {
    runtime: {
      lastError: null,
      onInstalled: runtimeOnInstalled,
      onMessage: runtimeOnMessage,
      openOptionsPage(cb) {
        if (typeof cb === "function") cb();
      },
      getURL(path) {
        return `moz-extension://test/${String(path || "")}`;
      }
    },
    browserAction: {
      onClicked: browserActionOnClicked,
      setBadgeText() {},
      setBadgeBackgroundColor() {}
    },
    tabs: {
      onActivated: tabsOnActivated,
      onCreated: tabsOnCreated,
      onUpdated: tabsOnUpdated,
      onRemoved: tabsOnRemoved,
      sendMessage(tabId, message, optionsOrCb, maybeCb) {
        let cb = null;
        if (typeof optionsOrCb === "function") cb = optionsOrCb;
        else if (typeof maybeCb === "function") cb = maybeCb;
        sentMessages.push({ tabId, message });
        if (cb) cb({ ok: true });
      },
      executeScript(_tabId, _details, cb) {
        if (typeof cb === "function") cb();
      },
      get(tabId, cb) {
        cb(tabsMap.get(tabId) || null);
      },
      query(_queryInfo, cb) {
        cb(Array.from(tabsMap.values()));
      },
      create(createProperties, cb) {
        const id = Math.max(0, ...Array.from(tabsMap.keys())) + 1;
        const tab = {
          id,
          url: String(createProperties.url || "about:blank"),
          pendingUrl: "",
          active: createProperties.active !== false
        };
        tabsMap.set(id, tab);
        if (typeof cb === "function") cb(tab);
      },
      update(tabId, updateProperties, cb) {
        const prev = tabsMap.get(tabId) || { id: tabId, url: "about:blank", pendingUrl: "", active: false };
        const next = { ...prev, ...updateProperties };
        tabsMap.set(tabId, next);
        if (typeof cb === "function") cb(next);
      },
      remove(tabId, cb) {
        tabsMap.delete(tabId);
        if (typeof cb === "function") cb();
      }
    },
    downloads: {
      download(_opts, cb) {
        if (typeof cb === "function") cb();
      }
    },
    storage: {
      local: {
        get(_key, cb) {
          cb({});
        },
        set(_value, cb) {
          if (typeof cb === "function") cb();
        }
      }
    }
  };

  function sendRuntimeMessage(message, sender = {}) {
    let responsePayload;
    runtimeOnMessage.emit(message, sender, (response) => {
      responsePayload = response;
    });
    return responsePayload;
  }

  return {
    chrome,
    sentMessages,
    tabsMap,
    emitTabActivated(payload) {
      tabsOnActivated.emit(payload);
    },
    emitTabCreated(tab) {
      tabsMap.set(tab.id, { ...tab });
      tabsOnCreated.emit(tab);
    },
    emitTabUpdated(tabId, changeInfo, tab) {
      if (tab) tabsMap.set(tabId, { ...tab });
      tabsOnUpdated.emit(tabId, changeInfo, tab || tabsMap.get(tabId));
    },
    emitTabRemoved(tabId) {
      tabsOnRemoved.emit(tabId);
      tabsMap.delete(tabId);
    },
    sendRuntimeMessage,
    clearSentMessages() {
      sentMessages.length = 0;
    }
  };
}

function bootBackground(initialTabs) {
  const harness = createChromeMock(initialTabs);
  globalThis.chrome = harness.chrome;
  const bgPath = "../../../../src/background/background.js";
  delete require.cache[require.resolve(bgPath)];
  require(bgPath);
  return harness;
}

test("background: mantiene flotante y registra switch_tab al cambiar de pestaña durante grabación", () => {
  const h = bootBackground([
    { id: 1, url: "https://site-a.test/home", active: true },
    { id: 2, url: "https://site-b.test/dashboard", active: false }
  ]);

  h.sendRuntimeMessage({ type: "RECORDING_STATE", active: true }, { tab: { id: 1, url: "https://site-a.test/home" } });
  h.clearSentMessages();

  h.emitTabActivated({ tabId: 2 });

  const floatingCalls = h.sentMessages.filter((c) => c.tabId === 2 && c.message && c.message.type === "SHOW_FLOATING_BTN");
  assert.equal(floatingCalls.length >= 1, true, "No se mostró el flotante en la pestaña activada");

  const rec = h.sendRuntimeMessage({ type: "QUERY_RECORDED_STEPS" }, { tab: { id: 2 } });
  assert.ok(Array.isArray(rec.steps), "QUERY_RECORDED_STEPS debe devolver array");
  assert.equal(rec.steps.some((s) => s && s.type === "switch_tab"), true, "No se registró switch_tab");
});

test("background: registra open_tab y close_tab durante grabación", () => {
  const h = bootBackground([
    { id: 10, url: "https://site-main.test/", active: true }
  ]);

  h.sendRuntimeMessage({ type: "RECORDING_STATE", active: true }, { tab: { id: 10, url: "https://site-main.test/" } });

  h.emitTabCreated({ id: 11, url: "https://site-new.test/page", active: true });
  h.emitTabRemoved(11);

  const rec = h.sendRuntimeMessage({ type: "QUERY_RECORDED_STEPS" }, { tab: { id: 10 } });
  assert.equal(rec.steps.some((s) => s && s.type === "open_tab"), true, "No se registró open_tab");
  assert.equal(rec.steps.some((s) => s && s.type === "close_tab"), true, "No se registró close_tab");
});

test("background: deduplica SHOW_FLOATING_BTN en ráfagas de onUpdated", () => {
  const h = bootBackground([
    { id: 21, url: "https://site-c.test/", active: true }
  ]);

  h.sendRuntimeMessage({ type: "RECORDING_STATE", active: true }, { tab: { id: 21, url: "https://site-c.test/" } });
  h.clearSentMessages();

  h.emitTabUpdated(21, { status: "complete" }, { id: 21, url: "https://site-c.test/", active: true });
  h.emitTabUpdated(21, { status: "complete" }, { id: 21, url: "https://site-c.test/", active: true });

  const floatingCalls = h.sentMessages.filter((c) => c.tabId === 21 && c.message && c.message.type === "SHOW_FLOATING_BTN");
  assert.equal(floatingCalls.length, 1);
});
