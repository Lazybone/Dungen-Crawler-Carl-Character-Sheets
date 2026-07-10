#!/usr/bin/env node
// Baut zwei Auslieferungen aus assets/ + data/:
//
//   index.html  Eine eigenständige Datei. Läuft per Doppelklick über file://,
//               ohne Server, ohne Netzwerk. Alles steckt darin.
//   dist/       Getrennte Dateien für einen Webserver. Schriften, Stile und
//               Bundle tragen einen Inhalts-Hash im Namen und sind damit
//               dauerhaft cachebar; das Wörterbuch lädt nur, wer auf Deutsch
//               schaltet. Ein englischer Erstbesuch spart so rund ein Drittel.
//
// Beide Wege teilen sich Bundle-Patches, Kopfbereich und boot.js. Sie
// unterscheiden sich nur darin, woher series.json und das Wörterbuch kommen.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFile(join(root, p), "utf8");
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 8);

// Alle `<` im minifizierten JSON stehen zwangsläufig in String-Literalen,
// die Ersetzung ist also verlustfrei und verhindert ein vorzeitiges </script>.
const escapeJson = (s) => s.replace(/</g, "\\u003c");
const minifyJson = (s) => JSON.stringify(JSON.parse(s));

const [fonts, css, js, seriesRaw, dictRaw, i18nRuntime, flavorRuntime, boot, flavorRaw] =
  await Promise.all([
    read("assets/fonts.css"),
    read("assets/theme.css"),
    read("assets/app.js"),
    read("data/series.json"),
    read("data/i18n.de.json"),
    read("assets/i18n-runtime.js"),
    read("assets/flavor-runtime.js"),
    read("assets/boot.js"),
    read("data/flavor.json"),
  ]);

const series = minifyJson(seriesRaw);
const dict = minifyJson(dictRaw);
const flavor = minifyJson(flavorRaw);

// Die beiden i18n-Haken leben jetzt fest in assets/app.js, nicht mehr als
// String-Chirurgie zur Build-Zeit. Wo früher patch() genau einen Treffer
// erzwang, sichert hier ein harter Quell-Assert dieselbe Invariante: fehlt oder
// verdoppelt sich einer der Aufrufe, bricht der Build ab, statt still Englisch
// zu bleiben oder den Root doppelt zu mounten.
const assertOnce = (src, needle, what) => {
  const hits = src.split(needle).length - 1;
  if (hits !== 1) {
    throw new Error(`Quell-Assert "${what}": ${hits} Treffer in assets/app.js, erwartet genau 1`);
  }
};

// 1. Die JSX-Fabrik läuft durch __i18n.wrapJsx — jeder gerenderte Textknoten
//    wird übersetzt, ohne dass eine einzelne Textstelle angefasst werden muss.
assertOnce(js, "window.__i18n.wrapJsx(", "jsx-Fabrik");

// 2. Der Root-Render läuft über __i18n.mount, damit ein Sprachwechsel neu
//    rendert statt neu zu mounten und der React-State überlebt.
assertOnce(js, "window.__i18n.mount(", "Root-Render");

const langToggleCss = `      .lang-toggle {
        position: fixed;
        top: 0.85rem;
        right: 0.85rem;
        z-index: 300; /* über dem .gate-Overlay (200), sonst nicht klickbar */
        min-width: 2.6rem;
        padding: 0.32rem 0.5rem;
        font-family: var(--display);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #fff;
        background: #2a2a2a;
        border: 1px solid #424242;
        border-radius: 2px;
        cursor: pointer;
      }
      .lang-toggle:hover { border-color: var(--amber); color: var(--amber); }
      .lang-toggle:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }`;

// `styles` ist entweder ein <style>-Block oder ein <link> auf die Stildatei.
const head = (styles) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dungeon Crawler Carl — Character Sheets</title>
    <meta name="description" content="Interactive character sheets for Carl and Princess Donut. Scrub through the timeline of Dungeon Crawler Carl and watch their stats, gear, and inventory evolve." />
    <meta property="og:title" content="Dungeon Crawler Carl — Character Sheets" />
    <meta property="og:description" content="Carl and Princess Donut, side by side. Drag the timeline and watch their stats, gear, and inventory evolve chapter by chapter. Spoiler-safe: you only see up to where you scrub." />
    <meta property="og:type" content="website" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👑</text></svg>" />
${styles}
  </head>
  <body>
    <div id="root"></div>
`;

// ---------------------------------------------------------------------------
// index.html — alles in einer Datei
// ---------------------------------------------------------------------------

// Das React-Bundle lädt seine Daten über fetch("/data/series.json"). Unter
// file:// ist fetch für lokale Pfade gesperrt, daher wird genau dieser Aufruf
// aus dem eingebetteten JSON bedient. Die App liest vom Ergebnis nur .ok,
// .status und .json(); ein echtes Response-Objekt würde die 1,4 MB zusätzlich
// nach UTF-8 kodieren und wieder dekodieren.
const seriesFromPage = `      (function () {
        "use strict";
        const DATA_URL = "/data/series.json";
        const native = window.fetch ? window.fetch.bind(window) : null;
        let cached = null;

        window.fetch = function (input, init) {
          const url = typeof input === "string" ? input : input && input.url;
          if (url && url.endsWith(DATA_URL)) {
            if (!cached) {
              cached = JSON.parse(document.getElementById("series-data").textContent);
            }
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(cached),
            });
          }
          if (!native) return Promise.reject(new Error("fetch unavailable: " + url));
          return native(input, init);
        };
      })();`;

const singleFile = `${head(`    <style>
${fonts}
${css}
${langToggleCss}
    </style>`)}
    <script type="application/json" id="series-data">
