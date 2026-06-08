const fs = require("fs");
const path = require("path");
const { chromium, firefox } = require("playwright");

const START_URL = "https://app.santafe.gov.ar/iapos-app-srvt/servlet/auauditcabe_ww?M,0";
const OUT_DIR = path.join(process.cwd(), "extracted");
const PROFILE_DIR = path.join(process.cwd(), ".iapos-extract-profile");
const BROWSER = (process.env.BROWSER || "chromium").toLowerCase();

const FIELDS = [
  {
    key: "especialidad",
    selector: "#vAUCAESPEFC",
    output: "genexus-catalogo-especialidad-playwright.json",
    terms: [
      "ALO", "ALOJ", "ALOJAMIENTO",
      "ANA", "ANES", "ANESTESIA",
      "CAR", "CARD", "CARDIO", "CARDIOLOGIA",
      "CIR", "CIRUGIA",
      "CLI", "CLINICA",
      "DER", "DERM", "DERMATO",
      "DIA", "DIAB", "DIABETES",
      "DOL", "DOLOR",
      "ECO", "ECOGRAFIA",
      "END", "ENDO", "ENDOSCOPIA", "ENDOCRINO",
      "FIS", "FISIO", "FISIATRIA",
      "FON", "FONO", "FONOAUDIOLOGIA",
      "GAS", "GASTRO", "GASTROENTEROLOGIA",
      "GEN", "GENETICA",
      "GIN", "GINE", "GINECOLOGIA",
      "HEM", "HEMA", "HEMATOLOGIA", "HEMOTERAPIA",
      "INF", "INFECTOLOGIA",
      "KIN", "KINE", "KINESIOLOGIA",
      "LAB", "LABORATORIO",
      "MAM", "MAMA",
      "MED", "MEDICA", "MEDICINA",
      "NEF", "NEFRO", "NEFROLOGIA",
      "NEU", "NEUMO", "NEUMONOLOGIA", "NEURO", "NEUROLOGIA", "NEUROCIRUGIA",
      "NUT", "NUTRICION",
      "OBS", "OBST", "OBSTETRICIA",
      "ODO", "ODON", "ODONTOLOGIA",
      "OFT", "OFTA", "OFTALMOLOGIA",
      "ONC", "ONCO", "ONCOLOGIA",
      "ORL",
      "ORT", "ORTOPEDIA",
      "OTO", "OTORRINO",
      "PED", "PEDIATRIA",
      "PSI", "PSIC", "PSICOLOGIA", "PSIQ", "PSIQUIATRIA",
      "PUL", "PULMON",
      "RAD", "RADIO", "RADIOLOGIA", "RADIOTERAPIA",
      "REH", "REHABILITACION",
      "RES", "RESONANCIA",
      "REU", "REUMA", "REUMATOLOGIA",
      "SAL", "SALUD MENTAL",
      "TAC",
      "TER", "TERAPIA",
      "TRA", "TRAU", "TRAUMA", "TRAUMATOLOGIA",
      "URO", "UROLOGIA"
    ],
    reject: [
      "IAPOS", "AMSAFE", "DIPART", "SOFSA", "SITRAM", "DELEG",
      "CENTRAL IAPOS", "CASA CENTRAL", "GERENCIA MEDICA", "BIOQUIMICOS",
      "CONVENIO", "CARTERA", "ROSARIO", "RAFAELA", "RECONQUISTA",
      "VENADO", "CASILDA", "CAÑADA", "GALVEZ", "ESPERANZA", "HELVECIA",
      "FIRMAT", "ALCORTA", "SUNCHALES", "SAN JAVIER", "SAN LORENZO",
      "SANTA FE", "BUENOS AIRES", "VILLA CONSTITUCION", "NO USAR"
    ]
  },
  {
    key: "delegacion",
    selector: "#vDELEGACION",
    output: "genexus-catalogo-delegacion-playwright.json",
    terms: [
      "IAP", "IAPOS", "CENTRAL", "CASA",
      "ROS", "ROSARIO",
      "RAF", "RAFAELA",
      "REC", "RECONQUISTA",
      "VEN", "VENADO",
      "CAS", "CASILDA",
      "CAÑ", "CAÑADA",
      "GAL", "GALVEZ",
      "ESP", "ESPERANZA",
      "AMSAFE", "DIPART", "CONVENIO", "SOFSA", "BIO", "BIOQUIMICOS",
      "SAN", "SANTA",
      "BE", "US", "NO USAR",
      "ALC", "ALCORTA",
      "BUENOS", "CORDOBA", "FIRMAT", "HELVECIA", "LAGUNA",
      "LAS ROSAS", "LORENZO", "JAVIER", "CARLOS", "GOBERNADOR",
      "CRESPO", "RECREO", "FRANCK", "TARTAGAL", "SUNCHALES",
      "TRIBUNALES", "SITRAM", "CARTERA", "GERENCIA", "MEDICA",
      "MUTUAL", "HOSP", "GOBIERNO", "VILLA", "GODEKEN",
      "ZENON", "MAXIMO", "PAZ"
    ],
    reject: [
      "AUDITORIA", "AUTORIZACIONES", "COBERTURA", "MODALIDAD",
      "NRO AUTORIZACION", "PAGINA", "ORDENADO POR", "NOMBRE Y APELLIDO",
      "N AFILIADO", "MATRICULA", "FICHA DE CONSUMOS", "WEBMATIC",
      "NOVEDADES", "INICIO"
    ]
  }
];

