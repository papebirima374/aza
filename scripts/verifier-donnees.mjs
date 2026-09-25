// Vérification de la sauvegarde / remise à zéro / restauration, sur la base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test AVEC CODE_DONNEES=code-de-test-123
// Usage : node scripts/verifier-donnees.mjs [http://localhost:3100]
// Vide la base de test : relancer le seed ensuite.

const SITE = process.argv[2] ?? "http://localhost:3100";
const CODE = "code-de-test-123";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner" };
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};

async function connexion(email) {
  const r = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  return r.json();
}
const donnees = (tok, corps) =>
  fetch(`${SITE}/api/gestion/donnees`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: JSON.stringify(corps),
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const compter = async (c) => ((await (await fetch(`${EMU}/${c}?pageSize=1000`, { headers: OWNER })).json()).documents ?? []).length;

const direction = (await connexion("direction@test.aza")).idToken;
const manager = (await connexion("manager@test.aza")).idToken;

ok((await donnees(manager, { action: "sauvegarder", code: CODE })).statut === 403, "le manager ne peut pas sauvegarder");
ok((await donnees(direction, { action: "sauvegarder", code: "faux" })).statut === 403, "mauvais code : refusé");

// Nombre de durées posées par le seed (il suit le catalogue : ne pas l'écrire en dur).
const DUREES = await compter("prestationsResa");
const s = await donnees(direction, { action: "sauvegarder", code: CODE });
const nbRdv = Object.keys(s.corps.collections?.rendezVous ?? {}).length;
const nbPresta = Object.keys(s.corps.collections?.prestationsResa ?? {}).length;
ok(s.statut === 200 && nbRdv > 0 && nbPresta === DUREES && DUREES > 100, `sauvegarde : ${nbRdv} rendez-vous, ${nbPresta} durées, ${Object.keys(s.corps.collections.comptes).length} comptes`);
ok(!("securite" in s.corps.collections) && !("journalDonnees" in s.corps.collections), "le compteur de sécurité et le journal ne sont pas dans le fichier");

// Vider l'activité seulement
ok((await donnees(direction, { action: "vider", code: CODE, parties: [] })).statut === 400, "rien de coché : refusé");
ok((await donnees(direction, { action: "vider", code: CODE, parties: ["activite"] })).statut === 200, "activité vidée");
ok((await compter("rendezVous")) === 0 && (await compter("clientes")) === 0, "…plus de rendez-vous ni de clientes");
ok((await compter("prestationsResa")) === DUREES && (await compter("comptes")) > 1, "…les durées et l'équipe sont gardées");

// Restaurer
const r = await donnees(direction, { action: "restaurer", code: CODE, sauvegarde: s.corps });
ok(r.statut === 200 && (await compter("rendezVous")) === nbRdv, `sauvegarde remise : ${nbRdv} rendez-vous revenus`);
const unRdv = (await (await fetch(`${EMU}/rendezVous?pageSize=1`, { headers: OWNER })).json()).documents[0];
ok("timestampValue" in unRdv.fields.creeLe, "…les dates sont redevenues de vraies dates");
ok((await donnees(direction, { action: "restaurer", code: CODE, sauvegarde: { bidon: 1 } })).statut === 400, "un fichier qui n'est pas une sauvegarde est refusé");

// Vider l'équipe, puis la faire revenir
const e = await donnees(direction, { action: "vider", code: CODE, parties: ["equipe"] });
ok(e.statut === 200 && (await compter("comptes")) === 1, `équipe vidée (${e.corps.comptesSupprimes} comptes) : seul le compte de la direction reste`);
ok((await connexion("manager@test.aza")).error?.message === "EMAIL_NOT_FOUND", "…le manager ne peut plus se connecter");
const r2 = await donnees(direction, { action: "restaurer", code: CODE, sauvegarde: s.corps });
ok(r2.statut === 200 && r2.corps.comptesRecrees > 0 && (await compter("comptes")) > 1, `restauration : ${r2.corps.comptesRecrees} comptes recréés`);

// Vider les réglages : on repart des horaires de la plaquette
ok((await donnees(direction, { action: "vider", code: CODE, parties: ["reglages"] })).statut === 200, "réglages vidés");
const reglages = await (await fetch(`${EMU}/reglages/institut`, { headers: OWNER })).json();
ok((await compter("prestationsResa")) === 0 && Boolean(reglages.fields?.horaires), "…plus de durées, horaires de départ remis");

// Journal
ok((await compter("journalDonnees")) >= 6, "chaque action est notée dans le journal");

// Blocage après 5 erreurs
for (let i = 0; i < 5; i++) await donnees(direction, { action: "sauvegarder", code: "mauvais" });
ok((await donnees(direction, { action: "sauvegarder", code: CODE })).statut === 429, "5 mauvais codes : bloqué 15 minutes, même avec le bon");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
