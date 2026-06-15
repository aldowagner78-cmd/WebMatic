/**
 * Tests unitarios para iim-adapter.js — exportToIim / importFromIim
 * Cubre: tipos estándar, round-trip con WM_JSON, tipos extendidos, backward-compat.
 */
const test  = require("node:test");
const assert = require("node:assert/strict");

// iim-adapter usa globalThis/window — polyfill mínimo para Node
const G = global;
G.globalThis = G;

require("../../../../src/modules/storage/iim-adapter.js");
const adapter = G.WebMaticIimAdapter;

// ── Helpers ──────────────────────────────────────────────────────────────────
function roundTrip(steps) {
  const script = adapter.exportToIim({ steps });
  return adapter.importFromIim(script).steps;
}

// ── Tipos estándar ────────────────────────────────────────────────────────────

test("exportToIim: emite encabezado VERSION y TAB", () => {
  const script = adapter.exportToIim({ steps: [] });
  assert.ok(script.includes("VERSION BUILD=1000"));
  assert.ok(script.includes("TAB T=1"));
});

test("exportToIim: navigate genera NAVIGATE URL", () => {
  const script = adapter.exportToIim({ steps: [{ type: "navigate", url: "https://test.com" }] });
  assert.ok(script.includes('NAVIGATE URL="https://test.com"'));
});

test("exportToIim: click genera CLICK SELECTOR", () => {
  const script = adapter.exportToIim({ steps: [{ type: "click", selector: "#btn" }] });
  assert.ok(script.includes('CLICK SELECTOR="#btn"'));
});

test("exportToIim: input genera TYPE CONTENT", () => {
  const script = adapter.exportToIim({ steps: [{ type: "input", selector: "#n", value: "Juan" }] });
  assert.ok(script.includes('TYPE SELECTOR="#n" CONTENT="Juan"'));
});

test("exportToIim: check genera CHECK CHECKED", () => {
  const script = adapter.exportToIim({ steps: [{ type: "check", selector: "#ok", checked: true }] });
  assert.ok(script.includes('CHECK SELECTOR="#ok" CHECKED="true"'));
});

test("exportToIim: wait genera WAIT SECONDS", () => {
  const script = adapter.exportToIim({ steps: [{ type: "wait", seconds: 3 }] });
  assert.ok(script.includes("WAIT SECONDS=3"));
});

test("exportToIim: extract genera EXTRACT VAR", () => {
  const script = adapter.exportToIim({ steps: [{ type: "extract", selector: "#precio", variable: "PRECIO" }] });
  assert.ok(script.includes('EXTRACT SELECTOR="#precio" VAR="PRECIO"'));
});

test("exportToIim: key genera KEY CODE", () => {
  const script = adapter.exportToIim({ steps: [{ type: "key", key: "Enter" }] });
  assert.ok(script.includes('KEY CODE="Enter"'));
});

// ── WM_JSON — round-trip lossless ─────────────────────────────────────────────

test("exportToIim: embebe comentario WM_JSON cuando hay pasos", () => {
  const script = adapter.exportToIim({ steps: [{ type: "navigate", url: "x" }] });
  assert.ok(script.includes("// WM_JSON:"));
});

test("exportToIim: NO embebe WM_JSON si steps esta vacio", () => {
  const script = adapter.exportToIim({ steps: [] });
  assert.ok(!script.includes("WM_JSON"));
});

test("exportToIim: el JSON embebido es parseable y contiene los pasos", () => {
  const steps = [{ type: "navigate", url: "https://a.com" }, { type: "click", selector: "#x" }];
  const script = adapter.exportToIim({ steps });
  const line = script.split("\n").find((l) => l.startsWith("// WM_JSON:"));
  assert.ok(line, "debe existir linea WM_JSON");
  const parsed = JSON.parse(line.slice("// WM_JSON:".length));
  assert.equal(parsed.version, 2);
  assert.equal(parsed.steps.length, 2);
});

