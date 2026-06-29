"use strict";

const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const FIXTURE_DIR = __dirname;
const PORT = 18089;
const BASE_URL = `http://localhost:${PORT}`;

function startServer() {
  const mime = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8"
  };

  const server = http.createServer((req, res) => {
    const rel = (req.url || "/").split("?")[0];
    const localPath = rel === "/" ? "fixture-wizard-hidden.html" : rel.slice(1);
    const file = path.join(FIXTURE_DIR, localPath);

    if (!file.startsWith(FIXTURE_DIR)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("forbidden");
      return;
    }

    try {
      const data = fs.readFileSync(file);
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "text/plain; charset=utf-8" });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(PORT, () => resolve(server));
  });
}

async function visibleEnabledUncoveredIndexes(page, selector) {
  return page.evaluate((rawSelector) => {
    function isVisible(el) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function isDisabled(el) {
      return Boolean(el.disabled || el.getAttribute("aria-disabled") === "true");
    }

    function isUncovered(el) {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const top = document.elementFromPoint(x, y);
      return top === el || (top && el.contains(top));
    }

    return Array.from(document.querySelectorAll(rawSelector))
      .map((el, index) => ({ el, index }))
      .filter(({ el }) => isVisible(el) && !isDisabled(el) && isUncovered(el))
      .map(({ index }) => index);
  }, selector);
}

async function clickFirstInteractable(page, selector) {
  const indexes = await visibleEnabledUncoveredIndexes(page, selector);
  if (indexes.length < 1) throw new Error(`sin candidatos interactuables para ${selector}`);
  await page.locator(selector).nth(indexes[0]).click();
  return indexes[0];
}

async function fillFirstInteractable(page, selector, value) {
  const indexes = await visibleEnabledUncoveredIndexes(page, selector);
  if (indexes.length < 1) throw new Error(`sin inputs interactuables para ${selector}`);
  await page.locator(selector).nth(indexes[0]).fill(value);
  return indexes[0];
}

async function waitUntilInteractable(page, selector, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const indexes = await visibleEnabledUncoveredIndexes(page, selector);
    if (indexes.length > 0) return indexes[0];
    await page.waitForTimeout(50);
  }
  throw new Error(`timeout esperando candidato interactuable para ${selector}`);
}

async function expectText(page, selector, expected) {
  const actual = await page.locator(selector).textContent({ timeout: 2000 });
  if ((actual || "").trim() !== expected) {
    throw new Error(`${selector} esperaba "${expected}", obtuvo "${(actual || "").trim()}"`);
  }
}

async function runCase(results, name, fn) {
  try {
    await fn();
    results.push({ status: "ok", name });
    console.log(`[universal-resolution] OK ${name}`);
  } catch (e) {
    const message = e && e.message ? e.message : String(e);
    results.push({ status: "fail", name, message });
    console.log(`[universal-resolution] FAIL ${name}: ${message}`);
  }
}

async function wizardAndSpa(page) {
  await page.goto(`${BASE_URL}/fixture-wizard-hidden.html`, { waitUntil: "load", timeout: 10000 });

  const before = await visibleEnabledUncoveredIndexes(page, ".next-action");
  if (before.length !== 1 || before[0] !== 0) {
    throw new Error(`wizard esperaba solo primer boton visible, obtuvo ${before.join(",")}`);
  }

  await clickFirstInteractable(page, ".next-action");
  await expectText(page, "#wizard-status", "step-2");

  const after = await visibleEnabledUncoveredIndexes(page, ".next-action");
  if (after.length !== 1 || after[0] !== 1) {
    throw new Error(`wizard esperaba segundo boton visible, obtuvo ${after.join(",")}`);
  }

  await page.click("#load-spa-content");
  await page.waitForSelector("#spa-confirm", { timeout: 3000 });
  await page.click("#spa-confirm");
  await expectText(page, "#spa-output", "spa-confirmed");
}

