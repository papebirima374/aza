// Prépare une journée réaliste sur la base de TEST (noms fictifs) pour les captures du guide.
const S = "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
async function jeton(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
const api = async (chemin, tok, corps) => {
  const r = await fetch(S + chemin, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: corps ? JSON.stringify(corps) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) console.log("  ⚠", chemin, r.status, j.erreur);
  return j;
};
const [dir, man, acc, coif] = await Promise.all(["direction", "manager", "accueil", "coiffeuse1"].map((n) => jeton(`${n}@test.aza`)));

// Réglages : réservation en ligne ouverte
await api("/api/gestion/reglages", dir, { action: "en-ligne", actif: true });

// Catalogue : 2 produits de boutique
const p1 = await api("/api/gestion/catalogue", dir, { action: "ajouter", familleId: "soins-cheveux", nom: "Huile de ricin 100 ml", prix: 4500, produit: true });
const p2 = await api("/api/gestion/catalogue", dir, { action: "ajouter", familleId: "soins-cheveux", nom: "Crème coiffante 340 g", prix: 7000, produit: true });

// Stock
const a1 = await api("/api/gestion/stock", man, { action: "creer", nom: "Huile de ricin 100 ml", type: "revente", unite: "flacon", seuil: 3, produit: p1.id });
const a2 = await api("/api/gestion/stock", man, { action: "creer", nom: "Crème coiffante 340 g", type: "revente", unite: "pot", seuil: 4, produit: p2.id });
const a3 = await api("/api/gestion/stock", man, { action: "creer", nom: "Cire tiède", type: "cabine", unite: "pot", seuil: 1 });
await api("/api/gestion/stock", man, { action: "reception", id: a1.id, quantite: 12, cout: 2500 });
await api("/api/gestion/stock", man, { action: "reception", id: a2.id, quantite: 3, cout: 4200 });
await api("/api/gestion/stock", man, { action: "reception", id: a3.id, quantite: 4, cout: 8000, peremption: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10) });
await api("/api/gestion/stock", man, { action: "consommation", prestation: "epilation-femme--sourcils-forme", lignes: [{ article: a3.id, quantite: 0.1 }] });
await api("/api/gestion/stock", man, { action: "boutique", id: a1.id, visible: true, titre: "Huile de ricin 100 ml", rayon: "capillaire", description: "Huile de ricin pure, pour fortifier les cheveux, les cils et les sourcils." });
await api("/api/gestion/stock", man, { action: "boutique", id: a2.id, visible: true, titre: "Crème coiffante 340 g", rayon: "capillaire", description: "Crème coiffante nourrissante pour cheveux naturels et tresses." });

// Boutique ouverte + zones + une commande
await api("/api/gestion/boutique", dir, { action: "ouverture", ouverte: true });
await api("/api/gestion/boutique", man, { action: "zones", zones: [{ nom: "Point-E / Fann", prix: 1000 }, { nom: "Plateau", prix: 1500 }, { nom: "Almadies", prix: 2500 }] });
await api("/api/boutique/commandes", null, { lignes: [{ article: a1.id, quantite: 2 }], mode: "retrait", nom: "Mariama Sarr (test)", telephone: "77 000 55 21", paiement: "sur-place" });

// Clientes : allergie + fiche technique
await api("/api/gestion/clientes", acc, { id: "770000101", allergies: "Henné noir", peau: "Sensible", cheveux: "Crépus, fins", meches: "Knotless mi-long, couleur 1B", connue: "Instagram", quartier: "Point-E" });

// Caisse : ouverture, ventes, un crédit
await api("/api/gestion/caisse", acc, { action: "ouvrir", fond: 20000 });
await api("/api/gestion/caisse", acc, { action: "encaisser", lignes: [{ id: p2.id }], paiements: [{ mode: "wave", montant: 7000 }] });
await api("/api/gestion/caisse", acc, { action: "encaisser", lignes: [{ id: "onglerie--vernis-permanent" }, { id: p1.id }], paiements: [{ mode: "especes", montant: 10000 }] });
await api("/api/gestion/caisse", acc, { action: "encaisser", lignes: [{ id: "epilation-femme--sourcils-forme" }], paiements: [{ mode: "especes", montant: 1000 }, { mode: "credit", montant: 4000 }], cliente: { nom: "Fatou Ndiaye (test)", telephone: "77 000 55 22" } });

// Rendez-vous : la coiffeuse commence et finit Awa Diop (9h) → à encaisser
const q = await (await fetch(`${EMU}:runQuery`, { method: "POST", headers: OWNER, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "rendezVous" }], where: { fieldFilter: { field: { fieldPath: "cliente.id" }, op: "EQUAL", value: { stringValue: "770000101" } } } } }) })).json();
const rdv = q[0].document.name.split("/").pop();
await api(`/api/gestion/rendez-vous/${rdv}/statut`, coif, { statut: "en-cours" });
console.log("RDV Awa :", rdv);
console.log("Articles :", a1.id, a2.id, a3.id);
console.log("Prêt.");