${escapeJson(series)}
    </script>

    <script type="application/json" id="i18n-de">
${escapeJson(dict)}
    </script>

    <!-- Flavor-Pools. Muss vor flavor-runtime.js stehen: die Laufzeit liest
         diesen Block synchron über getElementById. -->
    <script type="application/json" id="flavor-data">
${escapeJson(flavor)}
    </script>

    <script>
${seriesFromPage}
    </script>

    <script>
${boot}
    </script>

    <!-- Sprachschicht. Muss vor dem Bundle laufen: das Bundle greift beim
         Auswerten auf window.__i18n zu. -->
    <script>
${i18nRuntime}
    </script>

    <!-- Flavor-Schicht. Nach der Sprachschicht (liest window.__i18n.lang) und
         dem #flavor-data-Block, vor dem Bundle. -->
    <script>
${flavorRuntime}
    </script>

    <!-- Original ein type="module"-Bundle: Strict-Mode und eigener Scope
         werden hier durch die IIFE nachgebildet. -->
    <script>
      (function () {
        "use strict";
${js}
      })();
    </script>
  </body>
</html>
`;

await writeFile(join(root, "index.html"), singleFile);
console.log(`index.html geschrieben (${(singleFile.length / 1024 / 1024).toFixed(2)} MB)`);

// ---------------------------------------------------------------------------
// dist/ — getrennte Dateien für einen Webserver
// ---------------------------------------------------------------------------

// Eingebettet müssen die Schriften base64 sein; als eigene Dateien kostet das
// nur unnötige 33 % Aufschlag. Die data:-URIs werden daher wieder zu WOFF2.
const fontFiles = [];
const fontsLinked = fonts.replace(
  /url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\)/g,
  (_, b64) => {
    const name = `${hash(b64)}.woff2`;
    fontFiles.push({ name, buf: Buffer.from(b64, "base64") });
    return `url(fonts/${name})`;
  },
);
if (fontFiles.length === 0) throw new Error("Keine eingebetteten Schriften in fonts.css gefunden");

// Das Bundle fragt die Daten unter einem absoluten Pfad an. Relativ geholt
// läuft die Seite auch in einem Unterverzeichnis, nicht nur im Wurzelpfad.
const seriesOverHttp = `(function () {
  "use strict";
  const DATA_URL = "/data/series.json";
  const native = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    if (url && url.endsWith(DATA_URL)) return native("data/series.json", init);
    return native(input, init);
  };
})();
`;

const distCss = `${fontsLinked}\n${css}\n${langToggleCss}\n`;
const distBoot = `${seriesOverHttp}\n${boot}`;

const cssName = `app-${hash(distCss)}.css`;
const bootName = `boot-${hash(distBoot)}.js`;
const i18nName = `i18n-runtime-${hash(i18nRuntime)}.js`;
const flavorName = `flavor-runtime-${hash(flavorRuntime)}.js`;
const bundleName = `index-${hash(js)}.js`;

// boot.js und die Sprachschicht sind klassische Skripte und laufen sofort; das
// Bundle ist ein Modul und damit ohnehin aufgeschoben. Die Reihenfolge stimmt
// also: window.__i18n steht, bevor das Bundle ausgewertet wird.
// flavor.json reist als Inline-Block mit — data-Dateien werden ohnehin nicht
// gehasht, und die App braucht die Pools in beiden Sprachen ab dem ersten
// Paint. Der Block muss vor flavor-runtime.js stehen (synchrones getElementById).
const distHtml = `${head(`    <link rel="stylesheet" href="assets/${cssName}" />`)}
    <script type="application/json" id="flavor-data">
${escapeJson(flavor)}
    </script>
    <script src="assets/${bootName}"></script>
    <script src="assets/${i18nName}"></script>
    <script src="assets/${flavorName}"></script>
    <script type="module" src="assets/${bundleName}"></script>
  </body>
</html>
`;

const dist = join(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "assets", "fonts"), { recursive: true });
await mkdir(join(dist, "data"), { recursive: true });

await Promise.all([
  writeFile(join(dist, "index.html"), distHtml),
  writeFile(join(dist, "assets", cssName), distCss),
  writeFile(join(dist, "assets", bootName), distBoot),
  writeFile(join(dist, "assets", i18nName), i18nRuntime),
  writeFile(join(dist, "assets", flavorName), flavorRuntime),
  writeFile(join(dist, "assets", bundleName), js),
  writeFile(join(dist, "data", "series.json"), series),
  writeFile(join(dist, "data", "i18n.de.json"), dict),
  ...fontFiles.map((f) => writeFile(join(dist, "assets", "fonts", f.name), f.buf)),
]);

// Was ein englischer Erstbesuch tatsächlich zieht: alles ausser dem Wörterbuch.
// Die Flavor-Pools reisen inline in distHtml.length mit; flavor-runtime.js zählt
// als eigenes Eager-Skript dazu.
const eager =
  distHtml.length +
  distCss.length +
  distBoot.length +
  i18nRuntime.length +
  flavorRuntime.length +
  js.length +
  series.length;
console.log(
  `dist/ geschrieben (${fontFiles.length} Schriften, ` +
    `Erstbesuch auf Englisch ≈ ${(eager / 1024 / 1024).toFixed(2)} MB ` +
    `+ ${(dict.length / 1024 / 1024).toFixed(2)} MB nur bei Deutsch)`,
);
