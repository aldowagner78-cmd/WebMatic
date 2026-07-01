"use strict";

const { chromium } = require("playwright");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "../../../../..");
const FIXTURE_DIR = path.join(__dirname, "fixtures");
const REPORT_DIR = path.join(PROJECT_ROOT, "accesorios", "pruebas", "reports");
const ARTIFACT_DIR = path.join(REPORT_DIR, "headed-recorder-playback-artifacts");
const VIDEO_DIR = path.join(ARTIFACT_DIR, "videos");
const PROFILE_DIR = path.join(os.tmpdir(), "webmatic-headed-recorder-playback-profile");
const TEMP_EXTENSION_DIR = path.join(os.tmpdir(), "webmatic-headed-recorder-playback-chromium");
const REPORT_PATH = path.join(REPORT_DIR, "headed-recorder-playback-report.md");
const TRACE_PATH = path.join(ARTIFACT_DIR, "headed-recorder-playback-trace.zip");
const PORT = Number(process.env.WEBMATIC_HEADED_PORT || 18124);
const SLOW_MO = Number(process.env.WEBMATIC_HEADED_SLOWMO || 500);
const EXTERNAL_URL = "https://aldowagner78-cmd.github.io/flyer-clinico-prompt-builder/";
const EXTERNAL_EXPECTED_VALUES = [
  "Clinica QA WebMatic",
  "QA Gomez",
  "MP 00000",
  "Cardiologia"
];
const EXTERNAL_RELEVANT_VALUES = new Set([
  ...EXTERNAL_EXPECTED_VALUES,
  "green",
  "Dra."
]);

function log(message) {
  console.log(`[headed-recorder-playback] ${message}`);
}

function ensureDirs() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(source, target);
    else if (entry.isFile()) copyFile(source, target);
  }
}

