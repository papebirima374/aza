// Vérification de la sécurité du site public, sur la base de TEST.
// Prérequis : émulateurs + seed, site lancé avec RESERVATION_EN_LIGNE=1.
// Les demandes portent « x-aza-limites: strictes » : sur la base de test, les vraies limites
// par appareil s'appliquent alors (les autres contrôles ont des limites ×50).
// Usage : node scripts/verifier-securite.mjs [http://localhost:3100]
// Modifie la base de test (rendez-vous) : relancer le seed ensuite.

const SITE = process.argv[2] ?? "http://localhost:3100";
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};

// Un lundi dans 14 jours (les créneaux « dans moins de 2 h » ne gênent pas).
const d = new Date();
d.setUTCDate(d.getUTCDate() + 14);
while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
const DATE = d.toISOString().slice(0, 10);

const STRICT = { "x-aza-limites": "strictes" };
const get = (chemin) => fetch(SITE + chemin, { headers: STRICT }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const post = (corps) =>
  fetch(`${SITE}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...STRICT },
    body: JSON.stringify(corps),
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));


const SOIN = "soins-visage--hydrafacial";
const TEL = "77 000 44 01";

// En-têtes de sécurité sur les pages
const page = await fetch(SITE + "/");
ok(page.headers.get("x-frame-options") === "SAMEORIGIN", "le site ne s'affiche pas dans le cadre d'un autre site");
ok(page.headers.get("x-content-type-options") === "nosniff", "le navigateur ne devine pas le type des fichiers");
ok(!page.headers.get("x-powered-by"), "le serveur ne dit pas quel logiciel il utilise");
const csp = page.headers.get("content-security-policy") ?? "";
ok(csp.includes("default-src 'self'") && csp.includes("object-src 'none'"), "politique de contenu : code et connexions limités au site et à Google");
ok((await fetch(SITE + "/gestion")).headers.get("x-robots-tag")?.includes("noindex"), "la gestion n'est jamais montrée par Google");

// Champ piège : un robot qui le remplit est refusé
const jour = (n) => {
  const x = new Date(`${DATE}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 7 * n);
  return x.toISOString().slice(0, 10);
};
const premier = async (date) => (await get(`/api/creneaux?date=${date}&p=${SOIN}`)).corps.creneaux?.[0]?.debut;
ok((await post({ date: DATE, debut: await premier(DATE), prestations: [SOIN], nom: "Robot", telephone: "77 000 44 99", site: "http://spam" })).statut === 400, "champ piège rempli : refusé");

// Au plus 3 rendez-vous en ligne à venir par numéro (un par lundi, sans chevauchement)
for (let i = 0; i < 3; i++) {
  const r = await post({ date: jour(i), debut: await premier(jour(i)), prestations: [SOIN], nom: "Cliente sécurité", telephone: TEL });
  ok(r.statut === 201, `rendez-vous en ligne n° ${i + 1} accepté${r.statut === 201 ? "" : ` (${r.corps.erreur})`}`);
}
const quatrieme = await post({ date: jour(3), debut: await premier(jour(3)), prestations: [SOIN], nom: "Cliente sécurité", telephone: TEL });
ok(quatrieme.statut === 429, "4e rendez-vous à venir pour le même numéro : refusé (appeler l'institut)");

// Limite par appareil : demandes de devis (5 par heure), même refusées
const envoi = (chemin, corps) =>
  fetch(SITE + chemin, { method: "POST", headers: { "Content-Type": "application/json", ...STRICT }, body: JSON.stringify(corps) }).then((r) => r.status);
const devis = [];
for (let i = 0; i < 6; i++) devis.push(await envoi("/api/boutique/devis", { nom: "Robot", telephone: "77 000 44 98", site: "spam" }));
ok(devis.slice(0, 5).every((s) => s === 400) && devis[5] === 429, `6e demande de devis du même appareil : bloquée (${devis.join(", ")})`);

// Connexion de l'équipe : 20 essais par appareil et par quart d'heure, quel que soit le numéro
const essais = [];
for (let i = 0; i < 21; i++) essais.push(await envoi("/api/connexion-equipe", { telephone: `77 100 ${String(1000 + i).slice(-4, -2)} ${String(i).padStart(2, "0")}`, motDePasse: "mauvais" }));
ok(essais.slice(0, 20).every((s) => s === 401) && essais[20] === 429, `21e essai de connexion du même appareil : bloqué (dernier : ${essais[20]})`);

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