test("importFromIim: usa WM_JSON como fuente autoritativa ignorando IIM", () => {
  // Script con WM_JSON que tiene 3 pasos pero IIM tiene solo 1 CLICK
  const fakeScript = [
    "VERSION BUILD=1000",
    "TAB T=1",
    '// WM_JSON:{"version":2,"steps":[{"type":"navigate","url":"x"},{"type":"click","selector":"#a"},{"type":"wait","seconds":2}]}',
    'CLICK SELECTOR="#a"'
  ].join("\n");
  const { steps } = adapter.importFromIim(fakeScript);
  assert.equal(steps.length, 3); // toma del JSON, no del IIM
  assert.equal(steps[0].type, "navigate");
  assert.equal(steps[2].type, "wait");
});

test("importFromIim: cae al parser IIM si WM_JSON esta malformado", () => {
  const badScript = [
    "VERSION BUILD=1000",
    "TAB T=1",
    '// WM_JSON:{invalid json!!!}',
    'CLICK SELECTOR="#fallback"'
  ].join("\n");
  const { steps } = adapter.importFromIim(badScript);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].selector, "#fallback");
});

test("importFromIim: parser legacy ignora lineas que comienzan con //", () => {
  const script = [
    "VERSION BUILD=1000",
    "TAB T=1",
    '// este es un comentario',
    'CLICK SELECTOR="#real"'
  ].join("\n");
  const { steps } = adapter.importFromIim(script);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].selector, "#real");
});

test("importFromIim: parser legacy reconoce // WAIT_FOR como paso ejecutable", () => {
  const script = [
    "VERSION BUILD=1000",
    "TAB T=1",
    '// WAIT_FOR SELECTOR="#nombre" TIMEOUT=7500',
    'TYPE SELECTOR="#nombre" CONTENT="Juan"'
  ].join("\n");
  const { steps } = adapter.importFromIim(script);
  assert.equal(steps.length, 2);
  assert.equal(steps[0].type, "wait_for");
  assert.equal(steps[0].selector, "#nombre");
  assert.equal(steps[0].timeout, 7500);
  assert.equal(steps[1].type, "input");
});

test("importFromIim: parser legacy reconoce comentarios extendidos exportados por WebMatic", () => {
  const script = [
    "VERSION BUILD=1000",
    "TAB T=1",
    '// HOVER SELECTOR="#menu"',
    '// SET VAR="X" VALUE="42"',
    '// DRAG_DROP FROM="#a" TO="#b"',
    '// PROMPT LABEL="Codigo" VAR="COD"',
    '// CALL_MACRO NAME="Login"'
  ].join("\n");
  const { steps } = adapter.importFromIim(script);
  assert.equal(steps.length, 5);
  assert.equal(steps[0].type, "hover");
  assert.equal(steps[1].type, "set_variable");
  assert.equal(steps[1].variable, "X");
  assert.equal(steps[2].type, "drag_drop");
  assert.equal(steps[3].type, "prompt");
  assert.equal(steps[4].type, "call_macro");
});

test("importFromIim: parser legacy reconoce placeholders de bloques complejos", () => {
  const script = [
    "VERSION BUILD=1000",
    "TAB T=1",
    '// IF_EXISTS SELECTOR="#alert" THEN=2 ELSE=1',
    '// LOOP_UNTIL SELECTOR="#spinner" CONDITION="exists" MAX=7',
    "// TRY_FALLBACK STEPS=2 FALLBACK=1",
    '// FOR_EACH_ROW COLUMNS="NOMBRE,CIUDAD" ROWS=3'
  ].join("\n");

  const { steps } = adapter.importFromIim(script);
  assert.equal(steps.length, 4);

  assert.equal(steps[0].type, "if_exists");
  assert.equal(steps[0].selector, "#alert");
  assert.deepEqual(steps[0].then, []);
  assert.deepEqual(steps[0].else, []);

  assert.equal(steps[1].type, "loop_until");
  assert.equal(steps[1].selector, "#spinner");
  assert.equal(steps[1].condition, "exists");
  assert.equal(steps[1].max_iterations, 7);
  assert.deepEqual(steps[1].steps, []);

  assert.equal(steps[2].type, "try_fallback");
  assert.deepEqual(steps[2].steps, []);
  assert.deepEqual(steps[2].fallback, []);

  assert.equal(steps[3].type, "for_each_row");
  assert.deepEqual(steps[3].columns, ["NOMBRE", "CIUDAD"]);
  assert.deepEqual(steps[3].dataset, []);
  assert.deepEqual(steps[3].steps, []);
});

