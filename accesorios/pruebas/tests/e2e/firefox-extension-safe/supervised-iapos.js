"use strict";

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const { makeSafeLogger } = require("../iapos-safe/sanitize-log");
const {
  resolveFirefoxBinary,
  resolveGeckodriverBin,
  resolveZipBin
} = require("./run.js");

const ROOT = path.resolve(__dirname, "../../..");
const REPO_ROOT = path.resolve(ROOT, "../..");
const INVENTORY_SRC_PATH = path.join(REPO_ROOT, "src", "modules", "inventory", "page-inventory.js");
const PRIVATE_ARTIFACTS = path.join(ROOT, "tests", "e2e", "artifacts-private");
const GECKO_PORT = Number(process.env.GECKO_PORT || 4546);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildTemporaryXpi(zipPath) {
  fs.mkdirSync(PRIVATE_ARTIFACTS, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(PRIVATE_ARTIFACTS, "webmatic-iapos-supervised-"));
  const xpiPath = path.join(tempDir, "webmatic-temp.xpi");
  const out = spawnSync(zipPath, ["-qr", xpiPath, "manifest.json", "src", "logo48.png"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    windowsHide: true
  });

  if (out.status === 0 && fs.existsSync(xpiPath)) {
    return { tempDir, xpiPath };
  }

  throw new Error(`No se pudo crear XPI temporal: ${(out.stderr || out.stdout || "").trim()}`);
}

