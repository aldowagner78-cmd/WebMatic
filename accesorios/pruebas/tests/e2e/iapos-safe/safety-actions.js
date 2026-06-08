"use strict";

const { DANGEROUS_TERMS, SAFE_READONLY_TERMS } = require("./danger-terms");

function normalize(text) {
  return String(text == null ? "" : text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function buildTargetText(meta) {
  const bag = [
    meta.text,
    meta.title,
    meta.ariaLabel,
    meta.alt,
    meta.id,
    meta.name,
    meta.className,
    meta.value,
    meta.href,
    meta.onclick,
    meta.role,
    meta.tagName,
    meta.type,
    meta.containerRowText
  ];
  return normalize(bag.filter(Boolean).join(" | "));
}

function matchesAny(text, terms) {
  const t = normalize(text);
  return terms.filter((term) => t.includes(normalize(term)));
}

function isReadonlySearchAction(meta) {
  const relevant = [meta.text, meta.value, meta.ariaLabel, meta.title, meta.name, meta.id].join(" | ");
  return matchesAny(relevant, SAFE_READONLY_TERMS).length > 0;
}

function assertSafeTarget(meta, context = {}) {
  if (!meta || typeof meta !== "object") {
    throw new Error("SAFE_ABORT: target metadata inválida");
  }

  const loginAllowed = context.allowLogin === true && context.stage === "login";
  const allowGridClicks = context.allowGridClicks === true;
  const blob = buildTargetText(meta);
  const dangerous = matchesAny(blob, DANGEROUS_TERMS);

  if (meta.inGridRow && !allowGridClicks && context.action === "click") {
    throw new Error("SAFE_ABORT: click en fila de grilla bloqueado por política read-only");
  }

  if (dangerous.length > 0) {
    if (loginAllowed && context.action === "click") {
      return { ok: true, reason: "login-exception" };
    }

    if (context.action === "click" && isReadonlySearchAction(meta)) {
      return { ok: true, reason: "readonly-search" };
    }

    throw new Error(`SAFE_ABORT: acción potencialmente peligrosa detectada (${dangerous.join(", ")})`);
  }

  return { ok: true, reason: "safe" };
}

async function extractTargetMetadata(locator) {
  return locator.evaluate((el) => {
    const row = el.closest("tr") || el.closest("[role='row']") || null;
    const table = el.closest("table") || el.closest("[role='grid']") || null;
    return {
      text: (el.innerText || el.textContent || "").trim().slice(0, 300),
      title: (el.getAttribute("title") || "").trim(),
      ariaLabel: (el.getAttribute("aria-label") || "").trim(),
      alt: (el.getAttribute("alt") || "").trim(),
      id: (el.id || "").trim(),
      name: (el.getAttribute("name") || "").trim(),
      className: (el.className || "").toString().trim(),
      value: (el.value || el.getAttribute("value") || "").toString().trim(),
      href: (el.getAttribute("href") || "").trim(),
      onclick: (el.getAttribute("onclick") || "").trim(),
      role: (el.getAttribute("role") || "").trim(),
      tagName: (el.tagName || "").toLowerCase(),
      type: ((el.getAttribute("type") || el.type) || "").toLowerCase(),
      inGridRow: !!row,
      containerRowText: row ? (row.innerText || row.textContent || "").trim().slice(0, 300) : "",
      containerTableRole: table ? ((table.getAttribute("role") || table.tagName || "").toLowerCase()) : ""
    };
  });
}

async function safeClick(locator, context = {}) {
  const meta = await extractTargetMetadata(locator);
  assertSafeTarget(meta, { ...context, action: "click" });
  await locator.click();
  return meta;
}

async function safeFill(locator, value, context = {}) {
  const meta = await extractTargetMetadata(locator);
  assertSafeTarget(meta, { ...context, action: "fill" });
  await locator.fill(String(value == null ? "" : value));
  return meta;
}

async function safeSelectOption(locator, value, context = {}) {
  const meta = await extractTargetMetadata(locator);
  assertSafeTarget(meta, { ...context, action: "select" });
  await locator.selectOption(String(value == null ? "" : value));
  return meta;
}

module.exports = {
  normalize,
  assertSafeTarget,
  extractTargetMetadata,
  safeClick,
  safeFill,
  safeSelectOption
};
