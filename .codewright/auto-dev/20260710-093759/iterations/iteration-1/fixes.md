# Fixes — Iteration 1 (koordinator-seitig, Standard-Run, kein CRITICAL)

- TC-F1 [MEDIUM] f4bc4758d01d: smoke-build.mjs Check (b) — dataIdx nun an echtes einzeiliges Script-Tag gekoppelt (/<script[^>\n]*\bid=(["'])flavor-data\1/). Erste Fix-Version mit [^>]* wäre weiterhin am mehrzeiligen Runtime-Kommentar vorbeigerutscht — koordinator-seitig per Simulation entdeckt und nachgeschärft. Verifiziert: normal=PASS, Block verschoben=FAIL erkannt, Block entfernt=FAIL erkannt, dist=PASS.
- TC-F2 [LOW] 88f7d8dee17a: flavorRuntimeIndex quote-tolerant (getElementById(["']flavor-data["'])).
- A11Y-F1 [MEDIUM] 1830d86bca23: Leertreffer-Detailzeile app.js — opacity:0.7 ersetzt durch color:var(--ink-2) (#c9c2d6 auf #1c1722 ≈ 7:1, AA erfüllt).
- A11Y-F2 [LOW] 43b5862d4147: Dekorative Glyphen [ ] ▎ mit CSS-Alt-Text-Syntax (content: "…" / "") vor Screenreadern verborgen.

Abgelehnt als False Positive (Meta):
- Q-F2 ee22daf79780 (.system-banner): bewusstes, im abgenommenen Plan vorgesehenes Phase-2-Scaffolding.
- Q-F1 13f6b77d1b8f (angeblich tote Slot-Regeln): Prämisse falsch — mockups/empty-states.html:90-102 demonstriert .slot.empty.system-empty aktiv; Teil des WP-1-Klassenvertrags.

Auto-Checks nach Fixes: node build.mjs + node tools/smoke-build.mjs GRÜN.
FSM: logic, security, architecture, quality → DORMANT; test-correctness, a11y → ACTIVE (Re-Verifikation Iteration 2).
