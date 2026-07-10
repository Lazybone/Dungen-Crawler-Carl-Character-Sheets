## Implementation Plan: Dungeon-Crawler-Carl-Flair — De-minified Bundle, "System"-Announcer Voice & Rotating Flavor Pools

### Overview
- **Goal**: Make the character-sheet app feel like the Dungeon Crawler Carl universe by giving its high-impact surfaces (loader, spoiler gate, empty states, footer, toasts) a crude bilingual "System"-announcer voice driven by rotating pools, plus a matching "System" visual identity — delivered on a de-minified React bundle that becomes the new source of truth, with static HTML mockups reusing the real theme.
- **Approach**: De-minify `assets/index-B_LsmJIL.js` into a readable, renamed `assets/app.js` (the load-bearing, verified-first step), inline the two i18n hook calls that `build.mjs` currently string-patches, then layer on a new `data/flavor.json` + `assets/flavor-runtime.js` (`window.__flavor`) that mirrors the existing `window.__i18n` runtime *shape* but is embedded eagerly inline in both builds (no lazy-fetch path — concept §5/§6). Feature edits (flavor consumption, toast/icon redesign) land in `app.js`; the announcer look lands in `assets/theme.css`; design is proven up front in `mockups/`.
- **Estimated Effort**: **L** (roughly 4–6 focused sessions; the de-minify WP dominates).
- **Based on Concept**: §3 (constraints), §4 (all six components), §5 (data flow), §6 (interfaces), §7 (edge cases), §10 (risks); binding user decisions #1–#6 in `task.md`.

### Work Packages

#### WP-1: Static HTML Mockups + `mockups/flavor.css`
- **Files**: `mockups/loader.html`, `mockups/gate.html`, `mockups/empty-states.html`, `mockups/footer.html`, `mockups/toasts.html`, `mockups/system-banner.html`, `mockups/index.html` (gallery landing), `mockups/flavor.css`
- **Action**: create
- **Description**: Build pixel-accurate, in-browser previews of every redesigned surface. Each page `<link>`s the real `../assets/theme.css` and `../assets/fonts.css` (read-only reuse, do not edit them) plus the new `mockups/flavor.css` which holds the draft announcer classes (System-notification toast card with monospace `SYSTEM` header + kind-colored left rail, loader/gate/empty/footer announcer treatment, `.system-banner`). `mockups/flavor.css` is a **throwaway working copy**: its rules are ported (copied) into `theme.css` by WP-7 and the file is **deleted after the merge**. The announcer class-name list it defines is the **shared contract** between mockups, `theme.css` (WP-7), and the `app.js` markup (WP-6) — WP-6 and WP-7 both verify against this list. Hand-write representative DOM matching the real class names found in `theme.css` (`.toasts`/`.toast`/`.toast-head`/`.toast-body`/`.toast-icon`/`.toast-level_up`/`.toast-item_gained`, `.gate`/`.gate-card`/`.gate-question`, `.loading`, `.slot.empty`, `.footer-note`). Show 2–3 example flavor quotes per surface in EN and DE side by side. Include the new inline-SVG glyphs (extending the game-icons set) so the icon redesign is visible. No JS, no build coupling — pure design reference the user opens directly.
- **Depends on**: [] (only reads existing theme.css/fonts.css)
- **Estimated Effort**: M

