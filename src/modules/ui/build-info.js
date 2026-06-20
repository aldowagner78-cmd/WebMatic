(function initWebMaticBuildInfo(globalScope) {
  globalScope.WebMaticBuildInfo = Object.assign({}, globalScope.WebMaticBuildInfo || {}, {
    versionLabel: "v0.2.0-modular-rc22"
  });
})(typeof window !== "undefined" ? window : globalThis);
