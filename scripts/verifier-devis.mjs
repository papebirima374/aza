// Vérification des perruques sur mesure (devis), base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-devis.mjs [http://localhost:3100]

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
const [accueil, coiffeuse] = await Promise.all(["accueil", "coiffeuse1"].map((n) => jeton(`${n}@test.aza`)));
const demande = (corps) => api("/api/boutique/devis", null, { type: "Frontale", texture: "Ondulée", longueur: "20 pouces", couleur: "1B", nom: "Cliente perruque", telephone: "77 000 66 79", ...corps });

ok((await fetch(`${SITE}/boutique/perruques-sur-mesure`)).status === 200, "page « Perruques sur mesure » en ligne");
ok((await demande({ type: "Casque" })).statut === 400, "type inconnu : refusé");
ok((await demande({ telephone: "12" })).statut === 400, "téléphone invalide : refusé");
ok((await demande({ site: "robot" })).statut === 400, "champ piège rempli (robot) : refusé");
const d = await demande({ pourQuand: "mariage en décembre", remarque: "Raie au milieu" });
ok(d.statut === 201 && d.corps.reference === "D-000001", `demande reçue : ${d.corps.reference}`);

ok((await api("/api/gestion/devis", coiffeuse)).statut === 403, "une praticienne ne voit pas les devis");
const liste = (await api("/api/gestion/devis", accueil)).corps;
const x = liste.find((y) => y.reference === "D-000001");
ok(x?.statut === "nouveau" && x.type === "Frontale" && x.remarque === "Raie au milieu", "l'accueil voit la demande et ses détails");
ok((await api("/api/gestion/commandes?nouvelles=1", accueil)).corps.nouvelles >= 1, "la pastille « Commandes » compte la demande");
ok((await api("/api/gestion/devis", accueil, { id: x.id, statut: "accepte" })).statut === 409, "accepter avant d'avoir proposé un prix : refusé");
ok((await api("/api/gestion/devis", accueil, { id: x.id, statut: "propose" })).statut === 400, "proposer sans prix : refusé");
ok((await api("/api/gestion/devis", accueil, { id: x.id, statut: "propose", prix: 85000, delai: "10 jours" })).statut === 200, "prix proposé : 85 000 F, 10 jours");
ok((await api("/api/gestion/devis", accueil, { id: x.id, statut: "accepte" })).statut === 200, "la cliente accepte");
ok((await api("/api/gestion/devis", accueil, { id: x.id, statut: "pret" })).statut === 200, "perruque prête");
ok((await api("/api/gestion/devis", accueil, { id: x.id, statut: "remis" })).statut === 200, "perruque remise");
const fin = (await api("/api/gestion/devis", accueil)).corps.find((y) => y.id === x.id);
ok(fin.statut === "remis" && fin.prix === 85000 && fin.historique.length === 5, "historique complet (5 étapes), prix gardé");
ok((await api("/api/gestion/devis", accueil, { id: x.id, statut: "refuse", motif: "test" })).statut === 409, "une demande remise ne se rouvre plus");

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
