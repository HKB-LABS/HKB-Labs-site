/* HKB Labs — formulaire de contact / demande de devis (/contact.html)
   - sélection du type de projet (puces) + placeholder adaptatif
   - brouillon sauvegardé dans le navigateur
   - validation en direct, envoi AJAX vers /api/contact, états succès / erreur
   - suit la langue du site (attribut data-lang sur <html>, géré par lang.js) */
(function () {
  "use strict";

  var form = document.getElementById("contact-form");
  if (!form) return;

  var EMAIL = "hkb.labs.contact@gmail.com";
  var DRAFT_KEY = "hkb-contact-draft";

  var MESSAGES = {
    fr: {
      sending: "Envoi…",
      ok_title: "Demande envoyée",
      ok_body: "Merci {name}. Votre demande est bien arrivée — on revient vers vous sous 48 h ouvrées. Pour une urgence : ",
      err_fields: "Vérifiez les champs signalés en rouge.",
      err_generic: "L’envoi a échoué. Réessayez, ou écrivez-nous directement à ",
      err_not_configured: "Le formulaire n’est pas encore actif. Écrivez-nous à ",
      err_captcha: "La vérification anti-robot a échoué. Réessayez.",
    },
    en: {
      sending: "Sending…",
      ok_title: "Request sent",
      ok_body: "Thanks {name}. Your request has arrived — we’ll get back to you within 2 business days. For anything urgent: ",
      err_fields: "Please check the fields marked in red.",
      err_generic: "Sending failed. Please try again, or email us directly at ",
      err_not_configured: "The form isn’t live yet. Please email us at ",
      err_captcha: "The anti-bot check failed. Please try again.",
    },
  };

  var PLACEHOLDERS = {
    app: {
      fr: "Plateformes visées (iOS, Android, les deux), fonctionnalités clés, où vous en êtes.",
      en: "Target platforms (iOS, Android, both), key features, where you stand.",
    },
    web: {
      fr: "Objectif du site, nombre de pages, contenu prêt ou à produire, exemples que vous aimez.",
      en: "Goal of the site, number of pages, content ready or to be produced, examples you like.",
    },
    refonte: {
      fr: "Adresse du site actuel, ce qui ne va plus, ce que vous voulez conserver.",
      en: "Current site URL, what no longer works, what you want to keep.",
    },
    outil: {
      fr: "Le processus métier à outiller, qui l’utilisera, les outils déjà en place.",
      en: "The business process to support, who will use it, tools already in place.",
    },
    autre: {
      fr: "Dites-nous en quelques mots de quoi il s’agit.",
      en: "Tell us in a few words what it’s about.",
    },
  };

  var TIMELINE = [
    { v: "asap", fr: "Dès que possible", en: "As soon as possible" },
    { v: "1-3m", fr: "Dans 1 à 3 mois", en: "In 1–3 months" },
    { v: "3-6m", fr: "Dans 3 à 6 mois", en: "In 3–6 months" },
    { v: "flex", fr: "Flexible / pas encore défini", en: "Flexible / not set yet" },
  ];

  function lang() {
    return document.documentElement.getAttribute("data-lang") === "en" ? "en" : "fr";
  }
  function t(key) {
    return (MESSAGES[lang()] || MESSAGES.fr)[key];
  }

  var tsInput = document.getElementById("form-ts");
  var langInput = document.getElementById("form-lang");
  var typeInput = document.getElementById("project-type");
  var timelineSel = document.getElementById("timeline");
  var messageEl = form.elements.message;
  var chips = Array.prototype.slice.call(form.querySelectorAll(".chip"));
  var banner = document.getElementById("form-error");
  var submitBtn = document.getElementById("submit-btn");
  var submitBtnHtml = submitBtn.innerHTML;

  tsInput.value = String(Date.now());
  langInput.value = lang();

  // ---- liste déroulante « échéance » (peuplée selon la langue) ----
  function fillTimeline() {
    var current = timelineSel.value;
    var opts = ['<option value=""></option>'];
    for (var i = 0; i < TIMELINE.length; i++) {
      opts.push('<option value="' + TIMELINE[i].v + '">' + TIMELINE[i][lang()] + "</option>");
    }
    timelineSel.innerHTML = opts.join("");
    timelineSel.value = current;
  }
  fillTimeline();

  // ---- puces « type de projet » ----
  function selectChip(btn) {
    for (var i = 0; i < chips.length; i++) {
      var on = chips[i] === btn;
      chips[i].setAttribute("aria-pressed", String(on));
      chips[i].classList.toggle("is-selected", on);
    }
    typeInput.value = btn.getAttribute("data-value");
    var ph = PLACEHOLDERS[typeInput.value];
    if (ph) messageEl.setAttribute("placeholder", ph[lang()]);
    clearError("projectType");
    saveDraft();
  }
  chips.forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectChip(btn);
    });
  });

  // ---- brouillon ----
  var TEXT_FIELDS = ["name", "email", "company", "message"];
  function saveDraft() {
    try {
      var d = { projectType: typeInput.value, timeline: timelineSel.value };
      TEXT_FIELDS.forEach(function (f) {
        d[f] = form.elements[f].value;
      });
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (e) {}
  }
  function restoreDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
      TEXT_FIELDS.forEach(function (f) {
        if (d[f]) form.elements[f].value = d[f];
      });
      if (d.timeline) timelineSel.value = d.timeline;
      if (d.projectType) {
        var b = form.querySelector('.chip[data-value="' + d.projectType + '"]');
        if (b) selectChip(b);
      }
    } catch (e) {}
  }
  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }
  restoreDraft();
  var saveTimer;
  form.addEventListener("input", function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 400);
  });

  // ---- validation ----
  function setError(field) {
    var el = form.querySelector('[data-error-for="' + field + '"]');
    if (el) el.hidden = false;
    var ctrl = form.elements[field];
    if (ctrl && ctrl.setAttribute) ctrl.setAttribute("aria-invalid", "true");
  }
  function clearError(field) {
    var el = form.querySelector('[data-error-for="' + field + '"]');
    if (el) el.hidden = true;
    var ctrl = form.elements[field];
    if (ctrl && ctrl.removeAttribute) ctrl.removeAttribute("aria-invalid");
  }
  function validate() {
    ["projectType", "name", "email", "message", "consent"].forEach(clearError);
    var ok = true;
    if (!typeInput.value) {
      setError("projectType");
      ok = false;
    }
    if (!form.elements.name.value.trim()) {
      setError("name");
      ok = false;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(form.elements.email.value.trim())) {
      setError("email");
      ok = false;
    }
    if (form.elements.message.value.trim().length < 15) {
      setError("message");
      ok = false;
    }
    if (!form.elements.consent.checked) {
      setError("consent");
      ok = false;
    }
    return ok;
  }
  ["name", "email", "message", "consent"].forEach(function (f) {
    form.elements[f].addEventListener("input", function () {
      clearError(f);
      hideBanner();
    });
    form.elements[f].addEventListener("change", function () {
      clearError(f);
    });
  });

  function showBanner(text) {
    banner.textContent = text;
    banner.hidden = false;
  }
  function hideBanner() {
    banner.hidden = true;
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.innerHTML = on ? "<span>" + t("sending") + "</span>" : submitBtnHtml;
  }

  function showSuccess(name) {
    var wrap = document.querySelector(".contact-form-wrap");
    if (!wrap) return;
    var first = name ? String(name).trim().split(/\s+/)[0] : "";
    var body = t("ok_body").replace("{name}", first).replace("  ", " ");
    wrap.innerHTML =
      '<div class="contact-success" role="status">' +
      '<div class="contact-success-mark" aria-hidden="true">✓</div>' +
      "<h2>" +
      t("ok_title") +
      "</h2><p>" +
      body +
      '<a href="mailto:' +
      EMAIL +
      '">' +
      EMAIL +
      "</a></p></div>";
    try {
      wrap.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {}
  }

  function bannerForError(code) {
    if (code === "not_configured") return t("err_not_configured") + EMAIL;
    if (code === "captcha" || code === "captcha_error") return t("err_captcha");
    if (code === "missing_fields" || code === "bad_email" || code === "message_too_short") {
      validate();
      return t("err_fields");
    }
    return t("err_generic") + EMAIL;
  }

  // ---- reprise après soumission sans JavaScript (redirection ?sent / ?error) ----
  var params = new URLSearchParams(location.search);
  if (params.get("sent") === "1") {
    clearDraft();
    showSuccess("");
  } else if (params.get("error")) {
    showBanner(bannerForError(params.get("error")));
  }

  // ---- envoi AJAX ----
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBanner();
    langInput.value = lang();
    if (!validate()) {
      showBanner(t("err_fields"));
      return;
    }
    setLoading(true);

    var payload = {};
    new FormData(form).forEach(function (value, key) {
      payload[key] = value;
    });

    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r
          .json()
          .catch(function () {
            return {};
          })
          .then(function (j) {
            return { status: r.status, body: j };
          });
      })
      .then(function (res) {
        setLoading(false);
        if (res.status === 200 && res.body.ok) {
          clearDraft();
          showSuccess(form.elements.name.value);
          return;
        }
        showBanner(bannerForError(res.body.error || "delivery_failed"));
      })
      .catch(function () {
        setLoading(false);
        showBanner(t("err_generic") + EMAIL);
      });
  });

  // ---- suivre la bascule de langue du site ----
  new MutationObserver(function () {
    langInput.value = lang();
    fillTimeline();
    if (typeInput.value && PLACEHOLDERS[typeInput.value]) {
      messageEl.setAttribute("placeholder", PLACEHOLDERS[typeInput.value][lang()]);
    }
    if (!banner.hidden) hideBanner();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
})();