function normalizeText(raw) {
  return String(raw == null ? "" : raw)
    .replace(/\\042/g, '"')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .trim();
}

function noAccents(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function parseGeneXusOptions(txt) {
  txt = String(txt || "");
  const out = [];

  const patterns = [
    /\{c:"((?:\\.|[^"\\])*)",d:"((?:\\.|[^"\\])*)"\}/g,
    /\{c:'((?:\\.|[^'\\])*)',d:'((?:\\.|[^'\\])*)'\}/g,
    /"c"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"d"\s*:\s*"((?:\\.|[^"\\])*)"/g,
    /'c'\s*:\s*'((?:\\.|[^'\\])*)'\s*,\s*'d'\s*:\s*'((?:\\.|[^'\\])*)'/g
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(txt))) {
      out.push({
        value: normalizeText(m[1]),
        text: normalizeText(m[2])
      });
    }
  }

  return out;
}

function parseValidation(txt) {
  txt = String(txt || "").trim();
  const m = txt.match(/^\["([^"]*)","([^"]*)","([^"]*)"\]$/);
  if (!m) return null;
  return { code: normalizeText(m[1]), text: normalizeText(m[2]), raw: txt };
}

function isBadCommon(value, text) {
  const s = noAccents(`${value} ${text}`);
  if (!s) return true;
  if (s.length > 180) return true;
  if (s === "/") return true;

  return (
    s.includes("GX.DOM") ||
    s.includes("USUARIO") ||
    s.includes("ORGANIZACION") ||
    s.includes("JAVASCRIPT:") ||
    s.includes("FUNCTION(")
  );
}

function shouldReject(fieldConfig, value, text) {
  if (isBadCommon(value, text)) return true;

  const s = noAccents(`${value} ${text}`);

  for (const bad of fieldConfig.reject || []) {
    if (s.includes(noAccents(bad))) return true;
  }

  if (fieldConfig.key === "especialidad") {
    if (/\b\d-\d/.test(s)) return true;
    if (/\bBE\b/.test(s) || /\bUS\b/.test(s)) return true;
  }

  return false;
}

function addOption(fieldState, value, text, source, term, url) {
  value = normalizeText(value);
  text = normalizeText(text || value);

  if (shouldReject(fieldState.config, value, text)) return;

  const key = `${value}\u0000${text}`;
  if (!fieldState.options.has(key)) {
    fieldState.options.set(key, {
      value,
      text,
      source,
      term,
      capturedAt: new Date().toISOString()
    });

    console.log(`+ ${fieldState.config.key}: ${text}`);
  }
}

function addValidation(fieldState, validation, term, url) {
  if (!validation) return;
  if (shouldReject(fieldState.config, validation.code, validation.text)) return;

  const key = `${validation.code}\u0000${validation.text}`;
  if (!fieldState.validations.has(key)) {
    fieldState.validations.set(key, {
      code: validation.code,
      text: validation.text,
      raw: validation.raw,
      term,
      capturedAt: new Date().toISOString()
    });
  }
}

async function clearAndType(page, selector, term) {
  const loc = page.locator(selector);
  await loc.click({ timeout: 10000 });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(250);
  await page.keyboard.type(term, { delay: 90 });
  await page.waitForTimeout(1500);
}

