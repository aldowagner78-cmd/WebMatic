(function initEditorStateUtils(globalScope) {
  function clampAddFormTargetIndex(insertAt, stepsLength) {
    const len = Number.isFinite(Number(stepsLength)) ? Number(stepsLength) : 0;
    let idx = Number.isInteger(insertAt) ? insertAt : len;
    if (idx < 0) idx = 0;
    if (idx > len) idx = len;
    return idx;
  }

  function openAddFormState(insertAt, stepsLength, asNewBlock) {
    return {
      addFormOpen: true,
      addFormTargetIndex: clampAddFormTargetIndex(insertAt, stepsLength),
      addFormAsNewBlock: !!asNewBlock
    };
  }

  function closeAddFormState() {
    return {
      addFormOpen: false,
      addFormTargetIndex: null,
      addFormAsNewBlock: false
    };
  }

  function markStepMoved(movedStepMeta, stepRef, source) {
    if (!movedStepMeta || typeof movedStepMeta.set !== "function") return;
    if (!stepRef || typeof stepRef !== "object") return;
    movedStepMeta.set(stepRef, { source, at: Date.now() });
  }

  const api = {
    clampAddFormTargetIndex,
    openAddFormState,
    closeAddFormState,
    markStepMoved
  };

  globalScope.WebMaticEditorStateUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);