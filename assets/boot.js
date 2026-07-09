// Zwei Eingriffe, die beide Auslieferungswege brauchen. Läuft vor dem Bundle.
//
// Der Zugriff auf series.json unterscheidet sich dagegen je nach Weg und wird
// von build.mjs eingesetzt: eingebettet liest die App aus der Seite, getrennt
// ausgeliefert holt sie die Datei relativ zur index.html.
(function () {
  "use strict";

  // Die App merkt sich die gewählte Spoiler-Grenze und überspringt dann die
  // Buchauswahl. Beim Öffnen soll sie aber immer erscheinen, also wird die
  // gemerkte Wahl vor dem Start verworfen. Das Auswahlfeld in der Leiste
  // schaltet weiterhin während der Sitzung um.
  try {
    localStorage.removeItem("dcc_book_cap");
  } catch (e) {
    /* Privater Modus: nichts zu verwerfen. */
  }

  // Der Funken-Canvas gehört zum dunklen Theme und ist im hellen per CSS
  // ausgeblendet. Seine Animationsschleife liefe dennoch weiter und zeichnete
  // 60×/s mit Schattenwurf in einen mehrere Megapixel großen Puffer. Kontext
  // und Puffer werden daher stillgelegt, sobald die App sie anfordert.
  const getContext = HTMLCanvasElement.prototype.getContext;
  const noop = function () {};
  HTMLCanvasElement.prototype.getContext = function (...args) {
    if (this.classList.contains("embers")) {
      for (const dim of ["width", "height"]) {
        Object.defineProperty(this, dim, {
          get: () => 0,
          set: noop,
          configurable: true,
        });
      }
      return new Proxy({}, { get: () => noop, set: () => true });
    }
    return getContext.apply(this, args);
  };
})();
