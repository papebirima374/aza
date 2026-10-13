// Vérification : pointage de l'équipe (borne à code tournant, entrées/sorties, corrections).
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-pointage.mjs [http://localhost:3100]
// Modifie la base de test : relancer le seed ensuite.
import { createHmac } from "node:crypto";

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
const appel = (chemin, tok, corps) =>
  fetch(`${SITE}${chemin}`, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, ...(corps ? { body: JSON.stringify(corps) } : {}) }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const AUJ = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date());
const P = "/api/gestion/pointage";
const [direction, manager, accueil, coiffeuse, estheticienne] = await Promise.all(["direction@test.aza", "manager@test.aza", "accueil@test.aza", "coiffeuse1@test.aza", "estheticienne1@test.aza"].map(jeton));

// La borne
ok((await appel(`${P}?borne=1`, coiffeuse)).statut === 403, "une praticienne n'affiche pas la borne");
ok((await appel(`${P}?borne=1`, accueil)).statut === 403, "l'accueil non plus (sauf accès donné par la direction)");
const b = await appel(`${P}?borne=1`, direction);
ok(b.statut === 200 && /^\d{6}$/.test(b.corps.code) && b.corps.expireDans <= 30_000, `la borne affiche un code à 6 chiffres (${b.corps.code}), valable ${Math.round(b.corps.expireDans / 1000)} s`);
const lecture = await fetch(`${EMU}/secrets/pointage`, { headers: { Authorization: `Bearer ${direction}` } });
ok(lecture.status === 403, "la clé des codes n'est lisible par aucun écran");

// Codes : le précédent marche encore, un vieux code non
const cle = (await (await fetch(`${EMU}/secrets/pointage`, { headers: OWNER })).json()).fields.cle.stringValue;
const code = (f) => String(createHmac("sha256", cle).update(`aza-pointage:${f}`).digest().readUInt32BE(0) % 1_000_000).padStart(6, "0");
const f = Math.floor(Date.now() / 30_000);
ok(code(f) === b.corps.code || code(f - 1) === b.corps.code, "le code de la borne vient bien de la clé et de l'heure");
ok((await appel(P, coiffeuse, { action: "pointer", code: code(f - 3) })).statut === 400, "un code d'il y a 1 min 30 (photo envoyée) : refusé");
ok((await appel(P, coiffeuse, { action: "pointer", code: "12345" })).statut === 400, "un code mal tapé : refusé");

// Entrée, double scan, sortie
// Le code d'il y a 30 s, calculé juste avant l'envoi (sinon il peut avoir vieilli entre-temps).
const e1 = await appel(P, coiffeuse, { action: "pointer", code: code(Math.floor(Date.now() / 30_000) - 1) });
ok(e1.statut === 201 && e1.corps.type === "entree" && !e1.corps.deja, "1er scan du jour (code d'il y a 30 s, encore bon) : ENTRÉE");
const e2 = await appel(P, coiffeuse, { action: "pointer", code: (await appel(`${P}?borne=1`, direction)).corps.code });
ok(e2.corps.deja === true && e2.corps.type === "entree", "scan en double dans la minute : un seul pointage");
// On fait comme si l'entrée datait d'il y a 3 minutes
const q = await (await fetch(`${EMU}:runQuery`, { method: "POST", headers: OWNER, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "pointages" }] } }) })).json();
const doc = q.find((x) => x.document)?.document;
await fetch(`${EMU}/${doc.name.split("/documents/")[1]}?updateMask.fieldPaths=le`, { method: "PATCH", headers: OWNER, body: JSON.stringify({ fields: { le: { timestampValue: new Date(Date.now() - 180_000).toISOString() } } }) });
const s1 = await appel(P, coiffeuse, { action: "pointer", code: (await appel(`${P}?borne=1`, direction)).corps.code });
ok(s1.statut === 201 && s1.corps.type === "sortie", "scan suivant : SORTIE");
const moi = (await appel(`${P}?moi=1`, coiffeuse)).corps;
ok(moi.pointages.length === 2 && !moi.present && moi.arrivee !== null, "« Pointer » : elle voit son entrée et sa sortie");
await appel(P, estheticienne, { action: "pointer", code: (await appel(`${P}?borne=1`, direction)).corps.code });
ok((await appel(`${P}?borne=1`, direction)).corps.derniers[0]?.nom === "Esthéticienne test 1", "la borne affiche le dernier pointage (« Bonjour … »)");

// Le suivi de la direction et du manager
ok((await appel(P, coiffeuse)).statut === 403, "une praticienne ne voit pas les pointages des autres");
ok((await appel(P, accueil)).statut === 403, "l'accueil non plus");
let jour = (await appel(P, manager)).corps;
const c = jour.personnes.find((x) => x.nom === "Coiffeuse test 1");
const es = jour.personnes.find((x) => x.nom === "Esthéticienne test 1");
ok(c && c.arrivee !== null && c.depart !== null && !c.present, "le manager voit l'arrivée et le départ de la coiffeuse");
ok(es?.present === true && jour.presents === 1, "l'esthéticienne est « sur place » : 1 personne à l'institut");
ok(jour.personnes.some((x) => x.arrivee === null), "ceux qui n'ont pas pointé apparaissent « Pas pointé »");
const cloche = (await appel("/api/gestion/notifications", direction)).corps.find((n) => n.id === "pointages");
ok(cloche?.elements.some((e) => /Coiffeuse test 1 : arrivée/.test(e.texte)) && cloche.elements.some((e) => /départ/.test(e.texte)), "la cloche de la direction reçoit les arrivées et les départs");

// Corrections
const ui = jour.personnes.find((x) => x.nom === "Accueil test").uid;
ok((await appel(P, accueil, { action: "corriger", uid: ui, date: AUJ, type: "entree", heure: 480, motif: "oubli" })).statut === 403, "l'accueil ne corrige pas les pointages");
ok((await appel(P, manager, { action: "corriger", uid: ui, date: AUJ, type: "entree", heure: 480, motif: "" })).statut === 400, "correction sans motif : refusée");
const cor = await appel(P, manager, { action: "corriger", uid: ui, date: AUJ, type: "entree", heure: 480, motif: "téléphone sans batterie" });
ok(cor.statut === 201, "le manager ajoute l'entrée oubliée de l'accueil (8h00), avec un motif");
jour = (await appel(P, direction)).corps;
const acc = jour.personnes.find((x) => x.uid === ui);
ok(acc.arrivee === 480 && acc.pointages[0].source === "correction", "l'entrée ajoutée apparaît, marquée « ajouté par … »");
ok((await appel(P, direction, { action: "annuler", id: acc.pointages[0].id, motif: "erreur" })).statut === 200, "la direction annule ce pointage");
ok((await appel(P, direction)).corps.personnes.find((x) => x.uid === ui).arrivee === null, "annulé : il ne compte plus (mais reste visible, barré)");

// Le mois
const m = (await appel(`${P}?mois=${AUJ.slice(0, 7)}`, direction)).corps;
ok(m.personnes.find((x) => x.nom === "Coiffeuse test 1")?.jours === 1, "bilan du mois : 1 jour de présence pour la coiffeuse");

console.log(echecs ? `${echecs} ÉCHEC(S)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
