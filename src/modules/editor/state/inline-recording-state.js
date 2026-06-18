(function initInlineRecordingState(globalScope) {
  function normalizeInlineRecordedSteps(capturedSteps, asNewBlock) {
    const steps = Array.isArray(capturedSteps) ? capturedSteps : [];
    if (asNewBlock && steps.length > 0 && steps[0] && typeof steps[0] === "object") {
      steps[0]._wmBlockStart = true;
      steps[0]._wmCollapsed = true;
    }
    return steps;
  }

  const api = {
    normalizeInlineRecordedSteps
  };

  globalScope.WebMaticInlineRecordingState = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);