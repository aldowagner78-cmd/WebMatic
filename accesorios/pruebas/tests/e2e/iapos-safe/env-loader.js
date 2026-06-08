"use strict";

const fs = require("fs");
const path = require("path");

function parseDotenv(content) {
  const out = {};
  const lines = String(content || "").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnvLocal(options = {}) {
  const filePath = options.filePath || path.resolve(options.rootDir || process.cwd(), ".env.local");
  if (!fs.existsSync(filePath)) return { loaded: false, filePath, vars: {} };
  const parsed = parseDotenv(fs.readFileSync(filePath, "utf8"));
  for (const [k, v] of Object.entries(parsed)) {
    if (!(k in process.env)) process.env[k] = v;
  }
  return { loaded: true, filePath, vars: parsed };
}

function getIaposCredentials() {
  return {
    url: process.env.IAPOS_URL || "",
    user: process.env.IAPOS_USER || "",
    pass: process.env.IAPOS_PASS || ""
  };
}

module.exports = {
  parseDotenv,
  loadEnvLocal,
  getIaposCredentials
};
