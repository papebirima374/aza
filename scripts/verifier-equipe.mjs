// Vérification du premier démarrage et de l'écran Équipe, sur une base de TEST VIDÉE.
// Prérequis : émulateurs (firestore + auth) ; site démarré avec, en plus des variables
// d'émulateur, DIRECTION_EMAILS=patronne@test.aza,associee@test.aza
// Usage : node scripts/verifier-equipe.mjs [http://localhost:3100]
// ATTENTION : vide la base de test. Relancer ensuite scripts/seed-emulateur.mjs.

const SITE = process.argv[2] ?? "http://localhost:3100";
const PROJET = "demo-aza";
const AUTH = "http://127.0.0.1:9099";
const EMU = `http://127.0.0.1:8080/v1/projects/${PROJET}/databases/(default)/documents`;
const OWNER = { headers: { Authorization: "Bearer owner" } };
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};

await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJET}/databases/(default)/documents`, { method: "DELETE" });
await fetch(`${AUTH}/emulator/v1/projects/${PROJET}/accounts`, { method: "DELETE" });

async function inscrire(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  const j = await r.json();
  return { jeton: j.idToken, uid: j.localId };
}

const api = (chemin, jeton, methode = "POST", corps) =>
  fetch(SITE + chemin, {
    method: methode,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));

// 1. Premier démarrage
const intrus = await inscrire("intrus@test.aza");
ok((await api("/api/gestion/demarrer", intrus.jeton)).statut === 403, "un email hors de DIRECTION_EMAILS n'obtient rien");

const patronne = await inscrire("patronne@test.aza");
ok((await api("/api/gestion/demarrer", patronne.jeton)).statut === 200, "la direction déclarée démarre");
const compte = await (await fetch(`${EMU}/comptes/${patronne.uid}`, OWNER)).json();
ok(compte.fields?.role?.stringValue === "direction", "…et reçoit le rôle direction");
const reglages = await (await fetch(`${EMU}/reglages/institut`, OWNER)).json();
ok(
  reglages.fields?.horaires?.mapValue?.fields?.["0"]?.arrayValue?.values?.[0]?.mapValue?.fields?.debut?.integerValue === "600",
  "réglages créés avec les horaires de la plaquette (dimanche 10h)",
);
ok((await api("/api/gestion/demarrer", patronne.jeton)).corps.deja === true, "redémarrer ne change rien");

const associee = await inscrire("associee@test.aza");
ok((await api("/api/gestion/demarrer", associee.jeton)).statut === 403, "une seconde direction ne peut pas s'auto-attribuer le rôle");

// 2. Création des comptes
ok(
  (await api("/api/gestion/equipe", patronne.jeton, "POST", { nom: "Sans numéro", email: "sans@test.aza", role: "accueil" })).statut === 400,
  "sans numéro de téléphone : refusé (c'est l'identifiant)",
);
const accueil = await api("/api/gestion/equipe", patronne.jeton, "POST", { nom: "Aminata Accueil", email: "aminata@test.aza", telephone: "77 111 00 01", role: "accueil" });
ok(accueil.statut === 201 && /^\d{6}$/.test(accueil.corps.motDePasse), `compte accueil créé, mot de passe de 6 chiffres (${accueil.corps.motDePasse})`);
ok(
  (await api("/api/gestion/equipe", patronne.jeton, "POST", { nom: "Awa", email: "awa@test.aza", telephone: "77 111 00 02", role: "praticienne" })).statut === 400,
  "une praticienne sans compétence est refusée",
);
const awa = await api("/api/gestion/equipe", patronne.jeton, "POST", { nom: "Awa Tresses", email: "awa@test.aza", telephone: "77 111 00 02", role: "praticienne", competences: ["tresses", "locks"] });
ok(awa.statut === 201, "compte praticienne créé");
const fiches = await (await fetch(`${EMU}/praticiennes`, OWNER)).json();
ok(fiches.documents?.length === 1 && fiches.documents[0].fields.nom.stringValue === "Awa Tresses", "…avec sa fiche pour l'agenda");
ok(
  (await api("/api/gestion/equipe", patronne.jeton, "POST", { nom: "Awa bis", email: "AWA@test.aza", telephone: "77 111 00 03", role: "accueil" })).statut === 409,
  "même email (majuscules comprises) : pas de second compte",
);
ok(
  (await api("/api/gestion/equipe", patronne.jeton, "POST", { nom: "Faux", email: "pas-un-email", telephone: "77 111 00 04", role: "accueil" })).statut === 400,
  "email invalide refusé",
);

// 3. Droits
const intrusCompte = await api("/api/gestion/equipe", intrus.jeton, "GET");
ok(intrusCompte.statut === 403, "sans compte : pas d'accès à la liste");
const liste = await api("/api/gestion/equipe", patronne.jeton, "GET");
ok(liste.statut === 200 && liste.corps.length === 3, `la direction voit l'équipe (${liste.corps.length} membres)`);

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
