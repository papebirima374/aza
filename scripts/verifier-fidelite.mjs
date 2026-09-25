// Vérification de la carte de fidélité, sur la base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-fidelite.mjs [http://localhost:3100]

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
  }).then(async (r) => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const [direction, accueil] = await Promise.all(["direction", "accueil"].map((n) => jeton(`${n}@test.aza`)));
const TEL = "77 000 44 10";
const cliente = { nom: "Cliente fidèle (test)", telephone: TEL };
const vendre = (id, montant, extra = {}) =>
  api("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id }], paiements: [{ mode: "especes", montant }], cliente, ...extra });
const points = async () => (await api(`/api/gestion/caisse?fidelite=${encodeURIComponent(TEL)}`, accueil)).corps.points;

await api("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 0 });
ok((await api("/api/gestion/reglages", accueil, { action: "fidelite", actif: true, tranche: 1000, seuil: 10, valeur: 2000 })).statut === 403, "l'accueil ne règle pas la fidélité");
const sansProgramme = await vendre("onglerie--vernis-permanent", 5000);
ok(sansProgramme.statut === 201 && (await points()) === 0, "programme éteint : aucun point");
ok((await api("/api/gestion/reglages", direction, { action: "fidelite", actif: true, tranche: 1000, seuil: 10, valeur: 2000 })).statut === 200, "la direction active : 1 point par 1 000 F, 10 points = 2 000 F");

const t1 = await vendre("onglerie--vernis-permanent", 5000);
ok(t1.statut === 201, `vente 5 000 F (${t1.corps.reference})`);
const recu1 = (await api(`/api/gestion/caisse?ticket=${t1.corps.id}`, accueil)).corps;
ok(recu1.fidelite?.gagnes === 5 && recu1.fidelite.solde === 5, "le reçu porte +5 points, solde 5");
await vendre("onglerie--vernis-french", 7000);
ok((await points()) === 12, "après 7 000 F de plus : 12 points");

const t3 = await vendre("onglerie--vernis-simple", 1000, { fidelite: true });
ok(t3.statut === 201 && t3.corps.total === 1000, "vernis simple 3 000 F − 2 000 F de fidélité : la cliente paie 1 000 F");
const recu3 = (await api(`/api/gestion/caisse?ticket=${t3.corps.id}`, accueil)).corps;
ok(recu3.fidelite?.utilises === 10 && recu3.fidelite.remise === 2000 && recu3.fidelite.gagnes === 1 && recu3.fidelite.solde === 3, "reçu : 10 points utilisés, +1 gagné, solde 3");
ok((await vendre("onglerie--vernis-simple", 1000, { fidelite: true })).statut === 409, "3 points seulement : la remise est refusée");
ok((await api("/api/gestion/caisse", direction, { action: "annuler", id: t3.corps.id, motif: "Test fidélité" })).statut === 201, "annulation du ticket avec remise fidélité");
ok((await points()) === 12, "les points reviennent : 12");
const fiche = (await api(`/api/gestion/clientes?id=770004410`, accueil)).corps;
ok(fiche.points === 12, "la fiche cliente affiche 12 points");
ok((await api("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: "onglerie--vernis-simple" }], paiements: [{ mode: "especes", montant: 1000 }], fidelite: true })).statut === 400, "points sans téléphone de cliente : refusé");

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
