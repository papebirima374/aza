// Vérification : historique de la prestataire (sans montants) et fiche du mois (direction),
// avec les primes et pourboires. Données FICTIVES.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-prestataires.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
let echecs = 0;
const ok = (cond, msg, detail = "") => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) echecs++;
};
const jeton = async (email) =>
  (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }) })).json()).idToken;
const appel = (chemin, tok, corps) =>
  fetch(`${SITE}${chemin}`, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, ...(corps ? { body: JSON.stringify(corps) } : {}) }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const MOIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date()).slice(0, 7);
const CO = "test-coiffeuse-1";
const VERNIS = "onglerie--vernis-permanent"; // 5 000
const GAINAGE = "onglerie--gainage"; // 15 000
const [dir, man, acc, coiffeuse, comptable] = await Promise.all(["direction@test.aza", "manager@test.aza", "accueil@test.aza", "coiffeuse1@test.aza", "comptable@test.aza"].map(jeton));

await appel("/api/gestion/caisse", man, { action: "ouvrir", fond: 0 });
await appel("/api/gestion/caisse", man, { action: "encaisser", lignes: [{ id: GAINAGE, praticienne: CO }], paiements: [{ mode: "wave", montant: 15000 }], cliente: { nom: "Awa Diop (test)", telephone: "77 000 44 01" } });
await appel("/api/gestion/caisse", man, { action: "encaisser", lignes: [{ id: GAINAGE, praticienne: CO }, { id: VERNIS, praticienne: CO }], remise: { montant: 4000, motif: "Fidèle" }, paiements: [{ mode: "wave", montant: 16000 }] });
const annule = await appel("/api/gestion/caisse", man, { action: "encaisser", lignes: [{ id: VERNIS, praticienne: CO }], paiements: [{ mode: "wave", montant: 5000 }] });
await appel("/api/gestion/caisse", man, { action: "annuler", id: annule.corps.id, motif: "Erreur" });

// Son historique
ok((await appel(`/api/gestion/prestataires?mois=${MOIS}`, acc)).statut === 403, "un compte sans prestations n'a pas d'historique");
const h = await appel(`/api/gestion/prestataires?mois=${MOIS}`, coiffeuse);
ok(h.statut === 200 && h.corps.soins === 3 && h.corps.interventions.length === 3, `la coiffeuse voit ses 3 soins du mois (le soin annulé n'y est pas)`, JSON.stringify(h.corps).slice(0, 200));
ok(h.corps.interventions.every((x) => !("montant" in x)) && !JSON.stringify(h.corps).includes("15000"), "aucun montant dans son historique");
ok(h.corps.interventions.some((x) => x.cliente === "Awa Diop (test)"), "elle voit le nom de sa cliente");
ok((await appel(`/api/gestion/prestataires?fiche=${CO}&mois=${MOIS}`, coiffeuse)).statut === 403, "elle n'ouvre pas la fiche du mois (montants)");

// La fiche du mois
const f = await appel(`/api/gestion/prestataires?fiche=${CO}&mois=${MOIS}`, dir);
// 15 000 + (15 000 + 5 000 − 4 000 de remise) = 31 000
ok(f.statut === 200 && f.corps.chiffre === 31000 && f.corps.soins === 3, `fiche du mois : chiffre 31 000 F (remise déduite), 3 soins`, `chiffre ${f.corps.chiffre}`);
const rap = (await appel(`/api/gestion/rapports?du=${MOIS}-01&au=${MOIS}-31`, dir)).corps;
ok(rap.equipe.find((e) => e.id === CO)?.montant === f.corps.chiffre, "le chiffre de la fiche = celui des Rapports");
ok((await appel(`/api/gestion/prestataires?fiche=${CO}&mois=${MOIS}`, comptable)).statut === 200, "le comptable (qui voit les rapports) ouvre la fiche");
ok(f.corps.equipe.some((x) => x.id === CO) && f.corps.primes.length === 0, "la liste de l'équipe est fournie ; aucune prime encore");

// Prime et pourboire
ok((await appel("/api/gestion/depenses", dir, { action: "ajouter", montant: 3000, categorie: "salaires", mode: "wave", pour: "inconnue" })).statut === 400, "prime pour une prestataire inconnue : refusée");
const p = await appel("/api/gestion/depenses", dir, { action: "ajouter", montant: 10000, categorie: "salaires", libelle: "Prime du mois", mode: "wave", pour: CO });
await appel("/api/gestion/depenses", man, { action: "ajouter", montant: 2000, categorie: "salaires", libelle: "Pourboire", mode: "especes", pour: CO });
ok(p.statut === 201, "la direction note une prime de 10 000 F pour la coiffeuse");
const f2 = await appel(`/api/gestion/prestataires?fiche=${CO}&mois=${MOIS}`, dir);
ok(f2.corps.primes.length === 2 && f2.corps.primes.reduce((s, x) => s + x.montant, 0) === 12000, "la fiche montre la prime et le pourboire : 12 000 F");
const dep = (await appel("/api/gestion/depenses", dir)).corps;
ok(dep.parCategorie.salaires === 12000, "et ils sont comptés dans les Dépenses (Salaires et avances)");

console.log(echecs ? `${echecs} ÉCHEC(S)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
