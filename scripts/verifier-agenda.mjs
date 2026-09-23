// Vérification des changements de statut de l'agenda, sur la base de TEST.
// Prérequis : émulateurs (firestore + auth) + seed, site démarré avec
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
// Usage : node scripts/verifier-agenda.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};

async function jeton(email) {
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }) },
  );
  return (await r.json()).idToken;
}

const statut = (id, corps, tok) =>
  fetch(`${SITE}/api/gestion/rendez-vous/${id}/statut`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: JSON.stringify(corps),
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));

const reserver = (corps) =>
  fetch(`${SITE}/api/reservations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) })
    .then(async (r) => ({ statut: r.status, corps: await r.json() }));

const creneaux = (date, p) => fetch(`${SITE}/api/creneaux?date=${date}&p=${p}`).then((r) => r.json());

const d = new Date();
d.setUTCDate(d.getUTCDate() + 10);
while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1); // un mercredi
const DATE = d.toISOString().slice(0, 10);
const MASSAGE = "massage--massage-a-quatre-mains"; // occupe les 2 masseuses et la seule table

const [accueil, coiffeuse, comptable] = await Promise.all([jeton("accueil@test.aza"), jeton("coiffeuse1@test.aza"), jeton("comptable@test.aza")]);

// Réserver le massage à quatre mains à 10h : plus de massage possible à 10h.
const rdv = await reserver({ date: DATE, debut: 600, prestations: [MASSAGE], nom: "Cliente agenda", telephone: "77 888 88 88" });
ok(rdv.statut === 201, "rendez-vous de test créé");
const id = rdv.corps.id;
ok(!(await creneaux(DATE, MASSAGE)).creneaux.some((c) => c.debut === 600), "10h n'est plus proposé");

// Contrôles d'accès
ok((await statut(id, { statut: "confirme" })).statut === 401, "sans connexion : refusé");
ok((await statut(id, { statut: "confirme" }, comptable)).statut === 403, "le comptable ne change pas l'agenda");
ok((await statut(id, { statut: "annule", motif: "test" }, coiffeuse)).statut === 403, "une praticienne ne peut pas annuler");
ok((await statut(id, { statut: "en-cours" }, coiffeuse)).statut === 403, "une praticienne ne touche pas au rendez-vous d'une autre");
ok((await statut(id, { statut: "termine" }, accueil)).statut === 403, "étape impossible (réservé → terminé) refusée");
ok((await statut(id, { statut: "annule" }, accueil)).statut === 400, "annulation sans motif refusée");

// Annulation : le créneau est libéré
const annul = await statut(id, { statut: "annule", motif: "La cliente a appelé" }, accueil);
ok(annul.statut === 200, "l'accueil annule avec un motif");
ok((await creneaux(DATE, MASSAGE)).creneaux.some((c) => c.debut === 600), "10h est de nouveau proposé (créneau libéré)");
ok((await statut(id, { statut: "confirme" }, accueil)).statut === 403, "un rendez-vous annulé ne revient pas");

// Absence : compteur de la cliente
const rdv2 = await reserver({ date: DATE, debut: 720, prestations: [MASSAGE], nom: "Cliente agenda", telephone: "+221 77 888 88 88" });
ok((await statut(rdv2.corps.id, { statut: "absente" }, accueil)).statut === 200, "l'accueil marque une absence");
const fiche = await (await fetch(`${EMU}/clientes/778888888`, { headers: { Authorization: "Bearer owner" } })).json();
ok(fiche.fields?.absences?.integerValue === "1", "la fiche de la cliente compte 1 absence");

// Journal
const doc = await (await fetch(`${EMU}/rendezVous/${id}`, { headers: { Authorization: "Bearer owner" } })).json();
const journal = doc.fields.historique.arrayValue.values.map((v) => v.mapValue.fields);
const derniere = journal.at(-1);
ok(
  derniere.statut.stringValue === "annule" && derniere.nom.stringValue === "Accueil test" && derniere.motif.stringValue === "La cliente a appelé",
  "le journal garde qui a annulé, quand et pourquoi",
);

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
