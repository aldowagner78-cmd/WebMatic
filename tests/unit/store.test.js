const test = require("node:test");
const assert = require("node:assert/strict");

const contracts = require("../../src/core/contracts.js");
const storeApi = require("../../src/core/store.js");

test("Store: toggle panel cambia panelVisible", () => {
  const store = storeApi.createStore();
  const before = store.getState().ui.panelVisible;

  store.dispatch({ type: contracts.ActionTypes.PANEL_TOGGLED });

  const after = store.getState().ui.panelVisible;
  assert.equal(after, !before);
});

test("Store: MODE_SET actualiza modo activo", () => {
  const store = storeApi.createStore();
  store.dispatch({ type: contracts.ActionTypes.MODE_SET, payload: contracts.Modes.PLAY });

  assert.equal(store.getState().ui.mode, contracts.Modes.PLAY);
});

test("Store: RECORD_STARTED activa grabacion flotante y limpia pasos", () => {
  const store = storeApi.createStore();
  assert.equal(store.getState().recorder.isRecording, false);

  store.dispatch({ type: contracts.ActionTypes.RECORD_STARTED });
  assert.equal(store.getState().recorder.isRecording, true);
  assert.equal(store.getState().ui.isFloatingRecorderVisible, false);
  assert.equal(store.getState().ui.mode, contracts.Modes.RECORD);
  assert.equal(store.getState().draft.stepsCount, 0);
});

test("Store: RECORD_STOPPED restaura panel docked y cambia a reproducir", () => {
  const store = storeApi.createStore();
  store.dispatch({ type: contracts.ActionTypes.RECORD_STARTED });
  store.dispatch({ type: contracts.ActionTypes.STEP_CAPTURED, payload: { type: "click", selector: "#send" } });
  store.dispatch({ type: contracts.ActionTypes.RECORD_STOPPED });

  assert.equal(store.getState().recorder.isRecording, false);
  assert.equal(store.getState().ui.isFloatingRecorderVisible, false);
  assert.equal(store.getState().ui.mode, contracts.Modes.PLAY);
  assert.equal(store.getState().draft.stepsCount, 1);
});

test("Store: PLAY_STARTED y PLAY_STOPPED actualizan playback", () => {
  const store = storeApi.createStore();

  store.dispatch({ type: contracts.ActionTypes.PLAY_STARTED });
  assert.equal(store.getState().playback.isPlaying, true);

  store.dispatch({ type: contracts.ActionTypes.PLAY_STOPPED });
  assert.equal(store.getState().playback.isPlaying, false);
});

test("Store: PANEL_SIDE_TOGGLED intercambia left/right", () => {
  const store = storeApi.createStore();
  assert.equal(store.getState().ui.panelSide, contracts.PanelSides.LEFT);

  store.dispatch({ type: contracts.ActionTypes.PANEL_SIDE_TOGGLED });
  assert.equal(store.getState().ui.panelSide, contracts.PanelSides.RIGHT);
});

test("Store: SETTINGS_UPDATED aplica modo y variante de tema", () => {
  const store = storeApi.createStore();
  store.dispatch({
    type: contracts.ActionTypes.SETTINGS_UPDATED,
    payload: {
      themeMode: "dark",
      themeVariant: 3,
      accentColor: "#3f3f46",
      surfaceColor: "#d4d4d8"
    }
  });

  assert.equal(store.getState().settings.themeMode, "dark");
  assert.equal(store.getState().settings.themeVariant, 3);
  assert.equal(store.getState().settings.accentColor, "#3f3f46");
});

test("Store: modo por defecto es play", () => {
  const store = storeApi.createStore();
  assert.equal(store.getState().ui.mode, contracts.Modes.PLAY);
});

test("Store: LIBRARY_LOADED reemplaza el array de macros", () => {
  const store = storeApi.createStore();
  const macros = [
    { id: "a1", name: "Macro A", steps: [], createdAt: 1 },
    { id: "b2", name: "Macro B", steps: [], createdAt: 2 }
  ];
  store.dispatch({ type: contracts.ActionTypes.LIBRARY_LOADED, payload: macros });
  assert.equal(store.getState().library.macros.length, 2);
  assert.equal(store.getState().library.macros[0].name, "Macro A");
});

