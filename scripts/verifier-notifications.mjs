// Vérification du centre de notifications (la cloche), sur la base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-notifications.mjs [http://localhost:3100]
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
const notifs = async (tok) => {
  const r = await fetch(`${SITE}/api/gestion/notifications`, { headers: { Authorization: `Bearer ${tok}` } });
  return { statut: r.status, corps: await r.json() };
};
const AUJ = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date());
const HIER = new Date(Date.parse(`${AUJ}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
const [direction, accueil, coiffeuse, comptable] = await Promise.all(["direction", "accueil", "coiffeuse1", "comptable"].map((n) => jeton(`${n}@test.aza`)));

// Une caisse d'hier restée ouverte, une cliente dont c'est l'anniversaire, une commande en ligne
await fetch(`${EMU}/caisses/${HIER}~oubli`, { method: "PATCH", headers: OWNER, body: JSON.stringify({ fields: { date: { stringValue: HIER }, uid: { stringValue: "oubli" }, statut: { stringValue: "ouverte" }, fond: { integerValue: 0 }, ouvertPar: { mapValue: { fields: { uid: { stringValue: "oubli" }, nom: { stringValue: "Caissière test" } } } } } }) });
await fetch(`${EMU}/clientes/770009901?updateMask.fieldPaths=nom&updateMask.fieldPaths=telephone&updateMask.fieldPaths=anniversaire`, { method: "PATCH", headers: OWNER, body: JSON.stringify({ fields: { nom: { stringValue: "Anniversaire (test)" }, telephone: { stringValue: "770009901" }, anniversaire: { stringValue: AUJ.slice(5) } } }) });
// Un rendez-vous pris en ligne (comme par le site)
await fetch(`${EMU}/rendezVous?documentId=en-ligne-test`, { method: "POST", headers: OWNER, body: JSON.stringify({ fields: { date: { stringValue: AUJ }, debut: { integerValue: 17 * 60 }, fin: { integerValue: 18 * 60 }, statut: { stringValue: "reserve" }, source: { stringValue: "site" }, creeLe: { timestampValue: new Date().toISOString() }, cliente: { mapValue: { fields: { id: { stringValue: "770009902" }, nom: { stringValue: "Cliente en ligne (test)" }, telephone: { stringValue: "77 000 99 02" } } } }, prestations: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: "onglerie--vernis-permanent" }, nom: { stringValue: "Vernis permanent" }, prix: { integerValue: 5000 } } } }] } }, affectations: { arrayValue: { values: [] } }, praticiennesIds: { arrayValue: { values: [] } } } }) });

const d = await notifs(direction);
const ids = (d.corps ?? []).map((n) => n.id);
ok(d.statut === 200, "la direction lit ses notifications");
ok(ids.includes("caisses") && d.corps.find((n) => n.id === "caisses").detail.includes("Caissière test"), "caisse d'hier pas clôturée : signalée à la direction");
ok(ids.includes("anniversaires"), "anniversaire du jour : signalé");
const enLigne = d.corps.find((n) => n.id === "rdv-en-ligne");
ok(enLigne?.elements?.some((e) => e.id === "en-ligne-test" && e.texte.includes("Cliente en ligne")), "rendez-vous pris en ligne : signalé, avec le nom de la cliente");
const a = await notifs(accueil);
ok(a.statut === 200 && a.corps.some((n) => n.id === "rdv-en-ligne") && !a.corps.some((n) => n.id === "caisses"), "l'accueil voit les rendez-vous en ligne, pas les caisses des autres");
const c = await notifs(coiffeuse);
ok(c.statut === 200 && c.corps.length === 0, "une praticienne ne reçoit rien de tout cela (seulement ses alertes de rendez-vous, en direct)");
const k = await notifs(comptable);
ok(k.statut === 200 && k.corps.some((n) => n.id === "caisses") && !k.corps.some((n) => n.id === "rdv-en-ligne"), "le comptable voit les caisses oubliées, pas l'agenda");
ok((await fetch(`${SITE}/api/gestion/notifications`)).status === 401, "sans être connecté : refusé");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