async function duplicateInputAndSingleInteractable(page) {
  await page.goto(`${BASE_URL}/fixture-duplicates.html`, { waitUntil: "load", timeout: 10000 });

  const inputIndex = await fillFirstInteractable(page, 'input[placeholder="Correo electronico"]', "visible@example.test");
  if (inputIndex !== 1) throw new Error(`input visible debia ser indice 1, fue ${inputIndex}`);

  const hiddenValue = await page.inputValue("#hidden-email");
  const visibleValue = await page.inputValue("#visible-email");
  if (hiddenValue !== "hidden") throw new Error("se modifico el input oculto");
  if (visibleValue !== "visible@example.test") throw new Error("no se completo el input visible");

  const buttonIndex = await clickFirstInteractable(page, ".universal-choice");
  if (buttonIndex !== 2) throw new Error(`boton interactuable debia ser indice 2, fue ${buttonIndex}`);
  await expectText(page, "#duplicates-status", "active");
}

async function overlay(page) {
  await page.goto(`${BASE_URL}/fixture-overlay.html`, { waitUntil: "load", timeout: 10000 });

  const blocked = await visibleEnabledUncoveredIndexes(page, "#target-action");
  if (blocked.length !== 0) throw new Error("el target tapado no fue detectado como bloqueado");

  await page.click("#dismiss-overlay");
  await expectText(page, "#overlay-status", "overlay-closed");
  await clickFirstInteractable(page, "#target-action");
  await expectText(page, "#overlay-status", "processed");
}

async function disabledLate(page) {
  await page.goto(`${BASE_URL}/fixture-disabled-late.html`, { waitUntil: "load", timeout: 10000 });

  const before = await visibleEnabledUncoveredIndexes(page, "#late-button");
  if (before.length !== 0) throw new Error("el boton disabled aparecio como interactuable");

  await waitUntilInteractable(page, "#late-button", 3000);
  await clickFirstInteractable(page, "#late-button");
  await expectText(page, "#late-status", "sent");
}

async function remount(page) {
  await page.goto(`${BASE_URL}/fixture-remount.html`, { waitUntil: "load", timeout: 10000 });

  const oldHandle = await page.$("#volatile-field");
  await page.click("#start-remount");
  await page.waitForSelector("#volatile-field", { state: "detached", timeout: 1000 });
  await page.waitForSelector('#volatile-field[data-version="remounted"]', { timeout: 3000 });

  const sameNode = await page.evaluate((oldNode) => oldNode === document.querySelector("#volatile-field"), oldHandle);
  if (sameNode) throw new Error("el campo no fue desmontado realmente");

  await fillFirstInteractable(page, "#volatile-field", "RC39");
  await expectText(page, "#remount-status", "value:RC39:remounted");
}

async function main() {
  console.log("[universal-resolution] iniciando banco local en", BASE_URL);
  const server = await startServer();

  let browser;
  let context;
  const results = [];

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    await runCase(results, "wizard con pasos ocultos, boton repetido y SPA diferida", () => wizardAndSpa(page));
    await runCase(results, "placeholder duplicado y selector con multiples candidatos", () => duplicateInputAndSingleInteractable(page));
    await runCase(results, "boton cubierto por overlay", () => overlay(page));
    await runCase(results, "boton disabled habilitado tarde", () => disabledLate(page));
    await runCase(results, "campo desmontado y remontado", () => remount(page));
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  const failed = results.filter((item) => item.status === "fail");
  const pending = results.filter((item) => item.status === "pending");

  if (failed.length > 0) {
    console.error("[universal-resolution] FAIL");
    failed.forEach((item) => console.error(`  - ${item.name}: ${item.message}`));
    process.exitCode = 1;
    return;
  }

  if (pending.length > 0) {
    console.log("[universal-resolution] PENDING");
    pending.forEach((item) => console.log(`  - ${item.name}: ${item.message}`));
    return;
  }

  console.log("[universal-resolution] OK");
}

main().catch((e) => {
  console.error("[universal-resolution] FATAL", e && e.stack ? e.stack : e);
  process.exit(1);
});
