// Vérification des cartes cadeaux, sur la base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-cartes.mjs [http://localhost:3100]
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
const api = (chemin, tok, corps) =>
  fetch(`${SITE}${chemin}`, {
    method: corps ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const caisse = (tok, corps, q = "") => api(`/api/gestion/caisse${q}`, tok, corps);
const cartes = (tok, corps, q = "") => api(`/api/gestion/cartes${q}`, tok, corps);

const [direction, accueil, coiffeuse, comptable] = await Promise.all(["direction", "accueil", "coiffeuse1", "comptable"].map((n) => jeton(`${n}@test.aza`)));
const VERNIS = "onglerie--vernis-permanent";

const ouv = await caisse(accueil, { action: "ouvrir", fond: 10000 });
ok(ouv.statut === 201 || ouv.corps.erreur?.includes("déjà ouverte"), "caisse du jour ouverte");
const avant = (await caisse(accueil)).corps.totaux.recette;

// Vente
ok((await cartes(coiffeuse, { montant: 20000, paiements: [{ mode: "especes", montant: 20000 }] })).statut === 403, "une praticienne ne vend pas de carte");
ok((await cartes(accueil, { montant: 500, paiements: [{ mode: "especes", montant: 500 }] })).statut === 400, "montant trop petit : refusé");
ok((await cartes(accueil, { montant: 20000, paiements: [{ mode: "credit", montant: 20000 }] })).statut === 400, "une carte ne se vend pas à crédit");
ok((await cartes(accueil, { montant: 20000, paiements: [{ mode: "especes", montant: 15000 }] })).statut === 400, "paiement incomplet : refusé");
const v = await cartes(accueil, { montant: 20000, pour: "Awa (test)", dePart: "Fatou (test)", telephone: "77 000 55 30", paiements: [{ mode: "especes", montant: 25000 }] });
ok(v.statut === 201 && /^AZA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(v.corps.code), `carte vendue : ${v.corps.code}, ticket ${v.corps.reference}`);
ok(v.corps.rendu === 5000, "monnaie rendue : 5 000 F");
const code = v.corps.code;
const c1 = await cartes(comptable, undefined, `?code=${code.toLowerCase().replace(/-/g, " ")}`);
ok(c1.statut === 200 && c1.corps.solde === 20000, "le code se retrouve même tapé en minuscules avec des espaces ; solde 20 000 F");
ok((await cartes(coiffeuse, undefined, `?code=${code}`)).statut === 403, "une praticienne ne consulte pas les cartes");
ok((await cartes(accueil, undefined, "?code=AZA-0000-0000")).statut === 400, "code mal formé : refusé");

// Paiement avec la carte
const total = (await caisse(accueil, { action: "encaisser", lignes: [{ id: VERNIS, quantite: 5 }], paiements: [{ mode: "carte-cadeau", montant: 25000 }], carteCadeau: code })).corps;
ok(total.erreur?.includes("Il ne reste que"), "payer plus que le solde : refusé");
ok(
  (await caisse(accueil, { action: "encaisser", lignes: [{ id: VERNIS }], paiements: [{ mode: "carte-cadeau", montant: 1000 }, { mode: "especes", montant: 4000 }], carteCadeau: "AZA-2222-2222" })).statut === 404,
  "carte inconnue : refusée",
);
const t = await caisse(accueil, { action: "encaisser", lignes: [{ id: VERNIS }, { id: VERNIS }], paiements: [{ mode: "carte-cadeau", montant: 8000 }, { mode: "wave", montant: 2000 }], carteCadeau: code });
ok(t.statut === 201, `vente payée 8 000 F par la carte + 2 000 F Wave (${t.corps.reference ?? t.corps.erreur})`);
const c2 = (await cartes(accueil, undefined, `?code=${code}`)).corps;
ok(c2.solde === 12000 && c2.historique.length === 2, "solde de la carte : 12 000 F, historique à 2 lignes");
ok(
  (await caisse(accueil, { action: "commande", commande: "x", paiements: [{ mode: "carte-cadeau", montant: 1000 }] })).statut === 400,
  "la carte n'est pas acceptée ailleurs que dans une vente en caisse",
);

// Recette : la carte vendue compte, le paiement par carte ne compte pas une seconde fois
const j = (await caisse(accueil)).corps;
ok(j.totaux.recette - avant === 20000 + 2000, `recette du jour : +22 000 F (carte 20 000 + Wave 2 000), pas +30 000`);

// Annulations
const tCarte = j.tickets.find((x) => x.reference === v.corps.reference);
ok((await caisse(direction, { action: "annuler", id: tCarte.id, motif: "test" })).statut === 409, "annuler la vente d'une carte déjà utilisée : refusé");
ok((await caisse(direction, { action: "annuler", id: t.corps.id, motif: "Erreur de saisie" })).statut === 201, "annuler la vente payée par carte");
ok((await cartes(accueil, undefined, `?code=${code}`)).corps.solde === 20000, "la carte retrouve ses 20 000 F");
ok((await caisse(direction, { action: "annuler", id: tCarte.id, motif: "Cliente a changé d'avis" })).statut === 201, "la vente de la carte peut alors être annulée");
const c3 = (await cartes(accueil, undefined, `?code=${code}`)).corps;
ok(c3.statut === "annulee" && c3.solde === 0, "la carte est annulée (solde 0)");
ok(
  (await caisse(accueil, { action: "encaisser", lignes: [{ id: VERNIS }], paiements: [{ mode: "carte-cadeau", montant: 1000 }, { mode: "especes", montant: 10000 }], carteCadeau: code })).statut === 409,
  "une carte annulée ne paie plus",
);
const liste = (await cartes(comptable)).corps;
ok(Array.isArray(liste.cartes) && liste.cartes.some((x) => x.code === code), "la liste des cartes contient la carte (lecture comptable)");

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
