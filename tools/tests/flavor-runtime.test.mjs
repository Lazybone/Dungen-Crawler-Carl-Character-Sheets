#!/usr/bin/env node
// Härtetest für die Flavour-Schicht (assets/flavor-runtime.js) und deren
// Einbettung durch build.mjs. Deckt Regression, Randfälle und Integration ab.
//
// Wie smoke-build.mjs bewusst OHNE Abhängigkeiten (nur Node-Standardbibliothek),
// damit die pages.yml-Zusage "kein npm install" erhalten bleibt. Dieses Projekt
// hat kein Testframework — dieser Runner bringt seine eigene winzige Harness mit.
//
// assets/flavor-runtime.js ist eine IIFE, die window/document als Globals
// erwartet und synchron document.getElementById("flavor-data").textContent
// liest. Wir werten die Quelle deshalb in einem vm-Sandbox aus, in dem wir
// document/window minimal stubben, und greifen danach window.__flavor ab.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const p = (...parts) => join(ROOT, ...parts);

const RUNTIME_SRC = readFileSync(p("assets/flavor-runtime.js"), "utf8");
const REAL_FLAVOR = JSON.parse(readFileSync(p("data/flavor.json"), "utf8"));

// ---------------------------------------------------------------------------
// Sandbox-Loader: wertet die echte Laufzeit gegen ein steuerbares document aus.
//   data          Objekt → textContent = JSON.stringify(data)
//   rawText       expliziter textContent-String (für kaputtes JSON)
//   missing       true → getElementById liefert null (Block fehlt ganz)
//   i18nLang      setzt window.__i18n.lang (Sprachquelle ohne opts.lang)
// Gibt das erzeugte window.__flavor zurück.
// ---------------------------------------------------------------------------
function loadRuntime({ data, rawText, missing, i18nLang } = {}) {
  const elementText = rawText != null ? rawText : JSON.stringify(data != null ? data : {});
  const document = {
    getElementById(id) {
      if (id !== "flavor-data" || missing) return null;
      return { textContent: elementText };
    },
  };
  const window = {};
  if (i18nLang) window.__i18n = { lang: i18nLang };
  const sandbox = { window, document, console };
  vm.createContext(sandbox);
  vm.runInContext(RUNTIME_SRC, sandbox, { filename: "assets/flavor-runtime.js" });
  return window.__flavor;
}

// djb2 exakt wie in der Laufzeit — erlaubt uns, den erwarteten Index einer
// Auswahl vorherzusagen und so den Determinismusvertrag hart zu prüfen.
function hash(key) {
  const s = String(key);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Punktpfad → Pool im echten Datensatz auflösen (Spiegel von poolOf).
function poolOf(surface) {
  let node = REAL_FLAVOR;
  for (const part of surface.split(".")) {
    if (!node || typeof node !== "object") return null;
    node = node[part];
  }
  return Array.isArray(node) ? node : null;
}

// Alle echten Oberflächen einsammeln: Top-Level-Arrays + toast.* Unterpfade.
const TOP_SURFACES = Object.keys(REAL_FLAVOR).filter((k) => Array.isArray(REAL_FLAVOR[k]));
const TOAST_SURFACES = Object.keys(REAL_FLAVOR.toast).map((k) => "toast." + k);
const ALL_SURFACES = [...TOP_SURFACES, ...TOAST_SURFACES];

// Flavour-Block aus einem gebauten HTML herauslösen (getrimmter Inhalt).
function extractFlavorBlock(html) {
  const m = html.match(/<script[^>]*id="flavor-data"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) throw new Error('kein <script id="flavor-data">-Block gefunden');
  return m[1].trim();
}

// ---------------------------------------------------------------------------
// Winzige Test-Harness: aggregiert Fehler, klare Ausgabe pro Test, exit(1).
// ---------------------------------------------------------------------------
let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push({ name, error: e });
    console.log(`  ✗ ${name}`);
    for (const line of String(e && e.message ? e.message : e).split("\n")) {
      console.log(`      ${line}`);
    }
  }
}

// ===========================================================================
// REGRESSION
// ===========================================================================
console.log("\nREGRESSION");

