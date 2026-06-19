(function initBackgroundRouter(globalScope) {
  function messageType(message) {
    return message && typeof message === "object" ? String(message.type || "") : "";
  }

  function isMessageType(message, type) {
    return messageType(message) === String(type || "");
  }

  function ok(extra) {
    return Object.assign({ ok: true }, extra || {});
  }

  function error(code, extra) {
    return Object.assign({ ok: false, error: String(code || "error") }, extra || {});
  }

  const api = {
    messageType,
    isMessageType,
    ok,
    error
  };

  globalScope.WebMaticBackgroundRouter = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
