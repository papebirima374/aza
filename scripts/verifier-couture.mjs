// Vérification d'Anna Zen Couture en boutique (commande « sur commande », sans stock), base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-couture.mjs [http://localhost:3100]
// Modifie la base de test : relancer le seed ensuite.

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
const [direction, accueil] = await Promise.all(["direction", "accueil"].map((n) => jeton(`${n}@test.aza`)));
const commander = (corps) => api("/api/boutique/commandes", null, { nom: "Cliente couture", telephone: "77 000 66 78", paiement: "sur-place", mode: "retrait", ...corps });

// Pages publiques
const page = await fetch(`${SITE}/boutique/couture/C-07`);
const html = await page.text();
ok(page.status === 200 && html.includes("8 000") && html.includes("Sur mesure"), "page du modèle C-07 : prix 8 000 F et choix des tailles");
ok((await fetch(`${SITE}/boutique/couture/C-99`)).status === 404, "modèle inexistant : page introuvable");
const liste = await (await fetch(`${SITE}/boutique/couture`)).text();
ok(liste.includes("2 000") && liste.includes("30 000") && (liste.match(/Commander/g) ?? []).length >= 29, "collection : 29 modèles de 2 000 à 30 000 F, bouton « Commander »");

// Commande
ok((await commander({ lignes: [{ article: "couture:C-07:M", quantite: 1 }] })).statut === 503, "boutique fermée : pas de commande");
await api("/api/gestion/boutique", direction, { action: "ouverture", ouverte: true });
ok((await commander({ lignes: [{ article: "couture:C-07:XXXL", quantite: 1 }] })).statut === 409, "taille inconnue : refusée");
const c = await commander({ lignes: [{ article: "couture:C-07:M", quantite: 2 }, { article: "couture:C-29:Sur mesure", quantite: 1 }] });
ok(c.statut === 201 && c.corps.total === 2 * 8000 + 30000, `commande ${c.corps.reference} : 2 × C-07 taille M + C-29 sur mesure = 46 000 F`);
const cmd = (await api("/api/gestion/commandes", accueil)).corps.find((x) => x.reference === c.corps.reference);
ok(cmd?.lignes.length === 2 && cmd.lignes[0].variante === "Taille M" && cmd.lignes[1].variante === "Sur mesure" && cmd.lignes.every((l) => l.surCommande), "l'accueil voit les tailles, lignes « sur commande »");

// Le prix suit le catalogue (direction)
ok((await api("/api/gestion/catalogue", direction, { action: "prix", id: "couture--modele-c-07", prix: 9500 })).statut === 200, "la direction change le prix du modèle C-07 (Catalogue)");
// (la mémoire du catalogue est vidée à chaque changement)
const c2 = await commander({ lignes: [{ article: "couture:C-07:L", quantite: 1 }] });
ok(c2.corps.total === 9500, "la commande suivante prend le nouveau prix : 9 500 F");
ok((await api("/api/gestion/catalogue", direction, { action: "masquer", id: "couture--modele-c-07", masque: true })).statut === 200, "la direction retire le modèle C-07 de la vente");

ok((await commander({ lignes: [{ article: "couture:C-07:L", quantite: 1 }] })).statut === 409, "modèle retiré : commande refusée");

// Remise en caisse
await api("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 0 });
await api("/api/gestion/commandes", accueil, { id: cmd.id, statut: "confirmee" });
const t = await api("/api/gestion/caisse", accueil, { action: "commande", commande: cmd.id, paiements: [{ mode: "wave", montant: 46000 }] });
ok(t.statut === 201, `remise payée en caisse : ticket ${t.corps.reference ?? t.corps.erreur}`);
const a = await api("/api/gestion/caisse", direction, { action: "annuler", id: t.corps.id, motif: "Test annulation" });
ok(a.statut === 201, "annulation du ticket (aucun stock à remettre) : avoir créé");

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
