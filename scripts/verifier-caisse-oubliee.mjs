// Vérification : une caisse oubliée (restée ouverte un jour passé) se clôture après coup,
// et la cloche ne la signale plus. Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-caisse-oubliee.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};
const connexion = async (email) =>
  (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }) })).json());
const appel = (chemin, tok, corps) =>
  fetch(`${SITE}${chemin}`, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, ...(corps ? { body: JSON.stringify(corps) } : {}) }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const iso = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date(ms));
const HIER = iso(Date.now() - 4 * 86_400_000);
const [dir, man, acc] = await Promise.all(["direction@test.aza", "manager@test.aza", "accueil@test.aza"].map(connexion));

// La caisse de l'accueil, ouverte il y a 4 jours avec 10 000 F de fond et une vente de 5 000 F en espèces, jamais clôturée
const id = `${HIER}~${acc.localId}`;
await fetch(`${EMU}/caisses?documentId=${encodeURIComponent(id)}`, {
  method: "POST",
  headers: OWNER,
  body: JSON.stringify({ fields: { date: { stringValue: HIER }, uid: { stringValue: acc.localId }, statut: { stringValue: "ouverte" }, fond: { integerValue: 10000 }, ouvertPar: { mapValue: { fields: { uid: { stringValue: acc.localId }, nom: { stringValue: "Accueil test" } } } } } }),
});
await fetch(`${EMU}/tickets?documentId=ticket-oublie`, {
  method: "POST",
  headers: OWNER,
  body: JSON.stringify({ fields: { date: { stringValue: HIER }, caisse: { stringValue: id }, type: { stringValue: "vente" }, numero: { integerValue: 999 }, total: { integerValue: 5000 }, rendu: { integerValue: 0 }, paiements: { arrayValue: { values: [{ mapValue: { fields: { mode: { stringValue: "especes" }, montant: { integerValue: 5000 } } } }] } } } }),
});
const avant = (await appel("/api/gestion/notifications", dir.idToken)).corps.find((n) => n.id === "caisses");
ok(avant?.nombre === 1 && /Accueil test/.test(avant.detail), "la cloche signale la caisse oubliée de l'accueil");
const s = (await appel(`/api/gestion/caisse?sessions=1&du=${HIER}&au=${HIER}`, dir.idToken)).corps;
ok(s.jours[0]?.caisses[0]?.totaux.especesAttendues === 15000, "sessions de caisse : tiroir attendu 15 000 F (10 000 de fond + 5 000)");

ok((await appel("/api/gestion/caisse", acc.idToken, { action: "cloturer", compte: 15000, justification: "", caisse: `${HIER}~autre` })).statut === 404, "une caisse inconnue : introuvable");
ok((await appel("/api/gestion/caisse", man.idToken, { action: "cloturer", compte: 14000, justification: "", caisse: id })).statut === 400, "après coup aussi, un écart demande une explication");
const c = await appel("/api/gestion/caisse", man.idToken, { action: "cloturer", compte: 14000, justification: "1 000 F pris pour le taxi", caisse: id });
ok(c.statut === 200 && c.corps.ecart === -1000 && c.corps.jour === HIER, "le manager clôture après coup la caisse oubliée (écart −1 000 F expliqué)");
const doc = (await (await fetch(`${EMU}/caisses/${encodeURIComponent(id)}`, { headers: OWNER })).json()).fields;
ok(doc.statut.stringValue === "cloturee" && doc.cloture.mapValue.fields.apresCoup?.booleanValue === true, "elle est marquée « clôturée après coup »");
ok(!(await appel("/api/gestion/notifications", dir.idToken)).corps.some((n) => n.id === "caisses"), "la notification disparaît de la cloche");
ok((await appel("/api/gestion/caisse", man.idToken, { action: "cloturer", compte: 15000, justification: "", caisse: id })).statut === 409, "on ne la clôture pas deux fois");

console.log(echecs ? `${echecs} ÉCHEC(S)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
