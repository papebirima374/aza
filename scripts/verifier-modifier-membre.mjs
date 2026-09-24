// Vérification de la modification des comptes de l'équipe, sur la base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-modifier-membre.mjs [http://localhost:3100]
// Modifie la base de test : relancer le seed ensuite.

const SITE = process.argv[2] ?? "http://localhost:3100";
const AUTH = "http://127.0.0.1:9099";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { headers: { Authorization: "Bearer owner" } };
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};

async function connexion(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  const j = await r.json();
  return { jeton: j.idToken, uid: j.localId, erreur: j.error?.message };
}
const api = (jeton, methode, corps) =>
  fetch(`${SITE}/api/gestion/equipe`, {
    method: methode,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const champ = async (chemin) => (await (await fetch(`${EMU}/${chemin}`, OWNER)).json()).fields ?? {};

const direction = await connexion("direction@test.aza");
const manager = await connexion("manager@test.aza");
const coiffeuse = await connexion("coiffeuse1@test.aza");
const accueil = await connexion("accueil@test.aza");

// Droits
ok((await api(manager.jeton, "PATCH", { uid: coiffeuse.uid, nom: "Piratée" })).statut === 403, "le manager ne modifie pas les comptes");
ok((await api(direction.jeton, "PATCH", { uid: direction.uid, role: "accueil" })).statut === 400, "la direction ne change pas son propre rôle");
ok((await api(direction.jeton, "PATCH", { uid: direction.uid, actif: false })).statut === 400, "…ni ne coupe son propre accès");

// Nom et compétences
const r = await api(direction.jeton, "PATCH", { uid: coiffeuse.uid, nom: "Coiffeuse renommée", competences: ["tresses", "onglerie"] });
ok(r.statut === 200, "nom et compétences modifiés");
const fiche = await champ("praticiennes/test-coiffeuse-1");
ok(fiche.nom?.stringValue === "Coiffeuse renommée", "…le nom suit dans l'agenda");
const comp = fiche.competences?.arrayValue.values.map((v) => v.stringValue).sort().join();
ok(comp === "onglerie,tresses", `…compétences enregistrées (${comp})`);
ok((await api(direction.jeton, "PATCH", { uid: coiffeuse.uid, competences: [] })).statut === 400, "une praticienne sans compétence est refusée");
const liste = await api(manager.jeton, "GET");
ok(liste.corps.find((m) => m.uid === coiffeuse.uid)?.competences.length === 2, "la liste montre les compétences");

// Changement de rôle : accueil → praticienne crée sa fiche d'agenda
const p = await api(direction.jeton, "PATCH", { uid: accueil.uid, role: "praticienne", competences: ["soins-visage"] });
ok(p.statut === 200, "l'accueil devient praticienne");
const compteAccueil = await champ(`comptes/${accueil.uid}`);
const ficheId = compteAccueil.praticienne?.stringValue;
ok(Boolean(ficheId) && (await champ(`praticiennes/${ficheId}`)).actif?.booleanValue === true, "…elle a maintenant une colonne dans l'agenda");
await api(direction.jeton, "PATCH", { uid: accueil.uid, role: "accueil" });
ok((await champ(`praticiennes/${ficheId}`)).actif?.booleanValue === false, "redevenue accueil : sa colonne disparaît de l'agenda");

// Nouveau lien
const l = await api(direction.jeton, "PATCH", { uid: coiffeuse.uid, lien: true });
ok(typeof l.corps.lien === "string" && l.corps.lien.length > 20, "nouveau lien de mot de passe généré");

// Désactivation
ok((await api(direction.jeton, "PATCH", { uid: coiffeuse.uid, actif: false })).statut === 200, "compte de la coiffeuse désactivé");
ok((await connexion("coiffeuse1@test.aza")).erreur === "USER_DISABLED", "…elle ne peut plus se connecter");
ok((await champ("praticiennes/test-coiffeuse-1")).actif?.booleanValue === false, "…et ne reçoit plus de rendez-vous");
const ancienne = await api(coiffeuse.jeton, "GET");
ok([401, 403].includes(ancienne.statut) && !/réservé/i.test(ancienne.corps.erreur), `…son ancienne session est refusée par le serveur (${ancienne.statut} ${ancienne.corps.erreur})`);
ok((await api(direction.jeton, "PATCH", { uid: coiffeuse.uid, actif: true })).statut === 200, "compte réactivé");
ok(!(await connexion("coiffeuse1@test.aza")).erreur, "…elle se reconnecte");
ok((await champ("praticiennes/test-coiffeuse-1")).actif?.booleanValue === true, "…et retrouve sa colonne");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
