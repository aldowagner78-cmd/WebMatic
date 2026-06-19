(function initContentMessageRouter(globalScope) {
  function messageType(message) {
    return message && typeof message === "object" ? String(message.type || "") : "";
  }

  function isMessageType(message, type) {
    return messageType(message) === String(type || "");
  }

  const api = {
    messageType,
    isMessageType
  };

  globalScope.WebMaticContentMessageRouter = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
