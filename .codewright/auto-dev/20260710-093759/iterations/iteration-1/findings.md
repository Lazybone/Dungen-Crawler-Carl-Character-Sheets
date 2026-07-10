# Meta-gefilterte Findings — Iteration 1

Rohbefunde: LOGIC 0 · SECURITY 0 · ARCH 0 · QUALITY 2 low · TEST-CORRECTNESS 1 medium + 1 low · A11Y 1 medium + 1 low.
Meta-Review koordinator-seitig durchgeführt (6 Findings, keine Duplikate; dedizierter Meta-Agent aus Kostengründen eingespart — Entscheidung dokumentiert, meta_skipped: false, meta_inline: true).

## Akzeptiert (zu fixen)
1. **TC-F1 [MEDIUM] f4bc4758d01d** — smoke-build.mjs Check (b): False-Pass reproduziert; `id="flavor-data"` matcht auch einen Kommentar in der Inline-Runtime. Fix: dataIdx an echtes Script-Tag koppeln (`/<script[^>]*id="flavor-data"/i`).
2. **A11Y-F1 [MEDIUM] 1830d86bca23** — informative Leertreffer-Zeile (app.js:10304-10309) fällt mit opacity:0.7 auf ~3.1:1 unter WCAG AA. Fix: opacity ersetzen durch color var(--ink-2).
3. **TC-F2 [LOW] 88f7d8dee17a** — flavorRuntimeIndex an doppelte Quotes gekoppelt (False-Fail-Risiko). Fix: Regex mit ['"].
4. **A11Y-F2 [LOW] 43b5862d4147** — dekorative Pseudo-Element-Glyphen ([ ] ▎) landen im Accessibility-Tree. Fix: CSS content-Alt-Text (`content: "[" / ""`).
5. **Q-F1 [LOW] 13f6b77d1b8f** — tote CSS-Regeln .slot.empty.system-empty/.system-empty-tag/.system-empty-line-Slot-Variante (theme.css:1224-1246), kein Consumer. Fix: entfernen (nach Grep-Absicherung in mockups/).

## Abgelehnt (False Positive)
- **Q-F2 [LOW] ee22daf79780** — „ungenutzte .system-banner": Widerspricht dem abgenommenen Plan/Konzept (§10/WP-7: Treatment wird JETZT gebaut, Inhalt ist Phase 2; Mockup existiert; Kommentar im CSS dokumentiert es). Bewusstes Scaffolding, kein Defekt.

Severity-Routing: kein CRITICAL → Standard-Fix-Run. Fixes koordinator-seitig (klein, präzise spezifiziert; Fixer-Agenten eingespart), Re-Verifikation durch die aktiven Reviewer (test-correctness, a11y, quality) in Iteration 2.
FSM: logic/security/architecture → DORMANT; quality/test-correctness/a11y → ACTIVE.
