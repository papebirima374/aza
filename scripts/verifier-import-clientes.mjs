// Vérification : import d'une liste de clientes, sans jamais de doublon. Données FICTIVES.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-import-clientes.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};
const jeton = async (email) =>
  (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }) })).json()).idToken;
const appel = (tok, corps) =>
  fetch(`${SITE}/api/gestion/clientes`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(corps) }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const lire = async (chemin) => (await (await fetch(`${EMU}/${chemin}`, { headers: OWNER })).json()).fields ?? {};
const [direction, manager, accueil] = await Promise.all(["direction@test.aza", "manager@test.aza", "accueil@test.aza"].map(jeton));

// Une fiche existe déjà (créée au comptoir) : 77 000 66 10
await appel(accueil, { nom: "Fiche existante (test)", telephone: "77 000 66 10" });
const lignes = [
  { nom: "Import Une (test)", telephone: "770006611" },
  { nom: "Import Deux (test)", telephone: "+221 77 000 66 12", notes: "Autres noms pour ce numéro : Deuxième (test)" },
  { nom: "Même numéro que la fiche (test)", telephone: "00221770006610" },
  { nom: "Import Une encore (test)", telephone: "77 000 66 11" },
  { nom: "Sans numéro (test)", telephone: "" },
  { nom: "Numéro trop court (test)", telephone: "7700066" },
  { nom: "Cliente de Guinée (test)", telephone: "224620700046" },
];
ok((await appel(accueil, { action: "importer", lignes, essai: true })).statut === 403, "l'accueil n'importe pas de clientes");
const e = await appel(manager, { action: "importer", lignes, essai: true });
ok(e.statut === 200 && e.corps.nouvelles.length === 3 && e.corps.existantes.length === 1 && e.corps.doublons.length === 1 && e.corps.refusees.length === 2, "compte rendu : 3 nouvelles, 1 déjà une fiche, 1 numéro répété, 2 refusées");
ok(e.corps.existantes[0].nomActuel === "Fiche existante (test)", "« 00221 77 000 66 10 » reconnu comme la fiche existante 77 000 66 10");
ok(!(await lire("clientes/770006611")).nom, "l'essai n'écrit rien");
const i = await appel(direction, { action: "importer", lignes, essai: false });
ok(i.statut === 200 && i.corps.importees === 3, "import : 3 fiches créées");
const f1 = await lire("clientes/770006611");
ok(f1.nom?.stringValue === "Import Une (test)" && f1.origine?.stringValue === "import", "fiche 77 000 66 11 : le premier nom est gardé");
ok((await lire("clientes/770006612")).notes?.stringValue.includes("Deuxième"), "les notes sont reprises");
ok((await lire("clientes/224620700046")).nom?.stringValue === "Cliente de Guinée (test)", "un numéro étranger garde son indicatif");
ok((await lire("clientes/770006610")).nom?.stringValue === "Fiche existante (test)", "la fiche existante n'est pas modifiée");
const relance = await appel(direction, { action: "importer", lignes, essai: false });
ok(relance.corps.nouvelles.length === 0 && relance.corps.existantes.length === 5, "relancer le même import ne crée rien : 5 déjà une fiche");
const d = await (await fetch(`${SITE}/api/gestion/clientes?doublons=1`, { headers: { Authorization: `Bearer ${direction}` } })).json();
ok(Array.isArray(d) && !d.some((g) => ["770006610", "770006611", "770006612"].includes(g.cle)), "aucune fiche en double après l'import");

console.log(echecs ? `${echecs} ÉCHEC(S)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
