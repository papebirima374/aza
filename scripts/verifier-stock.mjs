// Vérification du stock (M-09), sur la base de TEST.
// Prérequis : émulateurs + seed (base fraîche : caisse du jour pas encore ouverte), site démarré en mode test.
// Usage : node scripts/verifier-stock.mjs [http://localhost:3100]

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
const api = (chemin, tok, corps) =>
  fetch(SITE + chemin, {
    method: corps ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const stock = (tok, corps) => api("/api/gestion/stock", tok, corps);
const [manager, accueil, comptable] = await Promise.all(["manager", "accueil", "comptable"].map((n) => jeton(`${n}@test.aza`)));
const article = async (id) => (await stock(manager)).corps.articles.find((a) => a.id === id);
const TIGES = "locks--lot-de-10-tiges-locks-6-pouces";
const SOURCILS = "epilation-femme--sourcils-forme";
const dans10jours = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);

// Droits
ok((await stock(accueil, { action: "creer", nom: "X", type: "cabine" })).statut === 403, "l'accueil ne modifie pas le stock");
ok((await stock(comptable)).statut === 200, "le comptable consulte le stock");

// Articles
const t = await stock(manager, { action: "creer", nom: "Tiges locks 6 pouces", type: "revente", unite: "boîte", seuil: 5, produit: TIGES });
ok(t.statut === 200, "article à vendre créé, relié à la ligne de caisse « Lot de 10 tiges 6 pouces »");
ok((await stock(manager, { action: "creer", nom: "Doublon", type: "revente", produit: TIGES })).statut === 409, "une ligne de caisse ne se relie qu'à un seul article");
const cire = await stock(manager, { action: "creer", nom: "Cire tiède", type: "cabine", unite: "pot", seuil: 1 });
ok(cire.statut === 200, "produit de cabine créé (cire, en pots)");

// Réceptions et coût moyen
await stock(manager, { action: "reception", id: t.corps.id, quantite: 10, cout: 3000 });
await stock(manager, { action: "reception", id: t.corps.id, quantite: 10, cout: 4000 });
let a = await article(t.corps.id);
ok(a.quantite === 20 && a.coutMoyen === 3500, `2 réceptions de 10 : stock 20, coût moyen ${a.coutMoyen} F (3 000 et 4 000)`);
await stock(manager, { action: "reception", id: cire.corps.id, quantite: 3, cout: 8000, peremption: dans10jours });

// Ce que consomme un soin
ok((await stock(manager, { action: "consommation", prestation: SOURCILS, lignes: [{ article: t.corps.id, quantite: 1 }] })).statut === 400, "un produit à vendre ne se consomme pas en cabine");
ok((await stock(manager, { action: "consommation", prestation: SOURCILS, lignes: [{ article: cire.corps.id, quantite: 0.1 }] })).statut === 200, "sourcils = 0,1 pot de cire");

// Encaissement : sorties automatiques
await api("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 0 });
const ticket = await api("/api/gestion/caisse", accueil, {
  action: "encaisser",
  lignes: [{ id: TIGES, quantite: 2 }, { id: SOURCILS }],
  paiements: [{ mode: "especes", montant: 100000 }],
});
ok(ticket.statut === 201, "ticket : 2 lots de tiges + une épilation sourcils");
ok((await article(t.corps.id)).quantite === 18, "…les tiges passent de 20 à 18 (sans rien saisir)");
ok((await article(cire.corps.id)).quantite === 2.9, "…la cire passe de 3 à 2,9 pots");
ok((await article(t.corps.id)).mouvements.some((m) => m.type === "vente" && m.reference === ticket.corps.reference), "…mouvement « vente » noté avec le n° de ticket");

// Annulation par avoir : tout revient
await api("/api/gestion/caisse", manager, { action: "annuler", id: ticket.corps.id, motif: "erreur de saisie" });
ok((await article(t.corps.id)).quantite === 20 && (await article(cire.corps.id)).quantite === 3, "ticket annulé : tiges et cire reviennent en stock");

// Perte, inventaire
ok((await stock(manager, { action: "perte", id: t.corps.id, quantite: 1, motif: "" })).statut === 400, "perte sans motif : refusée");
await stock(manager, { action: "perte", id: t.corps.id, quantite: 1, motif: "boîte abîmée" });
ok((await article(t.corps.id)).quantite === 19, "perte d'une boîte : 19");
const inv = await stock(manager, { action: "inventaire", id: t.corps.id, compte: 17 });
a = await article(t.corps.id);
ok(inv.statut === 200 && a.quantite === 17 && a.mouvements[0].ecart === -2, "inventaire : 17 comptées, écart −2 noté");

// Alertes
await stock(manager, { action: "modifier", id: t.corps.id, nom: "Tiges locks 6 pouces", type: "revente", unite: "boîte", seuil: 17, produit: TIGES });
const lu = await stock(manager);
const tiges = lu.corps.articles.find((x) => x.id === t.corps.id);
const cireLue = lu.corps.articles.find((x) => x.id === cire.corps.id);
ok(tiges.alerteSeuil === true, "seuil atteint : alerte « à commander »");
ok(cireLue.alertePeremption === "bientot", "cire qui périme dans 10 jours : alerte péremption");
ok((await stock(accueil, undefined)).statut === 200 && (await api("/api/gestion/stock?alertes=1", accueil)).corps.alertes === 2, "pastille de l'onglet : 2 alertes");
ok(lu.corps.valeur.revente === 17 * 3500, `valeur du stock à vendre : ${lu.corps.valeur.revente} F (17 × 3 500)`);

// Une vente n'est jamais bloquée par le stock
const gros = await api("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: TIGES, quantite: 20 }], paiements: [{ mode: "especes", montant: 120000 }] });
ok(gros.statut === 201 && (await article(t.corps.id)).quantite === -3, "vente de 20 avec 17 en stock : acceptée, stock −3 (à corriger par inventaire)");
ok((await article(t.corps.id)).joursCouverture !== undefined, "jours de couverture calculés d'après les ventes");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
