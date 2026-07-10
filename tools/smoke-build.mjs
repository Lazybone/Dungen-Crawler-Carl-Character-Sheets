#!/usr/bin/env node
// Post-Build-Rauchtest. Läuft nach `node build.mjs` und sichert die
// Invarianten ab, die zusammen mit dem harten Quell-Assert in build.mjs den
// entfernten patch()-Wächter ersetzen — dieses Projekt hat kein Testframework,
// also übernimmt dieses Skript die Rolle des "fails loudly at build".
//
// Bewusst ohne Abhängigkeiten (nur Node-Standardbibliothek), damit die
// pages.yml-Zusage "kein npm install" erhalten bleibt.
//
// Was NICHT hier geprüft werden kann: das eigentliche `window.__i18n.misses()`
// gegen die aufgezeichnete Baseline braucht einen echten Render und damit einen
// Headless-Browser (neue Abhängigkeit). Diese Zusicherung bleibt laut Plan
// (WP-10) ein verpflichtender lokaler Pre-Merge-Schritt. Als ehrlicher,
// abhängigkeitsfreier Ersatz prüft Check (g) hier stattdessen auf Inhaltsebene,
// dass jeder Flavor-Eintrag EN und DE trägt — der Miss-Wächter für die Pools.
//
// Pfade lassen sich über die Umgebungsvariable SMOKE_ROOT umbiegen, damit der
// Rauchtest gegen eine (absichtlich beschädigte) Kopie im Scratchpad laufen und
// so seine eigene Fehlererkennung beweisen kann, ohne das Repo anzufassen.
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT = process.env.SMOKE_ROOT || scriptRoot;
const p = (...parts) => join(ROOT, ...parts);

const failures = [];
const fail = (msg) => failures.push(msg);

