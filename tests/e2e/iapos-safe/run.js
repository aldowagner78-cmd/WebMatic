"use strict";

const { firefox } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  safeClick,
  safeFill,
  safeSelectOption,
  extractTargetMetadata
} = require("./safety-actions");
const { loadEnvLocal, getIaposCredentials } = require("./env-loader");
const { makeSafeLogger } = require("./sanitize-log");
const { collectSanitizedInventory, writeInventoryPrivate } = require("./inventory");

const ROOT = path.resolve(__dirname, "../../..");
const FIXTURE_DIR = path.join(ROOT, "tests", "fixtures");
const PRIVATE_ARTIFACTS = path.join(ROOT, "tests", "e2e", "artifacts-private");
const PORT = 18083;

function startFixtureServer() {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript",
    ".css": "text/css"
  };

  const server = http.createServer((req, res) => {
    const rel = (req.url || "/").split("?")[0];
    const file = path.join(FIXTURE_DIR, rel === "/" ? "iapos-safe-page.html" : rel.slice(1));
    try {
      const buf = fs.readFileSync(file);
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "text/plain" });
      res.end(buf);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(PORT, () => resolve(server));
  });
}

async function runLocalSafeFixture(log) {
  const server = await startFixtureServer();
  let browser;
  let ctx;
  let page;

  try {
    browser = await firefox.launch({ headless: true });
    ctx = await browser.newContext();
    page = await ctx.newPage();
  } catch (e) {
    await new Promise((resolve) => server.close(resolve));
    log("SKIP: Firefox de Playwright no está instalado. Ejecutar: npx playwright install firefox");
    return true;
  }

  let ok = true;
  const check = async (name, fn) => {
    try {
      await fn();
      log(`OK: ${name}`);
    } catch (e) {
      ok = false;
      log(`FAIL: ${name}`, e && e.message ? e.message : String(e));
    }
  };

  try {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 15000 });

    await check("safeFill permite input de filtro", async () => {
      await safeFill(page.locator("#filtro-texto"), "DATO_DEMO", { stage: "readonly-filter" });
    });

    await check("safeSelectOption permite select de filtro", async () => {
      await safeSelectOption(page.locator("#filtro-modalidad"), "2", { stage: "readonly-filter" });
    });

    await check("safeClick permite Buscar", async () => {
      await safeClick(page.locator("#btn-buscar"), { stage: "readonly-search" });
    });

    await check("safeClick bloquea Autorizar", async () => {
      let blocked = false;
      try {
        await safeClick(page.locator("#btn-autorizar"), { stage: "readonly-search" });
      } catch {
        blocked = true;
      }
      if (!blocked) throw new Error("No se bloqueó botón peligroso Autorizar");
    });

    await check("safeClick bloquea input type=image peligroso", async () => {
      let blocked = false;
      try {
        await safeClick(page.locator("#img-peligroso"), { stage: "readonly-search" });
      } catch {
        blocked = true;
      }
      if (!blocked) throw new Error("No se bloqueó input type=image peligroso");
    });

    await check("safeClick bloquea acciones de fila de grilla", async () => {
      let blocked = false;
      try {
        await safeClick(page.locator(".accion-fila"), { stage: "readonly-search" });
      } catch {
        blocked = true;
      }
      if (!blocked) throw new Error("No se bloqueó acción de fila de grilla");
    });

    await check("inventario técnico sanitizado se genera", async () => {
      const inventory = await page.evaluate(() => {
        return {
          title: document.title,
          counts: {
            selects: document.querySelectorAll("select").length,
            inputs: document.querySelectorAll("input").length,
            tables: document.querySelectorAll("table").length
          }
        };
      });
      if (!inventory || inventory.counts.selects < 1) {
        throw new Error("Inventario inválido");
      }
    });
  } finally {
    if (ctx) await ctx.close();
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  return ok;
}

