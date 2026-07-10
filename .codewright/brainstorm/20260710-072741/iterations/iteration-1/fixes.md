# Fixes — Iteration 1

Alle 9 konsolidierten Findings (F1–F9) wurden vom Concept Fixer in concept.md und plan.md eingearbeitet; keine NEEDS_REVIEW-Skips.

Kernänderungen:
- F1 (MAJOR): flavor.json wird in BEIDEN Builds eager inline eingebettet (<script type="application/json" id="flavor-data">); Fetch-/Lazy-Pfad und Hash-Behauptung vollständig entfernt; kein "not yet loaded"-Fall mehr.
- F2 (MAJOR): pick-Kontrakt in zwei Fälle getrennt — Per-Load-Flächen (Zufallsindex beim Mount, via useRef gepinnt, als seedKey re-passed) vs. Per-Event-Flächen (deterministisch eventId/chapterId). Mechanismus pro Fläche benannt.
- F3: innerHTML-Schutzregel als bindendes WP-6-Kriterium + grep-Check (WP-6/WP-10) statt falscher Ist-Beschreibung.
- F4: CSP-Verzicht als bewusstes Nicht-Ziel dokumentiert (file:// + Inline-Architektur), optionale Meta-CSP für dist/ notiert.
- F5: Vendor-Grenzkommentare in app.js als WP-2-Pflicht.
- F6 (MAJOR): build.mjs bekommt verpflichtenden Quell-Assert (genau 1× wrapJsx/mount in app.js, sonst Abbruch); WP-10 von optional auf verpflichtend.
- F7 (MEDIUM): WP-2-Gate mit konkretem 5-Schritt-Snapshot-Verfahren (endliche Zustandsliste, normalisierte #root.innerHTML-Snapshots, automatischer Diff, misses()-Baseline als Zahl+Keyliste).
- F8: Rollback = WP-2+WP-5 gekoppelt über gemeinsamen Branch, ein Revert des Merge-Commits.
- F9: exaktes Dc-Literal; Announcer-Klassenliste als geteilter Vertrag; mockups/flavor.css wird nach Merge gelöscht.

Kohärenz Konzept ↔ Plan: verifiziert. Fixer-Notiz: gepinnt wird der Index (nicht der String), damit Sprachwechsel dieselbe Zeile übersetzt rendert.
