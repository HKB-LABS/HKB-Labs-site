/* HKB Labs — bascule de langue FR / EN
   Chaque page contient les deux langues côte à côte :
     <p data-lang="fr">Bonjour</p>
     <p data-lang="en">Hello</p>
   Le CSS masque la langue inactive via <html data-lang="…">.
   Le choix est mémorisé dans le navigateur et conservé d'une page à l'autre. */
(function () {
  "use strict";
  var SUPPORTED = ["fr", "en"];
  var STORAGE_KEY = "hkb-lang";

  function stored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.indexOf(v) !== -1 ? v : null;
    } catch (e) {
      return null;
    }
  }

  function current() {
    var saved = stored();
    if (saved) return saved;
    var nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
    return nav === "en" ? "en" : "fr";
  }

  function apply(lang) {
    document.documentElement.setAttribute("data-lang", lang);
    document.documentElement.lang = lang;

    var switches = document.querySelectorAll("[data-set-lang]");
    for (var i = 0; i < switches.length; i++) {
      switches[i].setAttribute(
        "aria-pressed",
        String(switches[i].getAttribute("data-set-lang") === lang)
      );
    }

    var titles = window.HKB_TITLES;
    if (titles && titles[lang]) document.title = titles[lang];

    var desc = document.querySelector('meta[name="description"]');
    var descs = window.HKB_DESCRIPTIONS;
    if (desc && descs && descs[lang]) desc.setAttribute("content", descs[lang]);
  }

  function set(lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
    apply(lang);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("[data-set-lang]") : null;
    if (btn) {
      e.preventDefault();
      set(btn.getAttribute("data-set-lang"));
    }
  });

  apply(current());
  window.HKBLang = { set: set, current: current };
})();
