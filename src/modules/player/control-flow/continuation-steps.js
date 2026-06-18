(function initContinuationSteps(globalScope) {
  function cloneDatasetRows(rows) {
    if (!Array.isArray(rows)) return [];

    return rows.map((row) => {
      if (Array.isArray(row)) return row.slice();
      if (row && typeof row === "object") return { ...row };
      return row;
    });
  }

  function buildForEachRowContinuationStep(step, remainingRows) {
    const cloned = { ...(step || {}) };

    cloned.columns = Array.isArray(step && step.columns)
      ? step.columns.slice()
      : [];

    cloned.dataset = cloneDatasetRows(remainingRows);

    cloned.steps = Array.isArray(step && step.steps)
      ? step.steps.map((item) => (item && typeof item === "object" ? { ...item } : item))
      : [];

    return cloned;
  }

  function buildLoopUntilContinuationStep(step, remainingIterations) {
    const cloned = { ...(step || {}) };

    cloned.steps = Array.isArray(step && step.steps)
      ? step.steps.map((item) => (item && typeof item === "object" ? { ...item } : item))
      : [];

    cloned.max_iterations = remainingIterations;

    return cloned;
  }

  const api = {
    cloneDatasetRows,
    buildForEachRowContinuationStep,
    buildLoopUntilContinuationStep
  };

  globalScope.WebMaticContinuationSteps = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);