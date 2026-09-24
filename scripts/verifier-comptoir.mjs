// Vérification de la prise de rendez-vous au comptoir, sur la base de TEST.
// Prérequis : émulateurs (firestore + auth) + seed, site démarré en mode test.
// Usage : node scripts/verifier-comptoir.mjs [http://localhost:3100]
// Modifie la base de test (supprime des postes) : relancer le seed ensuite.

const SITE = process.argv[2] ?? "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner" };
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
const comptoir = (tok, corps) =>
  fetch(`${SITE}/api/gestion/comptoir`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify(corps),
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));

const d = new Date();
d.setUTCDate(d.getUTCDate() + 8);
while (d.getUTCDay() !== 4) d.setUTCDate(d.getUTCDate() + 1); // un jeudi
const DATE = d.toISOString().slice(0, 10);
const KNOTLESS = "tresses--knotless-mi-long";

const [accueil, coiffeuse, comptable] = await Promise.all([jeton("accueil@test.aza"), jeton("coiffeuse1@test.aza"), jeton("comptable@test.aza")]);

// Droits
ok((await comptoir(coiffeuse, { action: "durees", ids: [KNOTLESS] })).statut === 403, "une praticienne ne prend pas de rendez-vous au comptoir");
ok((await comptoir(comptable, { action: "durees", ids: [KNOTLESS] })).statut === 403, "le comptable non plus");

// Durée connue, heures au quart d'heure
const durees = await comptoir(accueil, { action: "durees", ids: [KNOTLESS] });
ok(durees.corps[KNOTLESS] === 240, "durée connue pré-remplie (knotless : 240 min)");
const c = await comptoir(accueil, { action: "creneaux", date: DATE, lignes: [{ id: KNOTLESS, duree: 240 }] });
ok(c.statut === 200 && c.corps.creneaux[0].debut === 540 && c.corps.creneaux[1].debut === 555, "heures libres au quart d'heure (9h, 9h15…)");
ok(c.corps.praticiennes.map((p) => p.id).sort().join() === "test-coiffeuse-1,test-coiffeuse-2", "seules les coiffeuses compétentes sont proposées");
ok(
  (await comptoir(accueil, { action: "creneaux", date: DATE, lignes: [{ id: KNOTLESS, duree: 240 }], praticienne: "test-masseuse" })).statut === 400,
  "une praticienne sans la compétence est refusée",
);

// Réservation et double réservation
const r1 = await comptoir(accueil, {
  action: "reserver", date: DATE, debut: 555, praticienne: "test-coiffeuse-2",
  lignes: [{ id: KNOTLESS, duree: 240 }], nom: "Cliente comptoir", telephone: "77 999 99 01",
});
ok(r1.statut === 201 && r1.corps.fin === 555 + 240, "rendez-vous pris au comptoir à 9h15");
const doc = await (await fetch(`${EMU}/rendezVous/${r1.corps.id}`, { headers: OWNER })).json();
ok(doc.fields.source.stringValue === "comptoir", "…noté « pris au comptoir »");
ok(doc.fields.historique.arrayValue.values[0].mapValue.fields.nom.stringValue === "Accueil test", "…avec le nom de la personne qui l'a pris");
const r2 = await comptoir(accueil, {
  action: "reserver", date: DATE, debut: 600, praticienne: "test-coiffeuse-2",
  lignes: [{ id: KNOTLESS, duree: 60 }], nom: "Autre", telephone: "77 999 99 02",
});
ok(r2.statut === 409, "même coiffeuse déjà prise à 10h : refusé");

// Durée inconnue : saisie par l'accueil
await fetch(`${EMU}/prestationsResa/gommage--gommage-simple`, { method: "DELETE", headers: OWNER });
ok(
  (await comptoir(accueil, { action: "creneaux", date: DATE, lignes: [{ id: "gommage--gommage-simple" }] })).statut === 400,
  "durée inconnue et non saisie : on la demande",
);
const g = await comptoir(accueil, {
  action: "reserver", date: DATE, debut: 840, lignes: [{ id: "gommage--gommage-simple", duree: 50 }],
  nom: "Cliente gommage", telephone: "77 999 99 03",
});
ok(g.statut === 201 && g.corps.fin === 840 + 50, "durée saisie à la main (50 min) : rendez-vous pris");

// Sans poste renseigné : seul l'agenda de la praticienne compte
const postes = await (await fetch(`${EMU}/postes`, { headers: OWNER })).json();
for (const p of postes.documents ?? []) {
  if (p.fields.type.stringValue === "cabine") await fetch(`http://127.0.0.1:8080/v1/${p.name}`, { method: "DELETE", headers: OWNER });
}
const s1 = await comptoir(accueil, {
  action: "reserver", date: DATE, debut: 600, lignes: [{ id: "soins-visage--hydrafacial" }], nom: "Cliente A", telephone: "77 999 99 04",
});
const s2 = await comptoir(accueil, {
  action: "reserver", date: DATE, debut: 600, lignes: [{ id: "soins-visage--hydrafacial" }], nom: "Cliente B", telephone: "77 999 99 05",
});
const s3 = await comptoir(accueil, {
  action: "reserver", date: DATE, debut: 600, lignes: [{ id: "soins-visage--hydrafacial" }], nom: "Cliente C", telephone: "77 999 99 06",
});
ok(s1.statut === 201 && s2.statut === 201 && s3.statut === 409, "sans cabine renseignée : 2 esthéticiennes = 2 soins à 10h, le 3e refusé");

// Le jour même : pas de délai de 2 heures au comptoir
const maintenant = new Date();
const minutes = maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes();
const aujourdhui = maintenant.toISOString().slice(0, 10);
const jour = maintenant.getUTCDay();
const ouvre = jour === 0 ? 10 * 60 : 9 * 60;
const ferme = jour === 0 ? 18 * 60 : 19 * 60;
if (minutes >= ouvre && minutes + 60 < ferme - 45) {
  const t = await comptoir(accueil, { action: "creneaux", date: aujourdhui, lignes: [{ id: "epilation-femme--sourcils-forme", duree: 15 }] });
  const premier = t.corps.creneaux?.[0]?.debut;
  ok(premier !== undefined && premier < minutes + 60, `le jour même, première heure libre ${Math.floor(premier / 60)}h${premier % 60} (moins de 2 h après maintenant)`);
} else {
  console.log("—     (institut fermé à cette heure : contrôle « le jour même » sauté)");
}

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