test("Store: MACRO_SAVED agrega macro a la biblioteca", () => {
  const store = storeApi.createStore();
  const macro = { id: "c3", name: "Macro C", steps: [], createdAt: 3 };
  store.dispatch({ type: contracts.ActionTypes.MACRO_SAVED, payload: macro });
  assert.equal(store.getState().library.macros.length, 1);
  assert.equal(store.getState().library.macros[0].id, "c3");
});

test("Store: LIBRARY_FILTERED actualiza searchQuery", () => {
  const store = storeApi.createStore();
  store.dispatch({ type: contracts.ActionTypes.LIBRARY_FILTERED, payload: "login" });
  assert.equal(store.getState().library.searchQuery, "login");
});

test("Store: LIBRARY_SELECTED establece selectedMacroId", () => {
  const store = storeApi.createStore();
  store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: "macro_123" });
  assert.equal(store.getState().library.selectedMacroId, "macro_123");
});

test("Store: MACRO_DELETED elimina la macro y limpia seleccion", () => {
  const store = storeApi.createStore();
  store.dispatch({
    type: contracts.ActionTypes.LIBRARY_LOADED,
    payload: [
      { id: "x1", name: "X", steps: [], createdAt: 1 },
      { id: "x2", name: "Y", steps: [], createdAt: 2 }
    ]
  });
  store.dispatch({ type: contracts.ActionTypes.LIBRARY_SELECTED, payload: "x1" });
  store.dispatch({ type: contracts.ActionTypes.MACRO_DELETED, payload: "x1" });
  assert.equal(store.getState().library.macros.length, 1);
  assert.equal(store.getState().library.selectedMacroId, null);
});

test("Store: MACRO_RENAMED actualiza el nombre de la macro", () => {
  const store = storeApi.createStore();
  store.dispatch({ type: contracts.ActionTypes.MACRO_SAVED, payload: { id: "m1", name: "Viejo", steps: [], createdAt: 1 } });
  store.dispatch({ type: contracts.ActionTypes.MACRO_RENAMED, payload: { id: "m1", name: "Nuevo" } });
  assert.equal(store.getState().library.macros[0].name, "Nuevo");
});

test("Store: PLAYBACK_LOOP_TOGGLED alterna loopEnabled", () => {
  const store = storeApi.createStore();
  assert.equal(store.getState().playback.loopEnabled, false);
  store.dispatch({ type: contracts.ActionTypes.PLAYBACK_LOOP_TOGGLED });
  assert.equal(store.getState().playback.loopEnabled, true);
  store.dispatch({ type: contracts.ActionTypes.PLAYBACK_LOOP_TOGGLED });
  assert.equal(store.getState().playback.loopEnabled, false);
});

test("Store: PLAYBACK_REPEAT_SET clamp entre 2 y 100", () => {
  const store = storeApi.createStore();
  store.dispatch({ type: contracts.ActionTypes.PLAYBACK_REPEAT_SET, payload: 1 });
  assert.equal(store.getState().playback.repeatCount, 2);
  store.dispatch({ type: contracts.ActionTypes.PLAYBACK_REPEAT_SET, payload: 999 });
  assert.equal(store.getState().playback.repeatCount, 100);
  store.dispatch({ type: contracts.ActionTypes.PLAYBACK_REPEAT_SET, payload: 42 });
  assert.equal(store.getState().playback.repeatCount, 42);
});

test("Store: SAVE_MODAL_OPENED y SAVE_MODAL_CLOSED gestionan el modal de guardado", () => {
  const store = storeApi.createStore();
  assert.equal(store.getState().ui.saveModal.open, false);
  store.dispatch({ type: contracts.ActionTypes.SAVE_MODAL_OPENED, payload: { script: "VERSION BUILD=1000\n" } });
  assert.equal(store.getState().ui.saveModal.open, true);
  assert.ok(store.getState().ui.saveModal.script.includes("VERSION"));
  store.dispatch({ type: contracts.ActionTypes.SAVE_MODAL_CLOSED });
  assert.equal(store.getState().ui.saveModal.open, false);
  assert.equal(store.getState().ui.saveModal.script, "");
});