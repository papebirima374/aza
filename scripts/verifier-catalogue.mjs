// Vérification du catalogue (prix modifiés, lignes masquées ou ajoutées), sur la base de TEST.
// Prérequis : émulateurs + seed (base fraîche), site démarré en mode test AVEC RESERVATION_EN_LIGNE=1.
// Usage : node scripts/verifier-catalogue.mjs [http://localhost:3100]

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
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const catalogue = (tok, corps) => api("/api/gestion/catalogue", tok, corps);
const vendre = (tok, id) => api("/api/gestion/caisse", tok, { action: "encaisser", lignes: [{ id }], paiements: [{ mode: "especes", montant: 1_000_000 }] });

const [direction, manager, accueil] = await Promise.all(["direction", "manager", "accueil"].map((n) => jeton(`${n}@test.aza`)));
const HYDRA = "soins-visage--hydrafacial";
const TIGES = "locks--lot-de-10-tiges-locks-6-pouces";
const d = new Date();
d.setUTCDate(d.getUTCDate() + 10);
while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1); // un mardi
const DATE = d.toISOString().slice(0, 10);

// Droits
ok((await catalogue(manager, { action: "prix", id: HYDRA, prix: 1 })).statut === 403, "le manager ne change pas les prix");
ok((await catalogue(accueil, { action: "ajouter", familleId: "massage", nom: "X", prix: 1 })).statut === 403, "l'accueil n'ajoute rien au catalogue");

// Changer un prix
ok((await catalogue(direction, { action: "prix", id: HYDRA, prix: 45000 })).statut === 200, "Hydrafacial passe de 40 000 à 45 000 F");
ok((await api("/api/catalogue")).corps.modifs[HYDRA]?.prix === 45000, "…le nouveau prix est publié");
await api("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 0 });
const t = await vendre(accueil, HYDRA);
ok(t.statut === 201 && t.corps.total === 45000, `…la caisse encaisse ${t.corps.total} F`);
const r = await api("/api/reservations", null, { date: DATE, debut: 600, prestations: [HYDRA], nom: "Cliente prix", telephone: "77 444 00 01" });
ok(r.statut === 201 && r.corps.total === 45000, "…et la réservation en ligne aussi");

// Masquer
ok((await catalogue(direction, { action: "masquer", id: TIGES, masque: true })).statut === 200, "lot de tiges masqué");
ok((await vendre(accueil, TIGES)).statut === 400, "…la caisse ne le vend plus");
await catalogue(direction, { action: "masquer", id: TIGES, masque: false });
ok((await vendre(accueil, TIGES)).statut === 201, "réaffiché : de nouveau en vente");

// Ajouter une prestation, lui donner une durée, la réserver
const a = await catalogue(direction, { action: "ajouter", familleId: "massage", nom: "Massage aux pierres chaudes", prix: 35000 });
ok(a.statut === 200 && a.corps.id?.startsWith("massage--massage-aux-pierres-chaudes"), `prestation ajoutée (${a.corps.id})`);
ok((await catalogue(direction, { action: "ajouter", familleId: "massage", nom: "massage aux pierres chaudes", prix: 1 })).statut === 409, "…pas de doublon dans la même famille");
ok((await api("/api/gestion/reglages", direction, { action: "prestation", id: a.corps.id, duree: 60, typePoste: "", praticiennes: 1, enLigne: true })).statut === 200, "…durée 1 h enregistrée");
const c = await api(`/api/creneaux?date=${DATE}&p=${encodeURIComponent(a.corps.id)}`);
ok(c.statut === 200 && c.corps.creneaux.length > 0, `…le site propose ${c.corps.creneaux?.length} heures libres`);
const r2 = await api("/api/reservations", null, { date: DATE, debut: 900, prestations: [a.corps.id], nom: "Cliente pierres", telephone: "77 444 00 02" });
ok(r2.statut === 201 && r2.corps.total === 35000, "…réservée en ligne à 35 000 F");

// Ajouter un produit et le vendre
const p = await catalogue(direction, { action: "ajouter", familleId: "soins-cheveux", nom: "Huile de ricin (test)", prix: 4500, produit: true });
ok(p.statut === 200, "produit ajouté (huile de ricin)");
const v = await vendre(accueil, p.corps.id);
ok(v.statut === 201 && v.corps.total === 4500, "…vendu en caisse 4 500 F");
ok((await api("/api/gestion/reglages", direction, { action: "prestation", id: p.corps.id, duree: 30 })).statut === 400, "…un produit n'a pas de durée");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
