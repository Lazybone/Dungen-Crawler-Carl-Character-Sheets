#!/usr/bin/env node
// Sammelt jeden String, der zur Laufzeit als Text gerendert werden kann:
// UI-Literale aus dem minifizierten Bundle plus die Inhalte aus series.json.
// Ausgabe: tools/i18n.source.json — die Vorlage für die Übersetzung.
//
// Die Übersetzung greift beim Rendern (siehe __t in build.mjs), nicht in den
// Daten. Deshalb müssen hier auch die *abgeleiteten* Formen auftauchen:
// das Bundle zeigt Slots mal roh ("head"), mal per Fo() großgeschrieben
// ("Head"), und Raritäten mal voll ("Divine / Unique"), mal als kleingeschriebenes
// erstes Wort ("divine").
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scanStringLiterals } from "./js-strings.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFile(join(root, p), "utf8");

// Der React-Vendor-Code endet hier; seine Literale gehören nicht übersetzt.
const APP_START = 193000;

const js = await read("assets/index-B_LsmJIL.js");
const series = JSON.parse(await read("data/series.json"));

// --- UI-Literale ---------------------------------------------------------
// Die ganze Datei tokenisieren: ein Schnitt bei APP_START würde mitten in
// einem Literal beginnen und die Quote-Paarung invertieren.
const lits = scanStringLiterals(js).filter((l) => l.index >= APP_START);

const cssClasses = new Set();
for (const l of lits) {
  if (/className\s*:$/.test(l.before)) l.value.split(/\s+/).forEach((t) => cssClasses.add(t));
}

// Tastencodes, Media-Queries, URLs und angehängte CSS-Klassen sind kein Text.
const NOT_TEXT = new Set([
  "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "Enter", "Escape", "Mac",
  "(prefers-reduced-motion: reduce)", "https://game-icons.net",
  " active", " changed", " flash", " shine", " unknown",
]);

const ui = new Set();
for (const s of new Set(lits.map((l) => l.value))) {
  if (NOT_TEXT.has(s)) continue;
  // Großzügiges Limit: Fußzeile und Hinweistexte sind lange Sätze.
  if (!/[A-Za-z]/.test(s) || s.length > 400) continue;
  if (/^[a-z0-9_.\/-]+$/.test(s)) continue;       // Lookup-Keys, Icons, CSS
  if (/^[a-z]+([A-Z][a-z]*)+$/.test(s)) continue; // camelCase
  if (/^var\(|^--|^#/.test(s)) continue;
  if (s.split(/\s+/).every((t) => cssClasses.has(t))) continue;
  ui.add(s);
}

// --- Inhalte -------------------------------------------------------------
const data = new Set();
const add = (s) => {
  if (typeof s === "string" && s.trim() && /[A-Za-z]/.test(s)) data.add(s);
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1); // entspricht Fo()

for (const b of series.meta.books) add(b.title);
for (const t of series.timeline) add(t.label);

// Stat-Namen erscheinen großgeschrieben über Fo(); die Kürzel (STR …) sind Literale.
for (const stat of ["strength", "intelligence", "constitution", "dexterity", "charisma"]) add(cap(stat));

for (const item of Object.values(series.items)) {
  for (const f of ["name", "description", "effects"]) add(item[f]);
  if (item.slot) {
    add(item.slot);       // Equip-Grid zeigt den Key roh
    add(cap(item.slot));  // Tooltip zeigt ihn über Fo()
  }
  if (item.rarity) {
    add(item.rarity);                                        // Tooltip: voll
    add(item.rarity.split(/[\s/]/)[0].toLowerCase());        // slot-tier: erstes Wort
  }
}

for (const e of series.events) {
  const fields = ["description", "effects", "cause", "evidence", "name", "source",
                  "derived", "item", "skill", "spell", "klass", "title"];
  for (const f of fields) add(e[f]);
  if (e.rarity) add(e.rarity);
  // `text` wird vom Bundle nirgends gelesen und bleibt unübersetzt.
}

// Charakter-Stammdaten: Rasse, Klasse, Titel, Skills, Zauber, Benefits, Erfolge.
const SKIP_KEYS = new Set(["id", "item_id", "icon", "file", "quote", "note", "text"]);
const walk = (o) => {
  if (Array.isArray(o)) return o.forEach(walk);
  if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      if (SKIP_KEYS.has(k)) continue;
      if (typeof v === "string") add(v);
      else walk(v);
    }
  }
};
walk(series.characters);

// Rasse und Klasse stehen nicht bei den Figuren, sondern verstreut: als `to` in
// race_class_change-Ereignissen und als `race`/`class` im Startzustand. Beide
// werden in der Kopfzeile jeder Karte gerendert.
const DEEP_TEXT_KEYS = new Set(["to", "from", "race", "class", "klass", "notes", "subtitle"]);
const deepWalk = (o) => {
  if (Array.isArray(o)) return o.forEach(deepWalk);
  if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string") {
        if (DEEP_TEXT_KEYS.has(k)) add(v);
      } else deepWalk(v);
    }
  }
};
deepWalk(series);

// Das Bundle setzt diese Wörter selbst ein, sie stehen in keinem Datenfeld:
// `cn()` fällt auf "enchanted" zurück, leere Ausrüstungsplätze zeigen "empty".
add("enchanted");
add("empty");

const out = {
  ui: [...ui].sort(),
  data: [...data].filter((s) => !ui.has(s)).sort(),
};

await writeFile(join(root, "tools/i18n.source.json"), JSON.stringify(out, null, 1));
const chars = [...out.ui, ...out.data].reduce((a, s) => a + s.length, 0);
console.log(`ui: ${out.ui.length}, data: ${out.data.length}, gesamt ${out.ui.length + out.data.length} Strings / ${chars} Zeichen`);