async function waitForIaposPage(page) {
  console.log("Abriendo IAPOS...");
  await page.goto(START_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  console.log("Esperando pantalla de auditoría...");
  const anyField = page.locator("#vAUCAESPEFC, #vDELEGACION").first();

  try {
    await anyField.waitFor({ state: "visible", timeout: 20000 });
  } catch {
    console.log("");
    console.log("Si ves login o menú, ingresá/navegá manualmente hasta Auditoría Médica.");
    console.log("El script sigue solo cuando aparezcan #vAUCAESPEFC y #vDELEGACION.");
    await anyField.waitFor({ state: "visible", timeout: 0 });
  }

  console.log("Campos detectados.");
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browserType = BROWSER === "firefox" ? firefox : chromium;

  const context = await browserType.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true
  });

  const page = context.pages()[0] || await context.newPage();

  const fieldStates = new Map();

  for (const cfg of FIELDS) {
    fieldStates.set(cfg.key, {
      config: cfg,
      currentTerm: "",
      options: new Map(),
      validations: new Map(),
      logs: []
    });
  }

  let activeFieldKey = null;

  page.on("response", async response => {
    const fieldState = activeFieldKey ? fieldStates.get(activeFieldKey) : null;
    if (!fieldState) return;

    const url = response.url();
    if (!url.includes("/servlet/auauditcabe_ww")) return;

    let text = "";
    try {
      text = await response.text();
    } catch {
      return;
    }

    const options = parseGeneXusOptions(text);
    const validation = parseValidation(text);

    if (!options.length && !validation) return;

    for (const opt of options) {
      addOption(fieldState, opt.value, opt.text, "xhr", fieldState.currentTerm, url);
    }

    addValidation(fieldState, validation, fieldState.currentTerm, url);

    fieldState.logs.push({
      at: new Date().toISOString(),
      url,
      status: response.status(),
      term: fieldState.currentTerm,
      optionsCount: options.length,
      validation,
      responsePreview: text.slice(0, 500)
    });
  });

  try {
    await waitForIaposPage(page);

    for (const cfg of FIELDS) {
      const fieldState = fieldStates.get(cfg.key);

      console.log("");
      console.log("=====================================");
      console.log(`Extrayendo ${cfg.key}: ${cfg.selector}`);
      console.log("=====================================");

      await page.locator(cfg.selector).scrollIntoViewIfNeeded();

      for (const term of cfg.terms) {
        activeFieldKey = cfg.key;
        fieldState.currentTerm = term;

        console.log(`${cfg.key} → ${term}`);
        await clearAndType(page, cfg.selector, term);
      }

      activeFieldKey = null;
      fieldState.currentTerm = "";

      await page.locator(cfg.selector).click();
      await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(300);
    }

    const combined = {
      capturedAt: new Date().toISOString(),
      url: page.url(),
      source: "Playwright trusted keyboard + GeneXus XHR extraction",
      fields: {}
    };

    for (const cfg of FIELDS) {
      const st = fieldStates.get(cfg.key);

      const options = Array.from(st.options.values())
        .sort((a, b) => a.text.localeCompare(b.text));

      const validations = Array.from(st.validations.values())
        .sort((a, b) => a.text.localeCompare(b.text));

      const data = {
        capturedAt: new Date().toISOString(),
        url: page.url(),
        field: cfg.selector,
        fieldName: cfg.key,
        source: "Playwright trusted keyboard + GeneXus XHR extraction",
        total: options.length,
        options,
        validationsTotal: validations.length,
        validations,
        logs: st.logs
      };

      const file = path.join(OUT_DIR, cfg.output);
      fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");

      combined.fields[cfg.key] = {
        selector: cfg.selector,
        total: options.length,
        options,
        validationsTotal: validations.length,
        validations
      };

      console.log("");
      console.log(`${cfg.key.toUpperCase()} TOTAL: ${options.length}`);
      console.log(`Archivo: ${file}`);
    }

    const combinedFile = path.join(
      OUT_DIR,
      "genexus-catalogo-iapos-delegacion-especialidad-combined.json"
    );

    fs.writeFileSync(combinedFile, JSON.stringify(combined, null, 2), "utf8");

    console.log("");
    console.log("=====================================");
    console.log("FINALIZADO");
    console.log("=====================================");
    console.log(`Combinado: ${combinedFile}`);
  } finally {
    await context.close();
  }
}

main().catch(err => {
  console.error("ERROR:", err);
  process.exitCode = 1;
});
