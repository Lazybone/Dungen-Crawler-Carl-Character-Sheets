# Dungeon Crawler Carl — Character Sheets

Interaktive Charakterbögen für Carl und Prinzessin Donut, zweisprachig (Deutsch/Englisch).
Die gesamte Anwendung steckt in einer einzigen `index.html`, die sich per Doppelklick
über `file://` öffnen lässt — kein Server, kein Netzwerk, keine Installation. Für einen
Webserver entsteht daneben ein `dist/` mit getrennten, cachebaren Dateien.

Ein inoffizielles Fanprojekt zur Reihe von Matt Dinniman.

## Benutzung

`index.html` im Browser öffnen. Oben rechts schaltet ein Button zwischen `DE` und `EN`
um. Beim ersten Öffnen entscheidet die Browsersprache; danach wird die Wahl in
`localStorage` unter `dcc_lang` gemerkt.

## Bauen

```sh
node build.mjs        # baut index.html und dist/ aus assets/ + data/
```

`build.mjs` baut aus lesbarer Quelle: `assets/app.js` ist das entminifizierte
React-Bundle. Die beiden i18n-Haken stehen fest im Quelltext — `build.mjs` patcht nichts
mehr, sondern besteht nur noch darauf, dass jeder genau einmal vorkommt. Bei jeder anderen
Zahl bricht der Build ab, statt still auf Englisch zurückzufallen oder den Root doppelt zu
mounten.

### Zwei Auslieferungen

| | `index.html` | `dist/` |
|---|---|---|
| Zweck | Doppelklick, `file://` | Webserver |
| Daten | eingebettet | eigene Dateien |
| Schriften | base64 im `<style>` | WOFF2, cachebar |
| Wörterbuch | immer dabei | nur bei Sprachwahl Deutsch |
| Erstbesuch (EN) | 2,7 MB | 1,7 MB |

Beide teilen sich Bundle, Kopfbereich, `assets/boot.js` und die inline eingebetteten
Sprüche-Pools (siehe unten). Sie unterscheiden sich nur darin, woher `series.json` und das
Wörterbuch kommen. In `dist/` tragen Stile,
Skripte und Schriften einen Inhalts-Hash im Namen und sind damit dauerhaft cachebar;
die Datenpfade sind relativ, die Seite läuft also auch in einem Unterverzeichnis.

`dist/` ist nicht versioniert — `index.html` schon: sie ist das Produkt.

### Veröffentlichung

Die Seite läuft auf GitHub Pages:

**<https://lazybone.github.io/Dungen-Crawler-Carl-Character-Sheets/>**

`.github/workflows/pages.yml` baut bei jedem Push auf `main` und lädt `dist/` als
Pages-Artefakt hoch. `build.mjs` hat keine Abhängigkeiten, der Workflow braucht darum
kein `npm install`. Weil `dist/` relative Pfade verwendet, funktioniert die Auslieferung
aus dem Unterverzeichnis einer Projektseite ohne weitere Konfiguration.

`fonts.mjs` lädt die Schriften einmalig von Google Fonts und schreibt sie als
`assets/fonts.css` mit eingebetteten WOFF2-Daten. Danach braucht weder der Build noch
die fertige Seite ein Netzwerk. Nur nötig, wenn sich die Schriften ändern sollen.

Bei einer Variable Font liefert Google für jeden angefragten Schnitt dieselbe Datei.
`fonts.mjs` fasst solche Blöcke zu einem `@font-face` mit Gewichtsspanne zusammen,
statt dieselben Bytes mehrfach einzubetten — Open Sans lag sonst dreimal in der CSS,
Inconsolata zweimal.

## Wie die Übersetzung funktioniert

Das React-Bundle hat keine eigene i18n-Schicht. Statt darin Dutzende Textstellen zu
patchen, umhüllt `assets/i18n-runtime.js` die **JSX-Fabrik**: `jsx` und `jsxs` zeigen auf
dieselbe Funktion, und es gibt genau eine Bindung darauf. Dadurch läuft jeder gerenderte
Textknoten durch eine Übersetzungsfunktion.

Der Haken selbst steht fest im Quelltext. `assets/app.js` ist das entminifizierte
React-Bundle und die gepflegte Quelle — ein lesbarer Nachbau, in dem der App-Code hinter
einer markierten React-Vendor-Region liegt (die bleibt byte-genau unangetastet). Der
Aufruf `window.__i18n.wrapJsx(...)` an der JSX-Fabrik und `window.__i18n.mount(...)` am
Root-Render sind Teil dieser Quelle; `build.mjs` fügt sie nicht mehr per String-Chirurgie
ein, sondern prüft nur, dass jeder genau einmal vorkommt.

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
   6.800 Einträgen (UI-Texte, Item-Namen, Beschreibungen, Ereignisse). In `index.html`
   steckt es in der Seite; in `dist/` wird es erst geholt, wenn jemand auf Deutsch
   schaltet. Scheitert das Laden, bleibt der Text englisch — dieselbe Regel wie bei
   einer fehlenden Vokabel, nur für alle auf einmal.
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

