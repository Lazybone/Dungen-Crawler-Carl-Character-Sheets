## Concept: Dungeon-Crawler-Carl-Flair — De-minified Bundle, "System"-Announcer-Voice & rotierende Flavor-Pools

> Scope note: This concept implements the six binding user decisions in `.codewright/brainstorm/20260710-072741/task.md`. The load-bearing decision is #5 — **de-minify `assets/index-B_LsmJIL.js` and make the readable bundle the new source of truth** — because it converts every downstream item (announcer banner, toast redesign, inline SVG, a real flavor component) from "hack around a black box" into "edit source directly."

### 1. Goals

- **Primary Goal**: Make the character-sheet app *feel* like the Dungeon Crawler Carl universe by (a) giving the app's notification/empty/loader/footer/gate surfaces the crude, mocking "System" announcer voice via **rotating bilingual quote pools**, and (b) giving those surfaces a distinct **"System" visual identity** (announcer-styled toasts, inline SVG iconography, banner treatment) — all delivered with **static HTML mockups** that reuse the real `assets/theme.css`.
- **Secondary Goals**:
  - **De-minify the React bundle** (`assets/index-B_LsmJIL.js`), rename core app components, and adopt the readable file as the source of truth — unlocking real component-level UI change instead of CSS/DOM-injection workarounds.
  - **Retire the two fragile surgical string-patches** in `build.mjs` by folding the i18n hook calls into the now-editable source.
  - Introduce a `data/flavor.json` content file + a `window.__flavor` runtime that mirrors the existing `window.__i18n` runtime *shape* (globals, `misses()` collector) — but **not** its lazy-fetch delivery: `flavor.json` is a few KB and is embedded eagerly inline in **both** builds (`index.html` **and** `dist/`) as a `<script type="application/json" id="flavor-data">` block. The i18n dual path exists only because the dictionary is ~900 KB; mirroring it for flavor would copy complexity without benefit.
  - Preserve every existing invariant: offline `file://` operation, single-file `index.html`, English-source-of-truth i18n with graceful fallback, spoiler gate, and the "paraphrased, not quoted" legal posture.
