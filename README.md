# Dungeon Crawler Carl — Character Sheets

Interaktive Charakterbögen für Carl und Prinzessin Donut, zweisprachig (Deutsch/Englisch).
Die gesamte Anwendung steckt in einer einzigen `index.html`, die sich per Doppelklick
über `file://` öffnen lässt — kein Server, kein Netzwerk, keine Installation.

Ein inoffizielles Fanprojekt zur Reihe von Matt Dinniman.

## Benutzung

`index.html` im Browser öffnen. Oben rechts schaltet ein Button zwischen `DE` und `EN`
um. Beim ersten Öffnen entscheidet die Browsersprache; danach wird die Wahl in
`localStorage` unter `dcc_lang` gemerkt.

## Bauen

```sh
node build.mjs        # bündelt assets/ + data/ zu index.html
```

`build.mjs` nimmt zwei chirurgische Eingriffe am minifizierten React-Bundle vor und
prüft beide: Findet ein Muster nicht genau einen Treffer, bricht der Build ab, statt
still auf Englisch zurückzufallen.

`fonts.mjs` lädt die Schriften einmalig von Google Fonts und schreibt sie als
`assets/fonts.css` mit eingebetteten WOFF2-Daten. Danach braucht weder der Build noch
die fertige Seite ein Netzwerk. Nur nötig, wenn sich die Schriften ändern sollen.

## Wie die Übersetzung funktioniert

Das React-Bundle ist minifiziert und hat keine i18n-Schicht. Statt darin Dutzende
Textstellen zu patchen, umhüllt `assets/i18n-runtime.js` die **JSX-Fabrik**: `jsx` und
`jsxs` zeigen auf dieselbe Funktion, und es gibt genau eine Bindung darauf. Dadurch
läuft jeder gerenderte Textknoten durch eine Übersetzungsfunktion.

Übersetzt wird **beim Rendern, nicht in den Daten.** Das ist notwendig, nicht
Geschmackssache: In `series.json` sind `slot`, `rarity` und `name` gleichzeitig
Anzeigetext *und* Lookup-Keys für Icons und Raritätsfarben. Würde man die Daten
übersetzen, brächen Icons und Farben.

Ein Sprachwechsel rendert denselben React-Root neu, statt neu zu mounten. Der State
bleibt dabei erhalten: Zeitleistenposition und gewählte Spoiler-Grenze überleben den
Wechsel.

Die Übersetzung greift nur auf Host-Elementen (`div`, `span`, …). Komponenten reichen
ihre `children` an ein Host-Element weiter; übersetzte man auch sie, liefe derselbe
Text zweimal durch das Nachschlagen.

### Nachschlagen in drei Stufen

1. **Wörterbuch** — `data/i18n.de.json`, ein flaches `englisch → deutsch` mit rund
   6.800 Einträgen (UI-Texte, Item-Namen, Beschreibungen, Ereignisse).
2. **Muster** — Texte, die das Bundle zur Laufzeit zusammensetzt, erreichen das
   Wörterbuch nie als Ganzes. `Book 7, Ch. 12` oder `194 total · 152 base +42 from gear`
   laufen deshalb über Regeln, deren Textanteile rekursiv wieder nachgeschlagen werden.
3. **Trennung an `·`** — Typenzeilen wie `Skill · Level 3 · from a potion` zerfallen in
   Teile, die einzeln im Wörterbuch stehen.

Findet keine Stufe etwas, bleibt der Text **englisch stehen** statt zu verschwinden.

### Lücken finden

Die Laufzeitschicht merkt sich jeden Text ohne Treffer. In der Browser-Konsole:

```js
__i18n.misses()
```

Nach dem Durchfahren der gesamten Zeitleiste bleiben genau zwei Einträge übrig —
`game-icons.net` und `esc` —, die absichtlich englisch bleiben.

## Übersetzung erweitern

```sh
node tools/extract-i18n.mjs      # sammelt alle renderbaren Strings → tools/i18n.source.json
node tools/i18n-chunks.mjs split # teilt sie in Chunks zum Übersetzen
node tools/i18n-chunks.mjs merge # führt Chunks + Nachträge zu data/i18n.de.json zusammen
```

`merge` ist streng: Fehlende oder unbekannte Schlüssel werden gemeldet und der Aufruf
endet mit Exit-Code 1, damit keine Lücke unbemerkt durchrutscht.

Einzelne Nachträge — etwa Begriffe, die erst zur Laufzeit auftauchen — gehören in
`tools/i18n-extra.de.json`. `tools/i18n-glossary.md` hält die Terminologie fest
(Ebene, Fähigkeit, Beutekiste, Raritätsstufen, Ausrüstungsplätze).

Die Chunk-Dateien unter `tools/i18n-chunks/` sind Zwischenprodukte und nicht
versioniert. Gepflegte Quelle der Wahrheit ist `data/i18n.de.json`.

Die **Buchtitel** sind sinngemäß übersetzt. Die deutschen Ausgaben behalten die
englischen Originaltitel und ergänzen lediglich deutsche Untertitel — es gibt also
keine offiziellen deutschen Titel, an denen man sich ausrichten könnte.

## Dateien

| Pfad | Zweck |
|---|---|
| `index.html` | Das fertige Ergebnis, eigenständig lauffähig |
| `build.mjs` | Baut `index.html` aus `assets/` und `data/` |
| `fonts.mjs` | Bettet die Schriften einmalig in `assets/fonts.css` ein |
| `assets/i18n-runtime.js` | Sprachschicht: JSX-Hook, Muster, Umschalter |
| `assets/index-B_LsmJIL.js` | Das minifizierte React-Bundle |
| `assets/theme.css`, `assets/fonts.css` | Styles und eingebettete Schriften |
| `data/series.json` | Zeitleiste, Figuren, Gegenstände, Ereignisse (englisch) |
| `data/i18n.de.json` | Wörterbuch englisch → deutsch |
| `tools/js-strings.mjs` | Tokenizer für minifiziertes JS |
| `tools/extract-i18n.mjs` | Sammelt alle renderbaren Strings |
| `tools/i18n-chunks.mjs` | Teilt auf und führt zusammen |
| `tools/i18n-extra.de.json` | Nachträge zum Wörterbuch |
| `tools/i18n-glossary.md` | Verbindliche Terminologie |

`assets/i18n-runtime.js` liegt bewusst als eigene Datei vor: In einem Template-Literal
in `build.mjs` würde `\b` zum Backspace-Zeichen und `\d` zu `d` — sämtliche Regexe wären
still kaputt.

`tools/js-strings.mjs` ist nötig, weil ein einfacher `/"(...)"/`-Regex an Regex-Literalen
und verschachtelten Template-Literalen im minifizierten Code verrutscht und danach
Codefragmente für Strings hält.

## Rechtliches

Inoffizielles Fanprojekt. Alle Gegenstandsnamen und Figuren gehören ihrem Schöpfer
Matt Dinniman. Die Daten sind aus dem Text paraphrasiert, nicht daraus zitiert.
Icons von [game-icons.net](https://game-icons.net) (CC BY 3.0).
