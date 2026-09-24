// Vérification de l'écran du jour, sur la base de TEST.
// Prérequis : émulateurs + seed (base fraîche), site démarré en mode test.
// Usage : node scripts/verifier-jour.mjs [http://localhost:3100]

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
const [direction, manager, accueil, comptable] = await Promise.all(["direction", "manager", "accueil", "comptable"].map((n) => jeton(`${n}@test.aza`)));
const TIGES = "locks--lot-de-10-tiges-locks-6-pouces";

ok((await api("/api/gestion/jour", accueil)).statut === 403, "l'accueil ne voit pas l'écran du jour");
ok((await api("/api/gestion/jour", comptable)).statut === 403, "le comptable non plus");

const avant = (await api("/api/gestion/jour", direction)).corps;
ok(avant.rendezVous.total >= 1 && avant.recette.total === 0, `matin : ${avant.rendezVous.total} rendez-vous, recette 0 F`);
ok(avant.equipe.length > 0 && avant.equipe.every((p) => p.occupation >= 0 && p.occupation <= 100), `équipe du jour : ${avant.equipe.length} praticiennes, taux d'occupation calculés`);

// Deux ventes, dont une annulée
await api("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 10000 });
await api("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: TIGES, quantite: 2 }], paiements: [{ mode: "wave", montant: 12000 }] });
const t2 = await api("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: TIGES }], paiements: [{ mode: "especes", montant: 10000 }] });
await api("/api/gestion/caisse", manager, { action: "annuler", id: t2.corps.id, motif: "test" });
await api("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: TIGES, quantite: 3 }], paiements: [{ mode: "especes", montant: 18000 }] });

const j = (await api("/api/gestion/jour", manager)).corps;
ok(j.recette.total === 30000, `recette : ${j.recette.total} F (12 000 + 18 000, le ticket annulé ne compte pas)`);
ok(j.recette.nombre === 2 && j.recette.panierMoyen === 15000, `panier moyen : ${j.recette.panierMoyen} F sur ${j.recette.nombre} ventes`);
ok(j.recette.parMode.wave === 12000 && j.recette.parMode.especes === 18000, "Wave 12 000 F, espèces 18 000 F");
ok(j.recette.produits === 30000 && j.caisse?.statut === "ouverte", "…tout en produits, caisse ouverte");

// Alerte de stock
const a = await api("/api/gestion/stock", manager, { action: "creer", nom: "Huile test", type: "cabine", seuil: 2 });
ok((await api("/api/gestion/jour", direction)).corps.alertesStock.some((x) => x.nom === "Huile test"), "alerte de stock reprise sur l'écran du jour");
void a;

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
