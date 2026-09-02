// api/contact.mjs — fonction serverless Vercel (runtime Node, zéro config).
// Reçoit le formulaire de /contact.html, filtre le spam, transmet la demande par e-mail.
//
// Configuration par variables d'environnement du projet Vercel.
// Aucune n'est requise pour DÉPLOYER, mais l'envoi ne fonctionne qu'une fois
// l'une des deux voies d'envoi renseignée :
//
//   Voie A — Resend (recommandé)
//     RESEND_API_KEY   clé API Resend (re_...)
//     CONTACT_FROM     optionnel, ex. "HKB Labs <devis@mondomaine.fr>"
//                      (défaut : "HKB Labs <onboarding@resend.dev>")
//   Voie B — Web3Forms
//     WEB3FORMS_KEY    clé d'accès Web3Forms
//
//   Communes
//     CONTACT_TO       destinataire (défaut : hkb.labs.contact@gmail.com)
//     TURNSTILE_SECRET optionnel — si présent, le jeton Cloudflare Turnstile est vérifié

const CONTACT_TO = process.env.CONTACT_TO || "hkb.labs.contact@gmail.com";
const TYPE_LABELS = {
  app: "Application mobile",
  web: "Site web",
  refonte: "Refonte de site",
  outil: "CRM / outil métier",
  autre: "Autre",
};

const clean = (v, max = 4000) => String(v == null ? "" : v).replace(/\s+$/g, "").slice(0, max);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const wantsJson = (req.headers.accept || "").includes("application/json");
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const fail = (status, code) =>
    wantsJson
      ? res.status(status).json({ error: code })
      : res.redirect(303, `/contact.html?error=${encodeURIComponent(code)}`);
  const done = () =>
    wantsJson ? res.status(200).json({ ok: true }) : res.redirect(303, "/contact.html?sent=1");

  // 1. Pot de miel : un bot remplit le champ caché "fax"
  if (clean(body.fax)) return done();

  // 2. Piège temporel : soumission quasi instantanée = bot
  const elapsed = Date.now() - Number(body._t || 0);
  if (!body._t || Number.isNaN(elapsed) || elapsed < 2500) return fail(400, "too_fast");

  // 3. Validation
  const name = clean(body.name, 200);
  const email = clean(body.email, 300);
  const message = clean(body.message, 8000);
  if (!name || !email || !message || !body.consent) return fail(422, "missing_fields");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return fail(422, "bad_email");
  if (message.trim().length < 15) return fail(422, "message_too_short");

  // 4. Cloudflare Turnstile (si configuré)
  const turnstileSecret = process.env.TURNSTILE_SECRET;
  if (turnstileSecret) {
    try {
      const verify = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: clean(body["cf-turnstile-response"], 3000),
          }),
        },
      ).then((r) => r.json());
      if (!verify.success) return fail(400, "captcha");
    } catch {
      return fail(502, "captcha_error");
    }
  }

  // 5. Construction du message
  const company = clean(body.company, 200);
  const timeline = clean(body.timeline, 80);
  const projectType = clean(body.projectType, 40);
  const lang = body.lang === "en" ? "EN" : "FR";
  const subject = `Demande — ${TYPE_LABELS[projectType] || "Projet"} — ${name}`;
  const text = [
    `Nom       : ${name}`,
    `E-mail    : ${email}`,
    company ? `Société   : ${company}` : null,
    `Type      : ${TYPE_LABELS[projectType] || projectType || "—"}`,
    timeline ? `Échéance  : ${timeline}` : null,
    `Langue    : ${lang}`,
    "",
    message,
  ]
    .filter((l) => l !== null)
    .join("\n");

  // 6. Envoi
  const resendKey = process.env.RESEND_API_KEY;
  const web3formsKey = process.env.WEB3FORMS_KEY;

  try {
    if (resendKey) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.CONTACT_FROM || "HKB Labs <onboarding@resend.dev>",
          to: [CONTACT_TO],
          reply_to: email,
          subject,
          text,
        }),
      });
      if (!r.ok) throw new Error(`resend_${r.status}`);
    } else if (web3formsKey) {
      const r = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: web3formsKey,
          subject,
          from_name: name,
          replyto: email,
          message: text,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.success) throw new Error("web3forms_failed");
    } else {
      return fail(503, "not_configured");
    }
  } catch (err) {
    console.error("contact delivery failed:", err && err.message);
    return fail(502, "delivery_failed");
  }

  return done();
}