function prepareChromiumExtension() {
  const firefoxManifest = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "manifest.json"), "utf8"));
  fs.rmSync(TEMP_EXTENSION_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEMP_EXTENSION_DIR, { recursive: true });

  copyDir(path.join(PROJECT_ROOT, "src"), path.join(TEMP_EXTENSION_DIR, "src"));
  copyDir(path.join(PROJECT_ROOT, "chromium"), path.join(TEMP_EXTENSION_DIR, "chromium"));
  ["logo16.png", "logo32.png", "logo48.png", "logo128.png"].forEach((file) => {
    copyFile(path.join(PROJECT_ROOT, file), path.join(TEMP_EXTENSION_DIR, file));
  });

  const manifest = {
    manifest_version: 3,
    name: firefoxManifest.name,
    version: firefoxManifest.version,
    description: `${firefoxManifest.description || ""} (QA Chromium temp)`.trim(),
    icons: firefoxManifest.icons,
    action: {
      default_title: firefoxManifest.browser_action && firefoxManifest.browser_action.default_title
        ? firefoxManifest.browser_action.default_title
        : "WebMatic",
      default_icon: firefoxManifest.browser_action ? firefoxManifest.browser_action.default_icon : firefoxManifest.icons
    },
    background: {
      service_worker: "chromium/background.chromium.js"
    },
    permissions: [
      "storage",
      "downloads",
      "activeTab",
      "tabs",
      "scripting",
      "webNavigation"
    ],
    host_permissions: ["<all_urls>"],
    content_scripts: firefoxManifest.content_scripts,
    web_accessible_resources: [
      {
        resources: firefoxManifest.web_accessible_resources,
        matches: ["<all_urls>"]
      }
    ],
    options_ui: firefoxManifest.options_ui
  };

  fs.writeFileSync(path.join(TEMP_EXTENSION_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  return TEMP_EXTENSION_DIR;
}

function sanitizeName(name) {
  return String(name || "artifact")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function rel(file) {
  return path.relative(PROJECT_ROOT, file).replace(/\\/g, "/");
}

function startFixtureServer() {
  const mime = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png"
  };

  const server = http.createServer((req, res) => {
    const requested = (req.url || "/").split("?")[0];
    const localPath = requested === "/" ? "iapos-genexus.html" : requested.slice(1);
    const file = path.resolve(FIXTURE_DIR, localPath);
    const root = path.resolve(FIXTURE_DIR);

    if (!file.startsWith(root)) {
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

async function screenshot(page, scenario, name) {
  const file = path.join(ARTIFACT_DIR, `${sanitizeName(scenario)}-${sanitizeName(name)}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return file;
}

async function collectPageState(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };

    const collectStoredValues = () => {
      const values = new Set();
      const addString = (value) => {
        const normalized = String(value || "").trim();
        if (normalized && normalized.length <= 200) values.add(normalized);
      };
      const visit = (value, depth = 0) => {
        if (depth > 8 || value == null) return;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          addString(value);
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((item) => visit(item, depth + 1));
          return;
        }
        if (typeof value === "object") {
          Object.values(value).forEach((item) => visit(item, depth + 1));
        }
      };
      const scanStorage = (storage) => {
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i);
          if (!key) continue;
          const raw = storage.getItem(key);
          try {
            visit(JSON.parse(raw));
          } catch {
            visit(raw);
          }
        }
      };

      scanStorage(localStorage);
      scanStorage(sessionStorage);
      return Array.from(values);
    };

    return {
      url: location.href,
      title: document.title,
      text: (document.body && document.body.innerText ? document.body.innerText : "").slice(0, 2500),
      controls: Array.from(document.querySelectorAll("input, textarea, select"))
        .filter(visible)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type") || "",
          id: el.id || "",
          label: el.labels && el.labels[0] ? (el.labels[0].textContent || "").trim().slice(0, 120) : "",
          value: el.type === "checkbox" ? String(el.checked) : String(el.value || "")
        })),
      persistedValues: collectStoredValues()
    };
  });
}

async function getExtensionId(page) {
  return page.evaluate(() => {
    const link = document.getElementById("webmatic-style-link");
    const href = link && link.href ? link.href : "";
    const match = href.match(/chrome-extension:\/\/([^/]+)\//);
    return match ? match[1] : null;
  });
}

async function waitForExtension(page) {
  await page.waitForSelector("#webmatic-panel-root", { state: "attached", timeout: 20000 });
  const id = await getExtensionId(page);
  if (!id) throw new Error("WebMatic se inyecto, pero no se pudo detectar extensionId desde webmatic-style-link");
  return id;
}

async function openPanel(ctx, page) {
  const extensionId = await waitForExtension(page);

  const workers = ctx.serviceWorkers();
  const serviceWorker = workers.find((worker) => worker.url().startsWith(`chrome-extension://${extensionId}/`));
  if (serviceWorker) {
    const err = await serviceWorker.evaluate(() => new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs && tabs[0] ? tabs[0].id : null;
        if (!tabId) {
          resolve("active_tab_missing");
          return;
        }
        chrome.tabs.sendMessage(tabId, { type: "OPEN_PANEL" }, () => {
          resolve(chrome.runtime.lastError ? chrome.runtime.lastError.message : null);
        });
      });
    }));
    if (err) throw new Error(`No se pudo abrir panel via service worker: ${err}`);
  } else {
    const bgPage = await ctx.newPage();
    try {
      await bgPage.goto(`chrome-extension://${extensionId}/_generated_background_page.html`, {
        waitUntil: "load",
        timeout: 10000
      });
      const activeTabId = await bgPage.evaluate(() => new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve(tabs && tabs[0] ? tabs[0].id : null);
        });
      }));
      if (!activeTabId) throw new Error("No se pudo detectar tab activo para abrir panel");
      await bgPage.evaluate((tabId) => new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: "OPEN_PANEL" }, () => {
          void chrome.runtime.lastError;
          resolve();
        });
      }), activeTabId);
    } finally {
      await bgPage.close().catch(() => {});
    }
  }

  await page.waitForSelector("#webmatic-panel-root", { state: "attached", timeout: 10000 });
  await page.waitForTimeout(500);
}

