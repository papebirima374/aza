// Vérification de la connexion de l'équipe par numéro de téléphone + mot de passe, base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-connexion-telephone.mjs [http://localhost:3100]
// Modifie la base de test : relancer le seed ensuite.

const SITE = process.argv[2] ?? "http://localhost:3100";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};
const post = (chemin, corps, tok) =>
  fetch(SITE + chemin, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: JSON.stringify(corps),
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const patch = (corps, tok) =>
  fetch(`${SITE}/api/gestion/equipe`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(corps) }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
async function session(jeton) {
  const r = await (await fetch(`${AUTH}/accounts:signInWithCustomToken?key=demo-api-key`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: jeton, returnSecureToken: true }) })).json();
  return { idToken: r.idToken, uid: JSON.parse(Buffer.from(r.idToken.split(".")[1], "base64url").toString()).user_id };
}
const connexion = (telephone, motDePasse) => post("/api/connexion-equipe", { telephone, motDePasse });
const direction = (await (await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-api-key`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "direction@test.aza", password: "AzaTest2026!", returnSecureToken: true }) })).json()).idToken;

// Comptes de test : 77 900 00 03 = accueil
const c = await connexion("77 900 00 03", "AzaTest2026!");
ok(c.statut === 200 && typeof c.corps.jeton === "string", "l'accueil se connecte avec son numéro et son mot de passe");
const s = await session(c.corps.jeton);
ok(Boolean(s.idToken), "…la session s'ouvre (jeton valable)");
ok((await connexion("+221 77 900 00 03", "AzaTest2026!")).statut === 200, "numéro écrit autrement (+221…) : accepté");
const faux = await connexion("77 900 00 03", "mauvais");
const inconnu = await connexion("77 999 88 77", "AzaTest2026!");
ok(faux.statut === 401 && inconnu.statut === 401 && faux.corps.erreur === inconnu.corps.erreur, "mauvais mot de passe ou numéro inconnu : même réponse (on ne révèle rien)");

// Création : numéro + mot de passe choisi ; sans email
const cree = await post("/api/gestion/equipe", { nom: "Ndeye Onglerie", email: "", telephone: "77 555 12 34", motDePasse: "fleur2026", role: "praticienne", competences: ["onglerie"] }, direction);
ok(cree.statut === 201 && cree.corps.motDePasse === "fleur2026", "praticienne créée sans email, mot de passe choisi par la direction");
ok((await connexion("775551234", "fleur2026")).statut === 200, "…elle se connecte avec son numéro");
ok((await post("/api/gestion/equipe", { nom: "Doublon", email: "", telephone: "+221775551234", role: "accueil" }, direction)).statut === 409, "même numéro pour un second compte : refusé");

// Mot de passe oublié : la direction en donne un nouveau
const n = await patch({ uid: cree.corps.uid, motDePasse: true }, direction);
ok(n.statut === 200 && /^\d{6}$/.test(n.corps.motDePasse), `nouveau mot de passe tiré au sort (${n.corps.motDePasse})`);
ok((await connexion("775551234", "fleur2026")).statut === 401, "…l'ancien ne marche plus");
const c2 = await connexion("775551234", n.corps.motDePasse);
ok(c2.statut === 200, "…le nouveau marche");

// Mon compte : elle change elle-même son mot de passe
const s2 = await session(c2.corps.jeton);
ok((await post("/api/gestion/mon-compte", { motDePasse: "123" }, s2.idToken)).statut === 400, "mot de passe trop court : refusé");
ok((await post("/api/gestion/mon-compte", { motDePasse: "jasmin777" }, s2.idToken)).statut === 200, "elle choisit son propre mot de passe");
ok((await connexion("775551234", "jasmin777")).statut === 200, "…et se connecte avec");

// Compte désactivé
await patch({ uid: cree.corps.uid, actif: false }, direction);
ok((await connexion("775551234", "jasmin777")).statut === 401, "compte désactivé : connexion refusée");

// Trop d'essais
for (let i = 0; i < 5; i++) await connexion("77 900 00 02", "mauvais");
ok((await connexion("77 900 00 02", "AzaTest2026!")).statut === 429, "5 erreurs sur un numéro : bloqué 15 minutes");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
