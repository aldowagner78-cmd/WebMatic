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

test("content playback banner: exito queda visible 2s y cierra con animacion", () => {
  const source = readContent();
  const updateBody = functionBody(source, "updatePlaybackFloating");
  const successBody = functionBody(source, "schedulePlaybackSuccessClose");
  const errorBody = functionBody(source, "handlePlaybackError");
  const animatedCloseBody = functionBody(source, "animateAndRemovePlaybackFloating");

  assert.match(source, /onDone: \(summary\) =>[\s\S]*?finishPlaybackSuccessfully\(_preparedSteps, _statusMsg\)/);
  assert.match(successBody, /clearPlaybackSuccessCloseTimer\(\)/);
  assert.match(successBody, /setTimeout\(\(\) =>[\s\S]*?animateAndRemovePlaybackFloating\(\{ restoreSidebar: true \}\)[\s\S]*?, 2000\)/);
  assert.match(animatedCloseBody, /opacity 220ms ease, transform 220ms ease/);
  assert.match(animatedCloseBody, /translateY\(-6px\)/);
  assert.match(animatedCloseBody, /setTimeout\(\(\) =>[\s\S]*?removePlaybackFloating\(opts\)[\s\S]*?, 220\)/);
  assert.match(successBody, /animateAndRemovePlaybackFloating\(\{ restoreSidebar: true \}\)/);
  assert.match(errorBody, /PLAYBACK_ERROR/);
  assert.match(errorBody, /clearPlaybackTransientCloseTimers\(\)/);
  assert.doesNotMatch(errorBody, /PANEL_SHOWN/);
  assert.doesNotMatch(errorBody, /openSidebarFromPlaybackFloating|openEditorAtPlaybackFailure/);
  assert.match(updateBody, /if \(errorMessage\)/);
  assert.match(updateBody, /Error en reproduccion/);
  assert.match(updateBody, /Paso: \$\{Math\.min\(currentStepIndex \+ 1, total\)\}\/\$\{total\}/);
  assert.match(updateBody, /Mensaje: \$\{errorMessage\}/);
  assert.match(updateBody, /_setNodeDisplay\(sidebarEl, "inline-flex"\)/);
});

test("content playback banner: stop manual queda visible y no abre sidebar automaticamente", () => {
  const source = readContent();
  const summaryBody = functionBody(source, "summarizeManualPlaybackStop");
  const stopBody = functionBody(source, "stopPlaybackFromUser");
  const onDoneBody = functionBody(source, "_startMacroPlay");
  const updateBody = functionBody(source, "updatePlaybackFloating");

  assert.match(stopBody, /clearPlaybackTransientCloseTimers\(\)/);
  assert.match(stopBody, /manualStopRequested = true/);
  assert.doesNotMatch(stopBody, /setTimeout\(|animateAndRemovePlaybackFloating\(/);
  assert.match(summaryBody, /Ejecucion detenida por el usuario/);
  assert.match(summaryBody, /index \+ 1/);
  assert.match(summaryBody, /_stepLabel\(step\)/);
  assert.match(summaryBody, /step\.selector \|\| step\.from \|\| step\.to/);
  assert.match(summaryBody, /macroName/);
  assert.match(summaryBody, /action: step && step\.type/);
  assert.match(stopBody, /PLAYBACK_STOP_SUMMARY_SET/);
  assert.doesNotMatch(stopBody, /PANEL_SHOWN/);
  assert.doesNotMatch(stopBody, /removePlaybackFloating/);
  assert.match(onDoneBody, /if \(playerRuntime\.manualStopRequested\)/);
  assert.match(updateBody, /Ejecucion detenida por el usuario/);
  assert.match(updateBody, /Paso: \$\{stopSummary\.index \+ 1\}\/\$\{stopSummary\.total\}/);
  assert.match(updateBody, /Accion: \$\{stopSummary\.action\}/);
  assert.match(updateBody, /Selector: \$\{stopSummary\.selector\}/);
  assert.match(updateBody, /Macro: \$\{stopSummary\.macroName\}/);
});

test("content playback banner: error muestra Editar macro y abre editor en paso fallido", () => {
  const source = readContent();
  const createBody = functionBody(source, "createPlaybackFloating");
  const updateBody = functionBody(source, "updatePlaybackFloating");
  const openEditBody = functionBody(source, "openEditorAtPlaybackFailure");
  const focusBody = functionBody(source, "_focusPlaybackFailureInOpenEditor");
  const pickLineBody = functionBody(source, "_pickIimLineForStep");

  assert.match(createBody, /wm-play-edit-macro/);
  assert.match(createBody, /onEditMacro/);
  assert.match(createBody, /openEditorAtPlaybackFailure\(\)/);
  assert.match(updateBody, /_setNodeDisplay\(editMacroEl, "inline-flex"\)/);
  assert.match(openEditBody, /animateAndRemovePlaybackFloating\(\{ restoreSidebar: true \}\)/);
  assert.match(openEditBody, /_openSelectedMacroInEditorWithReusableMetadata/);
  assert.match(focusBody, /_seActiveTab = "visual"/);
  assert.match(focusBody, /seEditor\._editIdx = boundedIndex/);
  assert.match(focusBody, /scrollIntoView/);
  assert.match(focusBody, /setSelectionRange\(/);
  assert.match(pickLineBody, /VERSION\\b/);
  assert.match(pickLineBody, /TAB\\b/);
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

test("content playback banner: botones finales cierran, abren sidebar y copian diagnostico", () => {
  const source = readContent();
  const createBody = functionBody(source, "createPlaybackFloating");
  const closeBody = functionBody(source, "closePlaybackFloatingOnly");
  const sidebarBody = functionBody(source, "openSidebarFromPlaybackFloating");
  const copyBody = functionBody(source, "copyPlaybackDiagnostic");
  const animatedCloseBody = functionBody(source, "animateAndRemovePlaybackFloating");

  assert.match(createBody, /wm-play-open-sidebar/);
  assert.match(createBody, /wm-play-copy-diagnostic/);
  assert.match(closeBody, /animateAndRemovePlaybackFloating\(\{ restoreSidebar: false \}\)/);
  assert.match(sidebarBody, /animateAndRemovePlaybackFloating\(\{ restoreSidebar: true \}\)/);
  assert.match(copyBody, /getPlaybackDiagnosticText/);
  assert.doesNotMatch(copyBody, /animateAndRemovePlaybackFloating|removePlaybackFloating/);
  assert.match(animatedCloseBody, /pointerEvents = "none"/);
});

test("content playback loop: preserva bucle al reanudar despues de navigate", () => {
  const source = readContent();
  const resumeBody = functionBody(source, "_resumePendingPlaybackIfAny");
  const continueBody = functionBody(source, "_startLoopReplayIterationFromPending");
  const nextBody = functionBody(source, "_nextLoopReplayState");

  assert.match(resumeBody, /_nextLoopReplayState\(p\.loopReplay\)/);
  assert.match(resumeBody, /_startLoopReplayIterationFromPending\(p, _nextLoop\)/);
  assert.match(resumeBody, /loopReplay: p\.loopReplay \|\| null/);
  assert.match(continueBody, /loopReplay: normalizedLoop/);
  assert.match(continueBody, /_nextLoopReplayState\(normalizedLoop\)/);
  assert.match(nextBody, /remaining: normalized\.remaining - 1/);
});
