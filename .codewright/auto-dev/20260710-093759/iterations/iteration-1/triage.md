# Triage — Iteration 1
core_reviewers.active: [logic, security, quality, architecture] (confidence 0.66 < 0.7 → Fallback: alle 4)
specialists.active: [test-correctness, accessibility]
skipped: performance (2.87-MB-Single-File = akzeptierter Trade-off), db-sql, api-contract (kein Backend)
fsm_overrides.forced_active: [security] (escapeJson-</script>-Guard + JSON.parse eingebetteter Daten)
Auto-Checks: node build.mjs + node tools/smoke-build.mjs = GRÜN (koordinator-seitig ausgeführt, Test-Runner-Agent eingespart)
