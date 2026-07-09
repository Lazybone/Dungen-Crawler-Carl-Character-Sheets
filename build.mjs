#!/usr/bin/env node
// Bündelt assets/ + data/ zu einer eigenständigen index.html, die auch
// über file:// läuft (kein Server, kein fetch, keine absoluten Pfade).
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFile(join(root, p), "utf8");

// Alle `<` im minifizierten JSON stehen zwangsläufig in String-Literalen,
// die Ersetzung ist also verlustfrei und verhindert ein vorzeitiges </script>.
const escapeJson = (s) => s.replace(/</g, "\\u003c");

const [fonts, css, jsRaw, seriesRaw, dictRaw, i18nRuntime] = await Promise.all([
  read("assets/fonts.css"),
  read("assets/theme.css"),
  read("assets/index-B_LsmJIL.js"),
  read("data/series.json"),
  read("data/i18n.de.json"),
  read("assets/i18n-runtime.js"),
]);

const series = escapeJson(JSON.stringify(JSON.parse(seriesRaw)));
const dict = escapeJson(JSON.stringify(JSON.parse(dictRaw)));

// Zwei chirurgische Eingriffe ins minifizierte Bundle. Beide werden geprüft:
// ändert sich das Bundle, scheitert der Build, statt still Englisch zu bleiben.
const patch = (src, needle, replacement, what) => {
  const hits = src.split(needle).length - 1;
  if (hits !== 1) throw new Error(`Patch "${what}": ${hits} Treffer, erwartet genau 1`);
  return src.replace(needle, replacement);
};

// 1. Die JSX-Fabrik. `Sr.jsx` und `Sr.jsxs` zeigen auf dieselbe Funktion, und
//    `f` ist die einzige Bindung darauf — jeder gerenderte Textknoten läuft
//    also durch __i18n.wrapJsx. Deshalb muss keine einzelne Textstelle im
//    Bundle angefasst werden.
let js = patch(jsRaw, "var f=oc()", "var f=window.__i18n.wrapJsx(oc())", "jsx-Fabrik");

// 2. Der Root-Render. Der Root bleibt erhalten, damit ein Sprachwechsel neu
//    rendert statt neu zu mounten: die Komponenten laufen erneut durch die
//    Fabrik, der React-State (Kapitelposition, Buchgrenze) überlebt.
js = patch(
  js,
  'dc.createRoot(document.getElementById("root")).render(f.jsx(Uo.StrictMode,{children:f.jsx(Wc,{})}));',
  'window.__i18n.mount(dc.createRoot(document.getElementById("root")),' +
    "function(lang){return f.jsx(Uo.StrictMode,{children:f.jsx(Wc,{__lang:lang})})});",
  "Root-Render",
);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dungeon Crawler Carl — Character Sheets</title>
    <meta name="description" content="Interactive character sheets for Carl and Princess Donut. Scrub through the timeline of Dungeon Crawler Carl and watch their stats, gear, and inventory evolve." />
    <meta property="og:title" content="Dungeon Crawler Carl — Character Sheets" />
    <meta property="og:description" content="Carl and Princess Donut, side by side. Drag the timeline and watch their stats, gear, and inventory evolve chapter by chapter. Spoiler-safe: you only see up to where you scrub." />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="og.png" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👑</text></svg>" />
    <style>
${fonts}
${css}
      .lang-toggle {
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
      .lang-toggle:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
    </style>
  </head>
  <body>
    <div id="root"></div>

    <script type="application/json" id="series-data">
${series}
    </script>

    <script type="application/json" id="i18n-de">
${dict}
    </script>

    <script>
      (function () {
        // Das React-Bundle lädt seine Daten über fetch("/data/series.json").
        // Unter file:// ist fetch für lokale Pfade gesperrt, daher wird genau
        // dieser Aufruf aus dem eingebetteten JSON bedient. Die App liest vom
        // Ergebnis nur .ok, .status und .json(); ein echtes Response-Objekt
        // würde die 1,4 MB zusätzlich nach UTF-8 kodieren und wieder dekodieren.
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

        // Die App merkt sich die gewählte Spoiler-Grenze und überspringt dann
        // die Buchauswahl. Beim Öffnen soll sie aber immer erscheinen, also
        // wird die gemerkte Wahl vor dem Start verworfen. Das Auswahlfeld in
        // der Leiste schaltet weiterhin während der Sitzung um.
        try {
          localStorage.removeItem("dcc_book_cap");
        } catch (e) {
          /* Privater Modus: nichts zu verwerfen. */
        }

        // Der Funken-Canvas gehört zum dunklen Theme und ist im hellen per CSS
        // ausgeblendet. Seine Animationsschleife liefe dennoch weiter und
        // zeichnete 60×/s mit Schattenwurf in einen mehrere Megapixel großen
        // Puffer. Kontext und Puffer werden daher stillgelegt, sobald die App
        // sie anfordert.
        const getContext = HTMLCanvasElement.prototype.getContext;
        const noop = function () {};
        HTMLCanvasElement.prototype.getContext = function (...args) {
          if (this.classList.contains("embers")) {
            for (const dim of ["width", "height"]) {
              Object.defineProperty(this, dim, {
                get: () => 0,
                set: noop,
                configurable: true,
              });
            }
            return new Proxy({}, { get: () => noop, set: () => true });
          }
          return getContext.apply(this, args);
        };
      })();
    </script>

    <!-- Sprachschicht. Muss vor dem Bundle laufen: das Bundle greift beim
         Auswerten auf window.__i18n zu. -->
    <script>
${i18nRuntime}
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

await writeFile(join(root, "index.html"), html);
console.log(`index.html geschrieben (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
