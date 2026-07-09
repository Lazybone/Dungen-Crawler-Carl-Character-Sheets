// Sprachschicht. Wird von build.mjs unverändert in index.html eingebettet und
// läuft vor dem React-Bundle, das beim Auswerten auf window.__i18n zugreift.
//
// Diese Datei liegt bewusst getrennt: in einem Template-Literal in build.mjs
// würde `\b` zum Backspace und `\d` zu `d` — sämtliche Regexe wären still kaputt.
//
// Übersetzt wird beim Rendern, nicht in den Daten: series.json bleibt englisch,
// weil `slot`, `rarity` und `name` dort zugleich Lookup-Keys für Icons und
// Raritätsfarben sind. Angriffspunkt ist die JSX-Fabrik — jeder Textknoten der
// App läuft durch sie hindurch.
(function () {
  "use strict";

  var DICT = null;
  var lang = "en";

  // Das Wörterbuch kommt aus einer von zwei Quellen. In der eigenständigen
  // index.html steckt es als <script type="application/json"> in der Seite und
  // steht sofort bereit. Getrennt ausgeliefert fehlt dieses Element und die
  // Datei wird geholt — dann aber erst, wenn Deutsch wirklich gebraucht wird:
  // wer auf Englisch bleibt, lädt die knappe Megabyte nie.
  var DICT_URL = "data/i18n.de.json";

  function dictFromPage() {
    if (DICT) return true;
    var el = document.getElementById("i18n-de");
    if (!el) return false;
    DICT = JSON.parse(el.textContent);
    return true;
  }

  function fetchDict() {
    return fetch(DICT_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("i18n.de.json: HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        DICT = d;
      });
  }

  // Gezeichnet wird erst, wenn das Wörterbuch steht — sonst liefe ein Durchgang
  // durch die Fabrik ohne Übersetzung und die Seite zeigte kurz Englisch.
  // Scheitert das Laden, bleibt DICT leer und der Text englisch: dieselbe Regel
  // wie bei einer fehlenden Vokabel, nur für alle auf einmal.
  function withDict(next, then) {
    if (next !== "de" || dictFromPage()) return then();
    fetchDict().catch(function () {}).then(then);
  }

  // Zusammengesetzte Texte erreichen das Wörterbuch nie als Ganzes: das Bundle
  // baut sie zur Laufzeit aus Bausteinen und Zahlen. Sie laufen über Muster,
  // deren Textanteile rekursiv wieder durch t() gehen.
  var RULES = [
    [/^Book (\d+), Ch\. (\d+)$/, function (m) { return "Buch " + m[1] + ", Kap. " + m[2]; }],
    [/^Book (\d+), start$/, function (m) { return "Buch " + m[1] + ", Beginn"; }],
    [/^Ch\. (\d+)$/, function (m) { return "Kap. " + m[1]; }],
    [/^Level (\d+)$/, function (m) { return "Stufe " + m[1]; }],
    [/^Floor (\d+)$/, function (m) { return "Ebene " + m[1]; }],
    [/^Welcome to Floor (\d+)$/, function (m) { return "Willkommen auf Ebene " + m[1]; }],
    [/^Base score (\d+)$/, function (m) { return "Grundwert " + m[1]; }],
    [/^(\d+) held$/, function (m) { return m[1] + " im Besitz"; }],
    [/^(\d+) books$/, function (m) { return m[1] + " Bücher"; }],
    [/^(\d+) total · (\d+) base ([+-]\d+) from gear$/, function (m) {
      return m[1] + " gesamt · " + m[2] + " Basis " + m[3] + " aus Ausrüstung";
    }],
    [/^(\d+) ([+-]\d+) gear$/, function (m) { return m[1] + " " + m[2] + " Ausrüstung"; }],
    [/^(.+) reached level (\d+)$/, function (m) { return t(m[1]) + " erreichte Stufe " + m[2]; }],
    [/^(.+) Item!$/, function (m) { return t(m[1]) + "-Gegenstand!"; }],
    [/^(.+) character sheet$/, function (m) { return "Charakterbogen von " + t(m[1]); }],
    [/^(.+) — Book (\d+), Ch\. (\d+)$/, function (m) {
      return t(m[1]) + " — Buch " + m[2] + ", Kap. " + m[3];
    }],
    [/^“([\s\S]+)”$/, function (m) { return "„" + t(m[1]) + "“"; }],
  ];

  // Texte ohne Übersetzung bleiben englisch statt zu verschwinden. Damit solche
  // Lücken auffindbar bleiben, sammelt __i18n.misses() sie ein.
  var misses = Object.create(null);

  function t(s) {
    if (lang !== "de" || !DICT || typeof s !== "string" || !s) return s;
    var hit = DICT[s];
    if (typeof hit === "string") return hit;
    for (var i = 0; i < RULES.length; i++) {
      var m = s.match(RULES[i][0]);
      if (m) return RULES[i][1](m);
    }
    // Typenzeilen wie "Skill · Level 3 · from a potion" bestehen aus Teilen,
    // die einzeln im Wörterbuch stehen.
    if (s.indexOf(" · ") !== -1) {
      var parts = s.split(" · ");
      var out = parts.map(t);
      for (var j = 0; j < parts.length; j++) {
        if (out[j] !== parts[j]) return out.join(" · ");
      }
    }
    if (/[A-Za-z]{2}/.test(s)) misses[s] = true;
    return s;
  }

  function copy(props) {
    var out = {};
    for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) out[k] = props[k];
    return out;
  }

  var TEXT_PROPS = ["title", "aria-label", "placeholder", "alt"];

  // Nur Textkinder und texttragende Attribute. className, style und Lookup-Keys
  // wie name bleiben unangetastet — an ihnen hängen Icons und Raritätsfarben.
  function translateProps(props) {
    var next = null;
    var c = props.children;

    if (typeof c === "string") {
      var tc = t(c);
      if (tc !== c) { next = copy(props); next.children = tc; }
    } else if (Array.isArray(c)) {
      var arr = null;
      for (var i = 0; i < c.length; i++) {
        if (typeof c[i] !== "string") continue;
        var ti = t(c[i]);
        if (ti !== c[i]) { arr = arr || c.slice(); arr[i] = ti; }
      }
      if (arr) { next = copy(props); next.children = arr; }
    }

    for (var k = 0; k < TEXT_PROPS.length; k++) {
      var key = TEXT_PROPS[k];
      var v = props[key];
      if (typeof v !== "string") continue;
      var tv = t(v);
      if (tv !== v) { next = next || copy(props); next[key] = tv; }
    }

    return next || props;
  }

  function wrapJsx(runtime) {
    var jsx = runtime.jsx; // jsx und jsxs sind dieselbe Funktion
    function wrapped(type, props, key) {
      // Nur Host-Elemente ("div", "span", …). Komponenten reichen ihre children
      // an ein Host-Element weiter; würde man auch sie übersetzen, liefe
      // derselbe Text zweimal durch t() — einmal beim Komponenten-Aufruf und
      // einmal beim Host-Element, auf dem er tatsächlich landet.
      var translate = lang === "de" && props && typeof type === "string";
      return jsx(type, translate ? translateProps(props) : props, key);
    }
    return { Fragment: runtime.Fragment, jsx: wrapped, jsxs: wrapped };
  }

  var root = null;
  var tree = null;
  var button = null;

  function draw() {
    document.documentElement.lang = lang;
    root.render(tree(lang));
  }

  function paintButton() {
    if (!button) return;
    button.textContent = lang === "de" ? "EN" : "DE";
    var hint = lang === "de" ? "Switch to English" : "Auf Deutsch umschalten";
    button.title = hint;
    button.setAttribute("aria-label", hint);
  }

  function setLang(next) {
    if (next === lang) return;
    withDict(next, function () {
      lang = next;
      try { localStorage.setItem("dcc_lang", lang); } catch (e) { /* Privater Modus */ }
      paintButton();
      if (root) draw();
    });
  }

  // Der Umschalter hängt an <body>, nicht im von React verwalteten #root, damit
  // ihn kein Re-Render entfernt.
  function addButton() {
    button = document.createElement("button");
    button.type = "button";
    button.className = "lang-toggle";
    button.addEventListener("click", function () { setLang(lang === "de" ? "en" : "de"); });
    document.body.appendChild(button);
    paintButton();
  }

  // Kein Neu-Mounten bei Sprachwechsel: derselbe Root rendert erneut, die
  // Komponenten laufen wieder durch die Fabrik, der React-State bleibt erhalten.
  function mount(reactRoot, renderTree) {
    root = reactRoot;
    tree = renderTree;
    // Steckt das Wörterbuch in der Seite, bleibt dieser Weg synchron und der
    // erste Render passiert wie zuvor noch in diesem Aufruf.
    withDict(lang, draw);
    addButton();
  }

  var browserIsGerman = /^de\b/i.test(navigator.language || "");
  try {
    var saved = localStorage.getItem("dcc_lang");
    lang = saved === "de" || saved === "en" ? saved : browserIsGerman ? "de" : "en";
  } catch (e) {
    lang = browserIsGerman ? "de" : "en";
  }

  window.__i18n = {
    wrapJsx: wrapJsx,
    mount: mount,
    setLang: setLang,
    misses: function () { return Object.keys(misses); },
    get lang() { return lang; },
  };
})();
