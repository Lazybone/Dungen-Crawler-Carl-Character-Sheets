#!/usr/bin/env node
// Teilt die zu übersetzenden Strings in Chunks auf (`split`) und führt die
// übersetzten Chunks wieder zu data/i18n.de.json zusammen (`merge`).
//
//   node tools/i18n-chunks.mjs split
//   node tools/i18n-chunks.mjs merge
//
// merge ist streng: fehlende oder unbekannte Schlüssel werden gemeldet, damit
// keine Lücke unbemerkt als englischer Fallback durchrutscht.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chunkDir = join(root, "tools/i18n-chunks");
const CHUNK_SIZE = 200;

const source = JSON.parse(await readFile(join(root, "tools/i18n.source.json"), "utf8"));
// UI zuerst: so landen verwandte Begriffe im selben Chunk.
const all = [...source.ui, ...source.data];

const cmd = process.argv[2];

if (cmd === "split") {
  await mkdir(chunkDir, { recursive: true });
  let n = 0;
  for (let i = 0; i < all.length; i += CHUNK_SIZE) {
    const name = String(n).padStart(2, "0");
    await writeFile(join(chunkDir, `${name}.json`), JSON.stringify(all.slice(i, i + CHUNK_SIZE), null, 1));
    n++;
  }
  console.log(`${n} Chunks à max. ${CHUNK_SIZE} Strings in tools/i18n-chunks/`);
} else if (cmd === "merge") {
  const files = (await readdir(chunkDir)).filter((f) => f.endsWith(".de.json")).sort();
  const dict = {};
  const problems = [];

  for (const f of files) {
    const src = JSON.parse(await readFile(join(chunkDir, f.replace(".de.json", ".json")), "utf8"));
    let translated;
    try {
      translated = JSON.parse(await readFile(join(chunkDir, f), "utf8"));
    } catch (e) {
      problems.push(`${f}: kein gültiges JSON (${e.message})`);
      continue;
    }
    for (const key of src) {
      const value = translated[key];
      if (typeof value !== "string" || !value.trim()) problems.push(`${f}: fehlt "${key.slice(0, 50)}"`);
      else dict[key] = value;
    }
    for (const key of Object.keys(translated)) {
      if (!src.includes(key)) problems.push(`${f}: unbekannter Schlüssel "${key.slice(0, 50)}"`);
    }
  }

  // Nachträge, die nach der Chunk-Übersetzung dazukamen (Rasse, Klasse, lange
  // Hinweistexte). Sie werden erst beim Rendern sichtbar, siehe __i18n.misses().
  const extra = JSON.parse(await readFile(join(root, "tools/i18n-extra.de.json"), "utf8"));
  for (const [key, value] of Object.entries(extra)) dict[key] = value;

  const missing = all.filter((s) => !(s in dict));
  console.log(`übersetzt: ${Object.keys(dict).length}/${all.length}`);
  if (missing.length) console.log(`ohne Übersetzung: ${missing.length}`);
  if (problems.length) {
    console.log(`\nProbleme (${problems.length}):`);
    for (const p of problems.slice(0, 25)) console.log("  " + p);
    if (problems.length > 25) console.log(`  … und ${problems.length - 25} weitere`);
  }

  await writeFile(join(root, "data/i18n.de.json"), JSON.stringify(dict));
  console.log("\ndata/i18n.de.json geschrieben");
  if (missing.length || problems.length) process.exitCode = 1;
} else {
  console.error("Aufruf: node tools/i18n-chunks.mjs split|merge");
  process.exitCode = 2;
}
