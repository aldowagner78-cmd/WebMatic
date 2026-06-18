(function initDragDropUtils(globalScope) {
  function computeDropPosition(clientY, top, height) {
    const relY = Number(clientY) - Number(top);
    return relY >= (Number(height) / 2) ? "after" : "before";
  }

  function normalizeDropTarget(rawTarget, from) {
    let to = Number(rawTarget);
    const source = Number(from);
    if (Number.isNaN(to) || Number.isNaN(source)) return to;
    if (to > source) to -= 1;
    return to;
  }

  function resolveDragMode(blockSize, blockLead, mode) {
    const wantsBlockMove = mode === "block" || (mode === "auto" && blockLead);
    return blockSize > 1 && wantsBlockMove ? "block" : "step";
  }

  const api = {
    computeDropPosition,
    normalizeDropTarget,
    resolveDragMode
  };

  globalScope.WebMaticDragDropUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);