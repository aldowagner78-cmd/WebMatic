(function initActionClick(globalScope) {
  function simulateClick(el) {
    const isAnchor = el.tagName && el.tagName.toLowerCase() === "a";

    el.dispatchEvent(new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true
    }));

    el.dispatchEvent(new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true
    }));

    if (isAnchor) {
      el.click();
    } else {
      el.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true
      }));
    }
  }

  const api = {
    simulateClick
  };

  globalScope.WebMaticActionClick = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);