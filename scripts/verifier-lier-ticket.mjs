// Vérification : vente directe en caisse pour une cliente qui avait un rendez-vous, base de TEST.
// Prérequis : émulateurs + seed (base fraîche : aucune caisse ouverte aujourd'hui), site démarré en mode test.
// Usage : node scripts/verifier-lier-ticket.mjs [http://localhost:3100]
// Modifie la base de test : relancer le seed ensuite.

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
const caisse = (tok, corps, q = "") =>
  fetch(`${SITE}/api/gestion/caisse${q}`, {
    method: corps ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const lire = async (chemin) => (await (await fetch(`${EMU}/${chemin}`, { headers: OWNER })).json()).fields ?? {};

const accueil = await jeton("accueil@test.aza");
const AUJ = new Date().toISOString().slice(0, 10);
const TEL = "77 000 55 01";
const rdv = (tel, debut) =>
  fetch(`${SITE}/api/gestion/comptoir`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accueil}` },
    body: JSON.stringify({ action: "libre", date: AUJ, debut, lignes: [{ id: "onglerie--vernis-simple", praticienne: "test-prothesiste-1" }], nom: "Cliente directe", telephone: tel, dejaFaite: false }),
  }).then((r) => r.json());

await caisse(accueil, { action: "ouvrir", fond: 0 });
const r1 = await rdv(TEL, 17 * 60);
ok(Boolean(r1.id), "rendez-vous pris (Réservé)");

// La caisse retrouve le rendez-vous du jour par le téléphone.
const proposes = (await caisse(accueil, null, `?rdv-cliente=${encodeURIComponent(TEL)}`)).corps;
ok(proposes.some((r) => r.id === r1.id), "la caisse propose le rendez-vous de la cliente");

// Encaissé directement avec le rendez-vous, sans attendre « Terminé ».
const t1 = await caisse(accueil, { action: "encaisser", rendezVous: r1.id, lignes: [{ id: "onglerie--vernis-simple" }], paiements: [{ mode: "especes", montant: 3000 }] });
ok(t1.statut === 201, "un rendez-vous « Réservé » s'encaisse");
ok((await lire(`rendezVous/${r1.id}`)).statut?.stringValue === "encaisse", "il passe « Encaissé »");

// Vente directe sans rendez-vous, puis reliée depuis l'agenda.
const r2 = await rdv(TEL, 18 * 60);
const t2 = await caisse(accueil, { action: "encaisser", cliente: { nom: "Cliente directe", telephone: TEL }, lignes: [{ id: "onglerie--vernis-simple" }], paiements: [{ mode: "especes", montant: 3000 }] });
ok(t2.statut === 201, "vente directe encaissée sans le rendez-vous");
const libres = (await caisse(accueil, null, `?tickets-libres=${r2.id}`)).corps;
ok(libres.some((t) => t.id === t2.corps.id) && !libres.some((t) => t.id === t1.corps.id), "l'agenda propose le ticket direct (pas celui déjà relié)");
const lien = await caisse(accueil, { action: "lier", rendezVous: r2.id, ticket: t2.corps.id });
ok(lien.statut === 200, "ticket relié au rendez-vous");
ok((await lire(`rendezVous/${r2.id}`)).statut?.stringValue === "encaisse", "le rendez-vous passe « Encaissé »");
ok((await lire(`tickets/${t2.corps.id}`)).rendezVous?.stringValue === r2.id, "le ticket garde le rendez-vous");
ok((await caisse(accueil, { action: "lier", rendezVous: r2.id, ticket: t2.corps.id })).statut === 409, "relier deux fois : refusé");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
