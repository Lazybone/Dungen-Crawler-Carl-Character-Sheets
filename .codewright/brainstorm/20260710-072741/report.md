# Brainstormer Report

## Task
Die Dungeon-Crawler-Carl-Character-Sheet-App mehr „Dungeon Crawler Carl"-mäßig machen: derbe „System"-Announcer-Sprüche im UI, Grafiken/visuelle Identität, mit HTML-Mockups. Bindende Entscheidungen: originalgetreu-derber Ton, High-Impact-Flächen (Loader, Spoiler-Gate, Empty States, Footer, Toasts), rotierende zweisprachige Quote-Pools in data/flavor.json, EN+DE gemeinsam verfasst, De-Minifizierung des React-Bundles als neue Source of Truth, statische HTML-Mockups mit dem echten theme.css.

## Concept
.codewright/plan/concept.md — De-minified Bundle (assets/app.js), window.__flavor-Runtime mit eager-inline eingebettetem flavor.json in beiden Builds, Zwei-Fall-Rotations-Kontrakt (per-load: Zufallsindex beim Mount via useRef; per-event: deterministischer seedKey), „System"-Visual-Identity (Announcer-Toasts, Inline-SVG, CSS), Spoiler-Gating via minBook, Legal-Gate (Pastiche statt Zitat).

## Implementation Plan
.codewright/imple/plan.md — 10 Work Packages (WP-1 Mockups, WP-2 De-Minify+Snapshot-Gate, WP-3 Flavor-Content, WP-4 Flavor-Runtime, WP-5 build.mjs-Integration inkl. hartem Quell-Assert, WP-6 App-Feature-Edits, WP-7 theme.css, WP-8 i18n-Abgleich, WP-9 README, WP-10 verpflichtender CI-Smoke-Check), 5 Milestones, Test- und Rollback-Strategie.

## Review Summary
- **Iterations**: 3 (Budget: 5)
- **Reviewers**: Logic, Quality, Architecture, Security (alle 4 in Iteration 1; danach adaptiv verengt)
- **Findings resolved**: 10 (nach Deduplizierung; 4 MAJOR, 2 MEDIUM, 4 LOW/INFO) — u. a. flavor.json-dist-Auslieferung auf eager-inline umgestellt, Rotations-Kontrakt entwirrt, patch()-Guard durch Build-Assert ersetzt, WP-2-Gate mit reproduzierbarem Snapshot-Verfahren
- **Acceptance Review**: 4/4 ACCEPT, 0 Findings

## Next Steps
- Konzept und Plan reviewen (insb. Open Questions: persistenter System-Banner in Phase 1? ship-prettified vs. esbuild?)
- Zur Implementierung übergehen (z. B. mit auto-dev), beginnend mit Parallel-Gruppe 1: WP-1 (Mockups), WP-2 (De-Minify), WP-3 (Flavor-Content)