// ── Round-trip de tipos extendidos ────────────────────────────────────────────

test("round-trip: wait_for sobrevive export/import", () => {
  const steps = [{ type: "wait_for", selector: "#resultado", timeout: 5000 }];
  const rt = roundTrip(steps);
  assert.equal(rt.length, 1);
  assert.equal(rt[0].type, "wait_for");
  assert.equal(rt[0].selector, "#resultado");
  assert.equal(rt[0].timeout, 5000);
});

test("round-trip: set_variable sobrevive export/import", () => {
  const steps = [{ type: "set_variable", variable: "TOTAL", value: "{{!A}} + {{!B}}" }];
  const rt = roundTrip(steps);
  assert.equal(rt[0].type, "set_variable");
  assert.equal(rt[0].variable, "TOTAL");
  assert.equal(rt[0].value, "{{!A}} + {{!B}}");
});

test("round-trip: prompt sobrevive export/import", () => {
  const steps = [{ type: "prompt", label: "¿RUT?", variable: "RUT", default: "" }];
  const rt = roundTrip(steps);
  assert.equal(rt[0].type, "prompt");
  assert.equal(rt[0].label, "¿RUT?");
  assert.equal(rt[0].variable, "RUT");
});

test("round-trip: call_macro sobrevive export/import con sus pasos", () => {
  const steps = [{
    type: "call_macro",
    macro_name: "Login",
    steps: [{ type: "click", selector: "#btn" }]
  }];
  const rt = roundTrip(steps);
  assert.equal(rt[0].type, "call_macro");
  assert.equal(rt[0].macro_name, "Login");
  assert.equal(rt[0].steps.length, 1);
});

test("round-trip: for_each_row sobrevive export/import con dataset completo", () => {
  const steps = [{
    type: "for_each_row",
    columns: ["NOMBRE", "RUT"],
    dataset: [["Ana", "12.345.678-9"], ["Luis", "98.765.432-1"]],
    steps: [{ type: "input", selector: "#n", value: "{{!NOMBRE}}" }]
  }];
  const rt = roundTrip(steps);
  assert.equal(rt[0].type, "for_each_row");
  assert.equal(rt[0].dataset.length, 2);
  assert.deepEqual(rt[0].columns, ["NOMBRE", "RUT"]);
  assert.equal(rt[0].steps[0].value, "{{!NOMBRE}}");
});

test("round-trip: if_exists con ramas then/else sobrevive export/import", () => {
  const steps = [{
    type: "if_exists",
    selector: "#modal",
    then: [{ type: "click", selector: "#cerrar" }],
    else:  [{ type: "navigate", url: "https://x.com" }]
  }];
  const rt = roundTrip(steps);
  assert.equal(rt[0].type, "if_exists");
  assert.equal(rt[0].then.length, 1);
  assert.equal(rt[0].else.length, 1);
  assert.equal(rt[0].then[0].selector, "#cerrar");
});

