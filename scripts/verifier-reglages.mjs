// Vérification de l'écran Réglages, sur la base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test SANS RESERVATION_EN_LIGNE
// (c'est l'interrupteur de l'écran qui doit décider).
// Usage : node scripts/verifier-reglages.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner" };
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
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const reglage = (tok, corps) => api("/api/gestion/reglages", tok, corps);
const comptoir = (tok, date, id, duree) => api("/api/gestion/comptoir", tok, { action: "creneaux", date, lignes: [{ id, duree }] });

const [direction, manager, accueil] = await Promise.all([jeton("direction@test.aza"), jeton("manager@test.aza"), jeton("accueil@test.aza")]);

function prochain(jour) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  while (d.getUTCDay() !== jour) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const LUNDI = prochain(1);
const MARDI = prochain(2);
const SOURCILS = "epilation-femme--sourcils-forme";

// Droits
ok((await reglage(accueil)).statut === 403, "l'accueil n'ouvre pas les réglages");
const lu = await reglage(manager);
ok(lu.statut === 200 && lu.corps.postes.length === 8, "le manager lit les réglages (8 postes de test)");

// Interrupteur de la réservation en ligne
ok((await reglage(manager, { action: "en-ligne", actif: true })).statut === 403, "le manager ne peut pas ouvrir la réservation en ligne");
ok((await api(`/api/creneaux?date=${LUNDI}&p=${SOURCILS}`)).statut === 503, "interrupteur fermé : le site refuse de donner des créneaux");
ok((await reglage(direction, { action: "en-ligne", actif: true })).statut === 200, "la direction ouvre la réservation en ligne");
ok((await api(`/api/creneaux?date=${LUNDI}&p=${SOURCILS}`)).statut === 200, "…et le site donne des créneaux");
await reglage(direction, { action: "en-ligne", actif: false });
ok((await api(`/api/creneaux?date=${LUNDI}&p=${SOURCILS}`)).statut === 503, "refermée : plus de créneaux en ligne");

// Horaires : fermer le lundi
const avant = await comptoir(accueil, LUNDI, SOURCILS, 30);
ok(avant.corps.creneaux.length > 0, `lundi ouvert : ${avant.corps.creneaux.length} heures libres`);
const h = { 0: { debut: 600, fin: 1080 }, 1: null, 2: { debut: 540, fin: 1140 }, 3: { debut: 540, fin: 1140 }, 4: { debut: 540, fin: 1140 }, 5: { debut: 540, fin: 1140 }, 6: { debut: 540, fin: 1140 } };
ok((await reglage(manager, { action: "horaires", horaires: h })).statut === 200, "le manager ferme le lundi");
ok((await comptoir(accueil, LUNDI, SOURCILS, 30)).corps.creneaux.length === 0, "lundi : plus aucune heure libre (praticiennes sans horaires propres comprises)");
ok((await reglage(manager, { action: "horaires", horaires: { ...h, 1: { debut: 1000, fin: 900 } } })).statut === 400, "fermeture avant ouverture refusée");
await reglage(manager, { action: "horaires", horaires: { ...h, 1: { debut: 540, fin: 1140 } } });

// Fermeture exceptionnelle
ok((await reglage(manager, { action: "fermeture-ajout", date: MARDI, motif: "Magal (test)" })).statut === 200, "fermeture ajoutée pour un mardi");
ok((await comptoir(accueil, MARDI, SOURCILS, 30)).corps.creneaux.length === 0, "ce mardi : aucune heure libre");
const relu = await reglage(manager);
ok(relu.corps.reglages.motifsFermeture?.[MARDI] === "Magal (test)", "le motif est gardé");
await reglage(manager, { action: "fermeture-retrait", date: MARDI });
ok((await comptoir(accueil, MARDI, SOURCILS, 30)).corps.creneaux.length > 0, "fermeture retirée : le mardi rouvre");

// Postes
const p = await reglage(manager, { action: "poste-ajout", type: "cabine", nom: "Cabine VIP" });
ok(p.statut === 201 || p.statut === 200, "poste « Cabine VIP » ajouté");
ok((await reglage(manager)).corps.postes.some((x) => x.nom === "Cabine VIP"), "…il apparaît dans la liste");
await reglage(manager, { action: "poste-retrait", id: p.corps.id });
ok(!(await reglage(manager)).corps.postes.some((x) => x.nom === "Cabine VIP"), "retiré : il disparaît de la liste");

// Durées
const g = await reglage(manager, { action: "prestation", id: "gommage--gommage-simple", duree: 60, pose: 20, typePoste: "cabine", praticiennes: 1, enLigne: true });
ok(g.statut === 200, "durée du gommage simple : 60 min dont 20 de pose");
const doc = await (await fetch(`${EMU}/prestationsResa/gommage--gommage-simple`, { headers: OWNER })).json();
const phases = doc.fields.phases.arrayValue.values.map((v) => [Number(v.mapValue.fields.minutes.integerValue), v.mapValue.fields.praticienne.booleanValue]);
ok(JSON.stringify(phases) === JSON.stringify([[20, true], [20, false], [20, true]]), `étapes : ${JSON.stringify(phases)} (pose au milieu)`);
ok((await reglage(manager)).corps.parametres["gommage--gommage-simple"].duree === 60, "relue : 60 min");
ok(
  (await reglage(manager, { action: "prestation", id: "gommage--gommage-simple", duree: 30, pose: 30 })).statut === 400,
  "temps de pose égal à la durée : refusé",
);
ok((await reglage(manager, { action: "prestation", id: "locks--lot-de-10-tiges-locks-6-pouces", duree: 30 })).statut === 400, "un produit n'a pas de durée");

// Toute une famille d'un coup
const cils = ["pose-cils--pose-cils-simple", "pose-cils--pose-cils-cheveux-naturels"];
const lot = await reglage(manager, { action: "prestations-lot", ids: cils, duree: 90, typePoste: "cabine" });
ok(lot.statut === 200 && lot.corps.nombre === 2, "famille remplie d'un coup : 2 prestations à 1 h 30");
const relues = (await reglage(manager)).corps.parametres;
ok(cils.every((id) => relues[id]?.duree === 90 && relues[id]?.typePoste === "cabine"), "…les deux sont relues à 1 h 30, en cabine");
ok(
  (await reglage(manager, { action: "prestations-lot", ids: [...cils, "locks--lot-de-10-tiges-locks-6-pouces"], duree: 60 })).statut === 400,
  "un lot contenant un produit est refusé en entier",
);
ok((await reglage(accueil, { action: "prestations-lot", ids: cils, duree: 60 })).statut === 403, "l'accueil ne remplit pas les durées");

// Règles
ok(
  (await reglage(manager, { action: "regles", delaiMinimumMinutes: 60, acompte: { montantMin: 25000, dureeMinMinutes: 180, absencesMax: 3 } })).statut === 200,
  "règles enregistrées (délai 60 min, acompte 25 000 F)",
);
ok((await reglage(manager)).corps.reglages.acompte.montantMin === 25000, "…et relues");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
