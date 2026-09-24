// Vérification de la réattribution d'un rendez-vous à une autre praticienne, sur la base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test AVEC RESERVATION_EN_LIGNE=1.
// Usage : node scripts/verifier-reattribution.mjs [http://localhost:3100]

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
const lireRdv = async (id) => (await (await fetch(`${EMU}/rendezVous/${id}`, { headers: OWNER })).json()).fields;
const ids = (f) => f.praticiennesIds.arrayValue.values.map((v) => v.stringValue);

const [accueil, coiffeuse] = await Promise.all([jeton("accueil@test.aza"), jeton("coiffeuse1@test.aza")]);
const d = new Date();
d.setUTCDate(d.getUTCDate() + 9);
while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1); // un mercredi
const DATE = d.toISOString().slice(0, 10);
const KNOTLESS = "tresses--knotless-mi-long";
const reserver = (nom, tel) => api("/api/reservations", null, { date: DATE, debut: 540, prestations: [KNOTLESS], nom, telephone: tel });

const r1 = await reserver("Cliente réattribution 1", "77 555 00 01");
ok(r1.statut === 201, "knotless réservé en ligne à 9h (la cliente n'a pas choisi)");
const a = ids(await lireRdv(r1.corps.id))[0];
const b = a === "test-coiffeuse-1" ? "test-coiffeuse-2" : "test-coiffeuse-1";

ok((await api(`/api/gestion/rendez-vous/${r1.corps.id}/praticienne`, coiffeuse)).statut === 403, "une praticienne ne réattribue pas");
const c = await api(`/api/gestion/rendez-vous/${r1.corps.id}/praticienne`, accueil);
const liste = c.corps[0]?.remplacantes ?? [];
ok(c.statut === 200 && liste.find((p) => p.id === b)?.empechement === null, "l'autre coiffeuse est proposée comme libre");
ok(liste.find((p) => p.id === "test-masseuse")?.empechement === "n'a pas la compétence", "la masseuse est grisée : pas la compétence");

ok((await api(`/api/gestion/rendez-vous/${r1.corps.id}/praticienne`, accueil, { remplacer: a, par: "test-masseuse" })).statut === 409, "confier à la masseuse : refusé");
const ch = await api(`/api/gestion/rendez-vous/${r1.corps.id}/praticienne`, accueil, { remplacer: a, par: b });
ok(ch.statut === 200, "rendez-vous confié à l'autre coiffeuse");
const f = await lireRdv(r1.corps.id);
ok(ids(f).join() === b, "…le rendez-vous est à son nom (elle le voit dans « Ma journée »)");
const journal = f.historique.arrayValue.values.at(-1).mapValue.fields.motif.stringValue;
ok(journal.startsWith("Confié à"), `…noté au journal : « ${journal} »`);

const r2 = await reserver("Cliente réattribution 2", "77 555 00 02");
ok(r2.statut === 201 && ids(await lireRdv(r2.corps.id))[0] === a, "la première coiffeuse, libérée, reçoit la réservation suivante à 9h");
const r3 = await reserver("Cliente réattribution 3", "77 555 00 03");
ok(r3.statut === 409, "une troisième knotless à 9h est refusée (les deux coiffeuses sont prises)");
ok(
  (await api(`/api/gestion/rendez-vous/${r1.corps.id}/praticienne`, accueil, { remplacer: b, par: a })).statut === 409,
  "impossible de confier à une coiffeuse déjà prise à cette heure",
);

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