test("round-trip: macro mixta (estandar + extendida) conserva todos los pasos", () => {
  const steps = [
    { type: "navigate", url: "https://app.com" },
    { type: "wait_for", selector: "#content" },
    { type: "set_variable", variable: "INICIO", value: "ok" },
    { type: "click", selector: "#submit" },
    { type: "prompt", label: "Código:", variable: "COD" },
    { type: "for_each_row", columns: ["X"], dataset: [["1"]], steps: [] }
  ];
  const rt = roundTrip(steps);
  assert.equal(rt.length, 6);
  assert.equal(rt[0].type, "navigate");
  assert.equal(rt[1].type, "wait_for");
  assert.equal(rt[4].type, "prompt");
  assert.equal(rt[5].type, "for_each_row");
});

test("round-trip: el campo _ts interno NO aparece en el JSON exportado", () => {
  const steps = [{ type: "click", selector: "#x", _ts: 1234567890 }];
  const script = adapter.exportToIim({ steps });
  const line = script.split("\n").find((l) => l.startsWith("// WM_JSON:"));
  const parsed = JSON.parse(line.slice("// WM_JSON:".length));
  assert.ok(!("_ts" in parsed.steps[0]), "_ts no debe aparecer en el JSON");
});

// ── Backward compat: IIM sin WM_JSON ─────────────────────────────────────────

test("importFromIim: script legacy sin WM_JSON parsea correctamente", () => {
  const legacy = [
    "VERSION BUILD=1000",
    "TAB T=1",
    'NAVIGATE URL="https://old.com"',
    'CLICK SELECTOR="#id"',
    'TYPE SELECTOR="#name" CONTENT="Hola"',
    "WAIT SECONDS=2",
    'EXTRACT SELECTOR="#result" VAR="RES"'
  ].join("\n");
  const { steps } = adapter.importFromIim(legacy);
  assert.equal(steps.length, 5);
  assert.equal(steps[0].url, "https://old.com");
  assert.equal(steps[2].value, "Hola");
  assert.equal(steps[4].variable, "RES");
});

// ── choose_option (IIM CHOOSE_OPTION) ────────────────────────────────────────

test("exportToIim: choose_option con value genera CHOOSE_OPTION VALUE", () => {
  const script = adapter.exportToIim({ steps: [{ type: "choose_option", selector: "#pais", value: "br" }] });
  assert.ok(script.includes('CHOOSE_OPTION SELECTOR="#pais" VALUE="br"'));
});

test("exportToIim: choose_option con text genera CHOOSE_OPTION TEXT", () => {
  const script = adapter.exportToIim({ steps: [{ type: "choose_option", selector: "#pais", text: "Brasil" }] });
  assert.ok(script.includes('CHOOSE_OPTION SELECTOR="#pais" TEXT="Brasil"'));
});

test("importFromIim: CHOOSE_OPTION legacy con VALUE parsea", () => {
  const legacy = [
    "VERSION BUILD=1000",
    "TAB T=1",
    'CHOOSE_OPTION SELECTOR="#pais" VALUE="br"'
  ].join("\n");
  const { steps } = adapter.importFromIim(legacy);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].type, "choose_option");
  assert.equal(steps[0].selector, "#pais");
  assert.equal(steps[0].value, "br");
});

test("importFromIim: CHOOSE_OPTION legacy con TEXT parsea", () => {
  const legacy = [
    "VERSION BUILD=1000",
    "TAB T=1",
    'CHOOSE_OPTION SELECTOR="#pais" TEXT="Brasil"'
  ].join("\n");
  const { steps } = adapter.importFromIim(legacy);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].type, "choose_option");
  assert.equal(steps[0].text, "Brasil");
});

test("round-trip: choose_option con value + text + variable sin pérdida (IIM + WM_JSON)", () => {
  const steps = [{ type: "choose_option", selector: "#pais", value: "br", text: "Brasil", variable: "PAIS" }];
  const rt = roundTrip(steps);
  assert.equal(rt.length, 1);
  assert.equal(rt[0].type, "choose_option");
  assert.equal(rt[0].selector, "#pais");
  assert.equal(rt[0].value, "br");
  assert.equal(rt[0].text, "Brasil");
  assert.equal(rt[0].variable, "PAIS");
});