async function startRecording(ctx, page) {
  await openPanel(ctx, page);
  await page.click("#webmatic-panel-root [data-record-btn]");
  await page.waitForSelector("#webmatic-floating-recorder-global", { timeout: 10000 });
  return {
    feedbackSeen: await page.locator("#webmatic-floating-recorder-global").isVisible().catch(() => false)
  };
}

async function stopRecording(page) {
  await page.click("#webmatic-floating-recorder-global");
  await page.waitForSelector('[data-script-editor][style*="block"], [data-script-editor][style*="flex"]', {
    timeout: 15000
  }).catch(async () => {
    await page.waitForFunction(() => {
      const editor = document.querySelector("[data-script-editor]");
      return !!(editor && editor.style.display !== "none");
    }, { timeout: 15000 });
  });
}

async function readScriptFromEditor(page) {
  await page.click('[data-action="script-editor-tab"][data-script-tab="script"]').catch(() => {});
  await page.waitForSelector("[data-script-editor-area]", { timeout: 5000 });
  return page.locator("[data-script-editor-area]").inputValue();
}

async function saveEditorMacro(page, macroName) {
  const saveAs = page.locator('[data-action="script-editor-saveas"]');
  if (await saveAs.count()) await saveAs.click();
  else await page.click('[data-action="script-editor-save"]');

  await page.waitForTimeout(300);
  if (await page.locator("[data-wm-dialog]").isVisible().catch(() => false)) {
    await page.fill("[data-wm-input]", macroName);
    await page.click("[data-wm-ok]");
  } else {
    await page.fill("[data-save-name]", macroName);
    await page.click('[data-action="save-confirm"]');
  }

  await page.waitForTimeout(900);
}

async function closeEditor(page) {
  await page.click('[data-action="script-editor-close"]').catch(() => {});
  await page.waitForTimeout(500);
}

async function selectMacroInLibrary(ctx, page, macroName) {
  await openPanel(ctx, page);
  await page.click('#webmatic-panel-root button[data-mode="play"]');
  await page.waitForTimeout(500);
  const item = page.locator(".webmatic-macro-item", { hasText: macroName }).first();
  await item.waitFor({ state: "visible", timeout: 10000 });
  await item.click();
}

async function playSelectedMacro(page) {
  await page.click('[data-action="macro-play"]');
  const feedbackSeen = await page.waitForSelector("#webmatic-floating-player-global", { timeout: 10000 })
    .then(() => true)
    .catch(() => false);

  await page.waitForFunction(() => {
    const floating = document.querySelector("#webmatic-floating-player-global #wm-play-info");
    const stop = document.querySelector('#webmatic-panel-root [data-action="play-stop"]');
    const txt = floating ? String(floating.textContent || "") : "";
    const stopped = !stop || stop.style.display === "none";
    return txt.includes("Completado") || (stopped && !txt.includes("Ejecutando"));
  }, { timeout: 45000 });

  await page.waitForTimeout(800);
  return { feedbackSeen };
}

function analyzeMacro(script) {
  const text = String(script || "");
  return {
    hasChooseOption: /CHOOSE_OPTION/i.test(text),
    hasChooseOptionValueTextIndex: /CHOOSE_OPTION[^\n]*VALUE=/i.test(text) &&
      /CHOOSE_OPTION[^\n]*TEXT=/i.test(text) &&
      /CHOOSE_OPTION[^\n]*INDEX=/i.test(text),
    hasWaitFor: /WAIT_FOR/i.test(text),
    hasImageClick: /CLICK[^\n]*(vDETALLES_0001|vAUTORIZAR_0001)/i.test(text),
    hasTemporarySelectors: /data-wm-hl|webmatic-floating|webmatic-panel-root|wm-play-info/i.test(text),
    lineCount: text.split(/\r?\n/).filter(Boolean).length
  };
}

