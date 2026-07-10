# Fixes — Iteration 2

F10 [LOW][QUALITY] — FIXED.
1. concept.md §5 (Build Schritt 3, dist/): explizite Anforderung ergänzt, dass der #flavor-data-Block textlich VOR dem flavor-runtime.js-Script-Tag steht (analog #series-data/#i18n-de in index.html), da das Runtime synchron via getElementById liest.
2. plan.md WP-5: explizites "Ordering requirement" für den dist/-Zweig (distHtml, build.mjs ~219–225, kein Inline-JSON-Präzedens); Hinweis, dass Fehlplatzierung alle Flächen still auf statische Defaults degradieren würde.
3. plan.md WP-10: Smoke-Skript prüft die Ordnung optional per String-Index-Check (Block vor Script-Tag) in beiden HTML-Dateien.

Kohärenz: concept §5 und plan WP-5/WP-10 nennen dieselbe Regel; nur die zwei erlaubten Dateien geändert.