test("exportToIim: open_tab genera OPEN_TAB", () => {
  const script = adapter.exportToIim({ steps: [{ type: "open_tab", url: "https://example.com/new", activate: "true" }] });
  assert.ok(script.includes('OPEN_TAB URL="https://example.com/new" ACTIVATE="true"'));
});

test("exportToIim: switch_tab genera SWITCH_TAB", () => {
  const script = adapter.exportToIim({ steps: [{ type: "switch_tab", url: "https://example.com", openIfMissing: "false" }] });
  assert.ok(script.includes('SWITCH_TAB URL="https://example.com" OPEN_IF_MISSING="false"'));
});

test("exportToIim: close_tab genera CLOSE_TAB", () => {
  const script = adapter.exportToIim({ steps: [{ type: "close_tab", target: "match_url", url: "https://example.com/x" }] });
  assert.ok(script.includes('CLOSE_TAB TARGET="match_url" URL="https://example.com/x"'));
});

test("importFromIim: OPEN_TAB legacy parsea", () => {
  const legacy = [
    "VERSION BUILD=1000",
    "TAB T=1",
    'OPEN_TAB URL="https://example.com/new" ACTIVATE="false"'
  ].join("\n");
  const { steps } = adapter.importFromIim(legacy);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].type, "open_tab");
  assert.equal(steps[0].url, "https://example.com/new");
  assert.equal(steps[0].activate, "false");
});

test("importFromIim: SWITCH_TAB legacy parsea", () => {
  const legacy = [
    "VERSION BUILD=1000",
    "TAB T=1",
    'SWITCH_TAB URL="https://example.com" OPEN_IF_MISSING="true"'
  ].join("\n");
  const { steps } = adapter.importFromIim(legacy);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].type, "switch_tab");
  assert.equal(steps[0].url, "https://example.com");
  assert.equal(steps[0].openIfMissing, "true");
});

test("importFromIim: CLOSE_TAB legacy parsea", () => {
  const legacy = [
    "VERSION BUILD=1000",
    "TAB T=1",
    'CLOSE_TAB TARGET="current"'
  ].join("\n");
  const { steps } = adapter.importFromIim(legacy);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].type, "close_tab");
  assert.equal(steps[0].target, "current");
});

// ── WM_JSON meta.pageInventories persistence ───────────────────────────────

test("exportToIim: WM_JSON conserva meta.pageInventories", () => {
  const macro = {
    steps: [{ type: "choose_option", selector: "#filtro-modalidad", value: "1" }],
    meta: {
      pageInventories: [{
        url: "https://example.com/",
        title: "Fixture",
        capturedAt: 111,
        controls: [{
          selector: "#filtro-modalidad",
          controlKind: "native-select",
          options: [{ index: 0, value: "1", text: "Ambulatorio" }]
        }]
      }]
    }
  };
  const script = adapter.exportToIim(macro);
  const line = script.split("\n").find((l) => l.startsWith("// WM_JSON:"));
  const parsed = JSON.parse(line.slice("// WM_JSON:".length));
  assert.ok(parsed.meta);
  assert.ok(Array.isArray(parsed.meta.pageInventories));
  assert.equal(parsed.meta.pageInventories[0].controls[0].selector, "#filtro-modalidad");
});

test("importFromIim: devuelve {steps, meta} cuando WM_JSON contiene meta", () => {
  const script = [
    "VERSION BUILD=1000",
    "TAB T=1",
    '// WM_JSON:{"version":2,"steps":[{"type":"click","selector":"#x"}],"meta":{"pageInventories":[{"url":"u","controls":[{"selector":"#x"}]}]}}',
    'CLICK SELECTOR="#x"'
  ].join("\n");
  const out = adapter.importFromIim(script);
  assert.equal(out.steps.length, 1);
  assert.ok(out.meta);
  assert.equal(out.meta.pageInventories[0].controls[0].selector, "#x");
});