function writeMacroArtifact(scenario, script) {
  const file = path.join(ARTIFACT_DIR, `${sanitizeName(scenario)}-macro.iim`);
  fs.writeFileSync(file, String(script || ""), "utf8");
  return file;
}

async function clearExternalPageStorage(page) {
  await page.goto(EXTERNAL_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle", timeout: 30000 });
}

async function interactExternalFlyer(page) {
  await page.selectOption("#themeColorSelector", "green");
  await page.click("#startAssistantButton");
  await page.click("#createInstitutionButton");
  await page.click('[data-institution-mode="full"]');
  await page.locator("label").filter({ hasText: /Nombre de la instituci/ }).locator("input").fill("Clinica QA WebMatic");
  await page.locator("label").filter({ hasText: /Tipo de instituci/ }).locator("select").selectOption({ index: 1 });
  await page.locator("label").filter({ hasText: /Direcci/ }).locator("input").fill("Av. QA 123");
  await page.locator("label").filter({ hasText: "WhatsApp principal" }).locator("input").fill("3415550101");
  await page.locator("label").filter({ hasText: "Email" }).locator("input").fill("qa@example.test");
  await page.locator("label").filter({ hasText: "Frase institucional" }).locator("select").selectOption({ index: 2 });
  await page.locator("label").filter({ hasText: "Color principal institucional" }).locator("select").selectOption("azul");
  await page.locator("label").filter({ hasText: "Color secundario institucional" }).locator("select").selectOption("verdeAgua");
  await page.click("#saveInstitutionAndContinueButton");
  await page.waitForSelector("text=Paso 2 de 5", { timeout: 10000 });
  await page.getByRole("button", { name: /Flyer profesional/ }).click();
  await page.waitForSelector("text=Paso 3 de 5", { timeout: 10000 });
  await page.locator("label").filter({ hasText: /T.tulo/ }).locator("select").selectOption("Dra.");
  await page.locator("label").filter({ hasText: "Nombre completo del profesional" }).locator("input").fill("QA Gomez");
  await page.locator("label").filter({ hasText: /Matr.cula/ }).locator("input").fill("MP 00000");
  await page.locator("label").filter({ hasText: /Especialidad o .rea/ }).locator("select").selectOption("Cardiologia");
}

async function runExternalScenario(ctx, page) {
  const name = "external-flyer-builder";
  const macroName = `QA Headed External ${Date.now()}`;
  const result = {
    name,
    title: "Pagina externa obligatoria: flyer-clinico-prompt-builder",
    status: "failed",
    macroName,
    validations: {},
    artifacts: []
  };

  await clearExternalPageStorage(page);
  result.artifacts.push(await screenshot(page, name, "before-recording"));
  const rec = await startRecording(ctx, page);
  result.validations.recordingFeedbackSeen = rec.feedbackSeen;
  await interactExternalFlyer(page);
  result.artifacts.push(await screenshot(page, name, "after-user-flow"));
  await stopRecording(page);
  const script = await readScriptFromEditor(page);
  result.macroArtifact = writeMacroArtifact(name, script);
  result.artifacts.push(result.macroArtifact);
  result.macroAnalysis = analyzeMacro(script);
  await saveEditorMacro(page, macroName);
  await closeEditor(page);

  await clearExternalPageStorage(page);
  await selectMacroInLibrary(ctx, page, macroName);
  const playback = await playSelectedMacro(page);
  result.validations.playbackFeedbackSeen = playback.feedbackSeen;
  result.artifacts.push(await screenshot(page, name, "after-playback"));
  const state = await collectPageState(page);
  result.finalState = {
    url: state.url,
    title: state.title,
    relevantControls: state.controls.filter((control) => EXTERNAL_RELEVANT_VALUES.has(control.value)),
    relevantPersistedValues: (state.persistedValues || []).filter((value) => EXTERNAL_RELEVANT_VALUES.has(value))
  };

  const values = [
    ...state.controls.map((control) => control.value),
    ...(state.persistedValues || [])
  ];
  result.validations.sameExpectedResult = EXTERNAL_EXPECTED_VALUES.every((value) => values.includes(value));
  result.validations.chooseOptionRecorded = result.macroAnalysis.hasChooseOption;
  result.validations.noTemporarySelectors = !result.macroAnalysis.hasTemporarySelectors;

  const failed = Object.entries(result.validations)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  result.status = failed.length ? "failed" : "passed";
  if (failed.length) result.failure = `Validaciones fallidas: ${failed.join(", ")}`;
  return result;
}

async function resetLocalFixture(page) {
  await page.goto(`http://localhost:${PORT}/iapos-genexus.html`, { waitUntil: "load", timeout: 20000 });
}

async function interactIaposFixture(page) {
  await page.click("#vDETALLES_0001");
  await page.waitForSelector("#vERROR", { state: "visible", timeout: 10000 });
  await page.waitForTimeout(3600);
  await page.selectOption("#vERROR", "47");
  await page.waitForFunction(() => {
    const img = document.getElementById("vAUTORIZAR_0001");
    return !!(img && !img.disabled);
  }, { timeout: 10000 });
  await page.click("#vAUTORIZAR_0001");
  await page.waitForFunction(() => {
    const btn = document.getElementById("confirmar");
    return !!(btn && !btn.disabled);
  }, { timeout: 10000 });
  await page.click("#confirmar");
  await page.waitForSelector("#resultado[data-state='autorizado']", { timeout: 10000 });
}

async function runIaposScenario(ctx, page) {
  const name = "local-iapos-genexus";
  const macroName = `QA Headed IAPOS ${Date.now()}`;
  const result = {
    name,
    title: "Fixture local GeneXus/IAPOS simulado",
    status: "failed",
    macroName,
    validations: {},
    artifacts: []
  };

  await resetLocalFixture(page);
  result.artifacts.push(await screenshot(page, name, "before-recording"));
  const rec = await startRecording(ctx, page);
  result.validations.recordingFeedbackSeen = rec.feedbackSeen;
  await interactIaposFixture(page);
  result.artifacts.push(await screenshot(page, name, "after-user-flow"));
  await stopRecording(page);
  const script = await readScriptFromEditor(page);
  result.macroArtifact = writeMacroArtifact(name, script);
  result.artifacts.push(result.macroArtifact);
  result.macroAnalysis = analyzeMacro(script);
  await saveEditorMacro(page, macroName);
  await closeEditor(page);

  await resetLocalFixture(page);
  await selectMacroInLibrary(ctx, page, macroName);
  const playback = await playSelectedMacro(page);
  result.validations.playbackFeedbackSeen = playback.feedbackSeen;
  result.artifacts.push(await screenshot(page, name, "after-playback"));

  const state = await page.evaluate(() => ({
    value: document.getElementById("vERROR") ? document.getElementById("vERROR").value : "",
    result: document.getElementById("resultado") ? document.getElementById("resultado").dataset.state : "",
    highlightCount: document.querySelectorAll("[data-wm-hl]").length,
    gxNotification: document.getElementById("gx_ajax_notification") ? document.getElementById("gx_ajax_notification").textContent.trim() : "",
    gxState: document.getElementById("GXState") ? document.getElementById("GXState").value : ""
  }));
  result.finalState = state;
  result.validations.sameExpectedResult = state.value === "47" && state.result === "autorizado";
  result.validations.clickImageRecorded = result.macroAnalysis.hasImageClick;
  result.validations.chooseOptionRecorded = result.macroAnalysis.hasChooseOption;
  result.validations.chooseOptionValueTextIndex = result.macroAnalysis.hasChooseOptionValueTextIndex;
  result.validations.waitForRecorded = result.macroAnalysis.hasWaitFor;
  result.validations.noTemporarySelectors = !result.macroAnalysis.hasTemporarySelectors && state.highlightCount === 0;

  const failed = Object.entries(result.validations)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  result.status = failed.length ? "failed" : "passed";
  if (failed.length) result.failure = `Validaciones fallidas: ${failed.join(", ")}`;
  return result;
}

function generateReport(run) {
  const lines = [];
  lines.push("# WebMatic headed recorder/playback QA report");
  lines.push("");
  lines.push(`- Fecha/hora: ${run.startedAt}`);
  lines.push(`- Version probada: ${run.version}`);
  lines.push(`- Navegador usado: ${run.browser}`);
  lines.push(`- Extension usada: ${run.extensionMode}`);
  lines.push(`- XPI firmado: no usado por este runner; Playwright no carga XPI firmado de Firefox de forma confiable en este flujo headed.`);
  lines.push(`- Comando ejecutado: \`${run.command}\``);
  lines.push(`- Trace Playwright: ${run.trace ? rel(run.trace) : "no generado"}`);
  lines.push("");
  lines.push("## Resultado general");
  lines.push("");
  lines.push(`Estado: **${run.overallStatus}**`);
  if (run.environmentNotes.length) {
    lines.push("");
    lines.push("## Notas de entorno");
    run.environmentNotes.forEach((note) => lines.push(`- ${note}`));
  }
  lines.push("");
  lines.push("## Escenarios");
  lines.push("");

  run.scenarios.forEach((scenario) => {
    lines.push(`### ${scenario.title}`);
    lines.push("");
    lines.push(`- Estado: ${scenario.status}`);
    lines.push(`- Macro guardada: ${scenario.macroName || "no disponible"}`);
    lines.push(`- Macro capturada: ${scenario.macroArtifact ? rel(scenario.macroArtifact) : "no disponible"}`);
    lines.push(`- Artefactos: ${scenario.artifacts && scenario.artifacts.length ? scenario.artifacts.map(rel).join(", ") : "sin artefactos"}`);
    lines.push(`- Reproduccion exitosa: ${scenario.validations && scenario.validations.sameExpectedResult ? "si" : "no"}`);
    if (scenario.failure) lines.push(`- Falla: ${scenario.failure}`);
    if (scenario.macroAnalysis) {
      lines.push(`- Analisis macro: CHOOSE_OPTION=${scenario.macroAnalysis.hasChooseOption}, VALUE/TEXT/INDEX=${scenario.macroAnalysis.hasChooseOptionValueTextIndex}, WAIT_FOR=${scenario.macroAnalysis.hasWaitFor}, CLICK image=${scenario.macroAnalysis.hasImageClick}, basura visual=${scenario.macroAnalysis.hasTemporarySelectors}`);
    }
    if (scenario.finalState) {
      lines.push("");
      lines.push("Estado final observado:");
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(scenario.finalState, null, 2));
      lines.push("```");
    }
    if (scenario.macroArtifact && fs.existsSync(scenario.macroArtifact)) {
      const macroText = fs.readFileSync(scenario.macroArtifact, "utf8");
      lines.push("");
      lines.push("Macro grabada:");
      lines.push("");
      lines.push("```iim");
      lines.push(macroText.slice(0, 6000));
      if (macroText.length > 6000) lines.push("// ... truncado en reporte, ver archivo .iim completo");
      lines.push("```");
    }
    lines.push("");
  });

  const bugs = run.scenarios
    .filter((scenario) => scenario.status !== "passed")
    .map((scenario) => ({
      scenario: scenario.title,
      severity: scenario.macroAnalysis && scenario.macroAnalysis.hasTemporarySelectors ? "alta" : "media",
      detail: scenario.failure || scenario.error || "Escenario no paso las validaciones"
    }));

  lines.push("## Bugs encontrados");
  lines.push("");
  if (!bugs.length) {
    lines.push("- No se detectaron bugs bloqueantes en los escenarios ejecutados.");
  } else {
    bugs.forEach((bug) => {
      lines.push(`- Severidad ${bug.severity}: ${bug.scenario} - ${bug.detail}`);
      lines.push("  Pasos: ejecutar el runner headed, observar el escenario indicado y revisar macro/trace asociados.");
    });
  }

  lines.push("");
  lines.push("## Recomendaciones");
  lines.push("");
  lines.push("- Mantener este runner fuera de scripts npm si no se aprueba modificar package.json.");
  lines.push("- Reejecutar con una terminal que tenga node y git en PATH para reproducir exactamente los comandos esperados.");
  lines.push("- Si se requiere validar el XPI firmado, hacerlo con runner Firefox/geckodriver dedicado y documentar diferencias frente a Chromium unpacked.");
  lines.push("");
  lines.push("## Que no se pudo probar");
  lines.push("");
  lines.push("- No se cargo el XPI firmado en Firefox desde Playwright en este runner.");
  lines.push("- No se uso IAPOS real ni credenciales reales.");
  lines.push("- No se hicieron commits, firma ni subida a GitHub.");
  lines.push("");

  fs.writeFileSync(REPORT_PATH, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  ensureDirs();
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"));
  const startedAt = new Date().toISOString();
  const run = {
    startedAt,
    version: `${pkg.name || "webmatic"} ${pkg.version || "sin-version"}`,
    browser: `Chromium headed, slowMo=${SLOW_MO}ms`,
    extensionMode: "Chromium MV3 temporal generado en %TEMP% desde manifest/src del repo",
    command: "node accesorios/pruebas/tests/e2e/headed-recorder-playback/run.js",
    environmentNotes: [],
    scenarios: [],
    trace: TRACE_PATH,
    overallStatus: "failed"
  };

  if (!process.env.PATH || !process.env.PATH.toLowerCase().includes("nodejs")) {
    run.environmentNotes.push("En esta sesion node puede no estar en PATH; se puede invocar con la ruta absoluta de Node si hace falta.");
  }

  const server = await startFixtureServer();
  let ctx;

  try {
    if (fs.existsSync(PROFILE_DIR)) {
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
    }

    log("Abriendo Chromium headed con extension Chromium temporal");
    const extensionDir = prepareChromiumExtension();
    ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      slowMo: SLOW_MO,
      viewport: { width: 1366, height: 900 },
      acceptDownloads: true,
      recordVideo: { dir: VIDEO_DIR, size: { width: 1366, height: 900 } },
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
        "--no-first-run",
        "--no-default-browser-check"
      ]
    });

    await ctx.tracing.start({ screenshots: true, snapshots: true });
    const page = await ctx.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") log(`console error: ${msg.text()}`);
    });

    for (const scenario of [runExternalScenario, runIaposScenario]) {
      try {
        const result = await scenario(ctx, page);
        run.scenarios.push(result);
        log(`${result.status.toUpperCase()}: ${result.title}`);
      } catch (error) {
        const failed = {
          name: scenario.name,
          title: scenario.name,
          status: "failed",
          error: error && error.stack ? error.stack : String(error),
          validations: {},
          artifacts: []
        };
        try {
          failed.artifacts.push(await screenshot(page, scenario.name, "failure"));
        } catch {
          // ignore screenshot failure
        }
        run.scenarios.push(failed);
        log(`FAIL: ${scenario.name}: ${error && error.message ? error.message : error}`);
      }
    }

    await ctx.tracing.stop({ path: TRACE_PATH }).catch((error) => {
      run.environmentNotes.push(`No se pudo guardar trace: ${error.message || String(error)}`);
      run.trace = null;
    });

    run.overallStatus = run.scenarios.every((scenario) => scenario.status === "passed") ? "passed" : "failed";
  } catch (error) {
    run.environmentNotes.push(`Falla de runner: ${error && error.message ? error.message : String(error)}`);
    throw error;
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    else if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
    await new Promise((resolve) => server.close(resolve));
    generateReport(run);
    log(`Reporte escrito en ${REPORT_PATH}`);
  }

  if (run.overallStatus !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[headed-recorder-playback] FATAL", error && error.stack ? error.stack : error);
  process.exit(1);
});
