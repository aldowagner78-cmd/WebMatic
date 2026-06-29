(function initBackgroundNavigator(globalScope) {
  function requestBackgroundNavigate(url, playbackState, deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const chromeApi = options.chromeApi || globalScope.chrome || (typeof chrome !== "undefined" ? chrome : null);

    return new Promise((resolve) => {
      if (!chromeApi || !chromeApi.runtime || typeof chromeApi.runtime.sendMessage !== "function") {
        resolve({ ok: false, error: "chrome_runtime_unavailable" });
        return;
      }

      chromeApi.runtime.sendMessage({
        type: "PLAYBACK_NAVIGATE",
        url,
        steps: Array.isArray(playbackState && playbackState.steps) ? playbackState.steps : undefined,
        index: Number.isFinite(Number(playbackState && playbackState.index)) ? Number(playbackState.index) : undefined,
        vars: playbackState && playbackState.vars ? playbackState.vars : undefined,
        speed: playbackState && playbackState.speed ? playbackState.speed : undefined,
        macroId: playbackState && playbackState.macroId ? playbackState.macroId : null,
        loopReplay: playbackState && playbackState.loopReplay ? playbackState.loopReplay : null
      }, (resp) => {
        if (chromeApi.runtime.lastError) {
          resolve({
            ok: false,
            error: chromeApi.runtime.lastError.message || "playback_navigate_runtime_error"
          });
          return;
        }

        resolve(resp || { ok: false, error: "playback_navigate_no_response" });
      });
    });
  }

  const api = {
    requestBackgroundNavigate
  };

  globalScope.WebMaticBackgroundNavigator = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);