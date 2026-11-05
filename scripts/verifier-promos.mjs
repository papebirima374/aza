// Vérification des promotions flash, sur la base de TEST.
// Prérequis : émulateurs + seed, site lancé avec RESERVATION_EN_LIGNE=1.
// Usage : node scripts/verifier-promos.mjs [http://localhost:3100]
// Modifie la base de test (promotions, rendez-vous) : relancer le seed ensuite.

const SITE = process.argv[2] ?? "http://localhost:3100";
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};
async function jeton(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
const json = (r) => r.json().then((corps) => ({ statut: r.status, corps }));
const promos = (tok, corps) =>
  fetch(`${SITE}/api/gestion/promos`, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: corps ? JSON.stringify(corps) : undefined }).then(json);
const reserver = (corps) => fetch(`${SITE}/api/reservations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }).then(json);
const premier = async (date, p) => (await (await fetch(`${SITE}/api/creneaux?date=${date}&p=${p}`)).json()).creneaux?.[0]?.debut;

const [direction, coiffeuse] = await Promise.all([jeton("direction@test.aza"), jeton("coiffeuse1@test.aza")]);
const SOIN = "soins-visage--hydrafacial";
const lundi = (semaines) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7 * semaines);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const PROMO = lundi(2);
const AUTRE = lundi(3);

// Prix habituel : un rendez-vous un jour sans promotion.
const normal = await reserver({ date: AUTRE, debut: await premier(AUTRE, SOIN), prestations: [SOIN], nom: "Cliente promo", telephone: "77 000 33 01" });
ok(normal.statut === 201, "rendez-vous un jour sans promotion");
const prixNormal = normal.corps.total;
const prixPromo = prixNormal - 5000;

ok((await promos(coiffeuse, { action: "creer", prestation: SOIN, prix: prixPromo, du: PROMO, au: PROMO })).statut === 403, "une praticienne ne crée pas de promotion");
ok((await promos(direction, { action: "creer", prestation: SOIN, prix: prixNormal, du: PROMO, au: PROMO })).statut === 400, "prix promo pas plus bas : refusé");
const cree = await promos(direction, { action: "creer", prestation: SOIN, prix: prixPromo, du: PROMO, au: PROMO, titre: "Promo Flash du Lundi" });
ok(cree.statut === 200 && cree.corps.id?.startsWith("promo-"), "la direction crée la promotion");
ok((await promos(direction, { action: "creer", prestation: SOIN, prix: prixPromo, du: PROMO, au: PROMO })).statut === 409, "deux promotions le même jour sur la même prestation : refusé");

// Le prix promo s'applique au rendez-vous du jour de la promotion, pas aux autres jours.
const r1 = await reserver({ date: PROMO, debut: await premier(PROMO, SOIN), prestations: [SOIN], nom: "Cliente promo", telephone: "77 000 33 02" });
ok(r1.statut === 201 && r1.corps.total === prixPromo, `rendez-vous le jour de la promotion : ${r1.corps.total} F (promo ${prixPromo} F)`);
const r2 = await reserver({ date: AUTRE, debut: await premier(AUTRE, SOIN), prestations: [SOIN], nom: "Cliente promo", telephone: "77 000 33 03" });
ok(r2.statut === 201 && r2.corps.total === prixNormal, "un autre jour : prix habituel");

// La page de la promotion, avec le lien pour réserver
const page = await fetch(`${SITE}/promo/${cree.corps.id}`);
const html = await page.text();
ok(page.status === 200 && html.includes("Promo Flash du Lundi") && html.includes(`date=${PROMO}`), "la page de la promotion propose de réserver ce jour-là");
ok((await fetch(`${SITE}/promo/promo-inexistante-xx`)).status === 404, "promotion inconnue : page introuvable");
const liste = await promos(direction);
ok(liste.corps.some((p) => p.id === cree.corps.id && p.etat === "a-venir"), "l'écran Promotions la montre « à venir »");

ok((await promos(direction, { action: "arreter", id: cree.corps.id })).statut === 200, "la direction arrête la promotion");
const r3 = await reserver({ date: PROMO, debut: await premier(PROMO, SOIN), prestations: [SOIN], nom: "Cliente promo", telephone: "77 000 33 04" });
ok(r3.statut === 201 && r3.corps.total === prixNormal, "après l'arrêt : prix habituel ce jour-là aussi");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
