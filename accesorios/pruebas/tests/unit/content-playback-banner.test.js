const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "../../../..");
const CONTENT_FILE = path.join(ROOT, "src/content/content.js");

function readContent() {
  return fs.readFileSync(CONTENT_FILE, "utf8");
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `falta ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") {
      depth += 1;
      opened = true;
    } else if (source[i] === "}") {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`no se pudo leer ${name}`);
}

test("content playback banner: se crea una sola vez y se actualiza in-place", () => {
  const source = readContent();
  const createBody = functionBody(source, "createPlaybackFloating");
  const updateBody = functionBody(source, "updatePlaybackFloating");

  assert.match(createBody, /document\.getElementById\(FLOATING_PLAYER_ID\)\) return/);
  assert.match(createBody, /document\.documentElement\.appendChild\(panel\)/);
  assert.match(createBody, /progressBar\.style\.cssText = ".*transition:none/);
  assert.match(createBody, /dot\.style\.cssText = ".*animation:none/);
  assert.doesNotMatch(updateBody, /createElement\(/);
  assert.doesNotMatch(updateBody, /innerHTML/);
  assert.match(updateBody, /_setNodeText\(infoEl/);
  assert.match(updateBody, /_setNodeStyle\(progress, "width"/);
  assert.match(updateBody, /_setNodeDisplay\(stopEl, "inline-flex"\)/);
});

test("content playback banner: exito cierra banner y error lo mantiene con sidebar abierto", () => {
  const source = readContent();
  const updateBody = functionBody(source, "updatePlaybackFloating");

  assert.match(source, /onDone: \(summary\) =>[\s\S]*?PLAY_STOPPED[\s\S]*?STATUS_MESSAGE_SET[\s\S]*?removePlaybackFloating\(\)/);
  assert.match(source, /onError: \(err\) =>[\s\S]*?PLAYBACK_ERROR[\s\S]*?PANEL_SHOWN[\s\S]*?STATUS_MESSAGE_SET/);
  assert.match(updateBody, /if \(errorMessage\)/);
  assert.match(updateBody, /const errorText = failedLabel/);
});

test("content playback banner: stop manual informa paso, accion y selector antes de cerrar", () => {
  const source = readContent();
  const summaryBody = functionBody(source, "summarizeManualPlaybackStop");
  const stopBody = functionBody(source, "stopPlaybackFromUser");

  assert.match(summaryBody, /Ejecucion detenida por el usuario/);
  assert.match(summaryBody, /index \+ 1/);
  assert.match(summaryBody, /_stepLabel\(step\)/);
  assert.match(summaryBody, /step\.selector \|\| step\.from \|\| step\.to/);
  assert.match(summaryBody, /macroName/);
  assert.match(summaryBody, /action: step && step\.type/);
  assert.match(stopBody, /PLAYBACK_STOP_SUMMARY_SET/);
  assert.ok(stopBody.indexOf("STATUS_MESSAGE_SET") < stopBody.indexOf("removePlaybackFloating()"));
  assert.match(stopBody, /PANEL_SHOWN/);
});

test("content playback banner: no cambia visualmente por waits ni pasos internos", () => {
  const source = readContent();
  const helperBody = functionBody(source, "isPlaybackBannerStepRelevant");
  const visualBody = functionBody(source, "getPlaybackBannerVisualIndex");
  const updateBody = functionBody(source, "updatePlaybackFloating");

  assert.match(helperBody, /type === "wait" \|\| type === "wait_for"/);
  assert.match(helperBody, /type === "key"\) return Boolean\(step\.selector\)/);
  assert.match(visualBody, /for \(let i = max; i >= 0; i -= 1\)/);
  assert.match(updateBody, /panel\.dataset\.wmVisualStepIndex/);
  assert.match(updateBody, /previousVisualIndex === String\(visualIndex\)/);
});
