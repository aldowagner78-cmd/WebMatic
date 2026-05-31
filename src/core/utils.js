(function initUtils(globalScope) {
  /**
   * WebMaticUtils — utilidades de texto y fechas
   * Adaptado del proyecto iMacros (Progress Software, 2021).
   */
  const WebMaticUtils = {

    trim(s) {
      return s.replace(/^\s+/, "").replace(/\s+$/, "");
    },

    // Formatea una fecha usando tokens: yyyy yy mm dd hh nn ss
    formatDate(fmt, date) {
      const pad = (n, len) => {
        let s = n.toString();
        while (s.length < len) s = "0" + s;
        return s;
      };
      const d = date instanceof Date ? date : new Date();
      return fmt
        .replace(/yyyy/g, pad(d.getFullYear(), 4))
        .replace(/yy/g, d.getFullYear().toString().slice(-2))
        .replace(/mm/g, pad(d.getMonth() + 1, 2))
        .replace(/dd/g, pad(d.getDate(), 2))
        .replace(/hh/g, pad(d.getHours(), 2))
        .replace(/nn/g, pad(d.getMinutes(), 2))
        .replace(/ss/g, pad(d.getSeconds(), 2));
    },

    // Escapa caracteres especiales de expresiones regulares
    escapeREChars(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    },

    // Normaliza texto de contenido DOM: trim, sin saltos, espacios simples
    escapeTextContent(str) {
      return str.replace(/^\s+|\s+$/g, "").replace(/[\r\n]+/g, "").replace(/\s+/g, " ");
    },

    // Envuelve: sustituye espacios especiales por <SP><BR><LF>
    wrap(line) {
      const quoted = /^"((?:\n|.)*)"$/.exec(line);
      if (quoted) {
        let s = quoted[1]
          .replace(/\\/g, "\\\\")
          .replace(/\t/g, "\\t")
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r")
          .replace(/"/g, '\\"');
        return '"' + s + '"';
      }
      return line.replace(/\t/g, "<SP>").replace(/\n/g, "<BR>").replace(/\r/g, "<LF>");
    },

    // Desenvuelve: convierte <SP><BR><LF> y secuencias de escape de vuelta
    unwrap(line) {
      const quoted = /^"((?:\n|.)*)"$/.exec(line);
      if (quoted) {
        return quoted[1].replace(
          /\\(?:[0btnvfr"'\\]|x[\da-fA-F]{2}|u[\da-fA-F]{4})/g,
          (seq) => {
            const map = { "\\0": "\0", "\\b": "\b", "\\t": "\t", "\\n": "\n", "\\v": "\v", "\\f": "\f", "\\r": "\r", '\\"': '"', "\\'": "'", "\\\\": "\\" };
            if (map[seq]) return map[seq];
            const hex = seq.slice(2);
            return String.fromCharCode(parseInt(hex, 16));
          }
        );
      }
      return line.replace(/<br>/gi, "\n").replace(/<lf>/gi, "\r").replace(/<sp>/gi, " ");    },

    /**
     * Inserta pasos WAIT entre pasos consecutivos cuya diferencia de tiempo
     * supera thresholdMs. Los pasos deben tener `_ts` (timestamp en ms).
     * Devuelve un nuevo array limpio sin `_ts`.
     */
    injectWaitSteps(steps, thresholdMs) {
      if (!Array.isArray(steps) || steps.length === 0) return steps;
      const threshold = typeof thresholdMs === "number" && thresholdMs > 0 ? thresholdMs : 3000;
      const result = [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const clean = Object.assign({}, step);
        delete clean._ts;
        if (i > 0 && steps[i - 1]._ts && step._ts) {
          const delta = step._ts - steps[i - 1]._ts;
          if (delta > threshold) {
            // Always use 1s — user can tune per-step after playback
            result.push({ type: "wait", seconds: 1 });
          }
        }
        result.push(clean);
      }
      return result;    }
  };

  globalScope.WebMaticUtils = WebMaticUtils;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = WebMaticUtils;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
