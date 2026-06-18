(function initBlockUtils(globalScope) {
  function normalizeBlockKey(raw) {
    const key = String(raw || "").trim();
    return key || "";
  }

  function stepBlockKey(step) {
    if (!step || typeof step !== "object") return "";
    return normalizeBlockKey(step._wmBlockKey);
  }

  function formatBlockContextLabel(blockKey) {
    const key = normalizeBlockKey(blockKey);
    if (!key) return "";
    const slash = key.indexOf("/");
    if (slash < 0) return key;
    const host = key.slice(0, slash);
    const path = key.slice(slash) || "/";
    if (path.length <= 32) return `${host}${path}`;
    return `${host}${path.slice(0, 29)}...`;
  }

  function isExecutionBlockBoundaryType(stepType) {
    return stepType === "navigate" || stepType === "open_tab" || stepType === "switch_tab" || stepType === "close_tab";
  }

  function isExecutionBlockBoundaryStep(step, idx, steps) {
    const list = Array.isArray(steps) ? steps : [];
    if (!step || typeof step !== "object") return false;
    if (idx === 0) return true;
    if (step._wmBlockStart === true || String(step._wmBlockStart).toLowerCase() === "true") return true;
    const currKey = stepBlockKey(step);
    const prev = list[idx - 1];
    const prevKey = stepBlockKey(prev);
    if (currKey && prevKey && currKey !== prevKey) return true;
    if (currKey && prevKey && currKey === prevKey) return false;
    return isExecutionBlockBoundaryType(step.type);
  }

  function wantsCollapsedByDefault(step) {
    if (!step || typeof step !== "object") return false;
    return step._wmCollapsed === true || String(step._wmCollapsed).toLowerCase() === "true";
  }

  function findExecutionBlockBounds(steps, idx) {
    const list = Array.isArray(steps) ? steps : [];
    if (idx < 0 || idx >= list.length) return null;
    let start = 0;
    for (let i = idx; i > 0; i--) {
      const s = list[i];
      if (isExecutionBlockBoundaryStep(s, i, list)) {
        start = i;
        break;
      }
    }

    let end = list.length - 1;
    for (let j = Math.max(start + 1, idx + 1); j < list.length; j++) {
      const s = list[j];
      if (isExecutionBlockBoundaryStep(s, j, list)) {
        end = j - 1;
        break;
      }
    }
    if (end < start) end = start;
    return { start, end };
  }

  function getExecutionBlockOrdinal(steps, idx) {
    const list = Array.isArray(steps) ? steps : [];
    if (idx < 0 || idx >= list.length) return 1;
    let ord = 1;
    for (let i = 1; i <= idx; i++) {
      const s = list[i];
      if (isExecutionBlockBoundaryStep(s, i, list)) ord += 1;
    }
    return ord;
  }

  function buildExecutionBlockContextMeta(steps) {
    const list = Array.isArray(steps) ? steps : [];
    const meta = new Map();
    if (list.length === 0) return meta;
    const visitCountByKey = new Map();
    let idx = 0;
    while (idx < list.length) {
      const block = findExecutionBlockBounds(list, idx) || { start: idx, end: idx };
      const start = block.start;
      const end = block.end;
      if (start !== idx) {
        idx += 1;
        continue;
      }
      const key = stepBlockKey(list[start]);
      if (key) {
        const visitIndex = (visitCountByKey.get(key) || 0) + 1;
        visitCountByKey.set(key, visitIndex);
        meta.set(start, {
          visitIndex,
          isReentry: visitIndex > 1,
          blockKey: key,
          contextLabel: formatBlockContextLabel(key)
        });
      } else {
        meta.set(start, {
          visitIndex: 0,
          isReentry: false,
          blockKey: "",
          contextLabel: ""
        });
      }
      idx = end + 1;
    }
    return meta;
  }

  const api = {
    normalizeBlockKey,
    stepBlockKey,
    formatBlockContextLabel,
    isExecutionBlockBoundaryType,
    isExecutionBlockBoundaryStep,
    wantsCollapsedByDefault,
    findExecutionBlockBounds,
    getExecutionBlockOrdinal,
    buildExecutionBlockContextMeta
  };

  globalScope.WebMaticBlockUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);