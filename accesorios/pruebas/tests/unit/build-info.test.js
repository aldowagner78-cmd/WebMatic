const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "../../../..");
const BUILD_INFO_FILE = "src/modules/ui/build-info.js";
const UI_SHELL_FILE = "src/modules/ui/ui-shell.js";

function readRepoFile(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function readRepoJson(file) {
  return JSON.parse(readRepoFile(file).replace(/^\uFEFF/, ""));
}

function assertBefore(source, first, second, label) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.notEqual(firstIndex, -1, `${label}: falta ${first}`);
  assert.notEqual(secondIndex, -1, `${label}: falta ${second}`);
  assert.ok(firstIndex < secondIndex, `${label}: ${first} debe cargar antes que ${second}`);
}

test("build info: expone la version visible centralizada", () => {
  const sandbox = { window: {} };
  vm.runInNewContext(readRepoFile(BUILD_INFO_FILE), sandbox);

  assert.equal(sandbox.window.WebMaticBuildInfo.versionLabel, "v0.2.0-modular-rc22");
});

test("ui shell: usa WebMaticBuildInfo para mostrar la version", () => {
  const source = readRepoFile(UI_SHELL_FILE);

  assert.match(source, /WebMaticBuildInfo/);
  assert.match(source, /versionLabel/);
  assert.equal(source.includes(`v0.2.0-modular-${"rc9"}`), false);
  assert.equal(source.includes(`v0.2.0-modular-${"rc10"}`), false);
  assert.equal(source.includes("Versión: v0."), false);
});

test("manifest e inyeccion manual: build-info carga antes de ui-shell", () => {
  const firefoxManifest = readRepoJson("manifest.json");
  const firefoxScripts = firefoxManifest.content_scripts[0].js;
  assert.ok(firefoxScripts.indexOf(BUILD_INFO_FILE) < firefoxScripts.indexOf(UI_SHELL_FILE));

  const chromiumManifest = readRepoJson("chromium/manifest.json");
  const chromiumScripts = chromiumManifest.content_scripts[0].js;
  assert.ok(chromiumScripts.indexOf(BUILD_INFO_FILE) < chromiumScripts.indexOf(UI_SHELL_FILE));

  assertBefore(readRepoFile("src/background/background.js"), BUILD_INFO_FILE, UI_SHELL_FILE, "background.js");
  assertBefore(readRepoFile("chromium/background.chromium.js"), BUILD_INFO_FILE, UI_SHELL_FILE, "background.chromium.js");
});
