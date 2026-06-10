"use strict";

const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const FIXTURES_DIR = path.join(ROOT, "tests", "fixtures");
const PORT = 18084;

function startFixtureServer() {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8"
  };

  const server = http.createServer((req, res) => {
    const rel = (req.url || "/").split("?")[0];
    const localPath = rel === "/" ? "iapos-safe-page.html" : rel.slice(1);
    const file = path.join(FIXTURES_DIR, localPath);

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

async function assertStep(name, fn) {
  try {
    await fn();
    console.log("OK ", name);
    return true;
  } catch (e) {
    console.log("FAIL", name, "-", e && e.message ? e.message : String(e));
    return false;
  }
}

async function modernFlow(page) {
  let ok = true;

  await page.goto(`http://localhost:${PORT}/modern-autocomplete.html`, { waitUntil: "load", timeout: 20000 });

  ok = (await assertStep("modern: abre fixture", async () => {
    await page.waitForSelector("#modern-affiliate", { timeout: 5000 });
  })) && ok;

  ok = (await assertStep("modern: autocomplete por fetch", async () => {
    await page.fill("#modern-affiliate", "wa");
    await page.waitForSelector("#modern-affiliate-list .suggest-item", { timeout: 5000 });
    await page.locator("#modern-affiliate-list .suggest-item").first().click();
    const selected = await page.getAttribute("#modern-affiliate", "data-selected-value");
    if (!selected) throw new Error("No se seteo data-selected-value");
  })) && ok;

  ok = (await assertStep("modern: datalist y shadow dom", async () => {
    await page.fill("#modern-specialty", "Cardiology");
    const host = page.locator("wm-shadow-autocomplete");
    await host.evaluate((el) => {
      const shadow = el.shadowRoot;
      if (!shadow) throw new Error("sin shadowRoot");
      const input = shadow.querySelector("#shadow-city");
      if (!input) throw new Error("sin input shadow");
      input.value = "san";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const first = shadow.querySelector("li");
      if (!first) throw new Error("sin sugerencias shadow");
      first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      if (!input.value) throw new Error("sin valor final shadow");
    });
  })) && ok;

  ok = (await assertStep("modern: navegacion subpagina", async () => {
    await page.click("#btn-modern-subpage");
    await page.waitForURL(`http://localhost:${PORT}/modern-autocomplete-subpage.html?from=modern`, { timeout: 5000 });
    await page.fill("#modern-sub-notes", "ok-modern-sub");
  })) && ok;

  return ok;
}

async function legacyFlow(page) {
  let ok = true;

  await page.goto(`http://localhost:${PORT}/legacy-autocomplete.html`, { waitUntil: "load", timeout: 20000 });

  ok = (await assertStep("legacy: abre fixture", async () => {
    await page.waitForSelector("#legacy-deleg", { timeout: 5000 });
  })) && ok;

  ok = (await assertStep("legacy: autocomplete delegacion", async () => {
    await page.click("#legacy-deleg");
    await page.keyboard.type("ALV");
    await page.waitForSelector("#legacy-deleg-menu div", { state: "attached", timeout: 5000 });
    await page.waitForTimeout(100);
    await page.locator("#legacy-deleg-menu div").first().click();
    const code = await page.inputValue("#legacy-deleg-code");
    if (code !== "54") throw new Error("codigo delegacion inesperado: " + code);
  })) && ok;

  ok = (await assertStep("legacy: autocomplete especialidad", async () => {
    await page.click("#legacy-spec");
    await page.keyboard.type("CARD");
    await page.waitForSelector("#legacy-spec-menu div", { state: "attached", timeout: 5000 });
    await page.waitForTimeout(100);
    await page.locator("#legacy-spec-menu div").first().click();
    const code = await page.inputValue("#legacy-spec-code");
    if (code !== "101") throw new Error("codigo especialidad inesperado: " + code);
  })) && ok;

  ok = (await assertStep("legacy: navegacion subpagina", async () => {
    await page.click("#legacy-navigate");
    await page.waitForURL(`http://localhost:${PORT}/legacy-autocomplete-subpage.html`, { timeout: 5000 });
    await page.fill("#legacy-sub-input", "ok-legacy-sub");
  })) && ok;

  return ok;
}

async function geneXusFlow(page) {
  let ok = true;

  await page.goto(`http://localhost:${PORT}/genexus-subpage.html`, { waitUntil: "load", timeout: 20000 });

  ok = (await assertStep("genexus: autocomplete delegacion", async () => {
    await page.fill("#vDELEGACION", "ALV");
    await page.waitForSelector("#vDELEGACION_menu button", { timeout: 5000 });
    await page.locator("#vDELEGACION_menu button").first().click();
    const val = await page.getAttribute("#vDELEGACION", "data-selected-value");
    if (val !== "54") throw new Error("delegacion no seleccionada");
  })) && ok;

  ok = (await assertStep("genexus: autocomplete especialidad", async () => {
    await page.fill("#vAUCAESPEFC", "CARD");
    await page.waitForSelector("#vAUCAESPEFC_menu button", { timeout: 5000 });
    await page.locator("#vAUCAESPEFC_menu button").first().click();
    const val = await page.getAttribute("#vAUCAESPEFC", "data-selected-value");
    if (val !== "101") throw new Error("especialidad no seleccionada");
  })) && ok;

  ok = (await assertStep("genexus: subpagina", async () => {
    await page.click("#gx-subpage");
    await page.waitForURL(`http://localhost:${PORT}/genexus-subpage-detail.html`, { timeout: 5000 });
    await page.fill("#gx-detail-input", "ok-gx-sub");
  })) && ok;

  return ok;
}

async function iaposFlow(page) {
  let ok = true;

  await page.goto(`http://localhost:${PORT}/iapos-subpage.html`, { waitUntil: "load", timeout: 20000 });

  ok = (await assertStep("iapos: autocomplete delegacion", async () => {
    await page.fill("#iapos-deleg", "BEL");
    await page.waitForSelector("#iapos-deleg-menu button", { timeout: 5000 });
    await page.locator("#iapos-deleg-menu button").first().click();
    const code = await page.getAttribute("#iapos-deleg", "data-selected-value");
    if (code !== "55") throw new Error("delegacion esperada 55");
  })) && ok;

  ok = (await assertStep("iapos: autocomplete especialidad", async () => {
    await page.fill("#iapos-spec", "DERM");
    await page.waitForSelector("#iapos-spec-menu button", { timeout: 5000 });
    await page.locator("#iapos-spec-menu button").first().click();
    const code = await page.getAttribute("#iapos-spec", "data-selected-value");
    if (code !== "103") throw new Error("especialidad esperada 103");
  })) && ok;

  ok = (await assertStep("iapos: subpagina", async () => {
    await page.click("#iapos-sub");
    await page.waitForURL(`http://localhost:${PORT}/iapos-subpage-detail.html`, { timeout: 5000 });
    await page.fill("#iapos-sub-notes", "ok-iapos-sub");
  })) && ok;

  return ok;
}

async function main() {
  console.log("[fixtures-flow] iniciando servidor en", PORT);
  const server = await startFixtureServer();

  let browser;
  let context;
  let page;
  let allOk = true;

  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (e) {
      console.error("No se pudo iniciar Chromium de Playwright.");
      console.error("Instalar con: npx playwright install chromium");
      throw e;
    }

    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await context.newPage();

    allOk = (await modernFlow(page)) && allOk;
    allOk = (await legacyFlow(page)) && allOk;
    allOk = (await geneXusFlow(page)) && allOk;
    allOk = (await iaposFlow(page)) && allOk;
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  if (!allOk) {
    process.exitCode = 1;
    console.error("[fixtures-flow] hay fallas");
    return;
  }

  console.log("[fixtures-flow] OK: flujos modern, legacy, GeneXus e IAPOS validados");
}

main().catch((e) => {
  console.error("[fixtures-flow] FATAL", e && e.stack ? e.stack : e);
  process.exit(1);
});
