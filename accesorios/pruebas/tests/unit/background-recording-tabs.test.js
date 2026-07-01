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
        // Simula comportamiento real del navegador: cada operación asíncrona
        // resetea lastError para su propio callback.
        chrome.runtime.lastError = null;
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

test("background: _merge atrasado no reemplaza un click ya grabado", () => {
  const h = bootBackground([
    { id: 1, url: "https://site-a.test/home", active: true }
  ]);

  h.sendRuntimeMessage({ type: "INLINE_RECORDING_STARTED" }, { tab: { id: 1 } });
  h.sendRuntimeMessage({
    type: "INLINE_RECORD_STEP",
    step: { type: "text", selector: "#search", value: "qa" }
  }, { tab: { id: 1 } });
  h.sendRuntimeMessage({
    type: "INLINE_RECORD_STEP",
    step: { type: "click", selector: "#createInstitutionButton" }
  }, { tab: { id: 1 } });
  h.sendRuntimeMessage({
    type: "INLINE_RECORD_STEP",
    step: { type: "text", selector: "#search", value: "qa!", _merge: true }
  }, { tab: { id: 1 } });

  const stop = h.sendRuntimeMessage({ type: "INLINE_RECORDING_STOP_REQUEST" }, { tab: { id: 1 } });

  assert.deepEqual(stop.steps, [
    { type: "text", selector: "#search", value: "qa" },
    { type: "click", selector: "#createInstitutionButton" },
    { type: "text", selector: "#search", value: "qa!" }
  ]);
});

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

test("background: SAVE/QUERY pending playback respeta aislamiento por tab y consume al leer", () => {
  const h = bootBackground([
    { id: 1, url: "https://site-a.test/home", active: true },
    { id: 2, url: "https://site-b.test/home", active: false }
  ]);

  const saveResp = h.sendRuntimeMessage({
    type: "SAVE_PLAYBACK_STATE",
    targetTabId: 2,
    steps: [{ type: "click", selector: "#go" }],
    index: 1,
    vars: { A: "1" },
    speed: 1,
    macroId: "m-1"
  }, { tab: { id: 1, url: "https://site-a.test/home" } });
  assert.equal(saveResp && saveResp.ok, true, "SAVE_PLAYBACK_STATE debe responder ok");

  const fromTab1 = h.sendRuntimeMessage({ type: "QUERY_PENDING_PLAYBACK" }, { tab: { id: 1 } });
  assert.equal(fromTab1 && fromTab1.pending, null, "tab origen no debe recibir pending de otra tab");

  const fromTab2 = h.sendRuntimeMessage({ type: "QUERY_PENDING_PLAYBACK" }, { tab: { id: 2 } });
  assert.ok(fromTab2 && fromTab2.pending, "tab destino debe recibir pending");
  assert.equal(fromTab2.pending.tabId, 2);
  assert.equal(Array.isArray(fromTab2.pending.steps), true);
  assert.equal(fromTab2.pending.steps.length, 1);

  const consumed = h.sendRuntimeMessage({ type: "QUERY_PENDING_PLAYBACK" }, { tab: { id: 2 } });
  assert.equal(consumed && consumed.pending, null, "pending debe consumirse luego de la primera lectura");
});

test("background: CLEAR_PENDING_PLAYBACK limpia por tab y tabs.onRemoved también limpia", () => {
  const h = bootBackground([
    { id: 7, url: "https://site-a.test/home", active: true },
    { id: 8, url: "https://site-b.test/home", active: false },
    { id: 9, url: "https://site-c.test/home", active: false }
  ]);

  h.sendRuntimeMessage({
    type: "SAVE_PLAYBACK_STATE",
    targetTabId: 8,
    steps: [{ type: "input", selector: "#q", value: "abc" }],
    index: 0
  }, { tab: { id: 7, url: "https://site-a.test/home" } });

  const clearResp = h.sendRuntimeMessage({ type: "CLEAR_PENDING_PLAYBACK", tabId: 8 }, { tab: { id: 7 } });
  assert.equal(clearResp && clearResp.ok, true, "CLEAR_PENDING_PLAYBACK debe responder ok");

  const afterClear = h.sendRuntimeMessage({ type: "QUERY_PENDING_PLAYBACK" }, { tab: { id: 8 } });
  assert.equal(afterClear && afterClear.pending, null, "clear explícito debe eliminar pending de esa tab");

  h.sendRuntimeMessage({
    type: "SAVE_PLAYBACK_STATE",
    targetTabId: 9,
    steps: [{ type: "navigate", url: "https://site-c.test/next" }],
    index: 0
  }, { tab: { id: 7, url: "https://site-a.test/home" } });

  h.emitTabRemoved(9);

  const afterRemove = h.sendRuntimeMessage({ type: "QUERY_PENDING_PLAYBACK" }, { tab: { id: 9 } });
  assert.equal(afterRemove && afterRemove.pending, null, "tabs.onRemoved debe limpiar pending de la tab cerrada");
});

test("background: PLAYBACK_NAVIGATE usa tabs.update y preserva pending para resume", () => {
  const h = bootBackground([
    { id: 31, url: "https://site-a.test/home", active: true }
  ]);

  const resp = h.sendRuntimeMessage({
    type: "PLAYBACK_NAVIGATE",
    url: "file:///C:/Users/usuario/Desktop/Ejercicios/testindex.html",
    steps: [{ type: "wait", ms: 1 }],
    index: 1,
    vars: { A: "1" },
    speed: 1,
    macroId: "m-file"
  }, { tab: { id: 31, url: "https://site-a.test/home" } });

  assert.equal(resp && resp.ok, true, "PLAYBACK_NAVIGATE debe responder ok");
  assert.equal((h.tabsMap.get(31) || {}).url, "file:///C:/Users/usuario/Desktop/Ejercicios/testindex.html");

  const pending = h.sendRuntimeMessage({ type: "QUERY_PENDING_PLAYBACK" }, { tab: { id: 31 } });
  assert.ok(pending && pending.pending, "debe persistir pending en la misma tab tras navegar");
  assert.equal(pending.pending.index, 1);
});

