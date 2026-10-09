// Vérification : acompte à la réservation, rendez-vous offert (cadeau), doublons de clientes.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-acompte.mjs [http://localhost:3100]
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
const appel = (chemin, tok, corps) =>
  fetch(`${SITE}${chemin}`, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, ...(corps ? { body: JSON.stringify(corps) } : {}) }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const lire = async (chemin) => (await (await fetch(`${EMU}/${chemin}`, { headers: OWNER })).json()).fields ?? {};
const AUJ = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date());
const VERNIS = "onglerie--vernis-permanent"; // 5 000 F
const GAINAGE = "onglerie--gainage"; // 15 000 F
const [direction, accueil] = await Promise.all([jeton("direction@test.aza"), jeton("accueil@test.aza")]);

// ——— Acompte ———
const rdv = (await appel("/api/gestion/comptoir", accueil, { action: "libre", date: AUJ, debut: 15 * 60, lignes: [{ id: GAINAGE, praticienne: "test-prothesiste-1" }], nom: "Cliente acompte (test)", telephone: "77 000 77 01", dejaFaite: false })).corps;
ok((await appel("/api/gestion/caisse", accueil, { action: "acompte", rendezVous: rdv.id, montant: 5000, mode: "wave" })).statut === 409, "acompte sans caisse ouverte : refusé (il faut ouvrir sa caisse)");
await appel("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 10000 });
const ac = await appel("/api/gestion/caisse", accueil, { action: "acompte", rendezVous: rdv.id, montant: 5000, mode: "wave" });
ok(ac.statut === 201 && /^T-/.test(ac.corps.reference), `acompte de 5 000 F reçu par Wave : ticket ${ac.corps.reference}`);
ok(Number((await lire(`rendezVous/${rdv.id}`)).acompte?.mapValue.fields.montant.integerValue) === 5000, "le rendez-vous garde son acompte");
ok((await appel("/api/gestion/caisse", accueil, { action: "acompte", rendezVous: rdv.id, montant: 2000, mode: "especes" })).statut === 409, "un second acompte : refusé");
ok((await appel("/api/gestion/caisse", accueil, { action: "acompte", rendezVous: rdv.id, montant: 99, mode: "wave" })).statut >= 400, "montant ridicule : refusé");
// Le jour du soin : terminé, puis encaissé avec l'acompte déduit
for (const s of ["arrivee", "en-cours", "termine"]) await appel(`/api/gestion/rendez-vous/${rdv.id}/statut`, accueil, { statut: s });
ok(
  (await appel("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: VERNIS }], paiements: [{ mode: "acompte", montant: 5000 }] })).statut === 400,
  "« acompte » sans rendez-vous : refusé",
);
const t = await appel("/api/gestion/caisse", accueil, {
  action: "encaisser",
  rendezVous: rdv.id,
  lignes: [{ id: GAINAGE }],
  paiements: [{ mode: "acompte", montant: 5000 }, { mode: "especes", montant: 10000 }],
});
ok(t.statut === 201 && t.corps.total === 15000, "le jour du soin : 15 000 F, dont 5 000 F d'acompte déjà versé, 10 000 F en espèces");
ok((await lire(`rendezVous/${rdv.id}`)).acompte?.mapValue.fields.utilise?.stringValue === t.corps.id, "l'acompte est marqué utilisé");
const j = (await appel(`/api/gestion/caisse?date=${AUJ}`, accueil)).corps;
ok(j.totaux.recette === 15000, `recette du jour : ${j.totaux.recette} F (5 000 acompte + 10 000 le jour du soin, sans double compte)`);
ok(j.totaux.parMode.wave === 5000 && j.totaux.especesAttendues === 20000, "Wave 5 000 F ; tiroir : 10 000 de fond + 10 000 en espèces");

// ——— Offert (cadeau) ———
ok(
  (await appel("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: VERNIS }], remise: { montant: 5000, motif: "Offert (cadeau)" }, paiements: [] })).statut === 403,
  "l'accueil sans l'accès « Remises » ne peut pas offrir",
);
await appel("/api/gestion/caisse", direction, { action: "ouvrir", fond: 0 });
const offert = await appel("/api/gestion/caisse", direction, {
  action: "encaisser",
  lignes: [{ id: VERNIS, praticienne: "test-prothesiste-1" }],
  remise: { montant: 5000, motif: "Offert (cadeau)" },
  paiements: [],
  cliente: { nom: "Cliente offerte (test)", telephone: "77 000 77 02" },
});
ok(offert.statut === 201 && offert.corps.total === 0, "la direction offre le soin : ticket à 0 F, sans paiement");
ok((await lire(`tickets/${offert.corps.id}`)).remise?.mapValue.fields.motif.stringValue === "Offert (cadeau)", "le motif « Offert » est sur le ticket");
ok((await appel("/api/gestion/caisse", direction, { action: "encaisser", lignes: [{ id: VERNIS }], paiements: [] })).statut === 400, "sans cadeau, un ticket sans paiement reste refusé");

// ——— Doublons ———
// Une ancienne fiche enregistrée avec des espaces, et la fiche normale du même numéro
await fetch(`${EMU}/clientes?documentId=${encodeURIComponent("77 392 75 72")}`, { method: "POST", headers: OWNER, body: JSON.stringify({ fields: { nom: { stringValue: "Doublon A (test)" }, telephone: { stringValue: "77 392 75 72" }, credit: { integerValue: 3000 }, points: { integerValue: 2 }, nbTickets: { integerValue: 1 } } }) });
await fetch(`${EMU}/clientes?documentId=773927572`, { method: "POST", headers: OWNER, body: JSON.stringify({ fields: { nom: { stringValue: "Doublon A (test)" }, telephone: { stringValue: "773927572" }, credit: { integerValue: 2000 }, points: { integerValue: 3 }, nbTickets: { integerValue: 2 }, allergies: { stringValue: "Henné" } } }) });
await fetch(`${EMU}/tickets?documentId=ticket-doublon`, { method: "POST", headers: OWNER, body: JSON.stringify({ fields: { date: { stringValue: "2026-01-01" }, type: { stringValue: "vente" }, cliente: { mapValue: { fields: { id: { stringValue: "77 392 75 72" }, nom: { stringValue: "Doublon A (test)" }, telephone: { stringValue: "77 392 75 72" } } } } } }) });
const d = await appel("/api/gestion/clientes?doublons=1", direction);
const g = d.corps.find((x) => x.cle === "773927572");
ok(d.statut === 200 && g?.fiches.length === 2, "« 77 392 75 72 » et « 773927572 » : repérés comme la même cliente");
ok((await appel("/api/gestion/clientes", accueil, { action: "fusionner", cle: "773927572" })).statut === 403, "l'accueil ne fusionne pas");
const f = await appel("/api/gestion/clientes", direction, { action: "fusionner", cle: "77 392 75 72" });
ok(f.statut === 200 && f.corps.id === "773927572" && f.corps.fusionnees === 1, "fusion : une seule fiche, 773927572");
const fiche = await lire("clientes/773927572");
ok(Number(fiche.credit?.integerValue) === 5000 && Number(fiche.points?.integerValue) === 5 && Number(fiche.nbTickets?.integerValue) === 3, "crédit, points et passages additionnés (5 000 F, 5 pts, 3 passages)");
ok(fiche.allergies?.stringValue === "Henné", "la fiche technique est gardée");
ok((await fetch(`${EMU}/clientes/${encodeURIComponent("77 392 75 72")}`, { headers: OWNER })).status === 404, "plus de fiche en double");
ok((await lire("tickets/ticket-doublon")).cliente?.mapValue.fields.id.stringValue === "773927572", "les tickets de l'ancienne fiche sont rattachés");
ok(!(await appel("/api/gestion/clientes?doublons=1", direction)).corps.some((x) => x.cle === "773927572"), "plus aucun doublon pour ce numéro");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
