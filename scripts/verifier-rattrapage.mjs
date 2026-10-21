// Vérification de la caisse de rattrapage (ventes du dimanche saisies le lundi), base de TEST.
// Prérequis : émulateurs + seed (base fraîche : aucune caisse ouverte aujourd'hui), site démarré en mode test.
// Usage : node scripts/verifier-rattrapage.mjs [http://localhost:3100]
// Modifie la base de test : relancer le seed ensuite.

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
const caisse = (tok, corps, q = "") =>
  fetch(`${SITE}/api/gestion/caisse${q}`, {
    method: corps ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const lire = async (chemin) => (await (await fetch(`${EMU}/${chemin}`, { headers: OWNER })).json()).fields ?? {};

const [direction, accueil] = await Promise.all(["direction", "accueil"].map((n) => jeton(`${n}@test.aza`)));
const jourAvant = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const HIER = jourAvant(1);
const TIGES = "locks--lot-de-10-tiges-locks-6-pouces";

// Un rendez-vous d'hier, « Terminé », jamais encaissé.
const RDV = "test-rattrapage-rdv";
await fetch(`${EMU}/rendezVous?documentId=${RDV}`, {
  method: "POST",
  headers: { ...OWNER, "Content-Type": "application/json" },
  body: JSON.stringify({
    fields: {
      date: { stringValue: HIER },
      debut: { integerValue: 600 },
      fin: { integerValue: 660 },
      statut: { stringValue: "termine" },
      total: { integerValue: 6000 },
      prestations: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: TIGES }, nom: { stringValue: "Tiges" }, prix: { integerValue: 6000 } } } }] } },
      cliente: { mapValue: { fields: { id: { stringValue: "770000902" }, nom: { stringValue: "Cliente dimanche" }, telephone: { stringValue: "77 000 09 02" } } } },
      historique: { arrayValue: { values: [] } },
    },
  }),
});

ok((await caisse(accueil, { action: "ouvrir", fond: 0, jour: HIER })).statut === 403, "l'accueil n'ouvre pas une caisse d'un jour passé");
ok((await caisse(direction, { action: "ouvrir", fond: 0, jour: jourAvant(8) })).statut === 403, "pas plus de 7 jours en arrière");
ok((await caisse(direction, { action: "ouvrir", fond: 0, jour: jourAvant(-1) })).statut === 403, "pas un jour à venir");
const j = await caisse(direction, null, `?date=${HIER}`);
ok(j.corps.rattrapage === true && j.corps.aujourdhui === false, "le journal d'hier propose le rattrapage à la direction");
const o = await caisse(direction, { action: "ouvrir", fond: 5000, jour: HIER });
ok(o.statut === 201 && o.corps.date === HIER && o.corps.rattrapage === true, "la direction ouvre la caisse d'hier");
const liste = await caisse(direction, null, `?a-encaisser=1&jour=${HIER}`);
ok(Array.isArray(liste.corps) && liste.corps.some((r) => r.id === RDV), "le rendez-vous d'hier est à encaisser");
const t = await caisse(direction, { action: "encaisser", jour: HIER, rendezVous: RDV, lignes: [{ id: TIGES }], paiements: [{ mode: "especes", montant: 6000 }] });
ok(t.statut === 201, "le rendez-vous d'hier est encaissé");
const ticket = await lire(`tickets/${t.corps.id}`);
ok(ticket.date?.stringValue === HIER && ticket.saisiLe?.stringValue === jourAvant(0), "le ticket est daté d'hier, saisi aujourd'hui");
ok((await lire(`rendezVous/${RDV}`)).statut?.stringValue === "encaisse", "le rendez-vous est « Encaissé »");
const c = await caisse(direction, { action: "cloturer", compte: 11000, caisse: o.corps.caisse });
ok(c.statut === 200 && c.corps.ecart === 0 && c.corps.jour === HIER, "la caisse d'hier se clôture (5 000 + 6 000 F, sans écart)");
ok((await caisse(direction, null, `?date=${HIER}`)).corps.tickets.some((x) => x.id === t.corps.id), "le ticket figure dans le journal d'hier");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
