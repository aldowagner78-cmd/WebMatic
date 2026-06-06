"use strict";

function sanitizeForLog(input, secrets = []) {
  let out = String(input == null ? "" : input);

  for (const secret of secrets) {
    if (!secret) continue;
    out = out.split(String(secret)).join("[REDACTED]");
  }

  out = out.replace(/(password|pass|pwd)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
  out = out.replace(/(IAPOS_USER|IAPOS_PASS)\s*=\s*[^\s,;]+/gi, "$1=[REDACTED]");

  return out;
}

function makeSafeLogger(options = {}) {
  const secrets = Array.isArray(options.secrets) ? options.secrets : [];
  return function safeLog(message, extra) {
    const base = extra == null ? String(message) : `${message} ${extra}`;
    // eslint-disable-next-line no-console
    console.log("[iapos-safe-e2e]", sanitizeForLog(base, secrets));
  };
}

module.exports = {
  sanitizeForLog,
  makeSafeLogger
};
