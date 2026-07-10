# Task: Mehr Dungeon-Crawler-Carl-Flair für die Character-Sheet-App

## Original Task Description (User)

> kannst du das ganze vielleicht irgendwie mehr Dungeon Crawler Carl mäßig machen? Vielleicht mehr Sprüche ins UI, Grafiken oder so. Gerne mit Mockups oder so

## Requirement Analysis

## Analysis

- **Task Type**: feature (visual/flavor enhancement — adding "Dungeon Crawler Carl" universe personality, graphics, and mockups to an existing character-sheet web app)
- **Complexity**: high
- **Affected Areas**:
  - `assets/theme.css` — the entire visual language (neon "Blacklight" theme) lives here; CSS is the lowest-friction lever for graphics/flavor
  - `assets/i18n-runtime.js` — the JSX-factory hook that every rendered text node passes through; the natural injection point for text-level flavor without touching the bundle
  - `assets/boot.js` — pre-bundle runtime script; precedent for DOM/behavior injection that is independent of the minified React source
  - `data/i18n.de.json` + `tools/i18n-extra.de.json` — any new user-facing English string needs a German counterpart here or it renders English mid-German UI
  - `build.mjs` — only path to change the hard-coded English strings baked into the minified bundle (surgical, verified single-hit patches)
  - `data/series.json` — if flavor quotes become data-driven (per book/floor/event)
  - New mockup artifacts (delivered later in the plan phase, not by this read-only analysis)
- **Existing Patterns**:
  - **No React source exists** — `assets/index-B_LsmJIL.js` is a minified bundle (40 lines, 225 KB). The project already established three ways to modify behavior *around* it: CSS (`theme.css`), a pre-bundle runtime script (`boot.js`), and a JSX-factory wrapper (`i18n-runtime.js`). `build.mjs` does "two surgical patches" that abort if a pattern doesn't hit exactly once.
  - **Blacklight visual identity** is already strong and intentional: near-black paper, eight per-book neon cover colors as CSS variables, glow instead of drop-shadow, tilted "cover typography," a radial-gradient confetti/starfield body background, animated loot "shine" sweep, toast notifications, a timeline "broadcast bar" with a rainbow scrubber.
  - **Sparse existing flavor** already present, so a house voice exists to extend: footer `"Unofficial fan project… Goddammit, Donut."`, loader `"Entering the dungeon…"`, tagline `"…drag the timeline and watch them grow"`, `"Search the crawl"`, spoiler gate `"How far into the crawl are you?"`.
  - **Toast system** (`toast-level_up`, `toast-item_gained`, `New Achievement!`, `Title Bestowed`) is the closest thing to a "System announcer" surface and a strong candidate for AI-announcer voice.
  - **i18n contract**: English is the source of truth inside the bundle; unknown strings fall back to English rather than disappearing. Legal note in README: data is *paraphrased, not quoted* from the books.
- **Risks**:
  - **Tone calibration**: the DCC AI announcer is deliberately crude/profane/insulting. The current app is tasteful and restrained (one mild "Goddammit, Donut."). Pushing crude humor too far could clash with the polished design or feel off-brand; too little misses the request.
  - **Minified-bundle ceiling**: "more graphics in the UI" cannot easily mean new React components. Realistic graphics = CSS decoration, SVG/background assets, and DOM injection via a boot-style script or the JSX hook. Scope must be framed around what these levers can do.
  - **Bilingual drift**: every new English quote needs a German twin, or the German UI shows stray English. Randomized/rotating quote pools multiply this cost.
  - **Spoiler leakage**: the app has a spoiler gate (book cap). Flavor tied to specific events/floors could reveal plot beyond the reader's chosen cap if not gated the same way.
  - **Legal line**: verbatim book quotes conflict with the project's stated "paraphrased, not quoted" stance — flavor text likely needs to be original-voice pastiche, not real excerpts.
  - **file:// + no-network constraint**: the app runs offline from a single HTML file; any graphics must be embeddable (inline SVG / base64), not external URLs.
  - **Mockup format undefined**: "Mockups or so" — deliverable form (annotated static HTML, rendered images, before/after screenshots) isn't specified.

## Codebase Context

This is a self-contained, offline-first fan app: one `index.html` (2.7 MB, embeds fonts + data) plus a cacheable `dist/` for web hosting, both built by `build.mjs` from `assets/` and `data/`. The React UI is shipped only as a minified bundle with no source, so the project has evolved a distinctive "modify around the bundle" architecture — CSS theming, a pre-bundle `boot.js` runtime hook, and an `i18n-runtime.js` wrapper around the JSX factory that intercepts every rendered text node. The recently added "Crawler Blacklight" theme (`theme.css`) already gives the app a confident cover-inspired neon aesthetic with per-book colors, glow, and a confetti starfield, and there is a thin but real layer of in-universe voice ("Entering the dungeon…", "Goddammit, Donut.", "Search the crawl"). The app is fully bilingual through an English-source dictionary with English fallback, so any new flavor is a two-language content commitment, and the existing spoiler gate plus the "paraphrased, not quoted" legal posture constrain *what* flavor content is allowed to appear and *when*.

