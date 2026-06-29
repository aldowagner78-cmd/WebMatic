const test = require("node:test");
const assert = require("node:assert/strict");

const contentRouter = require("../../../../src/modules/content/message-router.js");
const backgroundRouter = require("../../../../src/background/background-router.js");
const tabsNavigation = require("../../../../src/background/tabs-navigation.js");
const macroStorage = require("../../../../src/modules/storage/macro-storage.js");

test("content, background and storage helpers preserve routing, navigation and macro storage contracts", () => {
  assert.equal(contentRouter.messageType({ type: "START_RECORDING" }), "START_RECORDING");
  assert.equal(contentRouter.messageType(null), "");
  assert.equal(contentRouter.isMessageType({ type: "STOP_RECORDING" }, "STOP_RECORDING"), true);

  assert.deepEqual(backgroundRouter.ok({ id: 7 }), { ok: true, id: 7 });
  assert.deepEqual(backgroundRouter.error("missing_payload", { field: "steps" }), {
    ok: false,
    error: "missing_payload",
    field: "steps"
  });
  assert.equal(backgroundRouter.isMessageType({ type: "PLAYBACK_NAVIGATE" }, "PLAYBACK_NAVIGATE"), true);

  assert.equal(tabsNavigation.urlMatches("https://example.com/path?q=1", "https://example.com/path"), true);
  assert.equal(tabsNavigation.urlMatches("https://example.com/a", "https://example.com/b"), false);
  assert.equal(tabsNavigation.isRestrictedUrl("chrome://extensions"), true);
  assert.equal(tabsNavigation.isRestrictedUrl("https://example.com"), false);
  assert.deepEqual(tabsNavigation.resolveNavigationUrl("/next", "https://example.com/base/"), {
    ok: true,
    url: "https://example.com/next"
  });
  assert.deepEqual(tabsNavigation.resolveNavigationUrl("", "https://example.com/"), {
    ok: false,
    error: "navigate_missing_url"
  });
  assert.deepEqual(
    tabsNavigation.buildPendingPlaybackState(9, {
      steps: [{ type: "click" }],
      index: "2",
      vars: { A: "1" },
      speed: 1.5,
      macroId: "m1",
      loopReplay: { total: 3, remaining: 2 }
    }),
    {
      tabId: 9,
      steps: [{ type: "click" }],
      index: 2,
      vars: { A: "1" },
      speed: 1.5,
      macroId: "m1",
      loopReplay: { total: 3, remaining: 2 }
    }
  );

  const macros = [{ id: "m1", name: "Demo", steps: [] }];
  assert.equal(macroStorage.getMacrosStorageKey(), "webmaticMacros");
  assert.equal(macroStorage.normalizeMacros("bad").length, 0);
  assert.deepEqual(macroStorage.buildMacrosStoragePatch(macros), { webmaticMacros: macros });
  assert.deepEqual(macroStorage.readMacrosFromStorageSnapshot({ webmaticMacros: macros }), macros);
  assert.deepEqual(
    macroStorage.extractMacrosFromStorageChange({ webmaticMacros: { newValue: macros } }, "local"),
    macros
  );
  assert.equal(
    macroStorage.extractMacrosFromStorageChange({ webmaticMacros: { newValue: macros } }, "sync"),
    null
  );
});