test("jede echte Oberfläche liefert ihren geseedeten Pool-Eintrag (en)", () => {
  const flavor = loadRuntime({ data: REAL_FLAVOR });
  assert.ok(ALL_SURFACES.length >= 11, `zu wenige Oberflächen erkannt: ${ALL_SURFACES.length}`);
  for (const surface of ALL_SURFACES) {
    const pool = poolOf(surface);
    const seedKey = "seed-" + surface;
    // Default-cap ist Infinity → filtered === pool, Index direkt vorhersagbar.
    const idx = hash(seedKey) % pool.length;
    const got = flavor.pick(surface, { seedKey });
    assert.equal(
      got,
      pool[idx].en,
      `${surface}: erwartet Pool-Eintrag ${idx} (en), bekam ${JSON.stringify(got)}`,
    );
    assert.ok(typeof got === "string" && got.length > 0, `${surface}: leerer Rückgabewert`);
  }
});

test("gleicher seedKey liefert denselben Eintrag (deterministisch)", () => {
  const flavor = loadRuntime({ data: REAL_FLAVOR });
  for (const surface of ALL_SURFACES) {
    const a = flavor.pick(surface, { seedKey: "stable-key" });
    const b = flavor.pick(surface, { seedKey: "stable-key" });
    assert.equal(a, b, `${surface}: zwei Aufrufe mit gleichem seedKey unterschiedlich`);
  }
});

test("en und de teilen sich denselben Index (übersetzungsstabil)", () => {
  const flavor = loadRuntime({ data: REAL_FLAVOR });
  for (const surface of ALL_SURFACES) {
    const pool = poolOf(surface);
    const seedKey = "xchange-" + surface;
    const idx = hash(seedKey) % pool.length;
    const en = flavor.pick(surface, { seedKey, lang: "en" });
    const de = flavor.pick(surface, { seedKey, lang: "de" });
    assert.equal(en, pool[idx].en, `${surface}: en nicht am erwarteten Index`);
    assert.equal(de, pool[idx].de, `${surface}: de nicht am selben Index wie en`);
    assert.notEqual(de, en, `${surface}: de sollte die übersetzte Variante sein`);
  }
});

test("misses() bleibt leer bei den echten zweisprachigen Daten", () => {
  const flavor = loadRuntime({ data: REAL_FLAVOR, i18nLang: "de" });
  // Über mehrere seedKeys ziehen, damit verschiedene Indizes getroffen werden.
  for (const surface of ALL_SURFACES) {
    for (let i = 0; i < 12; i++) flavor.pick(surface, { seedKey: `k${i}`, lang: "de" });
  }
  // misses() stammt aus dem vm-Realm; feldweise statt deepEqual (Cross-Realm-
  // Prototyp würde deepStrictEqual scheitern lassen) über JSON prüfen.
  assert.equal(
    flavor.misses().length,
    0,
    `unerwartete Misses: ${JSON.stringify(flavor.misses())}`,
  );
});

// ===========================================================================
// EDGE CASES
// ===========================================================================
console.log("\nEDGE CASES");

test("unbekannte Oberfläche → fallback", () => {
  const flavor = loadRuntime({ data: REAL_FLAVOR });
  assert.equal(flavor.pick("does_not_exist", { fallback: "FB" }), "FB");
});

test("verschachtelte unbekannte toast-Oberfläche → fallback", () => {
  const flavor = loadRuntime({ data: REAL_FLAVOR });
  assert.equal(flavor.pick("toast.no_such_event", { fallback: "FB", seedKey: "x" }), "FB");
});

test("cap 1 schließt minBook>1-Einträge aus (achievement 3, floor_change 5)", () => {
  const flavor = loadRuntime({ data: REAL_FLAVOR });
  const cases = [
    { surface: "toast.achievement", minBook: 3 },
    { surface: "toast.floor_change", minBook: 5 },
  ];
  for (const { surface, minBook } of cases) {
    const gated = poolOf(surface).find((e) => e.minBook === minBook);
    assert.ok(gated, `${surface}: kein Eintrag mit minBook ${minBook} in den echten Daten`);
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(flavor.pick(surface, { seedKey: String(i), cap: 1 }));
    assert.ok(
      !seen.has(gated.en),
      `${surface}: minBook-${minBook}-Eintrag trotz cap 1 gezogen`,
    );
  }
});

test("cap 8 schließt die minBook-Einträge ein", () => {
  const flavor = loadRuntime({ data: REAL_FLAVOR });
  const cases = [
    { surface: "toast.achievement", minBook: 3 },
    { surface: "toast.floor_change", minBook: 5 },
  ];
  for (const { surface, minBook } of cases) {
    const gated = poolOf(surface).find((e) => e.minBook === minBook);
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(flavor.pick(surface, { seedKey: String(i), cap: 8 }));
    assert.ok(
      seen.has(gated.en),
      `${surface}: minBook-${minBook}-Eintrag bei cap 8 nie gezogen`,
    );
  }
});