## Questions

1. **How crude/irreverent should the announcer voice go?** The DCC "System" is famously profane and insulting; the app today is restrained (one mild "Goddammit, Donut.").
   - A) Faithful & crude — lean into the announcer's mocking, profanity-adjacent tone (e.g. sardonic loot/level-up barbs)
   - B) Cheeky but clean — in-universe wit and sarcasm, no real profanity, safe for all audiences and screenshots
   - C) Two-tier — clean by default with an optional "unfiltered announcer" toggle for the crude version
   - **Recommendation**: **B**, with the door open to C later.

2. **Which surfaces should receive flavor text?** Candidates found in the code: loader, spoiler gate, empty states ("Nothing in the first…", "Not yet revealed in the story"), toasts (level-up / item / achievement / title), footer, tooltips, timeline "Time Travel" bar.
   - A) Text-only, high-impact surfaces (loader, gate, empty states, footer, toasts)
   - B) Everything including per-item tooltip barbs and per-floor timeline captions (data-driven, much larger content set)
   - C) A curated subset you approve from a proposed list
   - **Recommendation**: **A** for phase one.

3. **Static or rotating quotes, and where does the content live?**
   - A) Small fixed strings hardcoded per surface (simplest, fewest moving parts)
   - B) Randomized pools rotating per view/interaction, defined in a new data file (e.g. `data/flavor.json`)
   - **Recommendation**: **B** with a dedicated data file.

4. **How should new English flavor be handled in the German UI?**
   - A) Author every quote in both EN and DE up front (no fallback gaps)
   - B) Ship EN-only now and accept English quotes appearing in the German UI until translated
   - **Recommendation**: **A**.

5. **What does "graphics" mean here, given the constraints?** New React components aren't feasible; embeddable CSS/SVG and DOM injection are.
   - A) CSS/SVG decoration only — announcer "System" banner styling, in-universe iconography, richer background/loot motifs, an announcer-style toast redesign
   - B) Add embedded raster/SVG art assets (character motifs, book-cover-style badges) inlined for offline use
   - C) Both — decorative CSS plus a few embedded art assets
   - **Recommendation**: **A** (optionally growing to C).

6. **What form should the requested mockups take?** The app is a single offline HTML file, so "mockups" needs a concrete format.
   - A) Static annotated HTML mockup page(s) reusing `theme.css`, rendered in-browser
   - B) Rendered before/after screenshots/images of proposed states
   - C) A written concept doc with inline visual descriptions only
   - **Recommendation**: **A**.

## User Answers

1. **Tonalität**: **Originalgetreu & derb** — die Announcer-Stimme darf so spöttisch, beleidigend und profan sein wie das „System" in den Büchern (sardonische Loot-/Level-Up-Sticheleien ausdrücklich erwünscht). Kein Clean-Modus als Default.
2. **Umfang**: **High-Impact-Flächen** — Loader, Spoiler-Gate, Empty States, Footer und Toasts (Level-Up/Item/Achievement/Titel). Tooltips und Per-Floor-Timeline-Kommentare sind NICHT Teil von Phase eins.
3. **Quotes**: **Rotierende Pools in `data/flavor.json`** — zufällig rotierende Sprüche pro Fläche, neue Datendatei mit parallelen EN/DE-Arrays, eingebettet über das bestehende Build-Muster.
4. **i18n**: **EN + DE gleich mitliefern** — jeder Spruch wird von Anfang an in beiden Sprachen verfasst; keine englischen Lücken im deutschen UI.
5. **Architektur** (Rückfrage des Users: „kannst du das minifizierte Bundle zurück minifizieren um es gescheit anpassen zu können?"): **Bundle de-minifizieren** — das Vite-React-Bundle (225 KB, keine Sourcemap) wird prettifiziert, Kernkomponenten werden identifiziert und benannt, und das de-minifizierte Bundle wird die neue Source of Truth. Volle Freiheit für echte UI-Änderungen (neue Komponenten, Announcer-Banner, Toast-Redesign, SVG-Grafiken im UI). Akzeptierter Trade-off: Upstream-Updates vom Original werden schwieriger; die Patch-Architektur (boot.js, i18n-runtime.js, build.mjs-Patches) muss angepasst werden.
6. **Mockups**: **Statische HTML-Mockups**, die das echte `theme.css` wiederverwenden — pixelgenaue In-Browser-Vorschau der vorgeschlagenen Zustände, ohne Risiko fürs Produktions-Bundle.
