# Konsolidierte Review-Findings — Iteration 1

Reviewer: LOGIC (2 MAJOR), QUALITY (2 MEDIUM, 2 LOW), ARCH (3 MAJOR, 1 MINOR, 1 INFO), SECURITY (2 LOW, 1 INFO).
Nach Deduplizierung: 9 Findings. Merges: F1 = LOGIC#1 + LOGIC#2 + ARCH#3 (flavor.json-dist-Auslieferung); F2 = QUALITY#1 + ARCH#1 (Rotations-Kontrakt).

---

## Gruppe A: concept.md

### F1 [MAJOR] [LOGIC+ARCH, merged] `flavor.json`-Auslieferung im dist/ ist in sich widersprüchlich und legt das Feature für Englisch-Erstbesucher still
- **Dokumente:** concept.md §5 (Build Pkt 3), §6 (`pick` Error Cases „not yet loaded"), §9 (Caching); plan.md WP-5
- **Probleme (drei verifizierte Teilaspekte):**
  1. (LOGIC) Content-Hashing UND Lazy-Fetch über festen Pfad schließen sich aus: `build.mjs:239` schreibt Daten-Dateien UNGEHASHT (`dist/data/i18n.de.json`), `i18n-runtime.js:22` fetcht die hartkodierte URL `data/i18n.de.json`. Nur Skript-Assets werden gehasht. „like the other assets" / „parallel to the i18n dict lazy path" ist für Daten-Dateien sachlich falsch; ein gehashter Name wäre garantierter 404.
  2. (LOGIC) Der i18n-Lazy-Pfad lädt NUR beim Umschalten auf Deutsch (`i18n-runtime.js:47-50` `withDict`). Flavor wird aber in BEIDEN Sprachen ab dem ersten Paint gebraucht → englische Erstbesucher im dist/ sähen dauerhaft nur die statischen Defaults; zudem fehlt jeglicher Re-Render-Trigger nach abgeschlossenem Fetch („resolve on next render" hat keinen Mechanismus).
  3. (ARCH) Das Dual-Path-Muster existiert wegen der ~900 KB des Wörterbuchs; `flavor.json` hat „a few KB" — das Muster zu spiegeln kopiert Komplexität ohne Nutzen und degradiert ausgerechnet den Loader (erste gerenderte Fläche, mountet nur einmal — Fetch wäre beim ersten Paint noch in-flight).
- **Konsolidierte Empfehlung:** `flavor.json` in BEIDEN Builds eager inline einbetten (auch im dist/ als `<script type="application/json" id="flavor-data">`-Block statt separater Datei). Der Fetch-Pfad in `flavor-runtime.js` entfällt komplett (kein „not yet loaded"-Fall, kein Re-Render-Problem, Loader hat Pool + Deutsch ab dem ersten Paint). §5, §6, §9 und WP-5 entsprechend angleichen; Hash-Behauptung streichen; Eager-Size-Log (`build.mjs:244-245`) um die wenigen KB ergänzen.

### F2 [MAJOR] [QUALITY+ARCH, merged] `__flavor.pick`-Kontrakt vermischt zwei widersprüchliche Rotations-Mechanismen; für Nicht-Toast-Flächen ist kein `seedKey` definiert → Rotation entfällt faktisch
- **Dokumente:** concept.md §4 (Flavor Consumption), §6 (`pick`-Interface), §7 (Language-toggle-Edge-Case); plan.md WP-4, WP-6
- **Probleme:**
  1. (ARCH) „deterministic index from `seedKey`" (§6) und „pin the chosen index per mount via `useRef`" (§4/§7) sind redundant bis kollidierend — eines von beiden ist überflüssig, je nachdem welches gilt.
  2. (QUALITY) Für Loader, Gate, Footer, Empty-States ist kein `seedKey` benannt; ein konstanter Seed ergibt bei deterministischem `pick` bei jedem App-Start dieselbe Zeile — Verletzung von Decision #3 („zufällig rotierende Sprüche").
- **Konsolidierte Empfehlung:** Kontrakt nach zwei realen Fällen trennen und in §6 + WP-4 präzise spezifizieren: (1) **Per-Load-Flächen** (loader/gate/footer/empty_*): beim Mount Zufallsindex ziehen, in `useRef` fixieren → rotiert zwischen App-Starts, bleibt beim Sprachwechsel stabil. (2) **Per-Event-Flächen** (Toasts): deterministischer `seedKey = eventId/chapterId`. Für alle fünf Flächen den konkreten Seed/Mechanismus benennen.

### F3 [LOW] [SECURITY] Aussage „no dangerouslySetInnerHTML" ist als Ist-Beschreibung falsch (Vendor-Region enthält es mehrfach) — als WP-6-Kriterium umformulieren
- **Dokumente:** concept.md §7 (XSS, Zeile ~147); plan.md WP-6
- **Problem:** Das reale Bundle enthält `dangerouslySetInnerHTML`/`innerHTML` mehrfach — verifiziert alle im React-Vendor-Reconciler, keine bestehende Schwachstelle. Aber die Konzept-Aussage beschreibt den Ist-Zustand falsch, und WP-6 fügt genau dort neue SVG-/Toast-Pfade hinzu.
- **Empfehlung:** Schutzregel als explizites Umsetzungs- und Review-Kriterium für WP-6 formulieren („Flavor und SVG ausschließlich als React-escapte Children, nie über `innerHTML`-Sinks") statt als Ist-Beschreibung; in WP-6/WP-10 grep-Check ergänzen: kein NEU hinzugefügtes `innerHTML`/`dangerouslySetInnerHTML` außerhalb der Vendor-Region.

### F4 [INFO] [SECURITY] Fehlende CSP nicht implizit auslassen, sondern bewusst als Nicht-Ziel dokumentieren
- **Dokumente:** concept.md §8
- **Empfehlung:** In §8 (oder §1 Non-Goals) festhalten: CSP ist für `file://` wirkungslos und mit der Inline-Architektur nur via `unsafe-inline` umsetzbar → bewusstes Nicht-Ziel Phase 1; optionale minimale `<meta>`-CSP für dist/ als spätere Defense-in-Depth notieren.

### F5 [INFO] [ARCH] Vendor-Grenze im de-minifizierten `app.js` am Code markieren
- **Dokumente:** concept.md §4 (Komponente app.js), §7; plan.md WP-2
- **Empfehlung:** In WP-2 festschreiben: Die React-Vendor-Region wird im `app.js` selbst mit Grenzkommentaren markiert (z. B. `// ─ React vendor region — do not edit ─`), damit die „nicht anfassen"-Invariante am Code klebt.

## Gruppe B: plan.md

### F6 [MAJOR] [ARCH] Wegfall des `patch()`-Guards ersetzt harte Build-Invariante durch weiche Laufzeit-Zusage; Kompensation ist „optional"
- **Dokumente:** plan.md WP-5, WP-10
- **Problem:** Heute erzwingt `build.mjs` via `patch()` (Assert genau-1-Treffer) Build-Abbruch bei verrutschter i18n-Verdrahtung. Nach WP-5 gibt es nur „fails loudly at render" — in einem Projekt ohne Test-Framework bemerkt das nur ein Mensch. Die einzige Kompensation (WP-10) ist „optional but recommended".
- **Empfehlung:** In WP-5 einen billigen dependency-freien Quell-Assert in `build.mjs` festschreiben: genau ein Vorkommen von `window.__i18n.wrapJsx(` und `window.__i18n.mount(` in `assets/app.js`, sonst harter Abbruch. WP-10 (inkl. `misses()`-Assertion) von „optional" auf verpflichtend heben.

### F7 [MEDIUM] [QUALITY] WP-2-Adoptions-Gate (DOM-Diff) ohne konkretes, wiederholbares Verfahren
- **Dokumente:** plan.md WP-2 (Verification), Testing Strategy
- **Problem:** Das Gate, an dem alles hängt, ist rein manuell beschrieben. Wie wird das DOM erfasst, normalisiert, verglichen? „Drive the full timeline" ist eine große manuelle Fläche.
- **Empfehlung:** Konkretes Snapshot-Verfahren festlegen: endliche Zustandsliste definieren; pro Zustand `#root.innerHTML` (normalisiert) via Headless-Browser-`evaluate` in Dateien schreiben; Vor-/Nach-Build automatisch diffen; `__i18n.misses()`-Baseline als konkrete Zahl fixieren.

### F8 [LOW] [QUALITY] Rollback-Formulierung „revert the WP-2 commit" isoliert irreführend
- **Dokumente:** plan.md Rollback Plan
- **Problem:** WP-2-Revert allein ließe `build.mjs` (nach WP-5 auf `app.js` umgestellt) eine nicht mehr existente Datei lesen → Build bricht. Die Branch-Strategie-Zeile deckt es korrekt ab, widerspricht aber der Commit-Revert-Formulierung.
- **Empfehlung:** Rollback an Branch-Strategie angleichen: WP-2+WP-5 werden zusammen gemergt und zusammen zurückgerollt; Einzel-Commit-Revert-Formulierung ersetzen.

### F9 [LOW] [QUALITY+ARCH] Kleinere Präzisierungen: `Dc`-Map exakt zitieren; `mockups/flavor.css` als Wegwerf-Kopie deklarieren
- **Dokumente:** plan.md WP-2 (+ concept.md §4 Zeile ~48); plan.md WP-1/WP-7
- **Probleme:** (a) `Dc`-Map ist verkürzt zitiert; real: `Dc={achievement:"achievement",level_up:"level_up",item_gained:"chest_box",title_gained:"crown",spell_gained:"spell",floor_change:"level_up"}`. (b) Announcer-Klassennamen leben in drei Dateien (mockups/flavor.css → theme.css → app.js-Markup) ohne gemeinsame Quelle.
- **Empfehlung:** (a) Exaktes Map-Literal übernehmen. (b) Klassenliste als expliziten geteilten Vertrag benennen, gegen den WP-6/WP-7 verifizieren; WP-7 portiert (kopiert) aus `mockups/flavor.css` statt neu zu autoren; festhalten, dass `mockups/flavor.css` nach dem Merge in theme.css gelöscht wird.
