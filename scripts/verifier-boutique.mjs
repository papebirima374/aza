// Vérification de la boutique en ligne et des commandes, sur la base de TEST.
// Prérequis : émulateurs + seed (base fraîche : caisse du jour pas encore ouverte), site démarré en mode test.
// Usage : node scripts/verifier-boutique.mjs [http://localhost:3100]

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
    headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const [direction, manager, accueil, coiffeuse] = await Promise.all(["direction", "manager", "accueil", "coiffeuse1"].map((n) => jeton(`${n}@test.aza`)));
const stock = (corps) => api("/api/gestion/stock", manager, corps);
const quantite = async (id) => (await api("/api/gestion/stock", manager)).corps.articles.find((a) => a.id === id).quantite;
const commander = (corps) => api("/api/boutique/commandes", null, { nom: "Cliente boutique", telephone: "77 000 66 77", paiement: "sur-place", ...corps });

// Produit publié : 2 déclinaisons (6 et 8 pouces) regroupées sous un même titre
const a6 = (await stock({ action: "creer", nom: "Tiges 6", type: "revente", unite: "boîte", seuil: 1, produit: "locks--lot-de-10-tiges-locks-6-pouces" })).corps.id;
const a8 = (await stock({ action: "creer", nom: "Tiges 8", type: "revente", unite: "boîte", seuil: 1, produit: "locks--lot-de-10-tiges-locks-8-pouces" })).corps.id;
await stock({ action: "reception", id: a6, quantite: 5, cout: 3000 });
await stock({ action: "reception", id: a8, quantite: 2, cout: 4000 });
const publier = (id, variante) => stock({ action: "boutique", id, visible: true, titre: "Tiges pour locks", variante, rayon: "capillaire", description: "Lot de 10 tiges." });
ok((await publier(a6, "6 pouces")).statut === 200 && (await publier(a8, "8 pouces")).statut === 200, "produit publié en boutique, en 2 déclinaisons");
const photo = await stock({ action: "photo-ajout", id: a6, image: "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==" });
const img = await fetch(`${SITE}/api/boutique/photo/${photo.corps.photo}`);
ok(photo.statut === 200 && img.status === 200 && img.headers.get("content-type") === "image/webp", "photo ajoutée et servie au site");

// Ouverture et zones
ok((await commander({ lignes: [{ article: a6, quantite: 1 }], mode: "retrait" })).statut === 503, "boutique fermée : pas de commande");
ok((await api("/api/gestion/boutique", manager, { action: "ouverture", ouverte: true })).statut === 403, "seule la direction ouvre la boutique");
await api("/api/gestion/boutique", direction, { action: "ouverture", ouverte: true });
await api("/api/gestion/boutique", manager, { action: "zones", zones: [{ nom: "Dakar Plateau", prix: 1500 }, { nom: "Almadies", prix: 2500 }] });
const reglage = (await api("/api/gestion/boutique", manager)).corps;
ok(reglage.ouverte && reglage.zones.length === 2 && reglage.publies === 1, "boutique ouverte, 2 zones de livraison, 1 produit publié");

// Commandes
const c1 = await commander({ lignes: [{ article: a6, quantite: 2 }], mode: "retrait" });
ok(c1.statut === 201 && c1.corps.reference === "C-000001" && c1.corps.total === 12000, "commande C-000001 : 2 boîtes, retrait à l'institut, 12 000 F");
ok((await quantite(a6)) === 3, "…le stock est réservé tout de suite (5 → 3)");
ok((await commander({ lignes: [{ article: a6, quantite: 10 }], mode: "retrait" })).statut === 409, "plus que le stock : refusé (il n'en reste que 3)");
ok((await commander({ lignes: [{ article: a8, quantite: 1 }], mode: "livraison" })).statut === 400, "livraison sans zone : refusée");
const zone = reglage.zones[0].id;
const c2 = await commander({ lignes: [{ article: a8, quantite: 1 }], mode: "livraison", zone, adresse: "Rue 10, Plateau" });
ok(c2.statut === 201 && c2.corps.total === 8000 + 1500, "commande livrée au Plateau : 8 000 + 1 500 F de livraison");

// Suivi
ok((await api("/api/gestion/commandes", coiffeuse)).statut === 403, "une praticienne ne voit pas les commandes");
const liste = (await api("/api/gestion/commandes", accueil)).corps;
ok(liste.length === 2 && (await api("/api/gestion/commandes?nouvelles=1", accueil)).corps.nouvelles === 2, "l'accueil voit 2 nouvelles commandes");
const id1 = liste.find((c) => c.reference === "C-000001").id;
const id2 = liste.find((c) => c.reference === "C-000002").id;
await api("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 0 });
ok((await api("/api/gestion/caisse", accueil, { action: "commande", commande: id1, paiements: [{ mode: "especes", montant: 12000 }] })).statut === 409, "pas de remise avant confirmation");
await api("/api/gestion/commandes", accueil, { id: id1, statut: "confirmee" });
await api("/api/gestion/commandes", accueil, { id: id1, statut: "prete" });
const t = await api("/api/gestion/caisse", accueil, { action: "commande", commande: id1, paiements: [{ mode: "wave", montant: 12000 }] });
ok(t.statut === 201, `remise et encaissement : ticket ${t.corps.reference}`);
const apres = (await api("/api/gestion/commandes", accueil)).corps.find((c) => c.id === id1);
ok(apres.statut === "remise" && apres.ticket?.reference === t.corps.reference, "…commande « remise et payée », reliée au ticket");
ok((await quantite(a6)) === 3, "…le stock ne sort pas une seconde fois");

// Livraison puis annulation : le produit revient
await api("/api/gestion/commandes", accueil, { id: id2, statut: "confirmee" });
await api("/api/gestion/commandes", accueil, { id: id2, statut: "en-livraison", livreur: "Moussa" });
ok((await api("/api/gestion/commandes", accueil, { id: id2, statut: "annulee" })).statut === 400, "annulation sans motif : refusée");
await api("/api/gestion/commandes", accueil, { id: id2, statut: "annulee", motif: "Cliente absente à la livraison" });
ok((await quantite(a8)) === 2, "commande annulée : la boîte revient en stock (1 → 2)");

// Retour après remise : avoir, produits remis en stock
await api("/api/gestion/caisse", manager, { action: "annuler", id: t.corps.id, motif: "Retour produit" });
ok((await quantite(a6)) === 5, "retour : l'avoir remet les 2 boîtes en stock (3 → 5)");

// Stock partagé avec le comptoir
await api("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: "locks--lot-de-10-tiges-locks-6-pouces", quantite: 5 }], paiements: [{ mode: "especes", montant: 30000 }] });
ok((await commander({ lignes: [{ article: a6, quantite: 1 }], mode: "retrait" })).statut === 409, "tout vendu au comptoir : le site ne peut plus le vendre");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
