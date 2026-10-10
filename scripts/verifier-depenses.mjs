// Vérification : dépenses de la journée (onglet Dépenses) et leur effet sur la caisse.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-depenses.mjs [http://localhost:3100]
// Modifie la base de test : relancer le seed ensuite.

const SITE = process.argv[2] ?? "http://localhost:3100";
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};
const jeton = async (email) =>
  (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }) })).json()).idToken;
const appel = (chemin, tok, corps) =>
  fetch(`${SITE}${chemin}`, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, ...(corps ? { body: JSON.stringify(corps) } : {}) }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const AUJ = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date());
const [direction, accueil, comptable, coiffeuse] = await Promise.all(["direction@test.aza", "accueil@test.aza", "comptable@test.aza", "coiffeuse1@test.aza"].map(jeton));
const D = "/api/gestion/depenses";

// Accès
ok((await appel(D, coiffeuse)).statut === 403, "une praticienne n'ouvre pas les dépenses");
ok((await appel(D, coiffeuse, { action: "ajouter", montant: 1000, categorie: "transport", mode: "especes" })).statut === 403, "une praticienne ne note pas de dépense");
ok((await appel(D, comptable)).statut === 200, "le comptable lit les dépenses");
ok((await appel(D, comptable, { action: "ajouter", montant: 1000, categorie: "transport", mode: "wave" })).statut === 403, "le comptable ne note pas de dépense (lecture seule)");

// Saisie
ok((await appel(D, accueil, { action: "ajouter", montant: 0, categorie: "transport", mode: "especes" })).statut === 400, "montant vide : refusé");
ok((await appel(D, accueil, { action: "ajouter", montant: 1000, categorie: "bijoux", mode: "especes" })).statut === 400, "type de dépense inconnu : refusé");
ok((await appel(D, accueil, { action: "ajouter", montant: 1000, categorie: "autre", mode: "especes" })).statut === 400, "« Autre » sans détail : refusé");
ok((await appel(D, accueil, { action: "ajouter", montant: 1000, categorie: "repas", mode: "especes", deLaCaisse: true })).statut === 409, "« pris dans mon tiroir » sans caisse ouverte : refusé");

await appel("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 20000 });
await appel("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: "onglerie--vernis-permanent", praticienne: "test-prothesiste-1" }], paiements: [{ mode: "especes", montant: 5000 }] });
const eau = await appel(D, accueil, { action: "ajouter", montant: 2500, categorie: "achats", libelle: "2 bidons d'eau", mode: "especes", deLaCaisse: true });
ok(eau.statut === 201 && eau.corps.deLaCaisse === true, "2 500 F d'eau, pris dans le tiroir de l'accueil");
const taxi = await appel(D, accueil, { action: "ajouter", montant: 1500, categorie: "transport", libelle: "taxi marché", mode: "wave", deLaCaisse: true });
ok(taxi.statut === 201 && taxi.corps.deLaCaisse === false, "1 500 F de taxi par Wave : ne touche pas le tiroir");
await appel(D, direction, { action: "ajouter", montant: 30000, categorie: "salaires", libelle: "avance Fatou", mode: "orange-money" });

let j = (await appel(`/api/gestion/caisse?date=${AUJ}`, accueil)).corps;
ok(j.caisse.totaux.depenses === 2500 && j.caisse.totaux.especesAttendues === 22500, `tiroir attendu : 20 000 + 5 000 − 2 500 = ${j.caisse.totaux.especesAttendues} F`);

let jour = (await appel(D, direction)).corps;
ok(jour.total === 34000 && jour.sortiesDeCaisse === 2500, `dépenses du jour : ${jour.total} F, dont ${jour.sortiesDeCaisse} F sortis d'un tiroir`);
ok(jour.recette === 5000 && jour.reste === -29000, "la direction voit la recette (5 000 F) et le reste (−29 000 F)");
ok((await appel(D, accueil)).corps.recette === null, "l'accueil ne voit pas la recette de toutes les caisses");
ok(jour.parCategorie.salaires === 30000 && jour.parCategorie.achats === 2500, "total par type de dépense");

// Annulation
ok((await appel(D, accueil, { action: "annuler", id: jour.depenses.find((d) => d.categorie === "salaires").id, motif: "erreur" })).statut === 403, "l'accueil n'annule pas la dépense d'une autre personne");
ok((await appel(D, accueil, { action: "annuler", id: eau.corps.id, motif: "" })).statut === 400, "annuler sans motif : refusé");
ok((await appel(D, accueil, { action: "annuler", id: eau.corps.id, motif: "erreur de montant" })).statut === 200, "l'accueil annule sa propre dépense, avec un motif");
j = (await appel(`/api/gestion/caisse?date=${AUJ}`, accueil)).corps;
ok(j.caisse.totaux.especesAttendues === 25000, "dépense annulée : le tiroir attendu revient à 25 000 F");
jour = (await appel(D, direction)).corps;
ok(jour.total === 31500 && jour.depenses.find((d) => d.id === eau.corps.id).annulee, "la dépense annulée reste visible, barrée, et ne compte plus");

// Clôture : la dépense du tiroir est déduite
await appel(D, accueil, { action: "ajouter", montant: 1000, categorie: "repas", mode: "especes", deLaCaisse: true });
const c = await appel("/api/gestion/caisse", accueil, { action: "cloturer", compte: 24000 });
ok(c.statut === 200 && c.corps.ecart === 0, "clôture : 24 000 F comptés = 20 000 + 5 000 − 1 000, aucun écart");
const repas = (await appel(D, accueil)).corps.depenses.find((d) => d.categorie === "repas");
ok((await appel(D, accueil, { action: "annuler", id: repas.id, motif: "erreur" })).statut === 409, "caisse clôturée : sa dépense ne s'annule plus");

// Bilan du mois
ok((await appel(`${D}?mois=${AUJ.slice(0, 7)}`, accueil)).statut === 403, "l'accueil ne voit pas le bilan du mois");
const m = (await appel(`${D}?mois=${AUJ.slice(0, 7)}`, comptable)).corps;
ok(m.total >= 32500 && m.jours.some((x) => x.date === AUJ && x.depenses === 32500), `bilan du mois : ${m.total} F de dépenses, dont 32 500 F aujourd'hui`);

console.log(echecs ? `${echecs} ÉCHEC(S)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