async function runOptionalRealIapos(log, creds) {
  if (process.env.IAPOS_E2E_REAL !== "1") {
    log("REAL_IAPOS: omitido (setear IAPOS_E2E_REAL=1 para habilitar)");
    return { executed: false, ok: true, reason: "disabled" };
  }

  if (!creds.url || !creds.user || !creds.pass) {
    log("REAL_IAPOS: omitido por credenciales incompletas en .env.local");
    return { executed: false, ok: true, reason: "missing-env" };
  }

  const browser = await firefox.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await page.goto(creds.url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const userCandidates = ["input[name='username']", "input[name='user']", "input[type='text']"];
    const passCandidates = ["input[type='password']", "input[name='password']", "input[name='pass']"];

    const findFirstVisible = async (selectors) => {
      for (const sel of selectors) {
        const loc = page.locator(sel).first();
        if (await loc.count()) return loc;
      }
      return null;
    };

    const userLoc = await findFirstVisible(userCandidates);
    const passLoc = await findFirstVisible(passCandidates);

    if (!userLoc || !passLoc) {
      log("REAL_IAPOS: limitación técnica, no se detectaron campos de login con selectores genéricos");
      return { executed: true, ok: false, reason: "login-selectors-not-found" };
    }

    await safeFill(userLoc, creds.user, { stage: "login", allowLogin: true });
    await safeFill(passLoc, creds.pass, { stage: "login", allowLogin: true });

    const loginBtnCandidates = [
      "button:has-text('Ingresar')",
      "button:has-text('Login')",
      "button[type='submit']",
      "input[type='submit']"
    ];

    let clicked = false;
    for (const sel of loginBtnCandidates) {
      const loc = page.locator(sel).first();
      if (await loc.count()) {
        await safeClick(loc, { stage: "login", allowLogin: true });
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      log("REAL_IAPOS: limitación técnica, no se detectó botón de login seguro");
      return { executed: true, ok: false, reason: "login-button-not-found" };
    }

    await page.waitForTimeout(2500);

    const inventory = await page.evaluate(() => {
      // No incluir valores de inputs ni datos sensibles; solo metadatos técnicos.
      return {
        capturedAt: new Date().toISOString(),
        url: location.href,
        title: document.title,
        counts: {
          inputs: document.querySelectorAll("input").length,
          selects: document.querySelectorAll("select").length,
          tables: document.querySelectorAll("table,[role='grid']").length
        }
      };
    });

    fs.mkdirSync(PRIVATE_ARTIFACTS, { recursive: true });
    const file = path.join(PRIVATE_ARTIFACTS, `real-iapos-inventory-${Date.now()}.private.json`);
    fs.writeFileSync(file, JSON.stringify(inventory, null, 2), "utf8");
    log("REAL_IAPOS: inventario técnico guardado en carpeta privada ignorada");

    return { executed: true, ok: true, reason: "completed" };
  } catch (e) {
    log("REAL_IAPOS: error controlado", e && e.message ? e.message : String(e));
    return { executed: true, ok: false, reason: "runtime-error" };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

async function main() {
  const envInfo = loadEnvLocal({ rootDir: ROOT });
  const creds = getIaposCredentials();
  const safeLog = makeSafeLogger({ secrets: [creds.user, creds.pass] });

  safeLog(`.env.local cargado: ${envInfo.loaded ? "sí" : "no"}`);
  safeLog("Fase 1/2: validación segura sobre fixture local");
  const localOk = await runLocalSafeFixture(safeLog);

  safeLog("Fase 2: intento opcional IAPOS real read-only");
  const real = await runOptionalRealIapos(safeLog, creds);

  safeLog("Fase 3/4: limitación documentada");
  safeLog("Automatización completa de extensión en Firefox puede tener limitaciones de runtime; se prioriza flujo seguro local + modo real opcional explícito");

  if (!localOk) {
    process.exitCode = 1;
    return;
  }

  if (real.executed && !real.ok) {
    // La fase real es opcional y controlada: no falsear éxito; no falla el pipeline
    // automáticamente porque depende de entorno real externo.
    safeLog(`REAL_IAPOS no completado (${real.reason})`);
  }

  process.exitCode = 0;
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[iapos-safe-e2e] FATAL", e && e.stack ? e.stack : e);
  process.exit(1);
});
