(function initRecordingLifecycle(globalScope) {
  function resetRuntimeForNewRecording(runtime, locationHref) {
    if (!runtime || typeof runtime !== "object") return;
    runtime.recordingStartUrl = String(locationHref || "");
    runtime.autocompleteCatalogs = {};
    runtime._autocompleteExpansionState = {};
    runtime._autocompleteLastTypedBySelector = {};
    runtime._autocompleteExpansionPromises = {};
    runtime.pageInventories = [];
  }

  function resetPageInventories(runtime) {
    if (!runtime || typeof runtime !== "object") return;
    runtime.pageInventories = [];
  }

  const api = {
    resetRuntimeForNewRecording,
    resetPageInventories
  };

  globalScope.WebMaticRecordingLifecycle = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
