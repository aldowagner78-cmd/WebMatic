(function () {
  "use strict";

  // ── Paletas completas (igual que THEME_PALETTES en ui-shell.js) ─────────
  var PALETTES = {
    light: [
      { accent:"#059669", accentFg:"#ffffff", accentDark:"#047857", accentBg:"#ecfdf5", accentMid:"#d1fae5", surface:"#f0fdf4", surface2:"#dcfce7", card:"#ffffff", border:"#a7f3d0", text:"#064e3b", textMuted:"#065f46", hdrFrom:"#065f46", hdrTo:"#10b981", hdrText:"#ffffff" },
      { accent:"#0284c7", accentFg:"#ffffff", accentDark:"#075985", accentBg:"#e0f2fe", accentMid:"#bae6fd", surface:"#f0f9ff", surface2:"#e0f2fe", card:"#ffffff", border:"#7dd3fc", text:"#0c4a6e", textMuted:"#075985", hdrFrom:"#0c4a6e", hdrTo:"#0ea5e9", hdrText:"#ffffff" },
      { accent:"#7c3aed", accentFg:"#ffffff", accentDark:"#4c1d95", accentBg:"#ede9fe", accentMid:"#ddd6fe", surface:"#faf5ff", surface2:"#ede9fe", card:"#ffffff", border:"#c4b5fd", text:"#3b0764", textMuted:"#4c1d95", hdrFrom:"#4c1d95", hdrTo:"#8b5cf6", hdrText:"#ffffff" },
      { accent:"#dc2626", accentFg:"#ffffff", accentDark:"#991b1b", accentBg:"#fee2e2", accentMid:"#fecaca", surface:"#fef2f2", surface2:"#fee2e2", card:"#ffffff", border:"#fca5a5", text:"#7f1d1d", textMuted:"#991b1b", hdrFrom:"#7f1d1d", hdrTo:"#ef4444", hdrText:"#ffffff" }
    ],
    dark: [
      { accent:"#34d399", accentFg:"#022c22", accentDark:"#059669", accentBg:"#065f46", accentMid:"#047857", surface:"#022c22", surface2:"#064e3b", card:"#064e3b", border:"#047857", text:"#d1fae5", textMuted:"#6ee7b7", hdrFrom:"#022c22", hdrTo:"#065f46", hdrText:"#a7f3d0" },
      { accent:"#38bdf8", accentFg:"#0c1a2e", accentDark:"#0284c7", accentBg:"#0c4a6e", accentMid:"#075985", surface:"#0c1a2e", surface2:"#0c2d4a", card:"#0c2d4a", border:"#0369a1", text:"#e0f2fe", textMuted:"#7dd3fc", hdrFrom:"#0c1a2e", hdrTo:"#0c4a6e", hdrText:"#bae6fd" },
      { accent:"#a78bfa", accentFg:"#1e1b2e", accentDark:"#7c3aed", accentBg:"#2e1065", accentMid:"#4c1d95", surface:"#1e1b2e", surface2:"#2d1b69", card:"#2d1b69", border:"#4c1d95", text:"#ede9fe", textMuted:"#c4b5fd", hdrFrom:"#1e1b2e", hdrTo:"#4c1d95", hdrText:"#ddd6fe" },
      { accent:"#f87171", accentFg:"#2a1515", accentDark:"#dc2626", accentBg:"#7f1d1d", accentMid:"#991b1b", surface:"#2a1515", surface2:"#450a0a", card:"#450a0a", border:"#991b1b", text:"#fee2e2", textMuted:"#fca5a5", hdrFrom:"#2a1515", hdrTo:"#7f1d1d", hdrText:"#fecaca" }
    ]
  };

  function applyPalette(p) {
    var r = document.documentElement.style;
    r.setProperty("--accent",      p.accent);
    r.setProperty("--accent-fg",   p.accentFg);
    r.setProperty("--accent-dark", p.accentDark);
    r.setProperty("--accent-bg",   p.accentBg);
    r.setProperty("--accent-mid",  p.accentMid);
    r.setProperty("--surface",     p.surface);
    r.setProperty("--surface-2",   p.surface2);
    r.setProperty("--card",        p.card);
    r.setProperty("--border",      p.border);
    r.setProperty("--text",        p.text);
    r.setProperty("--text-muted",  p.textMuted);
    r.setProperty("--hdr-from",    p.hdrFrom);
    r.setProperty("--hdr-to",      p.hdrTo);
    r.setProperty("--hdr-text",    p.hdrText);
  }

  function resolveAndApply(themeMode, themeVariant) {
    var mode    = (themeMode === "dark") ? "dark" : "light";
    var idx     = (typeof themeVariant === "number" && themeVariant >= 1 && themeVariant <= 4)
                  ? (themeVariant - 1) : 0;
    applyPalette(PALETTES[mode][idx]);
    if (mode === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  // ── Lee el tema desde chrome.storage.local ────────────────────────────
  function loadTheme() {
    try {
      chrome.storage.local.get(["webmaticHelpTheme", "webmaticSettings"], function (result) {
        var theme = result.webmaticHelpTheme || null;
        if (!theme && result.webmaticSettings) {
          theme = {
            themeMode:    result.webmaticSettings.themeMode    || "light",
            themeVariant: result.webmaticSettings.themeVariant || 1
          };
        }
        if (theme) { resolveAndApply(theme.themeMode, theme.themeVariant); }
        document.body.classList.remove("wm-loading");
        document.body.classList.add("wm-ready");
      });
    } catch (e) {
      document.body.classList.remove("wm-loading");
      document.body.classList.add("wm-ready");
    }
  }

  loadTheme();

  // ── Smooth scroll + active sidebar link ──────────────────────────────
  var navLinks = document.querySelectorAll("#wm-sidebar a[data-sec]");
  var sections = document.querySelectorAll(".wm-section[id]");

  navLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      navLinks.forEach(function (l) { l.classList.remove("active"); });
      link.classList.add("active");
    });
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var id = entry.target.id;
        navLinks.forEach(function (l) {
          l.classList.toggle("active", l.dataset.sec === id);
        });
      }
    });
  }, { rootMargin: "-56px 0px -60% 0px", threshold: 0 });

  sections.forEach(function (sec) { observer.observe(sec); });

  // ── Back to top ───────────────────────────────────────────────────────
  var topBtn = document.getElementById("wm-top-btn");

  window.addEventListener("scroll", function () {
    topBtn.classList.toggle("visible", window.scrollY > 300);
  }, { passive: true });

  topBtn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Primer ítem activo
  if (navLinks.length > 0) { navLinks[0].classList.add("active"); }

}());