test("round-trip IIM: conserva meta.pageInventories", () => {
  const macro = {
    steps: [{ type: "click", selector: "#x" }],
    meta: {
      pageInventories: [{
        url: "u",
        controls: [{ selector: "#x", options: [{ index: 0, value: "A", text: "A" }] }]
      }]
    }
  };
  const script = adapter.exportToIim(macro);
  const out = adapter.importFromIim(script);
  assert.equal(out.steps.length, 1);
  assert.ok(out.meta);
  assert.equal(out.meta.pageInventories[0].controls[0].selector, "#x");
});

test("importFromIim: compat con WM_JSON antiguo como array de steps", () => {
  const script = [
    "VERSION BUILD=1000",
    "TAB T=1",
    '// WM_JSON:[{"type":"navigate","url":"https://old.example"}]'
  ].join("\n");
  const out = adapter.importFromIim(script);
  assert.equal(out.steps.length, 1);
  assert.equal(out.steps[0].type, "navigate");
  assert.equal(out.meta, undefined);
});

test("importFromIim: script sin meta sigue funcionando", () => {
  const script = [
    "VERSION BUILD=1000",
    "TAB T=1",
    '// WM_JSON:{"version":2,"steps":[{"type":"click","selector":"#legacy"}]}'
  ].join("\n");
  const out = adapter.importFromIim(script);
  assert.equal(out.steps.length, 1);
  assert.equal(out.steps[0].selector, "#legacy");
  assert.equal(out.meta, undefined);
});

test("exportToIim: sanea currentValue sensible dentro de meta.pageInventories", () => {
  const macro = {
    steps: [{ type: "click", selector: "#go" }],
    meta: {
      pageInventories: [{
        url: "u",
        controls: [
          { selector: "#pwd", type: "password", name: "password", currentValue: "secret123" },
          { selector: "#tok", name: "csrf_token", currentValue: "abc" },
          { selector: "#ok", name: "nombre", currentValue: "Juan" }
        ]
      }]
    }
  };
  const script = adapter.exportToIim(macro);
  const line = script.split("\n").find((l) => l.startsWith("// WM_JSON:"));
  const parsed = JSON.parse(line.slice("// WM_JSON:".length));
  const controls = parsed.meta.pageInventories[0].controls;
  assert.equal(controls[0].currentValue, undefined);
  assert.equal(controls[1].currentValue, undefined);
  assert.equal(controls[2].currentValue, "Juan");
});

test("exportToIim: conserva meta.preRunReset en WM_JSON", () => {
  const macro = {
    steps: [{ type: "click", selector: "#go" }],
    meta: {
      preRunReset: {
        version: 1,
        controls: [
          { selector: "#deleg", tag: "input", type: "text", value: "CAPITAL" },
          { selector: "#chk", tag: "input", type: "checkbox", checked: true }
        ]
      }
    }
  };
  const script = adapter.exportToIim(macro);
  const line = script.split("\n").find((l) => l.startsWith("// WM_JSON:"));
  const parsed = JSON.parse(line.slice("// WM_JSON:".length));
  assert.ok(parsed.meta && parsed.meta.preRunReset);
  assert.equal(parsed.meta.preRunReset.controls.length, 2);
  assert.equal(parsed.meta.preRunReset.controls[0].selector, "#deleg");
});

test("exportToIim: sanea value sensible dentro de meta.preRunReset.controls", () => {
  const macro = {
    steps: [{ type: "click", selector: "#go" }],
    meta: {
      preRunReset: {
        version: 1,
        controls: [
          { selector: "#pwd", type: "password", name: "password", value: "secret123" },
          { selector: "#tok", name: "csrf_token", value: "abc" },
          { selector: "#ok", name: "nombre", value: "Juan" }
        ]
      }
    }
  };
  const script = adapter.exportToIim(macro);
  const line = script.split("\n").find((l) => l.startsWith("// WM_JSON:"));
  const parsed = JSON.parse(line.slice("// WM_JSON:".length));
  const controls = parsed.meta.preRunReset.controls;
  assert.equal(controls[0].value, undefined);
  assert.equal(controls[1].value, undefined);
  assert.equal(controls[2].value, "Juan");
});