- **Non-Goals / Out of Scope**:
  - **No re-minification / no bundler / no `npm install` in CI.** The build stays zero-dependency; the de-minified bundle ships as-is (esbuild-minify is a flagged *future* option, not phase 1).
  - **No rewrite of the React vendor code** inside the bundle — only the app-level identifiers get renamed.
  - **No per-item tooltip barbs and no per-floor timeline captions** (explicitly phase 2 per decision #2).
  - **No clean/unfiltered toggle** — crude is the default and only mode (decision #1).
  - **No translation of `data/series.json`** and no change to spoiler-gate mechanics.
  - **No raster/external image assets** — graphics are inline SVG + CSS only (offline constraint).

### 2. Assumptions

- The de-minified app code can be safely prettified and its app-level identifiers renamed **without a rebuild toolchain**, because the original TSX/Vite source is **not present in this repo** — the minified bundle is already the de-facto source of truth, so "make it readable" loses no reproducibility that exists today.
- React vendor code and the JSX-runtime factory (`oc()` → `f`, `jsx`/`jsxs`) remain functionally intact after prettification; only whitespace/formatting and app-symbol names change.
- Phase-1 flavor content is **generic announcer barbs** (pastiche), not plot-specific excerpts, so spoiler risk is low; the few pool entries that reference a plot beat carry an optional book-cap field.
- The app already re-renders (not remounts) on language switch (`__i18n.mount`/`draw`), so a flavor component can read `window.__i18n.lang` and re-render correctly.
- `prefers-reduced-motion` is already handled globally in `theme.css`; new animations inherit that guard.
- Content is authored EN+DE together (decision #4); no English gaps in the German UI.

### 3. Constraints

- **Offline / `file://` / no network**: all graphics must be inline SVG or base64; no external URLs. `series.json` is served through the `fetch` shim in `build.mjs`. The new `flavor.json` is embedded eagerly inline in both builds (see §5) — note that `build.mjs` content-hashes only *script* assets; data files in `dist/data/` are written unhashed, so a fetch-based flavor path could not participate in hashing anyway.
- **Single-file deliverable**: `index.html` (currently 2.7 MB) must remain self-contained; `build.mjs` concatenates everything.
- **Zero-dependency build**: `build.mjs` has no imports beyond Node stdlib; `.github/workflows/pages.yml` runs it with no `npm install`. Any minifier would break this and is therefore excluded from phase 1.
- **Bilingual contract**: English is the source of truth; unknown strings fall back to English. Every new user-facing English string needs a German counterpart or it renders English mid-German (`__i18n.misses()` surfaces gaps).
- **Legal**: `README.md` states data is "paraphrased, not quoted" from Matt Dinniman's books. All flavor must be **original-voice pastiche of the "System"**, never verbatim book text.
- **Spoiler gate**: the app caps content at the reader's chosen book (`dcc_book_cap`, state `V` in `Wc`). Flavor tied to specific plot points must respect the same cap.
- **Accepted trade-off (decision #5)**: upstream re-sync from any external original becomes harder; the patch architecture (`boot.js`, `i18n-runtime.js`, `build.mjs` patches) must be adapted to the de-minified source.

### 4. Components

#### Component: De-minified App Bundle (`assets/app.js`, replaces `assets/index-B_LsmJIL.js`)
- **Responsibility**: The readable, renamed React application source — the new source of truth. Hosts all real UI changes (announcer toast redesign, new flavor component, SVG iconography, optional System banner).
- **Inputs**: `series.json` (via existing `fetch` shim), `window.__i18n`, new `window.__flavor`.
- **Outputs**: Rendered React tree (`#root`).
- **Dependencies**: React vendor region (left minified inside the file and **marked with boundary comments in the code itself**, e.g. `// ─ React vendor region — do not edit ─` … `// ─ end React vendor region ─`, so the "do not touch" invariant sticks to the source), JSX runtime, `window.__i18n`, `window.__flavor`.
- **Technology**: Hand-maintained ES module / IIFE (JavaScript, no JSX-transpile step — the file already ships pre-compiled `f.jsx(...)` calls, which stay as-is and are simply readable now).
- **Key identifiers to rename** (confirmed from the current bundle): `Wc` → `App` (root, holds spoiler-cap state `V`, timeline index `x`), `Ac` → `SpoilerGate` (`function Ac({books,onPick})`, renders `.gate`), the toast-list renderer (renders `.toasts`/`.toast`/`toast-head`/`toast-body`, driven by the `{kind,head,body}` push loop over `s.events`), `Ie` → `Icon` (`{name,size}`, maps to game-icons SVG paths), plus the inline loader `f.jsx("div",{className:"loading",children:"Entering the dungeon…"})`. The toast icon map `Dc={achievement:"achievement",level_up:"level_up",item_gained:"chest_box",title_gained:"crown",spell_gained:"spell",floor_change:"level_up"}` (exact literal from the bundle) gets renamed and extended.

#### Component: Flavor Content File (`data/flavor.json`)
- **Responsibility**: Rotating bilingual quote pools, one pool per surface. Source of truth for all announcer copy.
- **Inputs**: none (static, authored).
- **Outputs**: JSON consumed by the flavor runtime.
- **Dependencies**: embedded eagerly inline by `build.mjs` in both builds (see §5).
- **Technology**: JSON with parallel EN/DE per entry (schema in §6).

#### Component: Flavor Runtime (`assets/flavor-runtime.js`, exposes `window.__flavor`)
- **Responsibility**: Read `flavor.json` synchronously from the embedded `<script type="application/json" id="flavor-data">` block (present in **both** `index.html` and `dist/index.html` — no fetch path, no "not yet loaded" state; the pool is available before the first paint, including for the loader). Expose `pick(surface, opts)` that returns one quote string in the current language, honoring the spoiler cap and the per-surface selection rule (§6).
- **Inputs**: `surface` key, `{lang, cap, seedKey?}`.
- **Outputs**: a single translated string (or a safe fallback).
- **Dependencies**: `window.__i18n.lang`, DOM (embedded script block).
- **Technology**: Plain IIFE mirroring `assets/i18n-runtime.js` (separate file for the same reason: regex/escape safety inside `build.mjs` template literals).

#### Component: Flavor Consumption in App (`useFlavor` hook / `<Flavor>` usage in `app.js`)
- **Responsibility**: Call `window.__flavor.pick(...)` from the de-minified React source at each approved surface. Two selection mechanisms, one per surface class (see §6 for the contract):
  - **Per-load surfaces** (loader, gate, footer, `empty_search`, `empty_inventory`): draw a **random index at mount** and pin it via `useRef` — rotates between app starts (decision #3: "zufällig rotierende Sprüche"), stays stable across a language toggle so the *same* line re-renders translated (not a reshuffle).
  - **Per-event surfaces** (all toast kinds): pass a **deterministic `seedKey`** derived from the triggering event (`eventId`/`chapterId`) — the same event always shows the same line, in either language.
- **Inputs**: surface key; for toasts additionally the event-derived `seedKey` (`eventId`/`chapterId`).
- **Outputs**: text child nodes (React-escaped).
- **Dependencies**: `window.__flavor`, React `useRef`/`useState`.
- **Technology**: React hook inside `app.js`.

#### Component: "System" Visual Identity (extends `assets/theme.css` + inline SVG)
- **Responsibility**: Announcer look for the approved surfaces — toast redesign into System-notification cards (monospace `SYSTEM` header, kind-colored left rail, new SVG glyphs), loader/gate/empty/footer styling for the crude voice. Optionally a dedicated `.system-banner` component class (built but content-gated to phase 2).
- **Inputs**: existing CSS variables (`--book-1..8`, `--crimson`, `--amber`, rarity colors), new SVG icon set.
- **Outputs**: CSS classes + inline SVG paths.
- **Dependencies**: `theme.css` variables, `Icon` component.
- **Technology**: CSS + inline SVG (offline-safe, extends existing game-icons set).

#### Component: HTML Mockups (`mockups/*.html` + `mockups/flavor.css`)
- **Responsibility**: Pixel-accurate, in-browser previews of every redesigned surface (loader, gate, empty states, footer, announcer toasts, optional System banner), each showing 2–3 example flavor quotes in EN and DE side by side. `<link>`s the real `assets/theme.css` and `assets/fonts.css`; new announcer classes live in `mockups/flavor.css` until merged (ported by copy) into `theme.css`, after which `mockups/flavor.css` is deleted — the announcer class-name list is a shared contract between mockups, `theme.css`, and the `app.js` markup.
- **Inputs**: real theme, hand-written representative DOM.
- **Outputs**: static HTML the user opens directly.
- **Dependencies**: `theme.css`, `fonts.css`. **Not** part of `build.mjs`; pure design reference.
- **Technology**: static HTML/CSS.

### 5. Data Flow

**Build (`build.mjs`)**
1. Read `assets/app.js` (de-minified, no more `patch()` calls), `assets/theme.css`, `assets/fonts.css`, `assets/boot.js`, `assets/i18n-runtime.js`, **`assets/flavor-runtime.js`**, `data/series.json`, `data/i18n.de.json`, **`data/flavor.json`**.
2. For `index.html`: embed `series.json`, `i18n.de.json`, **`flavor.json`** as `<script type="application/json">` blocks (flavor under `id="flavor-data"`); inline all scripts in order: fetch-shim → `boot.js` → `i18n-runtime.js` → **`flavor-runtime.js`** → app IIFE. The i18n `wrapJsx`/`mount` calls now live **inside `app.js`** (no string surgery).
3. For `dist/`: **`flavor.json` is embedded eagerly inline exactly as in `index.html`** — the same `<script type="application/json" id="flavor-data">` block in `dist/index.html`, not a separate file. Only the ~900 KB i18n dictionary keeps its lazy-fetch dual path; `flavor.json` is a few KB, is needed in both languages from the first paint (loader), and the i18n lazy path fires only on switching to German — mirroring it would silence the feature for English first-time visitors. The eager-size log in `build.mjs` is extended by these few KB.

**Runtime — a surface renders (e.g. a toast fires at chapter change)**
1. `App` builds the toast list from `series.events` filtered by book cap (unchanged logic).
2. The toast renderer calls `window.__flavor.pick("toast.level_up", {seedKey: chapterId})` for the announcer line.
3. `__flavor` resolves the pool → filters entries by `cap` (drops any with `minBook > cap`) → picks a deterministic index from `seedKey` → returns `entry[lang]`, falling back to `entry.en` if `de` missing, or to the surface's default static string if the pool is empty (the pool is always loaded — it is embedded inline in both builds).
4. React renders it as an escaped text child inside the redesigned System toast card.
5. Language toggle → `__i18n` re-renders the same tree; the toast's `seedKey` is unchanged, so the same line returns in the other language (no reshuffle). Per-load surfaces (loader/gate/footer/empty) behave the same because their randomly drawn index is pinned in a `useRef` at mount (§4/§6).

### 6. Interfaces / APIs

#### `data/flavor.json` schema
- **Type**: static JSON.
- **Purpose**: per-surface rotating bilingual pools.
- **Input/Shape**:
```jsonc
{
  "loader":         [ { "en": "...", "de": "..." }, ... ],
  "gate":           [ { "en": "...", "de": "..." }, ... ],
  "empty_search":   [ { "en": "...", "de": "..." }, ... ],
  "empty_inventory":[ { "en": "...", "de": "..." }, ... ],
  "footer":         [ { "en": "...", "de": "..." }, ... ],
  "toast": {
    "level_up":     [ { "en": "...", "de": "..." }, ... ],
    "item_gained":  [ { "en": "...", "de": "...", "minBook": 4 }, ... ],
    "achievement":  [ ... ],
    "title_gained": [ ... ],
    "spell_gained": [ ... ],
    "floor_change": [ ... ]
  }
}
```
- **Output**: consumed by `__flavor.pick`.
- **Error Cases**: missing `de` → fall back to `en` and record a miss; empty/absent pool → surface uses its existing hard-coded default string; malformed JSON → runtime catches, all surfaces fall back to defaults (English), same failure semantics as `i18n.de.json`.

#### `window.__flavor.pick(surface, opts)`
- **Type**: JS function (global runtime).
- **Purpose**: return one localized, spoiler-safe flavor line.
- **Input**: `surface: string` (dot-path, e.g. `"toast.level_up"`), `opts: { lang?, cap?: number, seedKey?: string|number }`.
- **Selection contract (two cases, no third)**:
  - **Per-event surfaces (toasts, all six kinds)**: caller passes `seedKey = eventId`/`chapterId`; `pick` derives a deterministic index from it. Same event → same line, in either language.
  - **Per-load surfaces (`loader`, `gate`, `footer`, `empty_search`, `empty_inventory`)**: the caller (the `useFlavor` hook) draws a random index **once at mount** and pins that *index* via `useRef`; every render — including after a language toggle — passes the pinned index as `seedKey`, so `pick` returns the *same entry* in the current language. The line rotates between app starts but stays stable across a language toggle. (Rotation randomness lives in the caller's mount-time draw; `pick` itself stays deterministic for a given `seedKey`.)
- **Output**: `string`.
- **Error Cases**: unknown surface → default/empty string (never throws); all entries filtered out by `cap` → return a designated cap-safe default entry. (No "not yet loaded" case exists: the data is embedded inline in both builds.)

#### `build.mjs` changes
- **Type**: build script.
- **Purpose**: integrate `flavor-runtime.js` + `flavor.json` (embedded inline in both builds); drop the two `patch()` calls.
- **Input**: the file set above.
- **Output**: `index.html` + `dist/`.
- **Error Cases**: the removed `patch()` guard (assert-exactly-1-hit) is replaced by an equivalent **hard build-time source assert** in `build.mjs`: exactly one occurrence each of `window.__i18n.wrapJsx(` and `window.__i18n.mount(` must exist in `assets/app.js`, otherwise the build aborts with an error (zero-dependency string check — same strength as today's `patch()` invariant, since a mis-wiring would otherwise only "fail loudly at render" where no test framework would catch it). Additionally, a **mandatory** post-build CI smoke check (see plan WP-10) asserts the artifacts render and `__i18n.misses()` stays at its baseline.

### 7. Error Handling & Edge Cases

- **Language toggle reshuffles the quote**: prevented per surface class (§6): per-load surfaces pin their mount-time random index via `useRef` and re-pass it as `seedKey`; per-event surfaces (toasts) use the deterministic event-derived `seedKey`. In both cases a toggle re-renders the same entry translated.
- **DE missing for a pool entry**: fall back to `en`, record via a `__flavor.misses()` collector mirroring `__i18n.misses()`.
- **Empty or malformed embedded flavor data** (`#flavor-data` block missing/unparseable — there is no fetch path): every surface falls back to its current static string ("Entering the dungeon…", "How far into the crawl are you?", "Goddammit, Donut.", "Nothing in the first …", "Not yet revealed in the story") — degradation identical to the i18n dictionary failing.
- **Spoiler leak**: entries with `minBook` above the current cap are filtered out before selection; if filtering empties a pool, return a cap-safe default entry.
- **Reduced motion**: new announcer animations sit under the existing `@media (prefers-reduced-motion: reduce)` guard.
- **De-minification breakage**: a renamed app identifier colliding with a vendor symbol would break rendering — mitigate by renaming only within the app region (whose boundaries are marked with comments in `app.js` itself, §4), verifying against a rendered before/after diff of the running app (drive the full timeline, compare DOM — concrete snapshot procedure in plan WP-2), and keeping React vendor code untouched.
- **XSS**: flavor is authored static text rendered as React children (auto-escaped); inline SVG is authored by us; no user-supplied content reaches these surfaces (search is client-side filtering only). Note the minified React *vendor region* legitimately contains `innerHTML`/`dangerouslySetInnerHTML` sinks (reconciler internals) — so "no `dangerouslySetInnerHTML`" is not a description of the bundle but a binding **implementation/review criterion for WP-6**: flavor and SVG are rendered exclusively as React-escaped children, never through `innerHTML`-style sinks, and no *new* such sink may be added outside the vendor region (enforced by a grep check in WP-6/WP-10).

### 8. Security Considerations

- **No authn/authz**: fully static, offline, no backend, no secrets — out of scope by nature.
- **Input validation**: the only user input is the search box (client-side filter over embedded data); flavor content is authored, not user-derived, so no injection surface. Render flavor strictly as escaped text children; never as raw HTML.
- **Supply chain**: keep the zero-dependency build; do not introduce a minifier/bundler that would add `node_modules` to the offline artifact or CI.
- **Content Security Policy — deliberate non-goal (phase 1)**: no CSP is shipped, and this is a conscious decision, not an omission. A CSP is ineffective for the primary `file://` delivery, and the single-file inline architecture (inline scripts, inline JSON, inline SVG) would require `unsafe-inline`, neutering most of its value. A minimal `<meta http-equiv="Content-Security-Policy">` for the `dist/` (GitHub Pages) build is noted as optional future defense-in-depth, out of scope for phase 1.
- **Legal exposure (treated as a safety constraint)**: all flavor is original "System"-voice pastiche; a content review step must confirm no verbatim excerpts from Dinniman's books, preserving the README's "paraphrased, not quoted" stance even while the tone is crude/profane.

### 9. Performance Considerations

- **Expected load**: single user, static assets; no runtime scaling concerns.
- **Bundle size**: de-minifying grows `app.js` from ~225 KB toward ~0.5 MB unminified. In `index.html` (already 2.7 MB, dominated by fonts+data) this is a modest relative increase; in `dist/` it inflates the eager English first-visit. `flavor.json` is a few KB (negligible). **Mitigation / decision point**: optional esbuild-minify of `app.js` at build time would recover the size but reintroduces a dependency and breaks the zero-`npm-install` CI promise — flagged as an open decision, defaulted to *ship prettified*.
- **Rotation cost**: `__flavor.pick` is O(pool length) with a deterministic index — trivial; results can be memoized per `seedKey`.
- **Caching (`dist/`)**: `app.js` gets a content-hashed filename like the other *script* assets, staying long-cacheable. `flavor.json` is **not** a separate file in `dist/` — it is embedded inline in `dist/index.html` (§5), so it needs no hashing or caching story of its own; its few KB simply ride along in the HTML document and are added to the eager-size log.

### 10. Open Questions / Risks

- **De-minification fidelity (highest risk)**: prettifying + renaming a 225 KB minified bundle by hand is error-prone. *Mitigation*: rename incrementally, keep vendor region byte-identical where possible, and verify by driving the whole timeline in a browser and diffing rendered DOM against the current build before adopting `app.js` as source of truth.
- **Ship prettified vs. re-minify**: accepting a larger bundle vs. adding a build dependency. *Default*: ship prettified; revisit esbuild only if `dist/` first-load size becomes a real concern.
- **Tone calibration in German**: crude English barbs must be re-authored as natural German profanity/idiom, not literal translations, to land like the book's "System." Needs a native-idiom authoring/review pass.
- **Standalone always-on System banner**: decision #5 lists an "announcer banner" among unlocked capabilities, but decision #2 limits phase-1 *content* surfaces to loader/gate/empty/footer/toasts. *Resolution proposed*: build the `.system-banner` visual treatment and apply it to the approved surfaces now; keep a dedicated persistent banner as a phase-2 content surface. Confirm with user if a persistent banner is wanted in phase 1.
- **Legal review gate**: crude pastiche is desired, but a human check that no line reproduces actual book sentences is mandatory before merge.
- **`boot.js` embers-canvas kill**: if the redesign removes/replaces the spark canvas, revisit whether `boot.js`'s canvas-neutering hook is still needed; keep it until the redesign settles.

---

**Key files (absolute paths) this concept touches or references:**
- `build.mjs` — remove two `patch()` calls, add the `wrapJsx`/`mount` source asserts, add inline flavor embedding (both builds), rename bundle input to `assets/app.js`
- `assets/index-B_LsmJIL.js` — de-minify → becomes `assets/app.js` (new source of truth)
- `assets/i18n-runtime.js` — hook calls migrate into `app.js`; `misses()` pattern reused for flavor
- `assets/theme.css` — new `.toast`/announcer/`.system-banner` styling
- `assets/boot.js` — unchanged (revisit embers hook post-redesign)
- New: `assets/flavor-runtime.js`, `data/flavor.json`, `mockups/*.html`, `mockups/flavor.css` (throwaway design copy — deleted after its rules are merged into `theme.css`)

**Illustrative pastiche quotes (EN+DE, crude "System" voice — final copy authored & legal-reviewed at implementation):**
- Loader: EN "Booting the dungeon. Try not to die in the first ten seconds." / DE „Fahre den Dungeon hoch. Versuch, nicht in den ersten zehn Sekunden zu verrecken."
- Toast `level_up`: EN "Ding! Congratulations, meatbag." / DE „Pling! Glückwunsch, du Sack Fleisch."
- Toast `item_gained`: EN "You looted a thing. The audience is mildly entertained." / DE „Du hast was abgestaubt. Das Publikum ist mäßig unterhalten."
- Empty inventory: EN "Nothing here yet. Even the goblins are carrying more than you." / DE „Noch nichts hier. Selbst die Goblins schleppen mehr mit sich rum als du."
- Footer: EN "Unofficial fan project. The System accepts no liability for your life choices. Goddammit, Donut." / DE „Inoffizielles Fanprojekt. Das System übernimmt keine Haftung für deine Lebensentscheidungen. Verdammt, Donut."