#### WP-2: De-minify Bundle → `assets/app.js` (baseline + i18n hook inlining, verified)
- **Files**: `assets/app.js` (create), `assets/index-B_LsmJIL.js` (delete)
- **Action**: create + delete
- **Description**: Prettify the 40-line, ~225 KB minified bundle into a readable `assets/app.js` and rename app-level identifiers only (leave the React vendor region and the `f.jsx`/`f.jsxs` runtime byte-behaviorally intact, and **mark the vendor region's start and end with boundary comments in `app.js` itself** — e.g. `// ─ React vendor region — do not edit ─` … `// ─ end React vendor region ─` — so the "do not touch" invariant sticks to the code): `Wc` → `App` (root, holds spoiler-cap state `V`, timeline index `x`), `Ac` → `SpoilerGate` (confirmed `function Ac({books:s,onPick:m})`, renders `.gate`), `Ie` → `Icon` (confirmed `function Ie({name:s,size:m=20,className:a="",style:C})`), `Dc` → the toast icon map (confirmed exact literal `Dc={achievement:"achievement",level_up:"level_up",item_gained:"chest_box",title_gained:"crown",spell_gained:"spell",floor_change:"level_up"}`), and the toast-list renderer (the `f.jsx("div",{className:"toast-head",children:x.head})` / `toast-body` loop keyed by `x.id`). **Inline the two edits `build.mjs` currently does via `patch()`** directly into the source: (1) `var f=oc()` → `var f=window.__i18n.wrapJsx(oc())`; (2) the `dc.createRoot(...).render(f.jsx(Uo.StrictMode,{children:f.jsx(Wc,{})}))` root render → the `window.__i18n.mount(...)` form with `__lang` passthrough. **This is behavior-preserving only — no flavor/visual changes yet.**
- **Verification (gate before anything builds on it) — concrete, repeatable snapshot procedure**:
  1. **Define a finite state list** up front (a named enumeration, e.g. `gate-initial`, `gate-open-book<N>` for each book 1–8, `chapter-<id>` for each timeline step, `lang-en`/`lang-de` variants of each, plus one state per toast kind fired). This list is the checklist — no open-ended "drive the full timeline".
  2. **Capture baseline**: build the *current* (pre-WP-2) `index.html`; for each state, drive the app to that state in a headless browser and write `#root.innerHTML` — **normalized** (collapse whitespace, strip volatile attributes such as animation-progress inline styles) — via a headless-browser `evaluate` call to one snapshot file per state.
  3. **Capture candidate**: produce a temporary build that reads `app.js` with the two `patch()` calls removed and repeat step 2 into a second snapshot directory.
  4. **Diff automatically**: compare the two snapshot directories file-by-file (plain `diff -r`); the gate passes only when the diff is empty.
  5. **Fix the misses baseline as a number**: record `window.__i18n.misses()` from the pre-WP-2 build as a concrete count + key list; the candidate build must reproduce exactly that baseline.
  Only adopt `app.js` as source of truth once the snapshot diff is clean. Keep `index-B_LsmJIL.js` in git history for rollback (see Rollback Plan: WP-2 is rolled back together with WP-5 via the shared branch).
- **Depends on**: []
- **Estimated Effort**: L

#### WP-3: Flavor Content Authoring → `data/flavor.json` (EN+DE crude pastiche, legal-reviewed)
- **Files**: `data/flavor.json` (create)
- **Action**: create
- **Description**: Author the rotating bilingual pools per the §6 schema: top-level `loader`, `gate`, `empty_search`, `empty_inventory`, `footer` arrays, plus a `toast` object with `level_up`, `item_gained`, `achievement`, `title_gained`, `spell_gained`, `floor_change` arrays. Each entry is `{ "en": "...", "de": "..." }`, with an optional `"minBook": <n>` field on any entry that references a plot beat (spoiler cap). Write EN + DE together (decision #4) — DE is natural German profanity/idiom, not literal translation (decision #1: originalgetreu & derb). Reuse and extend the existing house voice ("Goddammit, Donut.", "Entering the dungeon…"). **Mandatory legal-review step**: confirm every line is original "System"-voice pastiche, never verbatim Dinniman text, preserving README's "paraphrasiert, nicht daraus zitiert" stance (README line 170). Keep well under a few KB.
- **Depends on**: []
- **Estimated Effort**: M

#### WP-4: Flavor Runtime → `assets/flavor-runtime.js` (`window.__flavor`)
- **Files**: `assets/flavor-runtime.js` (create)
- **Action**: create
- **Description**: Plain IIFE mirroring `assets/i18n-runtime.js` structure (kept as a separate file for the same regex/escape-safety reason inside `build.mjs` template literals). Read `flavor.json` synchronously from the embedded `<script type="application/json" id="flavor-data">` block — present in **both** `index.html` and `dist/index.html` (concept §5); there is **no fetch path and no "not yet loaded" state**. Expose `window.__flavor.pick(surface, opts)` where `surface` is a dot-path (e.g. `"toast.level_up"`) and `opts = { lang?, cap?, seedKey? }`: resolve the pool, drop entries with `minBook > cap`, then select per the **two-case contract (concept §6)**: with a `seedKey` (per-event surfaces — toasts pass `eventId`/`chapterId`; per-load surfaces pass their mount-pinned index), derive a deterministic index; without one, draw a random index. Return `entry[lang]` falling back to `entry.en`, then to a surface default if the pool is empty. Never throw. Add a `__flavor.misses()` collector mirroring `__i18n.misses()`. Reads `window.__i18n.lang`. The stability of per-load surfaces across a language toggle is the caller's job (WP-6 pins the mount-time random index via `useRef` and re-passes it as `seedKey`).
- **Depends on**: [WP-3] (needs the finalized pool shape; can begin against the agreed schema in parallel)
- **Estimated Effort**: M

#### WP-5: `build.mjs` Integration (drop patches, rename input, embed flavor)
- **Files**: `build.mjs` (modify)
- **Action**: modify
- **Description**: Rename the bundle input from `assets/index-B_LsmJIL.js` to `assets/app.js` in the `Promise.all` read block. **Remove both `patch()` calls and the `patch` helper** (the jsx-factory and root-render edits now live in `app.js` from WP-2) and **replace the guard with a mandatory, zero-dependency source assert in `build.mjs`**: assert that `assets/app.js` contains **exactly one occurrence each** of `window.__i18n.wrapJsx(` and `window.__i18n.mount(`; on any other count, **abort the build with a hard error** (same strength as today's assert-exactly-1-hit `patch()` invariant — "fails loudly at render" alone is not acceptable in a project without a test framework). Read `assets/flavor-runtime.js` and `data/flavor.json`. For **both** `index.html` **and** `dist/index.html`: add a `<script type="application/json" id="flavor-data">` block (escaped via existing `escapeJson`, minified via `minifyJson`) and inline/load `flavor-runtime.js` in order after `i18n-runtime.js` and before the app bundle (in `dist/` it may be emitted as a hashed *script* asset loaded before the module bundle, since script assets are hashed). **Ordering requirement (explicit for the `dist/` branch, `distHtml` in `build.mjs` ~lines 219–225, which has no inline-JSON precedent)**: the `#flavor-data` block must appear textually **before** the `flavor-runtime.js` `<script>` tag — analogous to the `#series-data`/`#i18n-de` placement in `index.html` — because the runtime reads it synchronously via `getElementById` at execute time; placing it after the reader would silently degrade every surface to its static default. **`flavor.json` is never emitted as a separate `dist/` file and is never fetched** — no hashed data file, no lazy path (concept §5: data files are unhashed today, the i18n lazy path fires only on switching to German, and flavor is needed in both languages from the first paint). Update the eager-size log line (`build.mjs` ~lines 244–245) to include the few KB of embedded flavor data.
- **Depends on**: [WP-2, WP-3, WP-4]
- **Estimated Effort**: M

#### WP-6: In-App Flavor Consumption + Toast/Icon Redesign (`assets/app.js` feature edits)
- **Files**: `assets/app.js` (modify — see file-partitioning note)
- **Action**: modify
- **Description**: In the now-readable `app.js`, add a `useFlavor` hook / `<Flavor>` usage that calls `window.__flavor.pick(...)` at each approved surface, passing `{ lang: __i18n.lang, cap: <current book cap V> }` plus the per-surface seed per the **two-case contract (concept §6)** — the concrete mechanism for all surfaces:
  - **Per-load surfaces** — `loader` (`.loading`), `gate` (`SpoilerGate`, `.gate`), `footer`, `empty_search`, `empty_inventory`: at mount, draw a random pool index and **pin it via `useRef`**; every render re-passes the pinned index as `seedKey`, so the line rotates between app starts but a language toggle re-renders the *same* line translated.
  - **Per-event surfaces** — every toast kind (`level_up`, `item_gained`, `achievement`, `title_gained`, `spell_gained`, `floor_change`): pass a **deterministic `seedKey` = the toast's `eventId`/`chapterId`**; the same event always yields the same line in either language.
  Redesign the toast renderer markup into the System-notification card (monospace `SYSTEM` header element, kind-colored rail, `toast-body` = flavor line) using the announcer class names from the shared contract (WP-1), and extend/rename the `Dc` icon map + `Icon` usage to the new inline-SVG glyph set. **Implementation/review criterion (not a claim about the existing bundle, whose React vendor region legitimately contains `innerHTML` sinks)**: render all flavor and SVG strictly as escaped React children — no new `dangerouslySetInnerHTML`/`innerHTML` outside the marked vendor region; verify with a grep over `app.js` (repeated in WP-10). Every surface keeps its existing hard-coded English default as the fallback when a pool is empty.
- **Depends on**: [WP-2, WP-5, WP-4, WP-3]
- **Estimated Effort**: L

#### WP-7: "System" Visual Identity → `assets/theme.css`
- **Files**: `assets/theme.css` (modify), `mockups/flavor.css` (delete after merge)
- **Action**: modify + delete
- **Description**: Port — i.e. **copy, not re-author** — the announcer rules proven in `mockups/flavor.css` (WP-1) into the real `theme.css`, then **delete `mockups/flavor.css`** so the class definitions have exactly one home (the mockup HTML pages keep working against `theme.css`, which now contains the same classes). The announcer class-name list is the shared contract from WP-1 — verify the ported selectors match both the mockup DOM and the WP-6 `app.js` markup: redesign `.toast`/`.toast-head`/`.toast-body`/`.toast-icon` and the per-kind variants (`.toast-level_up`, `.toast-item_gained`, …) into System-notification cards (monospace `SYSTEM` header, kind-colored left rail); apply the crude announcer treatment to `.loading`, `.gate`/`.gate-card`/`.gate-question`, `.slot.empty`, and `.footer-note`; add the `.system-banner` component class (built now, content-gated to phase 2). Use only existing CSS variables (`--book-1..8`, `--crimson`, `--amber`, rarity colors) and inline-SVG glyph styling — no external/raster assets. Place any new animation under the existing `@media (prefers-reduced-motion: reduce)` guard (theme.css line ~1636). Coordinates with WP-6 markup but is a strictly separate file.
- **Depends on**: [WP-1]
- **Estimated Effort**: M

#### WP-8: i18n Reconciliation & Miss Smoke-Check
- **Files**: `tools/i18n-extra.de.json` (modify), `data/i18n.de.json` (modify)
- **Action**: modify
- **Description**: Flavor copy is self-bilingual via `flavor.json` and bypasses the i18n dictionary, so this WP covers only *new non-flavor* translatable strings introduced by WP-6/WP-7 (e.g. any new `aria-label`, heading, or visually-hidden label — the `SYSTEM` proper noun is language-neutral and needs none). Add German counterparts to `tools/i18n-extra.de.json` and regenerate/merge into `data/i18n.de.json` via the existing pipeline. Verify by building and asserting `window.__i18n.misses()` returns only the known baseline items and `window.__flavor.misses()` is empty (no DE gaps).
- **Depends on**: [WP-6]
- **Estimated Effort**: S

#### WP-9: Documentation Update → `README.md`
- **Files**: `README.md` (modify)
- **Action**: modify
- **Description**: Update the architecture section: replace the "zwei chirurgische Eingriffe am minifizierten Bundle" description with the new reality (`assets/app.js` is the de-minified source of truth; the i18n hook calls live in source; `build.mjs` no longer patches). Document `data/flavor.json`, `assets/flavor-runtime.js` / `window.__flavor`, and the `mockups/` directory. Reaffirm the "paraphrasiert, nicht daraus zitiert" legal posture now that flavor copy is crude pastiche.
- **Depends on**: [WP-5, WP-6]
- **Estimated Effort**: S

#### WP-10: CI Post-Build Smoke Check (mandatory)
- **Files**: `tools/smoke-build.mjs` (create), `.github/workflows/pages.yml` (modify)
- **Action**: create + modify
- **Description**: **Mandatory** (it is, together with the WP-5 source assert, the compensation for the removed `patch()` guard in a project without a test framework). Add a lightweight zero-dependency Node smoke script that runs after `node build.mjs` and asserts: `index.html` and `dist/index.html` were produced; the `#flavor-data` block is embedded in **both**; `flavor-runtime.js` is present; optionally (cheap string-index check) that in each HTML file the `#flavor-data` block appears textually before the `flavor-runtime.js` script tag (the WP-5 ordering requirement); `assets/app.js` contains exactly one `window.__i18n.wrapJsx(` and one `window.__i18n.mount(` (re-checking the WP-5 build assert); and a **grep check** that no `dangerouslySetInnerHTML`/`innerHTML` occurrence exists in `app.js` outside the marked React vendor region (F3/WP-6 criterion). The `__i18n.misses()`-baseline assertion is likewise **mandatory**: if a headless render check is feasible without new deps, assert `#root` renders and `__i18n.misses()` matches the recorded baseline in CI; otherwise perform that assertion as a mandatory local pre-merge step (documented in the script's header) while CI carries the static assertions. Wire the script into `pages.yml` as a step after the existing `- run: node build.mjs`, preserving the no-`npm-install` promise.
- **Depends on**: [WP-5]
- **Estimated Effort**: S

### Execution Order
- **Parallel Group 1** (fully independent): **WP-1** (mockups), **WP-2** (de-minify + verify), **WP-3** (flavor content)
- **Parallel Group 2** (after their deps): **WP-4** (flavor-runtime — after WP-3 schema), **WP-7** (theme.css — after WP-1 design)
- **Sequential — WP-5** (build.mjs — after WP-2, WP-3, WP-4)
- **Sequential — WP-6** (app.js feature edits — after WP-2, WP-5, WP-4, WP-3)
- **Parallel Group 3** (after WP-6/WP-5): **WP-8** (i18n reconcile — after WP-6), **WP-10** (CI smoke — after WP-5)
- **Sequential — WP-9** (README — after WP-5, WP-6)

### Milestones
1. **Design sign-off** — user approves the look via WP-1 mockups (opened in-browser, EN+DE side by side). *Gate before heavy CSS/app work.*
2. **Readable source of truth** — WP-2 adopted: `app.js` renders byte-behaviorally identical to today (clean DOM diff across the full timeline). *Everything downstream now edits real source.*
3. **Flavor infrastructure wired** — WP-3 + WP-4 + WP-5: `node build.mjs` produces `index.html`/`dist/` with `flavor.json` embedded inline in both, no `patch()` calls (replaced by the hard source assert), `window.__flavor.pick` live.
4. **Feature live** — WP-6 + WP-7: rotating crude announcer voice + System visual identity render on all approved surfaces, language toggle keeps the same line translated, spoiler cap respected.
5. **Polish & ship** — WP-8 (no i18n/flavor misses), WP-9 (docs), WP-10 (CI smoke); ready to commit.

### Testing Strategy
- **No test framework exists** (zero-dependency, no `package.json`); verification is `node build.mjs` + opening `index.html` and `dist/index.html` in a browser.
- **WP-2 (critical)**: the repeatable snapshot procedure specified in WP-2's Verification — finite state list, normalized `#root.innerHTML` snapshots per state captured via headless-browser `evaluate`, automated before/after directory diff, and the `__i18n.misses()` baseline fixed as a concrete count + key list. This is the adoption gate.
- **WP-3**: human legal review — no verbatim book text; DE reads as natural profanity/idiom, not literal translation.
- **WP-4/WP-6**: fire each toast kind and each empty/loader/gate/footer surface; toggle language and confirm the *same* pooled line returns translated (no reshuffle) for both surface classes; reload the app several times and confirm per-load surfaces (loader/gate/footer/empty) actually rotate between starts while a given toast event always shows the same line; set a low book cap and confirm `minBook`-gated entries are filtered; force an empty/malformed `#flavor-data` block and confirm every surface degrades to its static English default; `__flavor.misses()` empty; grep confirms no new `innerHTML`/`dangerouslySetInnerHTML` outside the marked vendor region.
- **WP-5**: build succeeds with no `patch()` calls; the source assert works both ways (build passes with exactly one `wrapJsx(`/`mount(` occurrence each, and a deliberately duplicated/removed call aborts the build); `index.html` stays self-contained and works via `file://`; `dist/index.html` contains the embedded `#flavor-data` block and no separate `flavor.json` file or fetch is emitted.
- **WP-7**: visual check against mockups; confirm new animation is suppressed under `prefers-reduced-motion`.
- **Cross-cutting**: confirm offline `file://` operation and the spoiler gate still behave unchanged.

### Rollback Plan
- All work is git-tracked; `index-B_LsmJIL.js` remains in history. **WP-2 and WP-5 are coupled and roll back together via their shared branch**: reverting WP-2 alone would leave the WP-5 `build.mjs` reading a no-longer-existing `assets/app.js` and break the build. Rollback of the de-minification therefore means reverting the whole WP-2+WP-5 branch merge (one revert of the merge commit), restoring both the minified bundle and the `patch()`-based `build.mjs` atomically.
- Keep the current `patch()`-based `build.mjs` untouched on `main` until WP-2's snapshot diff passes; do WP-2 and the `build.mjs` rewrite (WP-5) together on that branch so `main` stays buildable at every point.
- `data/flavor.json`, `assets/flavor-runtime.js`, and `mockups/` are additive — deleting them plus reverting the `app.js` feature edits (WP-6) returns to a plain de-minified app with no flavor.
- Because every surface retains its hard-coded English default, a broken/empty `flavor.json` degrades gracefully rather than breaking the UI.

### Open Questions
- **`app.js` double-touch (single deliberate partitioning exception)**: `assets/app.js` is owned by WP-2 (de-minified baseline) and again edited by WP-6 (feature). This is the one intentional shared file; it is mitigated by strict sequencing (WP-6 depends on WP-2 and never runs in parallel with it). Every other source file is in exactly one WP.
- **Persistent System banner in phase 1?** Concept §10 proposes building the `.system-banner` *treatment* now (WP-1/WP-7) but gating a dedicated always-on banner to phase 2. Confirm the user does not want a persistent banner surface in phase 1.
- **Ship prettified vs. esbuild-minify** (§9): default is ship prettified (`app.js` grows ~225 KB → ~0.5 MB) to preserve the zero-`npm-install` CI promise. Revisit only if `dist/` first-load size becomes a real concern.
- **`boot.js` embers-canvas hook**: left unchanged (not in any WP). Revisit whether the canvas-neutering hook is still needed only after the visual redesign settles.
- **WP-10 scope**: whether the headless render assertion is achievable in CI without adding a dependency. WP-10 itself is mandatory either way; if headless-in-CI is not feasible dependency-free, only that one assertion moves to a mandatory local pre-merge step while the static assertions (artifacts, embedding, source-assert re-check, vendor-region grep) stay in CI.
