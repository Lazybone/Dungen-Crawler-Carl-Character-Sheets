// Sprücheschicht. Wird von build.mjs unverändert in index.html eingebettet und
// läuft vor dem React-Bundle, das beim Rendern auf window.__flavor zugreift.
//
// Wie i18n-runtime.js liegt diese Datei bewusst getrennt: in einem
// Template-Literal in build.mjs würde ein Backslash-Escape still verfälscht.
// Deshalb hier ebenfalls keine Backticks und kein "Dollar-geschweift".
//
// Die Sprüche liefert data/flavor.json: pro Oberfläche ein Pool zweisprachiger
// Einträge. Übersetzt wird nicht in den Daten, sondern beim Ziehen — jeder
// Eintrag trägt en und de nebeneinander.
(function () {
  "use strict";

  // Die Daten stecken in BEIDEN Builds als <script type="application/json"
  // id="flavor-data"> in der Seite und stehen vor dem ersten Paint bereit —
  // kein Nachladen, kein "noch nicht da"-Zustand. Fehlt der Block oder ist er
  // kaputt, bleibt DATA leer und jeder pick() fällt auf den Default zurück:
  // dieselbe Ausfallregel wie beim i18n-Wörterbuch, nur fürs Flavour.
  var DATA = {};
  try {
    var el = document.getElementById("flavor-data");
    if (el) DATA = JSON.parse(el.textContent) || {};
  } catch (e) {
    DATA = {};
  }

  // Deterministischer String-Hash (djb2). Gleicher seedKey ergibt immer
  // denselben Index — das ist der Kern des Auswahlvertrags: derselbe Toast
  // (eventId/chapterId) und eine über useRef festgehaltene Ladeoberfläche
  // liefern nach einem Sprachwechsel wieder denselben Spruch, nur übersetzt.
  function hash(key) {
    var s = String(key);
    var h = 5381;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  // Punktpfad wie "toast.level_up" oder "loader" auf den Pool auflösen.
  // Unbekannte Oberfläche oder kein Array am Ende: null, der Aufrufer bekommt
  // dann seinen Default.
  function poolOf(surface) {
    if (typeof surface !== "string" || !surface) return null;
    var parts = surface.split(".");
    var node = DATA;
    for (var i = 0; i < parts.length; i++) {
      if (!node || typeof node !== "object") return null;
      node = node[parts[i]];
    }
    return Array.isArray(node) ? node : null;
  }

  // Fehlende Sprüche fallen auf Englisch zurück statt zu verschwinden. Damit
  // solche Lücken auffindbar bleiben, sammelt __flavor.misses() sie ein —
  // pro Oberfläche und Sprache einmal, analog zu __i18n.misses().
  var misses = Object.create(null);

  function recordMiss(surface, lang) {
    misses[surface + "|" + lang] = { surface: surface, lang: lang };
  }

  // Eine lokalisierte, spoiler-sichere Zeile ziehen. Wirft nie.
  //   surface  Punktpfad, z. B. "toast.level_up"
  //   opts     { lang?, cap?, seedKey?, fallback? }
  // Ablauf: Pool auflösen, Einträge mit minBook über der Kappe verwerfen,
  // per hash(seedKey) einen stabilen Index wählen, entry[lang] zurückgeben —
  // ersatzweise entry.en, dann opts.fallback, dann Leerstring.
  function pick(surface, opts) {
    opts = opts || {};
    var lang = opts.lang || (window.__i18n && window.__i18n.lang) || "en";
    var fallback = opts.fallback != null ? opts.fallback : "";

    var pool = poolOf(surface);
    if (!pool || !pool.length) return fallback;

    // Spoiler-Filter: Einträge, deren minBook über der aktuellen Buchkappe
    // liegt, fallen raus. Ohne cap (Infinity) bleibt alles stehen. flavor.json
    // garantiert, dass der erste Eintrag jedes Pools kappensicher ist (kein
    // minBook), ein regulärer Pool kann also nie ganz leergefiltert werden —
    // der Guard fängt trotzdem den Rest ab.
    var cap = opts.cap != null ? opts.cap : Infinity;
    var filtered = [];
    for (var i = 0; i < pool.length; i++) {
      var mb = pool[i] && pool[i].minBook;
      if (typeof mb === "number" && mb > cap) continue;
      filtered.push(pool[i]);
    }
    if (!filtered.length) return fallback;

    // seedKey festgelegt: deterministischer Index. Ohne seedKey rotiert die
    // Auswahl pro Aufruf zufällig — der Auswahlvertrag hält den Zufall
    // eigentlich beim Aufrufer (mount-fixierter useRef-Index), das hier ist
    // nur der defensive Notnagel.
    var idx;
    if (opts.seedKey != null) {
      idx = hash(opts.seedKey) % filtered.length;
    } else {
      idx = Math.floor(Math.random() * filtered.length);
    }

    var entry = filtered[idx] || {};
    var hit = entry[lang];
    if (typeof hit === "string" && hit) return hit;

    // Sprache fehlt: Englisch nehmen und die Lücke vermerken.
    if (lang !== "en") recordMiss(surface, lang);
    if (typeof entry.en === "string" && entry.en) return entry.en;

    return fallback;
  }

  window.__flavor = {
    pick: pick,
    misses: function () {
      var out = [];
      for (var k in misses) {
        if (Object.prototype.hasOwnProperty.call(misses, k)) out.push(misses[k]);
      }
      return out;
    },
  };
})();