test("H-09: exportToIim no filtra secretos sentinela en WM_JSON ni texto final", () => {
  const macro = {
    steps: [{ type: "click", selector: "#go" }],
    meta: {
      pageInventories: [{
        url: "u",
        controls: [
          { selector: "#pwd", type: "password", name: "password", currentValue: "PASSWORD_SHOULD_NOT_LEAK" },
          { selector: "#tok", name: "csrf_token", currentValue: "TOKEN_SHOULD_NOT_LEAK" }
        ]
      }],
      preRunReset: {
        version: 1,
        controls: [
          { selector: "#pwd", type: "password", name: "password", value: "PASSWORD_SHOULD_NOT_LEAK" },
          { selector: "#sec", name: "api_secret", value: "SECRET_SHOULD_NOT_LEAK" }
        ]
      }
    }
  };

  const script = adapter.exportToIim(macro);
  assert.ok(!script.includes("PASSWORD_SHOULD_NOT_LEAK"));
  assert.ok(!script.includes("TOKEN_SHOULD_NOT_LEAK"));
  assert.ok(!script.includes("SECRET_SHOULD_NOT_LEAK"));
});

test("exportToIim: input password no filtra valor real en lineas humanas ni WM_JSON", () => {
  const macro = {
    steps: [
      { type: "input", selector: "#password", value: "SECRET_SHOULD_NOT_LEAK_2026" },
      { type: "input", selector: "#usuario", value: "awagner" }
    ]
  };

  const script = adapter.exportToIim(macro);
  assert.ok(!script.includes("SECRET_SHOULD_NOT_LEAK_2026"), "el secreto no debe aparecer en el script exportado");
  assert.ok(script.includes("SENSITIVE_INPUT"), "debe dejar traza redactada para el campo sensible");
  assert.ok(script.includes('TYPE SELECTOR="#usuario" CONTENT="awagner"'), "campos normales deben seguir exportando valor");

  const line = script.split("\n").find((l) => l.startsWith("// WM_JSON:"));
  const parsed = JSON.parse(line.slice("// WM_JSON:".length));
  assert.equal(parsed.steps[0].value, "", "WM_JSON debe vaciar el valor sensible");
  assert.equal(parsed.steps[0].sensitive, true, "WM_JSON debe marcar paso sensible");
});

test("exportToIim: selector sensible token tampoco filtra valor real", () => {
  const macro = {
    steps: [
      { type: "input", selector: "#api_token", value: "SECRET_SHOULD_NOT_LEAK_2026" },
      { type: "input", selector: "#nombre", value: "Juan" }
    ]
  };

  const script = adapter.exportToIim(macro);
  assert.ok(!script.includes("SECRET_SHOULD_NOT_LEAK_2026"));
  assert.ok(script.includes('TYPE SELECTOR="#nombre" CONTENT="Juan"'));
});

// ── Round-trip con meta.preRunReset ─────────────────────────────────────────