function startGeckodriver(geckodriverPath, log) {
  const proc = spawn(geckodriverPath, ["--port", String(GECKO_PORT)], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  const logs = [];
  const capture = (src, chunk) => {
    const text = String(chunk || "").trim();
    if (!text) return;
    logs.push(`[${src}] ${text}`);
    if (logs.length > 60) logs.shift();
  };

  proc.stdout.on("data", (c) => capture("stdout", c));
  proc.stderr.on("data", (c) => capture("stderr", c));

  const ready = (async () => {
    const started = Date.now();
    while (Date.now() - started < 20000) {
      if (proc.exitCode !== null) {
        throw new Error(`geckodriver terminó antes de iniciar (code=${proc.exitCode})`);
      }
      try {
        const res = await fetch(`http://127.0.0.1:${GECKO_PORT}/status`);
        if (res.ok) return;
      } catch {
        // reintentar
      }
      await sleep(250);
    }
    throw new Error("Timeout iniciando geckodriver");
  })();

  return {
    proc,
    logs,
    ready,
    stop: async () => {
      if (!proc || proc.killed) return;
      proc.kill("SIGTERM");
      await sleep(300);
      if (!proc.killed) proc.kill("SIGKILL");
      log("geckodriver finalizado");
    }
  };
}

async function wdRequest(method, route, body) {
  const res = await fetch(`http://127.0.0.1:${GECKO_PORT}${route}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await res.text();
  let json = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = { raw };
  }

  const value = json.value !== undefined ? json.value : json;
  if (!res.ok || (value && value.error)) {
    throw new Error(`WebDriver ${method} ${route} -> ${JSON.stringify(value)}`);
  }

  return json;
}

function getSessionId(createSessionResponse) {
  if (createSessionResponse.sessionId) return createSessionResponse.sessionId;
  if (createSessionResponse.value && createSessionResponse.value.sessionId) return createSessionResponse.value.sessionId;
  return null;
}

async function execSync(sessionId, script, args = []) {
  const result = await wdRequest("POST", `/session/${sessionId}/execute/sync`, { script, args });
  return result.value !== undefined ? result.value : result;
}

async function tryAutoLogin(sessionId, user, pass, log) {
  if (!user || !pass) return { attempted: false, success: false, reason: "missing_credentials" };

  const result = await execSync(sessionId, `
    const user = String(arguments[0] || "");
    const pass = String(arguments[1] || "");

    const visible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
      const r = el.getBoundingClientRect();
      return r.width > 3 && r.height > 3;
    };

    const textish = (el) => {
      const t = String((el && el.type) || "").toLowerCase();
      return t === "text" || t === "email" || t === "search" || t === "tel" || t === "";
    };

    const scoreUserField = (el) => {
      if (!el) return -1;
      const blob = [
        el.id,
        el.name,
        el.getAttribute("aria-label"),
        el.getAttribute("placeholder"),
        el.getAttribute("title")
      ].join(" ").toLowerCase();
      let score = 0;
      if (/usuario|user|login|cuenta|dni|documento/.test(blob)) score += 8;
      if (/buscar|search|filtro/.test(blob)) score -= 6;
      return score;
    };

    const emit = (el, value) => {
      if (!el) return false;
      el.focus();
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };

    const passInput = Array.from(document.querySelectorAll("input[type='password']")).find(visible) || null;
    if (!passInput) return { attempted: false, success: false, reason: "password_field_not_found" };

    let userInput = null;
    const sameForm = passInput.form || passInput.closest("form");
    if (sameForm) {
      const candidates = Array.from(sameForm.querySelectorAll("input")).filter((i) => i !== passInput && textish(i) && visible(i));
      candidates.sort((a, b) => scoreUserField(b) - scoreUserField(a));
      userInput = candidates[0] || null;
    }
    if (!userInput) {
      const candidates = Array.from(document.querySelectorAll("input")).filter((i) => i !== passInput && textish(i) && visible(i));
      candidates.sort((a, b) => scoreUserField(b) - scoreUserField(a));
      userInput = candidates[0] || null;
    }
    if (!userInput) return { attempted: false, success: false, reason: "user_field_not_found" };

    emit(userInput, user);
    emit(passInput, pass);

    const isLoginText = (s) => /(ingresar|login|iniciar\s*sesi[oó]n|acceder|entrar)/i.test(String(s || ""));

    let submit = null;
    const greenTick = document.getElementById("IMG_LOGINON_MPAGE");
    if (greenTick && visible(greenTick)) {
      submit = greenTick;
    }

    if (sameForm) {
      if (!submit) {
        submit = Array.from(sameForm.querySelectorAll("button,input[type='submit'],input[type='image'],input[type='button']"))
          .find((el) => visible(el) && isLoginText(el.textContent || el.value || el.title || el.getAttribute("aria-label") || el.id || el.name));
      }
    }
    if (!submit) {
      submit = Array.from(document.querySelectorAll("button,input[type='submit'],input[type='image'],input[type='button']"))
        .find((el) => visible(el) && isLoginText(el.textContent || el.value || el.title || el.getAttribute("aria-label") || el.id || el.name));
    }

    if (submit) {
      submit.click();
      return {
        attempted: true,
        success: true,
        mode: "submit_click",
        userField: { id: userInput.id || "", name: userInput.name || "", type: userInput.type || "" },
        passField: { id: passInput.id || "", name: passInput.name || "", type: passInput.type || "" },
        submitField: { id: submit.id || "", name: submit.name || "", type: submit.type || "" }
      };
    }

    passInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    passInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
    if (sameForm && typeof sameForm.submit === "function") {
      try { sameForm.submit(); } catch (_e) { /* ignore */ }
    }
    return {
      attempted: true,
      success: true,
      mode: "enter_submit",
      userField: { id: userInput.id || "", name: userInput.name || "", type: userInput.type || "" },
      passField: { id: passInput.id || "", name: passInput.name || "", type: passInput.type || "" }
    };
  `, [user, pass]);

  if (result && result.attempted) {
    log(`Auto-login: intento ejecutado (${result.mode || "n/a"})`);
  } else {
    log(`Auto-login: omitido (${(result && result.reason) || "unknown"})`);
  }
  return result || { attempted: false, success: false, reason: "unknown" };
}

async function captureLoginFailureDiagnostics(sessionId) {
  return execSync(sessionId, `
    const txt = (el) => String((el && (el.textContent || el.innerText)) || "").replace(/\s+/g, " ").trim();
    const candidates = Array.from(document.querySelectorAll(".error,.alert,.mensaje,.msg,.gx-warning,.gx-error,[role='alert']"))
      .map((el) => txt(el))
      .filter(Boolean)
      .slice(0, 8);
    const title = document.title || "";
    return {
      href: location.href,
      title,
      messages: candidates
    };
  `);
}

async function navigateToUrl(sessionId, url) {
  await wdRequest("POST", `/session/${sessionId}/url`, { url: String(url || "") });
}

async function isLikelyLoginPage(sessionId) {
  const info = await execSync(sessionId, `
    const pass = Array.from(document.querySelectorAll("input[type='password']"))
      .filter((el) => {
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden") return false;
        const r = el.getBoundingClientRect();
        return r.width > 2 && r.height > 2;
      });
    const href = location.href;
    return {
      href,
      hasVisiblePassword: pass.length > 0
    };
  `);
  return Boolean(info && info.hasVisiblePassword);
}

async function waitForLoggedIn(sessionId, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await wdRequest("GET", `/session/${sessionId}/url`);
    const href = String(res.value !== undefined ? res.value : "");
    const loggedIn = !/\/uswbienvenido(\?|$)/i.test(href);
    if (loggedIn) return { ok: true, state: { href } };
    await sleep(700);
  }
  return { ok: false };
}

async function waitCountdown(ms, label, log) {
  let left = Math.max(0, Number(ms) || 0);
  while (left > 0) {
    const chunk = Math.min(left, 15000);
    await sleep(chunk);
    left -= chunk;
    log(`${label}: faltan ${Math.ceil(left / 1000)}s`);
  }
}

function isDangerousText(text) {
  return /(autorizar|confirmar|guardar|eliminar|anular|aprobar|rechazar|liquidar|emitir|facturar|pagar|aceptar|aplicar|imprimir\s+comprobante)/i.test(String(text || ""));
}

async function getWindowHandles(sessionId) {
  const res = await wdRequest("GET", `/session/${sessionId}/window/handles`);
  const value = res.value !== undefined ? res.value : res;
  return Array.isArray(value) ? value : [];
}

async function switchToWindow(sessionId, handle) {
  await wdRequest("POST", `/session/${sessionId}/window`, { handle });
}

async function closeCurrentWindow(sessionId) {
  await wdRequest("DELETE", `/session/${sessionId}/window`);
}

async function stepBack(sessionId) {
  await wdRequest("POST", `/session/${sessionId}/back`, {});
}

async function prepareSidebarMenu(sessionId) {
  return execSync(sessionId, `
    const visible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    };

    const preferred = [
      document.getElementById("MPW0071IMAGE_MENU_EXPAND_ALL"),
      document.getElementById("MPW0071IMG_MENUON"),
      document.getElementById("MPW0071IMG_MENUBLOCK"),
      document.getElementById("MPW0071IMG_MENUFREE")
    ].find(visible);

    if (!preferred) return { ok: false, reason: "sidebar_control_missing" };
    preferred.click();
    return { ok: true, clicked: preferred.id || preferred.name || preferred.title || "" };
  `);
}

async function clickSidebarItemByText(sessionId, text) {
  return execSync(sessionId, `
    const needle = String(arguments[0] || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
      .toLowerCase();
    if (!needle) return { ok: false, reason: "missing_text" };

    const visible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    };

    const norm = (v) => String(v == null ? "" : v)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
      .toLowerCase();

    const sidebarRoot = document.querySelector("[id^='MPW0071']") || document.getElementById("MPW0071WWMenumainTable") || document.body;
    const nodes = Array.from(sidebarRoot.querySelectorAll("td,a,span,div,[onclick]"));

    const candidate = nodes.find((el) => {
      if (!visible(el)) return false;
      const text = norm(el.textContent || el.getAttribute("title") || el.getAttribute("aria-label") || "");
      if (!text) return false;
      return text.includes(needle);
    }) || null;

    if (!candidate) return { ok: false, reason: "not_found", requested: needle };

    const rect = candidate.getBoundingClientRect();
    candidate.scrollIntoView({ block: "center", inline: "center" });
    candidate.click();
    return {
      ok: true,
      clickedText: String(candidate.textContent || candidate.getAttribute("title") || "").replace(/\s+/g, " ").trim(),
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
    };
  `, [text]);
}

async function openSidebarPath(sessionId, labels, log) {
  const list = (Array.isArray(labels) ? labels : []).map((x) => String(x || "").trim()).filter(Boolean);
  const steps = [];
  for (let i = 0; i < list.length; i++) {
    const label = list[i];
    let res = null;

    const sidebarCandidates = await collectSafeCandidates(sessionId, { sidebarOnly: true });
    const target = findTargetSidebarCandidate(sidebarCandidates, label);
    if (target) {
      const clicked = await clickCandidate(sessionId, target);
      res = {
        ok: !!(clicked && clicked.ok),
        reason: clicked && clicked.reason ? clicked.reason : "",
        mode: "candidate_click",
        target,
        clicked
      };
    }

    if (!res || !res.ok) {
      const fallback = await clickSidebarItemByText(sessionId, label);
      res = {
        ok: !!(fallback && fallback.ok),
        reason: fallback && fallback.reason ? fallback.reason : "",
        mode: "dom_fallback",
        fallback
      };
    }

    steps.push({ label, res });
    log(`Sidebar path ${i + 1}/${list.length}: ${label} -> ${res && res.ok ? "OK" : `FAIL (${(res && res.reason) || "unknown"})`}`);
    if (!res || !res.ok) {
      const sidebarCandidates = await collectSafeCandidates(sessionId, { sidebarOnly: true });
      const wanted = normalizeSearchText(label);
      const uniqTexts = [];
      const seen = new Set();
      for (const c of Array.isArray(sidebarCandidates) ? sidebarCandidates : []) {
        const t = String((c && c.text) || "").replace(/\s+/g, " ").trim();
        if (!t) continue;
        const key = t.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        uniqTexts.push(t);
      }

      const tokens = wanted.split(" ").filter((x) => x.length >= 3);
      const suggestions = uniqTexts
        .filter((t) => {
          const n = normalizeSearchText(t);
          if (!n) return false;
          if (!tokens.length) return true;
          return tokens.some((tok) => n.includes(tok));
        })
        .slice(0, 15);

      throw new Error(`No se pudo abrir la ruta del sidebar en '${label}': ${JSON.stringify({ res, suggestions })}`);
    }
    await sleep(1200);
  }
  return steps;
}

async function collectSafeCandidates(sessionId, options = {}) {
  return execSync(sessionId, `
    const isWebmaticElement = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const ownId = String(el.id || "");
      if (/^(wm-|webmatic-)/i.test(ownId)) return true;
      if (el.closest && el.closest("#webmatic-panel-root, #webmatic-floating-recorder-global, #webmatic-floating-player-global")) return true;
      let p = el.parentElement;
      let guard = 0;
      while (p && guard < 8) {
        if (/^(wm-|webmatic-)/i.test(String(p.id || ""))) return true;
        p = p.parentElement;
        guard += 1;
      }
      return false;
    };

    const isVisible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    };

    const short = (s, n = 120) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
    const sidebarOnly = Boolean(arguments[0] && arguments[0].sidebarOnly);
    const nodes = Array.from(document.querySelectorAll("a,button,[role='menuitem'],[onclick]"));
    const out = [];
    const used = new Set();
    const genericButtons = /(inicio|recargar menu|menu vertical|menu estilo arbol|menu cascada|cambiar color de fondo|cerrar y volver|buscar|expandir todo el menu|colapsar todo el menu|menu on|menu off|menu free|menu block|logout|salir|cerrar sesión|cerrar sesion)/i;

    for (const el of nodes) {
      if (!isVisible(el)) continue;
      if (isWebmaticElement(el)) continue;
      const text = short(el.textContent || el.getAttribute("title") || el.getAttribute("aria-label") || "");
      const href = el.getAttribute("href") || "";
      const id = el.id || "";
      const name = el.getAttribute("name") || "";
      const target = el.getAttribute("target") || "";
      if (sidebarOnly) {
        const combined = [text, id, name].join(" ");
        if (genericButtons.test(combined)) continue;
        if (id && /^MPW0049/i.test(id)) continue;
      }
      const sig = [el.tagName, id, name, href, text].join("|");
      if (used.has(sig)) continue;
      used.add(sig);

      let strategy = null;
      if (id) strategy = { by: "id", value: id };
      else if (href && href !== "#" && !href.toLowerCase().startsWith("javascript:")) strategy = { by: "href", value: href };
      else if (text) strategy = { by: "text", value: text };
      if (!strategy) continue;

      out.push({
        tag: String(el.tagName || "").toLowerCase(),
        text,
        href,
        id,
        name,
        target,
        strategy
      });
    }

    return out.slice(0, 120);
  `, [options]);
}

async function clickCandidate(sessionId, candidate) {
  return execSync(sessionId, `
    const c = arguments[0] || {};
    const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
    const equalsText = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase();

    let el = null;
    if (c.strategy && c.strategy.by === "id") {
      el = document.getElementById(String(c.strategy.value || ""));
    } else if (c.strategy && c.strategy.by === "href") {
      const all = Array.from(document.querySelectorAll("a[href]"));
      el = all.find((n) => (n.getAttribute("href") || "") === String(c.strategy.value || "")) || null;
    } else if (c.strategy && c.strategy.by === "text") {
      const all = Array.from(document.querySelectorAll("a,button,[role='menuitem'],[onclick]"));
      el = all.find((n) => equalsText(n.textContent || n.getAttribute("title") || n.getAttribute("aria-label") || "", c.strategy.value || "")) || null;
    }

    if (!el) return { ok: false, reason: "element_not_found" };
    if (el.closest && el.closest("#webmatic-panel-root")) return { ok: false, reason: "webmatic_panel_element" };

    const tag = String(el.tagName || "").toLowerCase();
    const text = norm(el.textContent || el.getAttribute("title") || el.getAttribute("aria-label") || "");
    const href = el.getAttribute("href") || "";
    const target = el.getAttribute("target") || "";

    try {
      el.scrollIntoView({ block: "center", inline: "center" });
      // Click asíncrono: evita que execute/sync quede bloqueado en una navegación lenta.
      setTimeout(() => {
        try { el.click(); } catch (_e) { /* ignore */ }
      }, 0);
      return { ok: true, tag, text, href, target };
    } catch (e) {
      return { ok: false, reason: "click_failed", detail: String((e && e.message) || e || "") };
    }
  `, [candidate]);
}

async function captureLocation(sessionId) {
  return execSync(sessionId, `
    return {
      href: location.href,
      title: document.title || "",
      readyState: document.readyState || ""
    };
  `);
}

async function captureInventorySnapshot(sessionId, inventorySrc) {
  const src = String(inventorySrc || "");
  return execSync(sessionId, `
    ${src}
    const api = (typeof globalThis !== "undefined" && globalThis.WebMaticPageInventory) || window.WebMaticPageInventory;
    const snap = api ? api.captureInventory(document) : null;
    const controls = Array.isArray(snap && snap.controls) ? snap.controls : [];
    return {
      url: location.href,
      title: document.title || "",
      hasInventoryApi: !!api,
      controlCount: controls.length,
      controls
    };
  `);
}

async function startManualInteractionCapture(sessionId, inventorySrc = "") {
  const src = String(inventorySrc || "");
  return execSync(sessionId, `
    ${src}
    const invApi = (typeof globalThis !== "undefined" && globalThis.WebMaticPageInventory) || window.WebMaticPageInventory;

    const cssPath = (el) => {
      if (!el || !(el instanceof Element)) return "";
      if (el.id) return "#" + el.id;
      const parts = [];
      let node = el;
      let guard = 0;
      while (node && node.nodeType === 1 && guard < 6) {
        let part = String(node.tagName || "").toLowerCase();
        const name = node.getAttribute && node.getAttribute("name");
        if (name) {
          const safeName = String(name).replace(/"/g, "\\\"");
          part += "[name=\"" + safeName + "\"]";
          parts.unshift(part);
          break;
        }
        let idx = 1;
        let sib = node;
        while ((sib = sib.previousElementSibling)) {
          if (String(sib.tagName || "").toLowerCase() === String(node.tagName || "").toLowerCase()) idx += 1;
        }
        part += ":nth-of-type(" + idx + ")";
        parts.unshift(part);
        node = node.parentElement;
        guard += 1;
      }
      return parts.join(" > ");
    };

    const norm = (v, n = 140) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
    const events = [];
    const pages = [];
    const seenPages = new Set();

    const snapCurrentPage = () => {
      const key = String(location.href || "") + "||" + String(document.title || "");
      if (seenPages.has(key)) return;
      seenPages.add(key);
      if (!invApi || typeof invApi.captureInventory !== "function") {
        pages.push({
          url: location.href,
          title: document.title || "",
          capturedAt: Date.now(),
          hasInventoryApi: false,
          controlCount: 0,
          controls: []
        });
        return;
      }
      let snap = null;
      try { snap = invApi.captureInventory(document); } catch (_e) { snap = null; }
      const controls = Array.isArray(snap && snap.controls) ? snap.controls : [];
      pages.push({
        url: location.href,
        title: document.title || "",
        capturedAt: Date.now(),
        hasInventoryApi: !!invApi,
        controlCount: controls.length,
        controls
      });
    };

    const listener = (ev) => {
      snapCurrentPage();
      const t = ev && ev.target instanceof Element ? ev.target : null;
      if (!t) return;
      if (t.closest && t.closest("#webmatic-panel-root")) return;
      const id = t.id || "";
      const name = (t.getAttribute && t.getAttribute("name")) || "";
      const tag = String(t.tagName || "").toLowerCase();
      const type = (t.getAttribute && t.getAttribute("type")) || "";
      const label = norm(t.getAttribute && (t.getAttribute("aria-label") || t.getAttribute("title")) || t.textContent || "", 120);
      const value = typeof t.value !== "undefined" ? norm(t.value, 80) : "";
      events.push({
        kind: ev.type,
        at: Date.now(),
        id,
        name,
        tag,
        type,
        label,
        value,
        selector: cssPath(t),
        href: location.href,
        title: document.title || ""
      });
      if (events.length > 800) events.shift();
    };

    const prev = window.__wmHybridCapture;
    if (prev && prev.stop) {
      try { prev.stop(); } catch (_e) { /* ignore */ }
    }

    const stop = () => {
      document.removeEventListener("click", listener, true);
      document.removeEventListener("change", listener, true);
      document.removeEventListener("input", listener, true);
    };

    document.addEventListener("click", listener, true);
    document.addEventListener("change", listener, true);
    document.addEventListener("input", listener, true);

    // Captura inventario base al iniciar, aunque aún no haya interacción.
    snapCurrentPage();

    window.__wmHybridCapture = {
      stop,
      getEvents: () => events.slice(),
      getPages: () => pages.slice(),
      snapCurrentPage
    };

    return { ok: true };
  `);
}

async function readManualInteractionCapture(sessionId, stop = false) {
  return execSync(sessionId, `
    const cap = window.__wmHybridCapture;
    if (!cap) return { ok: false, reason: "capture_not_initialized", events: [], pages: [] };
    if (cap.snapCurrentPage) {
      try { cap.snapCurrentPage(); } catch (_e) { /* ignore */ }
    }
    const out = {
      ok: true,
      events: Array.isArray(cap.getEvents && cap.getEvents()) ? cap.getEvents() : [],
      pages: Array.isArray(cap.getPages && cap.getPages()) ? cap.getPages() : []
    };
    if (arguments[0] && cap.stop) {
      try { cap.stop(); } catch (_e) { /* ignore */ }
    }
    return out;
  `, [Boolean(stop)]);
}

async function waitForPassiveSessionEnd(sessionId, log, options = {}) {
  const pollMs = Math.max(700, Number(options.pollMs || 2000));
  let latest = { ok: false, events: [], pages: [] };

  // Espera indefinida: termina cuando se cierra Firefox o la sesión deja de existir.
  while (true) {
    try {
      const snap = await readManualInteractionCapture(sessionId, false);
      if (snap && snap.ok) latest = snap;
    } catch {
      // Si falla lectura pero la sesión sigue, reintentamos.
    }

    try {
      const handles = await getWindowHandles(sessionId);
      if (!Array.isArray(handles) || handles.length === 0) {
        log("Modo pasivo: Firefox cerrado por el usuario, finalizando captura.");
        break;
      }
    } catch {
      log("Modo pasivo: sesión WebDriver finalizada, cerrando captura.");
      break;
    }

    await sleep(pollMs);
  }

  return latest;
}

function summarizeInventory(inventory) {
  const controls = Array.isArray(inventory && inventory.controls) ? inventory.controls : [];
  const counts = {};
  for (const ctrl of controls) {
    const kind = String((ctrl && ctrl.controlKind) || "unknown");
    counts[kind] = (counts[kind] || 0) + 1;
  }
  return {
    url: inventory && inventory.url ? inventory.url : "",
    title: inventory && inventory.title ? inventory.title : "",
    controlCount: controls.length,
    counts,
    sampleControls: controls.slice(0, 20).map((c) => ({
      selector: c.selector || "",
      tag: c.tag || c.tagName || "",
      type: c.type || "",
      controlKind: c.controlKind || "",
      label: c.label || "",
      options: Array.isArray(c.options) ? c.options.length : 0
    }))
  };
}

function isNeverTouchControl(ctrl) {
  if (!ctrl) return false;
  const blob = [ctrl.label, ctrl.selector, ctrl.id, ctrl.name, ctrl.type, ctrl.controlKind]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const exactIds = new Set([
    "mpw0049img_home",
    "mpw0049img_refresh",
    "mpw0049img_dropdown",
    "mpw0049img_treeview",
    "mpw0049img_menujscook",
    "mpw0049img_menupalette",
    "mpw0071vmenubuscar",
    "mpw0071image_menubuscar",
    "mpw0071vbuscar",
    "mpw0071vexpandall",
    "mpw0071vcollapseall",
    "vsearchcriteria_mpage",
    "k2bheaderclose_mpage",
    "mpw0024btn_logout",
    "mpw0024btn_contrasenia"
  ]);
  const id = String(ctrl.id || "").toLowerCase();
  const name = String(ctrl.name || "").toLowerCase();
  const selector = String(ctrl.selector || "").toLowerCase();
  const type = String(ctrl.type || "").toLowerCase();
  if (exactIds.has(id) || exactIds.has(name)) return true;
  if (selector.includes("vsearchcriteria_mpage") || selector.includes("mpw0071vmenubuscar") || selector.includes("mpw0071vbuscar")) return true;
  if (type === "hidden") return true;
  if (/(gxstate|recentlinkscontainerdatav|entitiesresultsgridcontainerdatav|entityitemtoskip|itemstoskipjson|containerdatav)$/i.test(id)) return true;
  if (/(gxstate|recentlinkscontainerdatav|entitiesresultsgridcontainerdatav|entityitemtoskip|itemstoskipjson)/i.test(selector)) return true;
  return /(^|\b)(buscar|search|menubuscar|vbuscar|searchcriteria|recargar menu|menu vertical|menu estilo arbol|menu cascada|cambiar color de fondo|cerrar y volver|inicio|home|expandir todo el menu|colapsar todo el menu|logout|salir|cerrar sesion|cerrar sesión|lupa|clear|limpiar)(\b|$)/i.test(blob);
}

function isSafeProbeControl(ctrl) {
  if (!ctrl) return false;
  const kind = String(ctrl.controlKind || "");
  if (!kind) return false;
  if (isDangerousText([ctrl.label, ctrl.selector, ctrl.id, ctrl.name].join(" "))) return false;
  if (isNeverTouchControl(ctrl)) return false;
  if (/^(unknown)$/i.test(kind)) return false;
  if (/^(button|image-button)$/i.test(kind)) return false;
  return ["text-input", "textarea", "autocomplete", "datalist", "native-select", "checkbox", "radio"].includes(kind);
}

function normalizeSearchText(value) {
  return String(value == null ? "" : value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function findTargetSidebarCandidate(candidates, targetText) {
  const needle = normalizeSearchText(targetText);
  if (!needle) return null;
  const list = Array.isArray(candidates) ? candidates : [];
  return list.find((c) => {
    if (!c || isNeverTouchControl(c)) return false;
    const hay = normalizeSearchText([c.text, c.label, c.id, c.name].filter(Boolean).join(" "));
    return hay.includes(needle);
  }) || null;
}

function sampleProbeValue(ctrl, index) {
  const label = String((ctrl && ctrl.label) || (ctrl && ctrl.name) || (ctrl && ctrl.id) || "campo").replace(/\s+/g, " ").trim();
  const short = label.slice(0, 24).replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `prueba_${short || "campo"}_${index + 1}`;
}

function pickSelectOption(ctrl) {
  const options = Array.isArray(ctrl && ctrl.options) ? ctrl.options : [];
  const currentIndex = options.findIndex((o) => !!o.selected);
  for (const opt of options) {
    if (!opt || opt.disabled) continue;
    if (typeof opt.index !== "number") continue;
    if (opt.index !== currentIndex) return opt.index;
  }
  return -1;
}

async function probeControl(sessionId, ctrl, index) {
  const payload = {
    selector: ctrl.selector || "",
    id: ctrl.id || "",
    name: ctrl.name || "",
    controlKind: ctrl.controlKind || "",
    type: ctrl.type || "",
    sampleValue: sampleProbeValue(ctrl, index),
    selectIndex: pickSelectOption(ctrl),
    label: ctrl.label || ""
  };

  return execSync(sessionId, `
    const c = arguments[0] || {};
    const norm = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
    const selector = norm(c.selector || "");
    const id = norm(c.id || "");
    const kind = norm(c.controlKind || "").toLowerCase();
    const sampleValue = String(c.sampleValue || "prueba");
    const selectIndex = Number(c.selectIndex || -1);

    const findBySelector = () => {
      if (!selector) return null;
      try { return document.querySelector(selector); } catch (_e) { return null; }
    };

    let el = findBySelector();
    if (!el && id) el = document.getElementById(id);
    if (!el) return { ok: false, reason: "element_not_found", kind };

    const visible = (node) => {
      if (!node || !(node instanceof Element)) return false;
      const st = getComputedStyle(node);
      if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
      const r = node.getBoundingClientRect();
      return r.width > 3 && r.height > 3;
    };

    if (!visible(el)) return { ok: false, reason: "not_visible", kind };

    const before = {
      href: location.href,
      title: document.title || "",
      value: typeof el.value !== "undefined" ? el.value : null,
      checked: typeof el.checked !== "undefined" ? !!el.checked : null,
      selectedIndex: typeof el.selectedIndex === "number" ? el.selectedIndex : null
    };

    const fire = (node, type) => {
      try { node.dispatchEvent(new Event(type, { bubbles: true })); } catch (_e) { /* ignore */ }
    };

    let action = "noop";
    try {
      if (kind === "text-input" || kind === "textarea" || kind === "autocomplete" || kind === "datalist") {
        const original = el.value != null ? String(el.value) : "";
        el.focus();
        el.value = sampleValue;
        fire(el, "input");
        fire(el, "change");
        el.value = original;
        fire(el, "input");
        fire(el, "change");
        action = "filled_and_restored";
      } else if (kind === "native-select") {
        const originalIndex = typeof el.selectedIndex === "number" ? el.selectedIndex : -1;
        let nextIndex = selectIndex;
        if (nextIndex < 0 && el.options && el.options.length > 1) {
          nextIndex = originalIndex === 0 ? 1 : 0;
        }
        if (nextIndex >= 0 && el.options && el.options[nextIndex] && !el.options[nextIndex].disabled) {
          el.selectedIndex = nextIndex;
          fire(el, "change");
          el.selectedIndex = originalIndex;
          fire(el, "change");
          action = "select_and_restored";
        }
      } else if (kind === "checkbox") {
        const checked = !!el.checked;
        el.click();
        if (checked !== !!el.checked) el.click();
        action = "toggle_and_restored";
      } else if (kind === "radio") {
        const checked = !!el.checked;
        if (!checked) el.click();
        if (checked && !el.checked) el.click();
        action = "radio_checked";
      } else if (kind === "button") {
        el.click();
        action = "clicked";
      }
    } catch (e) {
      return { ok: false, reason: "probe_failed", detail: String((e && e.message) || e || ""), kind };
    }

    return {
      ok: true,
      kind,
      action,
      before,
      after: {
        href: location.href,
        title: document.title || "",
        value: typeof el.value !== "undefined" ? el.value : null,
        checked: typeof el.checked !== "undefined" ? !!el.checked : null,
        selectedIndex: typeof el.selectedIndex === "number" ? el.selectedIndex : null
      }
    };
  `, [payload]);
}

async function shouldProbeControlInDom(sessionId, ctrl) {
  const payload = {
    selector: ctrl && ctrl.selector ? ctrl.selector : "",
    id: ctrl && ctrl.id ? ctrl.id : ""
  };
  return execSync(sessionId, `
    const c = arguments[0] || {};
    const selector = String(c.selector || "").trim();
    const id = String(c.id || "").trim();
    let el = null;
    if (selector) {
      try { el = document.querySelector(selector); } catch (_e) { el = null; }
    }
    if (!el && id) el = document.getElementById(id);
    if (!el) return false;

    if (el.closest && el.closest("#webmatic-panel-root, [id^='MPW0024'], [id^='MPW0049'], [id^='MPW0071']")) return false;

    const r = el.getBoundingClientRect();
    if (r.top < 140) return false;
    if (r.left < 240 && r.top < 700) return false;
    const type = String(el.type || "").toLowerCase();
    if (type === "hidden") return false;
    return true;
  `, [payload]);
}

async function driveSafeNavigation(sessionId, log, opts = {}) {
  const maxCandidates = Number(opts.maxCandidates || 10);
  const waitAfterClickMs = Number(opts.waitAfterClickMs || 2500);
  const sidebarOnly = Boolean(opts.sidebarOnly);
  const inventorySrc = String(opts.inventorySrc || "");
  const maxSectionControls = Number(opts.maxSectionControls || 8);
  const targetSectionText = String(opts.targetSectionText || "");
  const currentPageOnly = Boolean(opts.currentPageOnly);
  const events = [];
  const sectionReports = [];

  const baseHandles = await getWindowHandles(sessionId);
  const baseHandle = baseHandles[0] || null;
  const baseLocation = await captureLocation(sessionId);
  const baseOrigin = (() => {
    try { return new URL(baseLocation.href).origin; } catch { return ""; }
  })();

  const rawCandidates = currentPageOnly ? [] : await collectSafeCandidates(sessionId, { sidebarOnly });
  const filteredCandidates = (Array.isArray(rawCandidates) ? rawCandidates : [])
    .filter((c) => {
      const joined = [c.text, c.href, c.id, c.name].filter(Boolean).join(" ");
      return !isDangerousText(joined) && !isNeverTouchControl(c);
    })
    .slice(0, maxCandidates);
  const targetCandidate = targetSectionText ? findTargetSidebarCandidate(filteredCandidates, targetSectionText) : null;
  const candidates = currentPageOnly
    ? [{ text: "current-form-page", id: "", name: "", href: "", strategy: { by: "text", value: "current-form-page" } }]
    : (targetCandidate ? [targetCandidate] : filteredCandidates);

  log(`Autodrive: candidatos seguros detectados=${candidates.length}${sidebarOnly ? " (sidebar-only)" : ""}${targetSectionText ? `; objetivo=${targetSectionText}` : ""}`);
  if (targetSectionText && !targetCandidate) {
    throw new Error(`No se encontró la sección objetivo del sidebar: ${targetSectionText}`);
  }

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const before = await captureLocation(sessionId);
    const beforeHandles = await getWindowHandles(sessionId);
    const event = {
      index: i,
      candidate: c,
      before,
      beforeHandles: beforeHandles.length,
      clicked: false,
      skipped: false,
      reason: "",
      after: null,
      afterHandles: beforeHandles.length
    };

    if (isDangerousText([c.text, c.href, c.id, c.name].join(" "))) {
      event.skipped = true;
      event.reason = "dangerous_text";
      log(`Autodrive step ${i + 1}/${candidates.length}: SKIP (dangerous_text) -> ${c.text || c.href || c.id || "sin-texto"}`);
      events.push(event);
      continue;
    }

    if (!currentPageOnly) {
      const clickRes = await clickCandidate(sessionId, c);
      if (!clickRes || !clickRes.ok) {
        event.skipped = true;
        event.reason = (clickRes && clickRes.reason) || "click_failed";
        log(`Autodrive step ${i + 1}/${candidates.length}: SKIP (${event.reason}) -> ${c.text || c.href || c.id || "sin-texto"}`);
        events.push(event);
        continue;
      }
      event.clicked = true;
      event.clickResult = clickRes;
      await sleep(waitAfterClickMs);
    } else {
      event.clicked = false;
      event.clickResult = { ok: true, mode: "current_page_only" };
    }

    const handlesAfter = await getWindowHandles(sessionId);
    event.afterHandles = handlesAfter.length;

    if (handlesAfter.length > beforeHandles.length && baseHandle) {
      const extra = handlesAfter.find((h) => !beforeHandles.includes(h));
      if (extra) {
        await switchToWindow(sessionId, extra);
        await sleep(700);
        const childLoc = await captureLocation(sessionId);
        event.newTab = childLoc;
        await closeCurrentWindow(sessionId);
        await switchToWindow(sessionId, baseHandle);
        await sleep(600);
      }
    }

    const after = await captureLocation(sessionId);
    event.after = after;
    events.push(event);
    const changed = before.href !== after.href;
    let sameOrigin = false;
    try {
      sameOrigin = new URL(after.href).origin === baseOrigin;
    } catch {
      sameOrigin = false;
    }

    let inventory = null;
    let sectionReport = null;
    try {
      inventory = await captureInventorySnapshot(sessionId, inventorySrc);
      sectionReport = {
        index: i,
        candidate: c,
        before,
        after,
        changed,
        inventory: summarizeInventory(inventory),
        probes: []
      };

      const rawProbeTargets = (Array.isArray(inventory && inventory.controls) ? inventory.controls : [])
        .filter((ctrl) => isSafeProbeControl(ctrl));
      const probeTargets = [];
      for (const ctrl of rawProbeTargets) {
        const okDom = await shouldProbeControlInDom(sessionId, ctrl);
        if (okDom) probeTargets.push(ctrl);
        if (probeTargets.length >= maxSectionControls) break;
      }

      log(`Sección ${i + 1}/${candidates.length}: ${c.text || c.href || c.id || "sin-texto"} | controles=${inventory.controlCount || 0} | tipos=${JSON.stringify(sectionReport.inventory.counts)}`);

      for (let p = 0; p < probeTargets.length; p++) {
        const ctrl = probeTargets[p];
        const probeBefore = await captureLocation(sessionId);
        const probe = await probeControl(sessionId, ctrl, p);
        const probeAfter = await captureLocation(sessionId);
        const probeChanged = probeBefore.href !== probeAfter.href || probeBefore.title !== probeAfter.title;
        const probeEntry = {
          selector: ctrl.selector || "",
          label: ctrl.label || "",
          kind: ctrl.controlKind || "",
          action: probe && probe.action ? probe.action : "noop",
          ok: !!(probe && probe.ok),
          reason: probe && probe.reason ? probe.reason : "",
          before: probeBefore,
          after: probeAfter,
          changed: probeChanged
        };
        sectionReport.probes.push(probeEntry);

        log(`  Probe ${p + 1}/${probeTargets.length}: ${probeEntry.kind} -> ${probeEntry.label || probeEntry.selector || "sin-label"}${probeChanged ? " [UI cambió]" : ""}`);

        if (probeChanged && sameOrigin) {
          await stepBack(sessionId);
          await sleep(1000);
          break;
        }
      }
    } catch (e) {
      sectionReport = sectionReport || {
        index: i,
        candidate: c,
        before,
        after,
        changed,
        inventory: null,
        probes: [],
        error: String((e && e.message) || e || "")
      };
      log(`Sección ${i + 1}/${candidates.length}: error de inventario/probe -> ${sectionReport.error}`);
    }

    if (sectionReport) sectionReports.push(sectionReport);

    log(`Autodrive step ${i + 1}/${candidates.length}: OK -> ${c.text || c.href || c.id || "sin-texto"} | before=${before.href} | after=${after.href}`);

    if (!currentPageOnly && changed && sameOrigin) {
      await stepBack(sessionId);
      await sleep(1200);
    }
  }

  return {
    baseLocation,
    baseHandles: baseHandles.length,
    candidates,
    events,
    sectionReports
  };
}

async function main() {
  const iaposUser = String(process.env.IAPOS_USER || "");
  const iaposPass = String(process.env.IAPOS_PASS || "");
  const log = makeSafeLogger({ secrets: [iaposUser, iaposPass] });

  const iaposUrl = String(process.env.IAPOS_URL || "https://www.santafe.gov.ar/iapos-www/servlet/uswbienvenido");
  const postLoginUrl = String(process.env.IAPOS_POST_LOGIN_URL || "https://www.santafe.gov.ar/iapos-www/servlet/uswnovedades");
  const loginWaitMs = Number(process.env.IAPOS_LOGIN_WAIT_MS || 90000);
  const settleWaitMs = Number(process.env.IAPOS_SETTLE_WAIT_MS || 10000);
  const recordWaitMs = Number(process.env.IAPOS_RECORD_WAIT_MS || 20000);
  const autodriveCandidates = Number(process.env.IAPOS_AUTODRIVE_CANDIDATES || 10);
  const autodriveWaitMs = Number(process.env.IAPOS_AUTODRIVE_WAIT_MS || 2500);
  const sidebarOnly = process.env.IAPOS_SIDEBAR_ONLY !== "0";
  const targetSectionText = String(process.env.IAPOS_TARGET_SECTION_TEXT || "Auditoria Autoriz");
  const targetSubSectionText = String(process.env.IAPOS_TARGET_SUBSECTION_TEXT || "Autorizaciones Auditoria Medica");
  const currentPageOnlyMode = process.env.IAPOS_CURRENT_PAGE_ONLY !== "0";
  const hybridManualCapture = process.env.IAPOS_HYBRID_MANUAL_CAPTURE === "1";
  const passiveObserveOnly = process.env.IAPOS_PASSIVE_OBSERVE_ONLY === "1";
  const inventorySrc = fs.readFileSync(INVENTORY_SRC_PATH, "utf8");

  if (passiveObserveOnly && !hybridManualCapture) {
    throw new Error("Modo pasivo requiere IAPOS_HYBRID_MANUAL_CAPTURE=1");
  }

  const firefoxPath = resolveFirefoxBinary({ log });
  const geckodriverPath = resolveGeckodriverBin();
  const zipPath = resolveZipBin();

  if (!firefoxPath || !geckodriverPath || !zipPath) {
    throw new Error("Faltan dependencias: firefox/geckodriver/zip");
  }

  log("Inicio sesión supervisada IAPOS real (modo seguro)");
  log("Regla de seguridad: NO hacer click en Autorizar/Guardar/Confirmar/Eliminar/Anular");
  log(`Sidebar-only=${sidebarOnly ? "1" : "0"}; settleWaitMs=${settleWaitMs}; targetSection=${targetSectionText}; targetSubSection=${targetSubSectionText}; currentPageOnly=${currentPageOnlyMode ? "1" : "0"}; hybridManualCapture=${hybridManualCapture ? "1" : "0"}; passiveObserveOnly=${passiveObserveOnly ? "1" : "0"}`);

  let gecko;
  let sessionId = null;
  let tempDir = null;

  try {
    const xpi = buildTemporaryXpi(zipPath);
    tempDir = xpi.tempDir;

    gecko = startGeckodriver(geckodriverPath, log);
    await gecko.ready;

    const sessionResp = await wdRequest("POST", "/session", {
      capabilities: {
        alwaysMatch: {
          browserName: "firefox",
          acceptInsecureCerts: true,
          "moz:firefoxOptions": {
            args: [],
            binary: firefoxPath,
            prefs: {
              "xpinstall.signatures.required": false,
              "extensions.autoDisableScopes": 0,
              "extensions.enabledScopes": 15
            }
          }
        }
      }
    });

    sessionId = getSessionId(sessionResp);
    if (!sessionId) throw new Error("No se pudo obtener sessionId");

    await wdRequest("POST", `/session/${sessionId}/moz/addon/install`, {
      path: xpi.xpiPath,
      temporary: true
    });

    await wdRequest("POST", `/session/${sessionId}/url`, { url: iaposUrl });
    log(`Firefox abierto en IAPOS: ${iaposUrl}`);

    if (iaposUser && iaposPass) {
      await sleep(1200);
      await tryAutoLogin(sessionId, iaposUser, iaposPass, log);
      log(`Esperando autenticación real (${Math.ceil(loginWaitMs / 1000)}s max).`);

      const auth = await waitForLoggedIn(sessionId, loginWaitMs);
      if (!auth.ok) {
        const diag = await captureLoginFailureDiagnostics(sessionId);
        throw new Error(`Login automático no confirmado dentro del timeout; no se inicia grabación. DIAG=${JSON.stringify(diag)}`);
      }
      log(`Login confirmado en URL: ${auth.state.href}`);
    } else {
      log(`Tienes ${Math.ceil(loginWaitMs / 1000)}s para loguearte manualmente.`);
      await waitCountdown(loginWaitMs, "Login manual", log);

      const auth = await waitForLoggedIn(sessionId, 7000);
      if (!auth.ok) {
        throw new Error("No se detectó sesión autenticada tras login manual; no se inicia grabación.");
      }
      log(`Login manual confirmado en URL: ${auth.state.href}`);
    }

    await navigateToUrl(sessionId, postLoginUrl);
    await sleep(1200);
    log(`Navegación post-login a: ${postLoginUrl}`);

    if (settleWaitMs > 0) {
      log(`Esperando acomodo de interfaz (${Math.ceil(settleWaitMs / 1000)}s).`);
      await waitCountdown(settleWaitMs, "Acomodando interfaz", log);
    }

    if (sidebarOnly && !passiveObserveOnly) {
      const primed = await prepareSidebarMenu(sessionId);
      log(`Sidebar preparado: ${JSON.stringify(primed)}`);
      await sleep(1000);

      const sidebarPath = [targetSectionText, targetSubSectionText].filter(Boolean);
      if (sidebarPath.length > 0) {
        await openSidebarPath(sessionId, sidebarPath, log);
      }
    }

    let panelCheck = { hasPanel: false };
    let startedRecording = { ok: false };
    if (!passiveObserveOnly) {
      panelCheck = await execSync(sessionId, `
        const panel = document.getElementById("webmatic-panel-root");
        if (panel) panel.style.display = "block";
        return {
          hasPanel: !!panel,
          title: document.title || "",
          href: location.href
        };
      `);

      if (!panelCheck || !panelCheck.hasPanel) {
        throw new Error("No se detectó panel WebMatic en la página real actual");
      }

      startedRecording = await execSync(sessionId, `
        const panel = document.getElementById("webmatic-panel-root");
        const btn = panel && panel.querySelector("[data-action='record-toggle'][data-record-btn]");
        if (!btn) return { ok: false, reason: "record_btn_missing" };
        btn.click();
        return { ok: true };
      `);

      if (!startedRecording || !startedRecording.ok) {
        throw new Error(`No se pudo iniciar grabación: ${JSON.stringify(startedRecording)}`);
      }

      log("Grabación activa. Iniciando autodrive seguro de menús y navegación.");
    } else {
      log("Modo pasivo activo: no se realizarán clics automáticos ni control del panel.");
    }

    if (hybridManualCapture) {
      await startManualInteractionCapture(sessionId, inventorySrc);
      log("Captura híbrida manual iniciada: tus clics/cambios se registrarán en el artefacto.");
    }

    const autodrive = passiveObserveOnly
      ? {
        mode: "passive_observe_only",
        baseLocation: await captureLocation(sessionId),
        baseHandles: (await getWindowHandles(sessionId)).length,
        candidates: [],
        events: [],
        sectionReports: []
      }
      : await driveSafeNavigation(sessionId, log, {
        maxCandidates: autodriveCandidates,
        waitAfterClickMs: autodriveWaitMs,
        sidebarOnly,
        inventorySrc,
        maxSectionControls: Number(process.env.IAPOS_SECTION_CONTROL_LIMIT || 8),
        targetSectionText,
        currentPageOnly: currentPageOnlyMode
      });

    let manualCapture = { ok: false, events: [], pages: [] };

    if (passiveObserveOnly) {
      log("Modo pasivo: sin límite de tiempo. Cierra Firefox cuando termines de interactuar.");
      manualCapture = await waitForPassiveSessionEnd(sessionId, log, { pollMs: 1500 });
    } else {
      if (recordWaitMs > 0) {
        log(`Ventana adicional de grabación pasiva: ${Math.ceil(recordWaitMs / 1000)}s.`);
        await waitCountdown(recordWaitMs, "Ventana de grabación", log);
      }

      if (hybridManualCapture) {
        manualCapture = await readManualInteractionCapture(sessionId, true);
        log(`Captura híbrida manual finalizada: eventos=${Array.isArray(manualCapture.events) ? manualCapture.events.length : 0}`);
      }
    }

    let stoppedRecording = { ok: false, reason: "passive_mode" };
    let macroName = null;

    if (!passiveObserveOnly) {
      stoppedRecording = await execSync(sessionId, `
        const panel = document.getElementById("webmatic-panel-root");
        const btn = panel && panel.querySelector("[data-action='record-toggle'][data-record-btn]");
        if (!btn) return { ok: false, reason: "record_btn_missing" };
        btn.click();
        return { ok: true };
      `);

      if (!stoppedRecording || !stoppedRecording.ok) {
        throw new Error(`No se pudo detener grabación: ${JSON.stringify(stoppedRecording)}`);
      }

      macroName = `IAPOS supervised ${Date.now()}`;
      await execSync(sessionId, `
        const panel = document.getElementById("webmatic-panel-root");
        const save = panel && panel.querySelector("[data-action='script-editor-save']");
        if (save) save.click();
        return true;
      `);

      await execSync(sessionId, `
        const panel = document.getElementById("webmatic-panel-root");
        const input = panel && panel.querySelector("[data-wm-input]");
        const ok = panel && panel.querySelector("[data-wm-ok]");
        if (input && ok) {
          input.value = arguments[0];
          input.dispatchEvent(new Event("input", { bubbles: true }));
          ok.click();
        }
        return true;
      `, [macroName]);
    }

    let tech = {
      url: "",
      title: "",
      hasInventoryApi: false,
      controlCount: 0,
      sampleControls: []
    };

    if (!passiveObserveOnly) {
      tech = await execSync(sessionId, `
        ${inventorySrc}
        const api = (typeof globalThis !== "undefined" && globalThis.WebMaticPageInventory) || window.WebMaticPageInventory;
        const snap = api ? api.captureInventory(document) : null;
        const controls = Array.isArray(snap && snap.controls) ? snap.controls : [];
        return {
          url: location.href,
          title: document.title || "",
          hasInventoryApi: !!api,
          controlCount: controls.length,
          sampleControls: controls.slice(0, 30).map((c) => ({
            selector: c.selector || "",
            tagName: c.tagName || "",
            type: c.type || "",
            controlKind: c.controlKind || "",
            label: c.label || ""
          }))
        };
      `);
    } else if (manualCapture && Array.isArray(manualCapture.pages) && manualCapture.pages.length > 0) {
      const last = manualCapture.pages[manualCapture.pages.length - 1];
      const ctrls = Array.isArray(last.controls) ? last.controls : [];
      tech = {
        url: last.url || "",
        title: last.title || "",
        hasInventoryApi: !!last.hasInventoryApi,
        controlCount: Number(last.controlCount || ctrls.length || 0),
        sampleControls: ctrls.slice(0, 30).map((c) => ({
          selector: c.selector || "",
          tagName: c.tagName || c.tag || "",
          type: c.type || "",
          controlKind: c.controlKind || "",
          label: c.label || ""
        }))
      };
    }

    const stamp = Date.now();
    const outFile = path.join(PRIVATE_ARTIFACTS, `iapos-supervised-session-${stamp}.json`);
    fs.mkdirSync(PRIVATE_ARTIFACTS, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({
      generatedAt: new Date().toISOString(),
      iaposUrl,
      postLoginUrl,
      macroName,
      loginWaitMs,
      settleWaitMs,
      recordWaitMs,
      autodriveCandidates,
      autodriveWaitMs,
      sidebarOnly,
      targetSectionText,
      targetSubSectionText,
      currentPageOnlyMode,
      hybridManualCapture,
      passiveObserveOnly,
      manualCapture,
      telemetry: tech,
      autodrive
    }, null, 2), "utf8");

    log(`OK: sesión supervisada finalizada. Artefacto: ${outFile}`);
  } finally {
    try {
      if (sessionId) await wdRequest("DELETE", `/session/${sessionId}`);
    } catch {
      // ignore
    }

    if (gecko) await gecko.stop();

    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[supervised-iapos] FAIL", e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