test("fehlender #flavor-data-Block → jeder pick liefert fallback, kein Wurf", () => {
  const flavor = loadRuntime({ missing: true });
  assert.ok(flavor && typeof flavor.pick === "function", "window.__flavor nicht gesetzt");
  for (const surface of ALL_SURFACES) {
    assert.equal(
      flavor.pick(surface, { seedKey: "x", fallback: "FB" }),
      "FB",
      `${surface}: ohne Daten kein fallback`,
    );
  }
});

test("kaputtes #flavor-data-JSON → jeder pick liefert fallback, kein Wurf", () => {
  const flavor = loadRuntime({ rawText: "{ das ist kein json" });
  for (const surface of ALL_SURFACES) {
    assert.equal(
      flavor.pick(surface, { seedKey: "x", fallback: "FB" }),
      "FB",
      `${surface}: bei kaputtem JSON kein fallback`,
    );
  }
});

test("Eintrag ohne de → en + Miss vermerkt (synthetischer Datensatz)", () => {
  const flavor = loadRuntime({ data: { solo: [{ en: "only english" }] } });
  const got = flavor.pick("solo", { lang: "de", seedKey: "k" });
  assert.equal(got, "only english", "sollte auf en zurückfallen");
  const misses = flavor.misses();
  assert.equal(misses.length, 1, `erwartet genau einen Miss, bekam ${JSON.stringify(misses)}`);
  assert.equal(misses[0].surface, "solo", "Miss-Oberfläche falsch");
  assert.equal(misses[0].lang, "de", "Miss-Sprache falsch");
});

test("fallback ist standardmäßig der Leerstring", () => {
  const flavor = loadRuntime({ data: REAL_FLAVOR });
  assert.equal(flavor.pick("nope.nope"), "", "unbekannte Oberfläche ohne fallback");
  const empty = loadRuntime({ missing: true });
  assert.equal(empty.pick("loader", { seedKey: "x" }), "", "leere Daten ohne fallback");
});

test("pick ohne seedKey liefert einen gültigen Pool-Eintrag (Zufallspfad)", () => {
  const flavor = loadRuntime({ data: REAL_FLAVOR });
  const pool = poolOf("loader");
  const valid = new Set(pool.map((e) => e.en));
  for (let i = 0; i < 30; i++) {
    const got = flavor.pick("loader");
    assert.ok(valid.has(got), `Zufallsauswahl ${JSON.stringify(got)} nicht im Pool`);
  }
});

// ===========================================================================
// INTEGRATION — echter Build, dann eingebettetes JSON gegen die Quelle.
// ===========================================================================
console.log("\nINTEGRATION");

let buildError = null;
try {
  execFileSync("node", ["build.mjs"], { cwd: ROOT, stdio: "pipe" });
} catch (e) {
  buildError = e;
}

// So bettet build.mjs ein: minifiziert und jedes "<" zu < escaped.
const EXPECTED_EMBED = JSON.stringify(REAL_FLAVOR).replace(/</g, "\\u003c");

for (const rel of ["index.html", "dist/index.html"]) {
  test(`${rel}: eingebettetes Flavour-JSON entspricht data/flavor.json`, () => {
    assert.ok(!buildError, `node build.mjs schlug fehl: ${buildError && buildError.message}`);
    const html = readFileSync(p(rel), "utf8");
    const block = extractFlavorBlock(html);
    // Exakt-Prüfung der Einbettung (minifiziert + escaped) …
    assert.equal(block, EXPECTED_EMBED, `${rel}: eingebetteter Block weicht vom Erwartungswert ab`);
    // … und semantisch: geparst deckungsgleich mit den Quelldaten.
    assert.deepEqual(JSON.parse(block), REAL_FLAVOR, `${rel}: geparstes Flavour weicht ab`);
  });
}

// ===========================================================================
// Ergebnis
// ===========================================================================
const total = passed + failures.length;
if (failures.length > 0) {
  console.log(`\nFEHLGESCHLAGEN — ${failures.length}/${total} Test(s):`);
  for (const { name } of failures) console.log(`  ✗ ${name}`);
  process.exit(1);
}
console.log(`\nAlle ${total} Tests bestanden.`);
