# Konsolidierte Review-Findings — Iteration 2

Ergebnis: LOGIC 0 Findings (beide MAJOR aus It. 1 verifiziert gelöst) · ARCH 0 Findings (alle gelöst, „freigegeben") · SECURITY 0 Findings (alle gelöst, keine neuen) · QUALITY 1 neuer LOW-Befund.
Aktives Reviewer-Set für Iteration 3: nur QUALITY.

---

### F10 [LOW] [QUALITY] `#flavor-data`-Blockposition im `dist/index.html` relativ zum synchronen Reader nicht spezifiziert
- **Dokumente:** plan.md WP-5 (Zeile ~49); concept.md §5 (Zeile ~92), §6 Flavor Runtime (Zeile ~58)
- **Problem:** Das Runtime liest `#flavor-data` synchron via `getElementById`; `flavor-runtime.js` ist im `dist/` ein klassisches `<script src>` nach i18n-runtime und vor dem Modul-Bundle. Der JSON-Block muss also textlich VOR dem `flavor-runtime.js`-Tag stehen. In `index.html` folgt das dem bestehenden Muster; im `dist/`-Zweig (`distHtml`, build.mjs:219–225) gibt es kein Präzedens für Inline-JSON. WP-5 spezifiziert die Skript-Reihenfolge, aber nicht die Position des JSON-Blocks relativ zum lesenden Skript — bei falscher Platzierung schlägt der Loader-Flavor beim ersten Paint fehl, genau der Fall, den das Eager-Embedding verhindern soll.
- **Empfehlung:** In WP-5 (und ggf. §5) festhalten: Im `dist/index.html` steht der `#flavor-data`-Block vor dem `flavor-runtime.js`-`<script>`-Tag (analog `#series-data`/`#i18n-de` in `index.html`), sodass der synchrone Read garantiert ein befülltes DOM vorfindet. WP-10 prüft diese Ordnung optional mit.