test("background: PLAYBACK_NAVIGATE fallback a tabs.create cuando tabs.update falla", () => {
  const h = bootBackground([
    { id: 42, url: "https://site-a.test/home", active: true }
  ]);

  // tabs.update falla (simulando permiso denegado a file://)
  h.chrome.tabs.update = (_tabId, _props, cb) => {
    h.chrome.runtime.lastError = { message: "Missing host permission for the tab" };
    if (typeof cb === "function") cb();
    h.chrome.runtime.lastError = null;
  };

  const resp = h.sendRuntimeMessage({
    type: "PLAYBACK_NAVIGATE",
    url: "file:///C:/testindex.html",
    steps: [{ type: "wait", ms: 1 }],
    index: 1,
    vars: { A: "1" }
  }, { tab: { id: 42, url: "https://site-a.test/home" } });

  // tabs.create debería haberse invocado y creado una nueva tab (id 43)
  assert.equal(resp && resp.ok, true, "debe responder ok via fallback tabs.create");
  assert.equal(resp && resp.usedCreate, true, "debe marcar usedCreate=true");
  const newTabId = resp && resp.tabId;
  assert.ok(newTabId && newTabId !== 42, "debe devolver id de la nueva tab");

  // pending debe estar en la nueva tab, no en la original
  const pendingOld = h.sendRuntimeMessage({ type: "QUERY_PENDING_PLAYBACK" }, { tab: { id: 42 } });
  assert.equal(pendingOld && pendingOld.pending, null, "tab original no debe tener pending");

  const pendingNew = h.sendRuntimeMessage({ type: "QUERY_PENDING_PLAYBACK" }, { tab: { id: newTabId } });
  assert.ok(pendingNew && pendingNew.pending, "nueva tab debe tener pending");
  assert.equal(pendingNew.pending.index, 1);
});

test("background: PLAYBACK_NAVIGATE propaga detail real cuando ambos tabs.update y tabs.create fallan", () => {
  const h = bootBackground([
    { id: 43, url: "https://site-a.test/home", active: true }
  ]);

  h.chrome.tabs.update = (_tabId, _props, cb) => {
    h.chrome.runtime.lastError = { message: "Missing host permission for the tab" };
    if (typeof cb === "function") cb();
    h.chrome.runtime.lastError = null;
  };
  h.chrome.tabs.create = (_props, cb) => {
    h.chrome.runtime.lastError = { message: "Cannot access file URL" };
    if (typeof cb === "function") cb(null);
    h.chrome.runtime.lastError = null;
  };

  const resp = h.sendRuntimeMessage({
    type: "PLAYBACK_NAVIGATE",
    url: "file:///C:/testindex.html",
    steps: [{ type: "click", selector: "#x" }],
    index: 1
  }, { tab: { id: 43, url: "https://site-a.test/home" } });

  assert.equal(resp && resp.ok, false, "si ambos fallan debe responder error");
  assert.equal(resp && resp.error, "navigate_tab_update_failed");
  assert.ok(resp && resp.detail && resp.detail.includes("Missing host permission"), `detail debe incluir error real de tabs.update: ${resp && resp.detail}`);
  assert.ok(resp && resp.detail && resp.detail.includes("SOLUCIÓN"), `detail debe incluir hint accionable: ${resp && resp.detail}`);

  const pending = h.sendRuntimeMessage({ type: "QUERY_PENDING_PLAYBACK" }, { tab: { id: 43 } });
  assert.equal(pending && pending.pending, null, "no debe dejar pending colgado ante fallo total");
});

test("background: PLAYBACK_NAVIGATE informa error claro y limpia pending si tabs.update falla (sin fallback create)", () => {
  const h = bootBackground([
    { id: 41, url: "https://site-a.test/home", active: true }
  ]);

  h.chrome.tabs.update = (_tabId, _props, cb) => {
    h.chrome.runtime.lastError = { message: "blocked" };
    if (typeof cb === "function") cb();
    h.chrome.runtime.lastError = null;
  };
  h.chrome.tabs.create = (_props, cb) => {
    h.chrome.runtime.lastError = { message: "also blocked" };
    if (typeof cb === "function") cb(null);
    h.chrome.runtime.lastError = null;
  };

  const resp = h.sendRuntimeMessage({
    type: "PLAYBACK_NAVIGATE",
    url: "file:///C:/Users/usuario/Desktop/Ejercicios/testindex.html",
    steps: [{ type: "click", selector: "#x" }],
    index: 1
  }, { tab: { id: 41, url: "https://site-a.test/home" } });

  assert.equal(resp && resp.ok, false, "si tabs.update falla debe responder error");
  assert.equal(resp && resp.error, "navigate_tab_update_failed");
  assert.ok(resp && resp.detail && resp.detail.includes("blocked"), `detail debe incluir el mensaje real: ${resp && resp.detail}`);

  const pending = h.sendRuntimeMessage({ type: "QUERY_PENDING_PLAYBACK" }, { tab: { id: 41 } });
  assert.equal(pending && pending.pending, null, "no debe dejar pending colgado ante fallo");
});