Die **Buchtitel** bleiben englisch. Die deutschen Ausgaben behalten die englischen
Originaltitel und ergänzen lediglich deutsche Untertitel — es gibt also keine
offiziellen deutschen Titel, an denen man sich ausrichten könnte. Sie stehen darum
in `tools/i18n-extra.de.json` mit sich selbst als Übersetzung; das überschreibt beim
`merge` jede Chunk-Übersetzung und hält sie dauerhaft englisch.

Gegenstände und Orte, die nach einem Buch benannt sind, bleiben davon unberührt und
werden weiterhin übersetzt: das Artefaktset `Gate of the Feral Gods` (ohne `The`), das
`Eye of the Bedlam Bride Tattoo` und die Maskerade als Veranstaltung sind keine
Buchtitel, auch wenn sie beinahe so heißen.

## Die »System«-Sprüche

Flächen mit hoher Sichtbarkeit — Ladebildschirm, Spoiler-Gate, leere Zustände, Fußzeile
und die Toasts — sprechen mit der derben Stimme des »System«-Ansagers aus der Reihe. Die
Sprüche liefert `data/flavor.json`: pro Fläche ein Pool zweisprachiger Einträge
(`{ "en": …, "de": … }`), manche mit `minBook`, damit ein Spruch erst ab einem bestimmten
Buch auftaucht und keine Handlung vorwegnimmt.

`assets/flavor-runtime.js` stellt `window.__flavor` bereit — dieselbe Bauart wie
`window.__i18n`. Die Pools stecken als `<script type="application/json" id="flavor-data">`
in **beiden** Builds in der Seite und stehen vor dem ersten Paint bereit; nichts wird
nachgeladen, in `dist/` entsteht keine eigene Datendatei. `__flavor.pick(surface, { lang,
cap, seedKey })` löst den Pool auf, wirft Einträge über der Spoiler-Kappe raus und zieht
eine Zeile — mit `seedKey` deterministisch, sonst zufällig. Fehlt der Datenblock oder ein
Spruch, fällt jede Fläche auf ihren fest verdrahteten englischen Default zurück, genau wie
das Wörterbuch bei einer fehlenden Vokabel.

Der Auswahlvertrag: Ladeflächen ziehen beim Mounten einen Zufallsindex und halten ihn über
die App-Laufzeit fest — die Zeile wechselt zwischen App-Starts, überlebt aber einen
Sprachwechsel unverändert (nur übersetzt). Toasts sind pro Ereignis deterministisch:
derselbe Toast zeigt immer denselben Spruch. Lücken findet man wie beim i18n über
`__flavor.misses()` in der Konsole.

`mockups/` hält statische HTML-Vorschauen jeder umgestalteten Fläche. Sie binden das echte
`assets/theme.css` ein und lassen sich direkt im Browser öffnen — reine Design-Referenz,
kein Build, kein JavaScript.

## Dateien

| Pfad | Zweck |
|---|---|
| `index.html` | Das fertige Ergebnis, eigenständig lauffähig |
| `dist/` | Dieselbe App für einen Webserver (nicht versioniert) |
| `build.mjs` | Baut beide aus `assets/` und `data/` |
| `.github/workflows/pages.yml` | Baut und deployt `dist/` nach GitHub Pages |
| `fonts.mjs` | Bettet die Schriften einmalig in `assets/fonts.css` ein |
| `assets/boot.js` | Spoiler-Grenze zurücksetzen, Funken-Canvas stilllegen |
| `assets/i18n-runtime.js` | Sprachschicht: JSX-Hook, Muster, Umschalter |
| `assets/flavor-runtime.js` | Sprücheschicht: `window.__flavor`, zieht aus den Pools |
| `assets/app.js` | Das entminifizierte React-Bundle, gepflegte Quelle |
| `assets/theme.css`, `assets/fonts.css` | Styles und eingebettete Schriften |
| `data/series.json` | Zeitleiste, Figuren, Gegenstände, Ereignisse (englisch) |
| `data/i18n.de.json` | Wörterbuch englisch → deutsch |
| `data/flavor.json` | Zweisprachige »System«-Sprüche pro Fläche |
| `mockups/` | Statische Design-Vorschauen der Flächen (nicht im Build) |
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
Matt Dinniman. Die Daten sind aus dem Text paraphrasiert, nicht daraus zitiert; auch die
»System«-Sprüche in `data/flavor.json` sind eigene Pastiche in dieser Stimme —
paraphrasiert, nicht daraus zitiert. Der derbe, vulgäre Ton des Ansagers ist Absicht.
Icons von [game-icons.net](https://game-icons.net) (CC BY 3.0).
