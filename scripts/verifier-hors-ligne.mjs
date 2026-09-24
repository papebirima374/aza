// Vérification de la caisse hors connexion (C-11 : aucune vente perdue), côté serveur, base de TEST.
// Prérequis : émulateurs + seed (base fraîche : caisse du jour pas encore ouverte), site démarré en mode test.
// Usage : node scripts/verifier-hors-ligne.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
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
const caisse = (tok, corps, q = "") =>
  fetch(`${SITE}/api/gestion/caisse${q}`, {
    method: corps ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const accueil = await jeton("accueil@test.aza");
const TIGES = "locks--lot-de-10-tiges-locks-6-pouces";
const vente = (idLocal, faitLe) => caisse(accueil, { action: "encaisser", lignes: [{ id: TIGES }], paiements: [{ mode: "especes", montant: 6000 }], idLocal, faitLe });

await caisse(accueil, { action: "ouvrir", fond: 0 });

// Renvoyée deux fois (connexion revenue au mauvais moment) : un seul ticket
const id1 = "vente-test-0001";
const a = await vente(id1, Date.now());
const b = await vente(id1, Date.now());
ok(a.statut === 201 && b.statut === 201 && a.corps.reference === b.corps.reference && b.corps.deja === true, `même vente envoyée deux fois : un seul ticket (${a.corps.reference})`);
const c = await vente("vente-test-0002", Date.now());
ok(c.corps.reference === "T-000002", "la vente suivante prend bien le n° 2 (aucun numéro gâché)");

// Faite il y a 40 minutes, envoyée maintenant : garde son heure
const il40 = Date.now() - 40 * 60_000;
const d = await vente("vente-test-0003", il40);
const j = await caisse(accueil, undefined, "");
const t = j.corps.tickets.find((x) => x.reference === d.corps.reference);
const attendu = new Date(il40).getUTCHours() * 60 + new Date(il40).getUTCMinutes();
ok(t && t.heure === attendu && t.horsLigne === true, `vente hors connexion : heure réelle gardée (${Math.floor(attendu / 60)}h${String(attendu % 60).padStart(2, "0")}), marquée « hors ligne »`);

// Une heure invraisemblable (dans le futur) est remplacée par maintenant
const e = await vente("vente-test-0004", Date.now() + 5 * 3600_000);
ok(e.statut === 201, "heure future ignorée : la vente passe à l'heure actuelle");

// Clôture, puis une vente faite AVANT la clôture arrive : acceptée, signalée
const total = j.corps.totaux.especesAttendues + 6000;
ok((await caisse(accueil, { action: "cloturer", compte: total })).statut === 200, "caisse clôturée");
ok(
  (await caisse(accueil, { action: "encaisser", lignes: [{ id: TIGES }], paiements: [{ mode: "especes", montant: 6000 }] })).statut === 409,
  "après la clôture : une nouvelle vente normale est refusée",
);
const f = await vente("vente-test-0005", Date.now() - 10 * 60_000);
ok(f.statut === 201, "…mais une vente faite hors connexion AVANT la clôture est acceptée (aucune vente perdue)");
const j2 = await caisse(accueil, undefined, "");
ok(j2.corps.caisse.ticketsApresCloture.includes(f.corps.reference), `…et signalée « arrivée après la clôture » (${f.corps.reference})`);
ok((await vente("vente-test-0005", Date.now() - 10 * 60_000)).corps.deja === true, "…renvoyée encore une fois : toujours un seul ticket");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