const readText = async (rel) => readFile(p(rel), "utf8");
const exists = async (rel) => {
  try {
    await stat(p(rel));
    return true;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// (a) Beide Auslieferungen existieren und sind nicht trivial klein.
// ---------------------------------------------------------------------------
// index.html trägt alles inline (~2.9 MB); dist/index.html ist der schlanke
// Kopf (~10 KB). Die Schwellen liegen bewusst weit unter dem Ist-Wert — sie
// fangen "leer/abgeschnitten geschrieben" ab, nicht Größenschwankungen.
const SIZE_MIN = { "index.html": 512 * 1024, "dist/index.html": 2 * 1024 };
const sizes = {};
for (const rel of ["index.html", "dist/index.html"]) {
  if (!(await exists(rel))) {
    fail(`(a) ${rel} fehlt — build.mjs hat die Datei nicht erzeugt`);
    continue;
  }
  const { size } = await stat(p(rel));
  sizes[rel] = size;
  if (size < SIZE_MIN[rel]) {
    fail(`(a) ${rel} ist mit ${size} Bytes verdächtig klein (erwartet ≥ ${SIZE_MIN[rel]})`);
  }
}

// HTML-Inhalte einlesen, soweit vorhanden.
const htmls = {};
for (const rel of ["index.html", "dist/index.html"]) {
  if (await exists(rel)) htmls[rel] = await readText(rel);
}

// ---------------------------------------------------------------------------
// (b) #flavor-data-Block vorhanden und VOR dem flavor-runtime-Skript.
// ---------------------------------------------------------------------------
// Die Laufzeit liest den Block synchron via getElementById beim Auswerten;
// stünde er danach, fiele jede Oberfläche still auf ihren Default zurück.
// In index.html ist die Laufzeit inline (Anker: getElementById("flavor-data")),
// in dist/ eine gehashte Datei (Anker: flavor-runtime-...).
const flavorRuntimeIndex = (html) => {
  const bySrc = html.indexOf("flavor-runtime-");
  if (bySrc !== -1) return bySrc;
  // Quote-tolerant: getElementById("flavor-data") oder ('flavor-data')
  return html.search(/getElementById\((["'])flavor-data\1\)/);
};
for (const [rel, html] of Object.entries(htmls)) {
  // Ans echte Script-Tag koppeln — das blosse Attribut kommt in index.html
  // auch in einem Kommentar der Inline-Laufzeit vor (False-Pass-Gefahr).
  // [^>\n]* statt [^>]*: der Kommentar erstreckt sich ueber einen Zeilen-
  // umbruch und wuerde sonst weiterhin matchen; das echte Tag ist einzeilig.
  const dataIdx = html.search(/<script[^>\n]*\bid=(["'])flavor-data\1/);
  const runtimeIdx = flavorRuntimeIndex(html);
  if (dataIdx === -1) {
    fail(`(b) ${rel} enthält keinen <script id="flavor-data">-Block`);
    continue;
  }
  if (runtimeIdx === -1) {
    fail(`(b) ${rel}: flavor-runtime-Skript nicht auffindbar`);
    continue;
  }
  if (dataIdx > runtimeIdx) {
    fail(
      `(b) ${rel}: #flavor-data (Index ${dataIdx}) steht NACH der flavor-runtime ` +
        `(Index ${runtimeIdx}) — die Laufzeit läse den Block dann leer`,
    );
  }
}

// ---------------------------------------------------------------------------
// (c) Der eingebettete Flavor-JSON-Block enthält kein rohes "</script".
// ---------------------------------------------------------------------------
// build.mjs escaped jedes "<" zu <; der Block darf sich also nicht selbst
// vorzeitig schließen. Robuste Prüfung: den Blockinhalt bis zum ersten
// </script> greifen. Ein vorzeitiges </script> mitten im JSON schneidet den
// Inhalt ab → JSON.parse scheitert (gefangen), und ein direkter "</script"-Scan
// fängt den Rest. Zusammen erkennen beide ein durchgesickertes "<".
const blockRe = /<script[^>]*id="flavor-data"[^>]*>([\s\S]*?)<\/script>/i;
for (const [rel, html] of Object.entries(htmls)) {
  const m = html.match(blockRe);
  if (!m) {
    // (b) meldet den fehlenden Block bereits; hier nichts doppelt melden.
    if (html.includes('id="flavor-data"')) {
      fail(`(c) ${rel}: #flavor-data-Block nicht sauber abschließbar (kein </script>?)`);
    }
    continue;
  }
  const content = m[1];
  if (content.toLowerCase().includes("</script")) {
    fail(`(c) ${rel}: eingebetteter Flavor-JSON-Block enthält ein rohes "</script"`);
  }
  try {
    JSON.parse(content.trim());
  } catch (e) {
    fail(`(c) ${rel}: eingebetteter Flavor-JSON-Block parst nicht (${e.message})`);
  }
}

// ---------------------------------------------------------------------------
// (d) assets/app.js: genau ein wrapJsx( und ein mount( (Wiederholung des
//     WP-5-Quell-Asserts, damit CI ihn unabhängig vom Build nachzieht).
// ---------------------------------------------------------------------------
let appJs = null;
if (await exists("assets/app.js")) {
  appJs = await readText("assets/app.js");
  const countOccurrences = (s, needle) => s.split(needle).length - 1;
  for (const needle of ["window.__i18n.wrapJsx(", "window.__i18n.mount("]) {
    const n = countOccurrences(appJs, needle);
    if (n !== 1) fail(`(d) assets/app.js enthält "${needle}" ${n}× (erwartet genau 1×)`);
  }
} else {
  fail("(d) assets/app.js fehlt");
}

// ---------------------------------------------------------------------------
// (e) Kein dangerouslySetInnerHTML / .innerHTML NACH dem Vendor-Region-Ende.
// ---------------------------------------------------------------------------
// Die React-Vendor-Region enthält legitim innerHTML-Senken; unser App-Code
// (alles nach dem Endmarker) darf keine haben — er rendert alles als escapte
// React-Children. Prüfung nur auf dem Bereich hinter dem Endmarker.
if (appJs !== null) {
  const END_MARKER = "// ─ end React vendor region ─";
  const markerIdx = appJs.indexOf(END_MARKER);
  if (markerIdx === -1) {
    fail(`(e) Endmarker "${END_MARKER}" nicht in assets/app.js gefunden`);
  } else {
    const tail = appJs.slice(markerIdx + END_MARKER.length);
    for (const needle of ["dangerouslySetInnerHTML", ".innerHTML"]) {
      if (tail.includes(needle)) {
        fail(`(e) assets/app.js enthält "${needle}" nach dem Vendor-Region-Ende`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// (f) dist/data/ enthält series.json und i18n.de.json, aber KEIN flavor.json.
// ---------------------------------------------------------------------------
// flavor.json reist ausschließlich inline mit — es darf nie als eigene
// dist-Datei landen (kein Nachladen, kein Fetch-Pfad).
for (const name of ["series.json", "i18n.de.json"]) {
  if (!(await exists(join("dist", "data", name)))) {
    fail(`(f) dist/data/${name} fehlt`);
  }
}
if (await exists(join("dist", "data", "flavor.json"))) {
  fail("(f) dist/data/flavor.json existiert — Flavor darf nur inline eingebettet sein");
}

// ---------------------------------------------------------------------------
// (g) data/flavor.json parst und jeder Eintrag trägt EN und DE (nicht leer).
// ---------------------------------------------------------------------------
// Inhaltlicher Miss-Wächter: der abhängigkeitsfreie Ersatz für die
// __flavor.misses()-Zusicherung, die einen echten Render bräuchte.
// Sammelt rekursiv alle Blatt-Einträge (Top-Level-Arrays + verschachteltes
// toast-Objekt) — ein Eintrag ist ein Objekt mit en/de.
const collectEntries = (node, path, out) => {
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectEntries(v, `${path}[${i}]`, out));
    return;
  }
  if (node && typeof node === "object") {
    if ("en" in node || "de" in node) {
      out.push({ path, node });
      return;
    }
    for (const k of Object.keys(node)) collectEntries(node[k], `${path}.${k}`, out);
  }
};
if (await exists("data/flavor.json")) {
  let flavor;
  try {
    flavor = JSON.parse(await readText("data/flavor.json"));
  } catch (e) {
    flavor = null;
    fail(`(g) data/flavor.json parst nicht (${e.message})`);
  }
  if (flavor) {
    const entries = [];
    collectEntries(flavor, "flavor", entries);
    if (entries.length === 0) {
      fail("(g) data/flavor.json enthält keine Einträge mit en/de");
    }
    const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
    for (const { path, node } of entries) {
      if (!nonEmpty(node.en)) fail(`(g) ${path}: "en" fehlt oder ist leer`);
      if (!nonEmpty(node.de)) fail(`(g) ${path}: "de" fehlt oder ist leer`);
    }
  }
} else {
  fail("(g) data/flavor.json fehlt");
}

// ---------------------------------------------------------------------------
// Ergebnis
// ---------------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\nRauchtest FEHLGESCHLAGEN — ${failures.length} Problem(e):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

const mb = (n) => (n / 1024 / 1024).toFixed(2);
console.log(
  `Rauchtest bestanden: index.html (${mb(sizes["index.html"])} MB) und ` +
    `dist/index.html (${sizes["dist/index.html"]} B) mit eingebettetem #flavor-data ` +
    `vor der flavor-runtime; app.js-Haken (wrapJsx/mount) je 1×, keine innerHTML-Senke ` +
    `im App-Code; dist/data ohne flavor.json; alle Flavor-Einträge zweisprachig.`,
);
