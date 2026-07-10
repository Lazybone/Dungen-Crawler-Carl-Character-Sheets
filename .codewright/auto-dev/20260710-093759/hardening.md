# Hardening — Phase 5

Abweichung dokumentiert: EIN kombinierter Test-Writer statt drei paralleler (Projekt hat kein Test-Framework/package.json; alles zero-dependency Node; Kostenbudget).

Ergebnis: tools/tests/flavor-runtime.test.mjs (Commit 60074ec) — 15 Tests via vm-Sandbox mit document-Stub:
- Regression (4): jede Oberfläche liefert erwarteten Pool-Eintrag (djb2-Index nachgebildet); Determinismus; EN/DE-Index-Stabilität; misses() leer.
- Edge (9): unbekannte Oberflächen → fallback; cap-1/cap-8-Filter gegen echte minBook-Einträge (200-Seed-Sweep); fehlender/kaputter Block → fallback ohne Wurf; fehlendes de → en + Miss; Leerstring-Default; seedKey-loser Zufallspfad.
- Integration (2): echtes node build.mjs; eingebetteter #flavor-data-Block in beiden HTMLs byte-genau = minifiziert+escaped data/flavor.json.

Läufe: Tests 15/15 grün (exit 0), smoke-build grün, Build idempotent. hardening_done = true.
