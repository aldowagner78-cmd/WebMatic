(function initGenexusAutocomplete(globalScope) {
  const BRIDGE_SOURCE = "webmatic-page-bridge";
  const BRIDGE_MESSAGE_FLAG = "__wmBridge";
  const BRIDGE_SCRIPT_ID = "webmatic-page-bridge-script";

  function decodeEscapes(text) {
    return String(text || "")
      .replace(/\\042/g, '"')
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");
  }

  function parseGeneXusOptionTuples(raw) {
    const text = String(raw || "");
    if (!text) return [];

    const out = [];
    const seen = new Set();
    const patterns = [
      /\{\s*c\s*:\s*"((?:\\\\"|[^"])*)"\s*,\s*d\s*:\s*"((?:\\\\"|[^"])*)"\s*\}/g,
      /\{\s*c\s*:\s*'((?:\\\\'|[^'])*)'\s*,\s*d\s*:\s*'((?:\\\\'|[^'])*)'\s*\}/g,
      /"c"\s*:\s*"((?:\\\\"|[^"])*)"\s*,\s*"d"\s*:\s*"((?:\\\\"|[^"])*)"/g,
      /'c'\s*:\s*'((?:\\\\'|[^'])*)'\s*,\s*'d'\s*:\s*'((?:\\\\'|[^'])*)'/g
    ];

    patterns.forEach((re) => {
      let m;
      while ((m = re.exec(text)) !== null) {
        const c = decodeEscapes(m[1]).trim();
        const d = decodeEscapes(m[2]).trim();
        if (!c && !d) continue;
        const value = c || d;
        const label = d || c;
        const key = `${value}||${label}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ value, text: label });
      }
    });

    return out;
  }

  function parseGeneXusValidation(raw) {
    const text = String(raw || "");
    if (!text) return null;
    const m = text.match(/\[\s*"([^"\\]*)"\s*,\s*"([^"\\]*)"\s*,\s*"\[[^\]]*\]"\s*\]/);
    if (!m) return null;
    return { code: String(m[1] || ""), text: decodeEscapes(m[2] || "") };
  }

  function parsePayload(raw) {
    const options = parseGeneXusOptionTuples(raw);
    const validation = parseGeneXusValidation(raw);
    return {
      options,
      validations: validation ? [validation] : []
    };
  }

  function ensurePageBridgeInstalled(doc) {
    const d = doc || (typeof document !== "undefined" ? document : null);
    if (!d) return;
    if (d.getElementById(BRIDGE_SCRIPT_ID)) return;

    const script = d.createElement("script");
    script.id = BRIDGE_SCRIPT_ID;
    script.textContent = `(function(){
      if (window.__wmPageBridgeInstalled) return;
      window.__wmPageBridgeInstalled = true;
      var FLAG = ${JSON.stringify(BRIDGE_MESSAGE_FLAG)};
      var SOURCE = ${JSON.stringify(BRIDGE_SOURCE)};
      function post(kind, method, url, body, responseText, status) {
        try {
          window.postMessage({
            [FLAG]: 1,
            source: SOURCE,
            kind: kind || "xhr",
            method: String(method || "GET").toUpperCase(),
            url: String(url || ""),
            body: body == null ? "" : String(body),
            responseText: String(responseText || ""),
            status: Number(status || 0)
          }, "*");
        } catch (e) {}
      }
      try {
        var XHR = window.XMLHttpRequest;
        if (XHR && XHR.prototype && !XHR.prototype.__wmPageBridgePatched) {
          XHR.prototype.__wmPageBridgePatched = true;
          var _open = XHR.prototype.open;
          var _send = XHR.prototype.send;
          XHR.prototype.open = function(method, url, async, user, password) {
            try {
              this.__wmMethod = String(method || "GET").toUpperCase();
              this.__wmUrl = String(url || "");
            } catch (e) {}
            return _open.call(this, method, url, async, user, password);
          };
          XHR.prototype.send = function(body) {
            var bodyText = "";
            try { bodyText = body == null ? "" : String(body); } catch (e) { bodyText = ""; }
            try {
              this.addEventListener("loadend", function() {
                post("xhr", this.__wmMethod || "GET", this.__wmUrl || "", bodyText, this.responseText || "", this.status || 0);
              });
            } catch (e) {}
            return _send.call(this, body);
          };
        }
      } catch (e) {}
      try {
        if (typeof window.fetch === "function" && !window.__wmPageBridgeFetchPatched) {
          window.__wmPageBridgeFetchPatched = true;
          var _fetch = window.fetch.bind(window);
          window.fetch = function(input, init) {
            var method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
            var url = String((typeof input === "string" ? input : (input && input.url)) || "");
            var body = (init && init.body != null) ? String(init.body) : "";
            return _fetch(input, init).then(function(resp){
              try {
                var c = resp && resp.clone ? resp.clone() : null;
                if (c && typeof c.text === "function") {
                  c.text().then(function(txt){ post("fetch", method, url, body, txt || "", resp.status || 0); }).catch(function(){});
                }
              } catch (e) {}
              return resp;
            });
          };
        }
      } catch (e) {}
    })();`;
    (d.documentElement || d.head || d.body).appendChild(script);
    try { script.parentNode && script.parentNode.removeChild(script); } catch (e) {}
  }

  function subscribeNetwork(handler) {
    const cb = typeof handler === "function" ? handler : () => {};
    function onMessage(ev) {
      const data = ev && ev.data;
      if (!data || data[BRIDGE_MESSAGE_FLAG] !== 1 || data.source !== BRIDGE_SOURCE) return;
      cb({
        kind: String(data.kind || "xhr"),
        method: String(data.method || "GET").toUpperCase(),
        url: String(data.url || ""),
        body: String(data.body || ""),
        responseText: String(data.responseText || ""),
        status: Number(data.status || 0)
      });
    }
    window.addEventListener("message", onMessage);
    return function unsubscribe() {
      try { window.removeEventListener("message", onMessage); } catch (e) {}
    };
  }

  const api = Object.freeze({
    decodeEscapes,
    parseGeneXusOptionTuples,
    parseGeneXusValidation,
    parsePayload,
    ensurePageBridgeInstalled,
    subscribeNetwork
  });

  globalScope.WebMaticGenexusAutocomplete = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
