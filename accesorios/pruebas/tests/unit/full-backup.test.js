const test = require("node:test");
const assert = require("node:assert/strict");

const backup = require("../../../../src/modules/storage/full-backup.js");

test("full-backup: export incluye macros y settings", () => {
  const payload = backup.createFullBackupPayload({
    macros: [{ id: "m1", name: "Macro 1", steps: [{ type: "click", selector: "#a" }], script: "CLICK" }],
    settings: { themeMode: "dark", themeVariant: 3, panelSide: "right" },
    ui: { panelSide: "right", panelWidth: 260 },
    metadata: { storage: { webmaticExportFolder: "X" } }
  });

  assert.equal(payload.version, 1);
  assert.equal(payload.app, "WebMatic");
  assert.equal(Array.isArray(payload.macros), true);
  assert.equal(payload.macros.length, 1);
  assert.equal(payload.settings.themeMode, "dark");
  assert.equal(payload.ui.panelSide, "right");
});

test("full-backup: parse full backup restaura macros y settings", () => {
  const parsed = backup.parseBackupObject({
    version: 1,
    app: "WebMatic",
    exportedAt: "2026-06-07T00:00:00.000Z",
    macros: [{ id: "m1", name: "Macro 1", meta: { pageInventories: [{ controls: [] }] } }],
    settings: { themeMode: "light", themeVariant: 2, runtimeDataTemplates: [{ id: "t1", name: "T" }] },
    ui: { panelSide: "left" },
    metadata: { storage: { webmaticHelpTheme: { themeMode: "light", themeVariant: 2 } } }
  });

  assert.equal(parsed.kind, "full");
  assert.equal(parsed.data.macros.length, 1);
  assert.equal(parsed.data.settings.themeVariant, 2);
  assert.equal(parsed.data.macros[0].meta.pageInventories.length, 1);
});

test("full-backup: parse backup legacy de macros mantiene compatibilidad", () => {
  const parsed = backup.parseBackupObject({
    version: 1,
    exportedAt: 123,
    macros: [{ id: "m-old", name: "Legacy", steps: [] }]
  });

  assert.equal(parsed.kind, "macros-only");
  assert.equal(parsed.data.macros.length, 1);
  assert.equal(parsed.data.macros[0].id, "m-old");
});

test("full-backup: settings/tema se preservan en payload", () => {
  const payload = backup.createFullBackupPayload({
    macros: [],
    settings: {
      themeMode: "dark",
      themeVariant: 4,
      accentColor: "#dc2626",
      surfaceColor: "#fef2f2",
      panelOpacity: 0.85,
      runtimeDataTemplates: [{ id: "rt1", name: "Plantilla" }]
    }
  });

  assert.equal(payload.settings.themeMode, "dark");
  assert.equal(payload.settings.themeVariant, 4);
  assert.equal(payload.settings.accentColor, "#dc2626");
  assert.equal(payload.settings.runtimeDataTemplates.length, 1);
});

test("full-backup: safeParseJson valida json", () => {
  const obj = backup.safeParseJson('{"version":1,"app":"WebMatic","macros":[],"settings":{}}');
  assert.equal(obj.version, 1);
  assert.throws(() => backup.safeParseJson("{"));
});
