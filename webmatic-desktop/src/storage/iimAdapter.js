"use strict";

/**
 * iimAdapter.js — Serializer/deserializer de macros al formato .iim de WebMatic.
 *
 * Formato de línea: COMANDO KEY1=VALUE1 KEY2=VALUE2
 * Los valores están URL-encoded para soportar espacios y caracteres especiales.
 *
 * Ejemplo de archivo:
 *   VERSION BUILD=1.0 RECORDER=WEBMATIC
 *   MACRO NAME=Mi%20Macro
 *
 *   NAVIGATE URL=https%3A%2F%2Fexample.com
 *   CLICK SELECTOR=%23btn
 *   INPUT SELECTOR=%23q VALUE=hello%20world
 *   WAIT MS=1000
 *   KEY CODE=Enter
 */

const enc = (v) => encodeURIComponent(String(v == null ? "" : v));
const dec = (v) => { try { return decodeURIComponent(v || ""); } catch (_) { return v || ""; } };

// ── Serialize ────────────────────────────────────────────────────────────────

function serialize(name, steps) {
  const lines = [
    "VERSION BUILD=1.0 RECORDER=WEBMATIC",
    "MACRO NAME=" + enc(name || "sin-nombre"),
    ""
  ];
  for (const step of (steps || [])) {
    lines.push(serializeStep(step));
  }
  return lines.join("\n");
}

function serializeStep(step) {
  const t = step.type || "unknown";
  switch (t) {
    case "navigate":
      return "NAVIGATE URL=" + enc(step.url);
    case "click":
      return "CLICK SELECTOR=" + enc(step.selector);
    case "dblclick":
      return "DBLCLICK SELECTOR=" + enc(step.selector);
    case "input":
      return "INPUT SELECTOR=" + enc(step.selector) + " VALUE=" + enc(step.value);
    case "text":
      return "TEXT SELECTOR=" + enc(step.selector) + " VALUE=" + enc(step.value);
    case "check":
      return "CHECK SELECTOR=" + enc(step.selector) + " STATE=" + (step.checked ? "true" : "false");
    case "key":
      return "KEY CODE=" + enc(step.key);
    case "wait": {
      const ms = step.ms != null
        ? step.ms
        : (step.seconds != null ? Math.round(step.seconds * 1000) : 0);
      return "WAIT MS=" + ms;
    }
    case "extract":
      return "EXTRACT SELECTOR=" + enc(step.selector) + " VAR=" + enc(step.variable);
    default:
      return "# UNKNOWN " + enc(JSON.stringify(step));
  }
}

// ── Deserialize ──────────────────────────────────────────────────────────────

function deserialize(content, fallbackName) {
  const lines = (content || "").split(/\r?\n/);
  let name = fallbackName || "importado";

  // Extrae el nombre de la línea MACRO si existe
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("MACRO ")) {
      const kv = parseTokens(line.slice(6));
      if (kv.NAME) name = kv.NAME;
      break;
    }
  }

  // Prioridad: bloque WM_JSON embebido (mayor fidelidad — incluye wait_for, hover, scroll_to, etc.)
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("// WM_JSON:")) {
      try {
        const json = JSON.parse(line.slice("// WM_JSON:".length));
        if (json && Array.isArray(json.steps) && json.steps.length > 0) {
          return { name, steps: json.steps };
        }
      } catch (_) {}
    }
  }

  // Fallback: parsear comandos iim línea a línea
  const steps = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    if (line.startsWith("VERSION") || line.startsWith("MACRO ")) continue;
    const step = deserializeStep(line);
    if (step) steps.push(step);
  }
  return { name, steps };
}

function deserializeStep(line) {
  const spaceIdx = line.indexOf(" ");
  const cmd = spaceIdx === -1 ? line : line.slice(0, spaceIdx);
  const rest = spaceIdx === -1 ? "" : line.slice(spaceIdx + 1);
  const kv = parseTokens(rest);

  switch (cmd) {
    case "NAVIGATE": return { type: "navigate", url:      kv.URL      || "" };
    case "CLICK":    return { type: "click",    selector: kv.SELECTOR || "" };
    case "DBLCLICK": return { type: "dblclick", selector: kv.SELECTOR || "" };
    case "INPUT":    return { type: "input",    selector: kv.SELECTOR || "", value: kv.VALUE || "" };
    case "TEXT":     return { type: "text",     selector: kv.SELECTOR || "", value: kv.VALUE || "" };
    case "CHECK":    return { type: "check",    selector: kv.SELECTOR || "", checked: kv.STATE === "true" };
    case "KEY":      return { type: "key",      key:      kv.CODE     || "" };
    case "WAIT":     return { type: "wait",     ms:       parseInt(kv.MS, 10) || 0 };
    case "EXTRACT":  return { type: "extract",  selector: kv.SELECTOR || "", variable: kv.VAR || "" };
    default:         return null;
  }
}

/**
 * Parsea "KEY1=VAL1 KEY2=VAL2" en { KEY1: "VAL1", KEY2: "VAL2" }.
 * Divide por espacios SOLO donde el siguiente token comienza con MAYÚSCULAS=
 * (lookahead regex), para que valores URL-encoded con espacios se lean bien.
 */
function parseTokens(rest) {
  if (!rest) return {};
  const tokens = rest.split(/\s+(?=[A-Z_]+=)/);
  const result = {};
  for (const token of tokens) {
    const eq = token.indexOf("=");
    if (eq === -1) continue;
    const key = token.slice(0, eq).trim();
    const val = token.slice(eq + 1);
    result[key] = dec(val);
  }
  return result;
}

module.exports = { serialize, deserialize };
