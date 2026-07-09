#!/usr/bin/env node
// Lädt die Latin-Schnitte der drei Schriften von Google Fonts und schreibt sie
// als assets/fonts.css mit eingebetteten WOFF2-Daten. Einmalig auszuführen;
// danach braucht weder der Build noch die fertige Seite ein Netzwerk.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

// Google liefert WOFF2 nur an Browser, die es ankündigen.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CSS_URL =
  "https://fonts.googleapis.com/css2" +
  "?family=Barlow+Condensed:wght@600;700;800" +
  "&family=Inconsolata:wght@400;700" +
  "&family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400" +
  "&display=swap";

const css = await fetch(CSS_URL, { headers: { "User-Agent": UA } }).then((r) => {
  if (!r.ok) throw new Error(`Fonts-CSS: HTTP ${r.status}`);
  return r.text();
});

// Google kommentiert jeden @font-face mit seinem Subset. Nur Latin wird gebraucht.
const blocks = [...css.matchAll(/\/\* (\S+) \*\/\s*(@font-face\s*\{[^}]*\})/g)]
  .filter(([, subset]) => subset === "latin")
  .map(([, , face]) => face);

if (blocks.length !== 9) {
  throw new Error(`Erwartet 9 Latin-Schnitte, gefunden ${blocks.length}`);
}

// Bei einer Variable Font liefert Google für jeden angefragten Schnitt
// dieselbe Datei — Open Sans steckt so dreimal, Inconsolata zweimal in der
// CSS. Blöcke mit gleicher URL werden daher zu einem @font-face mit
// Gewichtsspanne zusammengefasst. Die Datei deckt die Spanne ab, sonst hätte
// Google für die Schnitte verschiedene Dateien geliefert. Barlow Condensed
// ist statisch, hat pro Schnitt eine eigene URL und bleibt unangetastet.
const field = (face, name) => face.match(new RegExp(`${name}:\\s*([^;]+)`))?.[1].trim();

const groups = new Map();
for (const face of blocks) {
  const url = face.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
  if (!url) throw new Error("Keine WOFF2-URL im @font-face");
  if (!groups.has(url)) groups.set(url, []);
  groups.get(url).push(face);
}

let bytes = 0;
const embedded = await Promise.all(
  [...groups].map(async ([url, faces]) => {
    // Eine Datei muss zu genau einer Familie und einem Stil gehören; sonst
    // würde das Zusammenfassen Schnitte stillschweigend vertauschen.
    const ident = (f) => `${field(f, "font-family")}|${field(f, "font-style")}`;
    if (faces.some((f) => ident(f) !== ident(faces[0]))) {
      throw new Error(`Eine Datei für mehrere Familien/Stile: ${ident(faces[0])}`);
    }

    const buf = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
    bytes += buf.length;
    const uri = `url(data:font/woff2;base64,${buf.toString("base64")})`;
    let face = faces[0].replace(/url\(https:\/\/[^)]+\.woff2\)/, uri);

    const weights = faces.map((f) => Number(field(f, "font-weight"))).sort((a, b) => a - b);
    if (weights.length > 1) {
      const span = `${weights[0]} ${weights[weights.length - 1]}`;
      face = face.replace(/font-weight:\s*\d+/, `font-weight: ${span}`);
    }
    return face;
  })
);

const out = `/* Erzeugt von fonts.mjs — nicht von Hand bearbeiten.
   Latin-Schnitte von Barlow Condensed, Inconsolata und Open Sans,
   eingebettet, damit die Seite ohne Netzwerk in ihren Schriften erscheint. */

${embedded.join("\n\n")}
`;

await writeFile(join(root, "assets/fonts.css"), out);
console.log(
  `assets/fonts.css: ${blocks.length} Schnitte in ${groups.size} Dateien, ` +
    `${(bytes / 1024).toFixed(0)} KB WOFF2 → ${(out.length / 1024).toFixed(0)} KB base64`
);
