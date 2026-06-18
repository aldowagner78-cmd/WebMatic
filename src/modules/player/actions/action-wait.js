(function initActionWait(globalScope) {
  function wait(step, speed, deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const resolve = typeof options.resolve === "function" ? options.resolve : function noop() {};
    const setTimeoutFn = typeof options.setTimeout === "function" ? options.setTimeout : setTimeout;

    const rawMs = step.seconds != null
      ? Math.round(Number(step.seconds) * 1000)
      : (Number(step.ms) || 500);
    const scaledMs = Math.round(rawMs / (speed || 1));
    setTimeoutFn(resolve, scaledMs);
  }

  const api = {
    wait
  };

  globalScope.WebMaticActionWait = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
