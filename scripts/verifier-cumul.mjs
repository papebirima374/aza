// Vérification : une personne de l'accueil (caisse) qui fait AUSSI des prestations.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-cumul.mjs [http://localhost:3100]
// Modifie la base de test : relancer le seed ensuite.

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
const appel = (chemin, tok, corps, methode) =>
  fetch(`${SITE}${chemin}`, { method: methode ?? (corps ? "POST" : "GET"), headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, ...(corps ? { body: JSON.stringify(corps) } : {}) }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const lire = async (chemin) => (await (await fetch(`${EMU}/${chemin}`, { headers: OWNER })).json()).fields ?? {};
const [direction, accueil] = await Promise.all([jeton("direction@test.aza"), jeton("accueil@test.aza")]);

const equipe = (await appel("/api/gestion/equipe", direction)).corps;
const moi = equipe.find((m) => m.role === "accueil");
ok(moi && !moi.aussiPrestataire && !moi.praticienne, "au départ, l'accueil ne fait pas de prestations");
ok((await appel("/api/gestion/equipe", direction, { uid: moi.uid, aussiPrestataire: true }, "PATCH")).statut === 400, "« fait aussi des prestations » sans compétence : refusé");
const r = await appel("/api/gestion/equipe", direction, { uid: moi.uid, aussiPrestataire: true, competences: ["onglerie"] }, "PATCH");
ok(r.statut === 200, "la direction coche « Fait aussi des prestations » (onglerie) pour l'accueil");
const apres = (await appel("/api/gestion/equipe", direction)).corps.find((m) => m.uid === moi.uid);
ok(apres.role === "accueil" && apres.aussiPrestataire && apres.praticienne && apres.competences.includes("onglerie"), "elle garde son rôle Accueil / caisse, avec une fiche de prestataire");
const fiche = await lire(`praticiennes/${apres.praticienne}`);
ok(fiche.actif?.booleanValue === true && fiche.externe?.booleanValue === false, "sa fiche est active : elle a sa colonne dans l'agenda");
ok((await appel("/api/gestion/equipe?ordre=1", direction)).corps.some((p) => p.id === apres.praticienne), "elle apparaît dans l'ordre des colonnes de l'agenda");
const caisse = (await appel("/api/gestion/caisse?equipe=1", accueil)).corps;
ok(caisse.some((p) => p.id === apres.praticienne), "elle apparaît dans « Fait par » à la caisse");
await appel("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 0 });
const t = await appel("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: "onglerie--vernis-permanent", praticienne: apres.praticienne }], paiements: [{ mode: "wave", montant: 5000 }] });
ok(t.statut === 201, "elle encaisse une prestation qu'elle a faite elle-même");
ok((await lire(`tickets/${t.corps.id}`)).lignes?.arrayValue.values[0].mapValue.fields.praticienne?.mapValue.fields.id.stringValue === apres.praticienne, "la ligne du ticket est à son nom (son chiffre)");
// Un rendez-vous peut lui être confié
const AUJ = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date());
const rdv = await appel("/api/gestion/comptoir", accueil, { action: "libre", date: AUJ, debut: 16 * 60, lignes: [{ id: "onglerie--vernis-permanent", praticienne: apres.praticienne }], nom: "Cliente cumul (test)", telephone: "77 000 66 01", dejaFaite: false });
ok(rdv.statut === 201 && (await lire(`rendezVous/${rdv.corps.id}`)).praticiennesIds?.arrayValue.values.some((v) => v.stringValue === apres.praticienne), "un rendez-vous peut lui être confié");
// Décocher : elle sort de l'agenda
ok((await appel("/api/gestion/equipe", direction, { uid: moi.uid, aussiPrestataire: false }, "PATCH")).statut === 200, "la direction décoche « Fait aussi des prestations »");
ok((await lire(`praticiennes/${apres.praticienne}`)).actif?.booleanValue === false, "sa fiche est désactivée : plus de colonne dans l'agenda");
ok(!(await appel("/api/gestion/caisse?equipe=1", accueil)).corps.some((p) => p.id === apres.praticienne), "elle n'est plus dans « Fait par »");
// Une praticienne ou un comptable ne « cumule » pas : la case n'a pas d'effet
const compta = equipe.find((m) => m.role === "comptable");
await appel("/api/gestion/equipe", direction, { uid: compta.uid, aussiPrestataire: true, competences: ["onglerie"] }, "PATCH");
ok(!(await appel("/api/gestion/equipe", direction)).corps.find((m) => m.uid === compta.uid).aussiPrestataire, "le comptable ne peut pas être prestataire");

console.log(echecs ? `${echecs} ÉCHEC(S)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