test("round-trip IIM: conserva meta.preRunReset con controles no sensibles", () => {
  const steps = [
    { type: "navigate", url: "https://a.local/" },
    { type: "choose_option", selector: "#estado", value: "autorizado" }
  ];
  const preRunReset = {
    version: 1,
    url: "https://a.local/",
    title: "Página A",
    capturedAt: 1000000,
    controls: [
      { selector: "#estado", tag: "select", type: "select-one", value: "pendiente" },
      { selector: "#urgente", tag: "input", type: "checkbox", checked: false },
      { selector: "#afiliado", tag: "input", type: "text", value: "123456" }
    ]
  };
  const script = adapter.exportToIim({ steps, meta: { preRunReset } });
  const line = script.split("\n").find((l) => l.startsWith("// WM_JSON:"));
  assert.ok(line, "el script exportado debe contener // WM_JSON:");
  const { steps: rtSteps, meta: rtMeta } = adapter.importFromIim(script);
  assert.equal(rtSteps.length, 2);
  assert.ok(rtMeta && rtMeta.preRunReset, "el import debe recuperar preRunReset");
  assert.equal(rtMeta.preRunReset.controls.length, 3);
  assert.equal(rtMeta.preRunReset.controls[0].selector, "#estado");
  assert.equal(rtMeta.preRunReset.controls[0].value, "pendiente");
  assert.equal(rtMeta.preRunReset.controls[2].value, "123456");
});

test("round-trip IIM: preRunReset sensibles son sanitizados y no se filtran en import", () => {
  const steps = [{ type: "navigate", url: "https://a.local/" }];
  const preRunReset = {
    version: 1,
    controls: [
      { selector: "#pwd", tag: "input", type: "password", name: "password", value: "SENSITIVE_MUST_NOT_LEAK" },
      { selector: "#campo", tag: "input", type: "text", value: "valor-ok" }
    ]
  };
  const script = adapter.exportToIim({ steps, meta: { preRunReset } });
  assert.ok(!script.includes("SENSITIVE_MUST_NOT_LEAK"), "valor sensible no debe aparecer en el IIM");
  const { meta: rtMeta } = adapter.importFromIim(script);
  assert.ok(rtMeta && rtMeta.preRunReset);
  // El control sensible existe en preRunReset pero sin value
  const sensitiveCtrl = rtMeta.preRunReset.controls.find((c) => c.selector === "#pwd");
  assert.ok(sensitiveCtrl, "el control sensible debe seguir presente en preRunReset");
  assert.equal(sensitiveCtrl.value, undefined, "el valor sensible no debe aparecer");
  // El no sensible conserva su valor
  const safeCtrl = rtMeta.preRunReset.controls.find((c) => c.selector === "#campo");
  assert.equal(safeCtrl && safeCtrl.value, "valor-ok");
});

test("round-trip IIM: macro grabada A→B→A conserva preRunReset y pasos en orden", () => {
  const steps = [
    { type: "navigate", url: "https://a.local/", _wmBlockKey: "a.local/", _wmBlockStart: true },
    { type: "choose_option", selector: "#estado", value: "autorizado", _wmBlockKey: "a.local/" },
    { type: "navigate", url: "https://b.local/", _wmBlockKey: "b.local/", _wmBlockStart: true },
    { type: "input", selector: "#obs", value: "Prueba", _wmBlockKey: "b.local/" },
    { type: "navigate", url: "https://a.local/", _wmBlockKey: "a.local/", _wmBlockStart: true },
    { type: "input", selector: "#afiliado", value: "789000", _wmBlockKey: "a.local/" }
  ];
  const preRunReset = {
    version: 1,
    url: "https://a.local/",
    controls: [
      { selector: "#estado", tag: "select", value: "pendiente" },
      { selector: "#afiliado", tag: "input", type: "text", value: "123456" }
    ]
  };
  const script = adapter.exportToIim({ steps, meta: { preRunReset } });
  assert.ok(script.includes("// WM_JSON:"), "debe incluir WM_JSON");
  const { steps: rtSteps, meta: rtMeta } = adapter.importFromIim(script);
  // Orden de pasos preservado
  assert.equal(rtSteps.length, 6);
  assert.equal(rtSteps[0].url, "https://a.local/");
  assert.equal(rtSteps[3].value, "Prueba");
  assert.equal(rtSteps[5].value, "789000");
  // preRunReset conservado
  assert.ok(rtMeta && rtMeta.preRunReset);
  assert.equal(rtMeta.preRunReset.controls[1].value, "123456");
});
