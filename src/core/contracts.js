(function initContracts(globalScope) {
  const ActionTypes = Object.freeze({
    PANEL_TOGGLED: "PANEL_TOGGLED",
    PANEL_SIDE_SET: "PANEL_SIDE_SET",
    PANEL_SIDE_TOGGLED: "PANEL_SIDE_TOGGLED",
    PANEL_WIDTH_SET: "PANEL_WIDTH_SET",
    MODE_SET: "MODE_SET",
    SETTINGS_UPDATED: "SETTINGS_UPDATED",
    RECORD_STARTED: "RECORD_STARTED",
    RECORD_STOPPED: "RECORD_STOPPED",
    PLAY_STARTED: "PLAY_STARTED",
    PLAY_STOPPED: "PLAY_STOPPED",
    STEP_CAPTURED: "STEP_CAPTURED",
    DRAFT_RESTORED: "DRAFT_RESTORED",
    STATUS_MESSAGE_SET: "STATUS_MESSAGE_SET",
    LIBRARY_LOADED: "LIBRARY_LOADED",
    MACRO_SAVED: "MACRO_SAVED",
    LIBRARY_FILTERED: "LIBRARY_FILTERED",
    LIBRARY_SELECTED: "LIBRARY_SELECTED",
    MACRO_RENAMED: "MACRO_RENAMED",
    MACRO_DELETED: "MACRO_DELETED",
    PLAYBACK_REPEAT_SET: "PLAYBACK_REPEAT_SET",
    PLAYBACK_LOOP_TOGGLED: "PLAYBACK_LOOP_TOGGLED",
    PLAYBACK_STEP_STARTED: "PLAYBACK_STEP_STARTED",
    PLAYBACK_ERROR: "PLAYBACK_ERROR",
    PANEL_SHOWN: "PANEL_SHOWN",
    SAVE_MODAL_OPENED: "SAVE_MODAL_OPENED",
    SAVE_MODAL_CLOSED: "SAVE_MODAL_CLOSED",
    SCRIPT_EDITOR_OPENED: "SCRIPT_EDITOR_OPENED",
    SCRIPT_EDITOR_CLOSED: "SCRIPT_EDITOR_CLOSED"
  });

  const Modes = Object.freeze({
    RECORD: "record",
    PLAY: "play",
    SETTINGS: "settings"
  });

  const PanelSides = Object.freeze({
    LEFT: "left",
    RIGHT: "right"
  });

  const contracts = Object.freeze({
    ActionTypes,
    Modes,
    PanelSides
  });

  globalScope.WebMaticContracts = contracts;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = contracts;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);