// Vérification de la connexion par lien WhatsApp et de « Ma journée », sur la base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-lien-connexion.mjs [http://localhost:3100]
// Modifie la base de test : relancer le seed ensuite.

const SITE = process.argv[2] ?? "http://localhost:3100";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner" };
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};

async function jeton(email) {
  const r = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
const api = (chemin, tok, methode, corps) =>
  fetch(SITE + chemin, {
    method: methode,
    headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const entrer = (j) => api("/api/entrer", null, "POST", { jeton: j });
async function connecterAvec(customToken) {
  const r = await fetch(`${AUTH}/accounts:signInWithCustomToken?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  return r.json();
}

const [direction, manager, coiffeuse] = await Promise.all(["direction", "manager", "coiffeuse1"].map((n) => jeton(`${n}@test.aza`)));

// Création sans email
ok(
  (await api("/api/gestion/equipe", direction, "POST", { nom: "Accueil sans email", email: "", role: "accueil" })).statut === 400,
  "l'accueil a besoin d'un email (poste partagé, mot de passe)",
);
const cree = await api("/api/gestion/equipe", direction, "POST", {
  nom: "Fatou Tresses",
  email: "",
  telephone: "77 000 12 34",
  role: "praticienne",
  competences: ["tresses"],
});
ok(cree.statut === 201 && typeof cree.corps.lienConnexion === "string", "praticienne créée SANS email : un lien de connexion est rendu");

// Utilisation du lien
const e1 = await entrer(cree.corps.lienConnexion);
ok(e1.statut === 200 && typeof e1.corps.jeton === "string", "le lien donne un jeton de connexion");
const session = await connecterAvec(e1.corps.jeton);
const identite = JSON.parse(Buffer.from(session.idToken.split(".")[1], "base64url").toString());
ok(identite.user_id === cree.corps.uid, "…qui connecte bien CETTE praticienne");
const compte = await (await fetch(`${EMU}/comptes/${cree.corps.uid}`, { headers: OWNER })).json();
ok(compte.fields.telephone.stringValue === "77 000 12 34" && compte.fields.role.stringValue === "praticienne", "son compte : rôle praticienne, numéro WhatsApp gardé");
ok((await entrer(cree.corps.lienConnexion)).statut === 410, "le même lien ne sert pas deux fois");
ok((await entrer("x".repeat(43))).statut === 404, "un lien inventé est refusé");
ok((await entrer("court")).statut === 400, "un lien mal formé est refusé");

// Nouveau lien : réservé à la direction
ok((await api("/api/gestion/equipe", manager, "PATCH", { uid: cree.corps.uid, lienConnexion: true })).statut === 403, "le manager n'envoie pas de lien");
const l2 = await api("/api/gestion/equipe", direction, "PATCH", { uid: cree.corps.uid, lienConnexion: true });
ok(l2.statut === 200 && l2.corps.lienConnexion !== cree.corps.lienConnexion, "la direction envoie un nouveau lien");
await api("/api/gestion/equipe", direction, "PATCH", { uid: cree.corps.uid, actif: false });
ok((await entrer(l2.corps.lienConnexion)).statut === 403, "compte désactivé : le lien ne connecte plus");

// « Je commence » sans passer par l'accueil
const q = await fetch(`${EMU}:runQuery`, {
  method: "POST",
  headers: { ...OWNER, "Content-Type": "application/json" },
  body: JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: "rendezVous" }],
      where: { fieldFilter: { field: { fieldPath: "praticiennesIds" }, op: "ARRAY_CONTAINS", value: { stringValue: "test-coiffeuse-1" } } },
    },
  }),
}).then((r) => r.json());
const rdv = q.map((x) => x.document).find((d) => d && ["reserve", "confirme"].includes(d.fields.statut.stringValue));
if (rdv) {
  const id = rdv.name.split("/").pop();
  const statut = (s) => api(`/api/gestion/rendez-vous/${id}/statut`, coiffeuse, "POST", { statut: s });
  ok((await statut("termine")).statut === 403, "« J'ai fini » avant d'avoir commencé : refusé");
  ok((await statut("en-cours")).statut === 200, "« Je commence » directement (sans attendre l'accueil)");
  ok((await statut("termine")).statut === 200, "« J'ai fini »");
} else {
  console.log("—     (aucun rendez-vous de test pour la coiffeuse 1 : contrôle sauté)");
}

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
