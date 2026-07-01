const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  createChromeMock,
  freshRequire
} = require("../helpers/browser-harness.js");

const contentRouter = require("../../../../src/modules/content/message-router.js");
const backgroundRouter = require("../../../../src/background/background-router.js");
const tabsNavigation = require("../../../../src/background/tabs-navigation.js");
const macroStorage = require("../../../../src/modules/storage/macro-storage.js");

test("content/background flow: routing preserva nombres y payload", () => {
  const payload = { type: "PLAYBACK_NAVIGATE", url: "https://example.test/", steps: [{ type: "click" }] };
  assert.equal(contentRouter.messageType(payload), "PLAYBACK_NAVIGATE");
  assert.equal(contentRouter.isMessageType(payload, "PLAYBACK_NAVIGATE"), true);
  assert.equal(contentRouter.isMessageType({ type: "UNKNOWN" }, "PLAYBACK_NAVIGATE"), false);
  assert.deepEqual(backgroundRouter.ok({ payload }), { ok: true, payload });
  assert.deepEqual(backgroundRouter.error("unknown_message", { type: "UNKNOWN" }), {
    ok: false,
    error: "unknown_message",
    type: "UNKNOWN"
  });
});

test("script editor IIM: no crea marcas visuales para _baselineDefault", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../../../src/content/content.js"), "utf8");
  assert.equal(/className\s*=\s*["']webmatic-script-default-line["']/.test(source), false);
  assert.equal(/dataset\.scriptDefaultLayer\s*=/.test(source), false);
});

test("content recorder: accion real cancela observador post-click dinamico", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../../../src/content/content.js"), "utf8");
  assert.match(source, /function _cancelPostClickObserverForStep\(step\)/);
  assert.match(source, /if \(step\.type === "wait_for" && step\._autoWait\) return;/);
  assert.match(source, /visible: true/);
  const cancelCalls = source.match(/_cancelPostClickObserverForStep\(step\);/g) || [];
  assert.equal(cancelCalls.length >= 2, true);
});

test("content recorder: indicador visual se dispara despues de captura aceptada", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../../../src/content/content.js"), "utf8");
  assert.match(source, /function captureStepAndFlash\(step, target\)/);
  assert.match(source, /const captured = captureStep\(step\);/);
  assert.match(source, /if \(captured && target instanceof Element/);
  assert.match(source, /function addStepAndFlash\(step, target\)/);
  assert.match(source, /const captured = addStep\(step\);/);
});

test("background flow: tabs-navigation cubre restricted, openIfMissing y pending playback", () => {
  assert.equal(tabsNavigation.isRestrictedUrl("chrome://extensions"), true);
  assert.equal(tabsNavigation.isRestrictedUrl("https://example.test/"), false);
  assert.equal(tabsNavigation.urlMatches("https://example.test/path?a=1", "https://example.test/path"), true);
  assert.deepEqual(tabsNavigation.resolveNavigationUrl("../next", "https://example.test/a/b/"), {
    ok: true,
    url: "https://example.test/a/next"
  });
  assert.deepEqual(
    tabsNavigation.buildPendingPlaybackState(4, { steps: [{ type: "input" }], index: "3", vars: { X: "1" }, speed: 2 }),
    { tabId: 4, steps: [{ type: "input" }], index: 3, vars: { X: "1" }, speed: 2, macroId: null }
  );
  assert.deepEqual(
    tabsNavigation.buildPendingPlaybackState(4, { steps: [{ type: "input" }], index: "3", vars: { X: "1" }, speed: 2, loopReplay: { total: 3, remaining: 2 } }),
    { tabId: 4, steps: [{ type: "input" }], index: 3, vars: { X: "1" }, speed: 2, macroId: null, loopReplay: { total: 3, remaining: 2 } }
  );
});

test("background flow: mock chrome.tabs abre, cambia y cierra tabs sin chrome real", () => {
  const h = createChromeMock({ tabs: [{ id: 1, url: "https://a.test/", active: true }] });
  let created;
  h.chrome.tabs.create({ url: "https://b.test/", active: true }, (tab) => { created = tab; });
  assert.equal(created.id, 2);
  assert.equal(h.tabsMap.get(2).url, "https://b.test/");

  let switched;
  h.chrome.tabs.update(1, { active: true }, (tab) => { switched = tab; });
  assert.equal(switched.active, true);

  h.chrome.tabs.remove(2, () => {});
  assert.equal(h.tabsMap.has(2), false);
});

test("storage flow: mock chrome.storage guarda, lista, carga, borra y conserva legacy", () => {
  const h = createChromeMock();
  const legacyMacro = { name: "Legacy", steps: [{ type: "click", selector: "#go" }] };
  const macros = [{ id: "m1", name: "Demo", steps: [] }, legacyMacro];

  h.chrome.storage.local.set(macroStorage.buildMacrosStoragePatch(macros));
  h.chrome.storage.local.get(macroStorage.getMacrosStorageKey(), (snapshot) => {
    assert.deepEqual(macroStorage.readMacrosFromStorageSnapshot(snapshot), macros);
  });

  const updated = macros.filter((macro) => macro.id !== "m1");
  h.chrome.storage.local.set(macroStorage.buildMacrosStoragePatch(updated));
  assert.deepEqual(h.storageData.webmaticMacros, [legacyMacro]);

  h.chrome.storage.local.remove(macroStorage.getMacrosStorageKey());
  h.chrome.storage.local.get(macroStorage.getMacrosStorageKey(), (snapshot) => {
    assert.deepEqual(macroStorage.readMacrosFromStorageSnapshot(snapshot), []);
  });
});

test("background flow: background.js responde PLAYBACK_NAVIGATE con mock tabs", () => {
  const h = createChromeMock({ tabs: [{ id: 10, url: "https://origin.test/", active: true }] });
  freshRequire("../../../../src/background/background.js");

  const response = h.emitRuntimeMessage({
    type: "PLAYBACK_NAVIGATE",
    url: "https://destino.test/",
    steps: [{ type: "click", selector: "#go" }],
    index: 1,
    vars: { A: "1" },
    speed: 1
  }, { tab: { id: 10, url: "https://origin.test/" } });

  assert.equal(response && response.ok, true);
  assert.equal(h.tabsMap.get(10).url, "https://destino.test/");
});


test("content recorder: feedback global para eventos que navegan", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../../../src/content/content.js"), "utf8");
  assert.match(source, /WM_RECORDER_NAV_FEEDBACK_KEY/);
  assert.match(source, /function _rememberRecorderFeedbackForNextPage\(step\)/);
  assert.match(source, /function _consumeRecorderFeedbackFromPreviousPage\(\)/);
  assert.match(source, /function _showRecorderEventToast\(payload\)/);
  assert.match(source, /_shouldPersistRecorderFeedbackForNavigation\(captured, target\)/);
});

test("content recorder: feedback persistente solo para click o navigate con navegacion probable", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../../../src/content/content.js"), "utf8");
  assert.match(source, /if \(type === "navigate"\) return true;/);
  assert.match(source, /if \(type !== "click"\) return false;/);
  assert.match(source, /if \(step\._wmSubmitIntent\) return true;/);
  assert.match(source, /return _targetLooksNavigationLike\(target\);/);
});
