// Vérification : plusieurs caisses (sessions) dans la même journée pour la même personne.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-sessions-jour.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
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
const C = "/api/gestion/caisse";
const VERNIS = "onglerie--vernis-permanent"; // 5 000 F
const [acc, dir] = await Promise.all([jeton("accueil@test.aza"), jeton("direction@test.aza")]);

// 1re session : un essai, puis clôture
const o1 = await appel(C, acc, { action: "ouvrir", fond: 10000 });
ok(o1.statut === 201, "1re caisse ouverte (10 000 F)");
await appel(C, acc, { action: "encaisser", lignes: [{ id: VERNIS }], paiements: [{ mode: "especes", montant: 5000 }] });
ok((await appel(C, acc, { action: "cloturer", compte: 15000 })).statut === 200, "1re caisse clôturée (15 000 F comptés, aucun écart)");
ok((await appel(C, acc, { action: "encaisser", lignes: [{ id: VERNIS }], paiements: [{ mode: "especes", montant: 5000 }] })).statut === 409, "caisse clôturée : on n'encaisse plus dedans");

// 2e session, le même jour
const o2 = await appel(C, acc, { action: "ouvrir", fond: 20000 });
ok(o2.statut === 201 && o2.corps.caisse !== o1.corps.caisse && /~2$/.test(o2.corps.caisse), `2e caisse ouverte le même jour (${o2.corps.caisse.split("~").pop() === "2" ? "session 2" : o2.corps.caisse})`);
ok((await appel(C, acc, { action: "ouvrir", fond: 0 })).statut === 409, "pas une 3e tant que la 2e est ouverte");
const t = await appel(C, acc, { action: "encaisser", lignes: [{ id: VERNIS }], paiements: [{ mode: "wave", montant: 5000 }] });
ok(t.statut === 201, "on encaisse dans la 2e caisse");
let j = (await appel(`${C}?date=${AUJ}`, acc)).corps;
ok(j.caisse.id === o2.corps.caisse && j.caisse.statut === "ouverte" && j.caisse.fond === 20000, "« Ma caisse » est la nouvelle (fond 20 000 F)");
ok(j.caisse.totaux.recette === 5000 && j.caisse.totaux.especesAttendues === 20000, "ses comptes repartent de zéro : recette 5 000 F, tiroir 20 000 F");
const dep = await appel("/api/gestion/depenses", acc, { action: "ajouter", montant: 1000, categorie: "transport", mode: "especes", deLaCaisse: true });
ok(dep.statut === 201 && dep.corps.deLaCaisse, "une dépense sort du tiroir de la 2e caisse");
const cl2 = await appel(C, acc, { action: "cloturer", compte: 19000 });
ok(cl2.statut === 200 && cl2.corps.ecart === 0 && cl2.corps.caisse === o2.corps.caisse, "clôture de la 2e caisse : 20 000 − 1 000 = 19 000 F, aucun écart");

// La direction voit les deux sessions, et la journée entière
const s = (await appel(`${C}?sessions=1&du=${AUJ}&au=${AUJ}`, dir)).corps;
const siennes = s.jours[0].caisses.filter((c) => c.ouvertPar.nom === "Accueil test");
ok(siennes.length === 2 && siennes.some((c) => c.session === 2), "Sessions de caisse : les deux caisses de l'accueil, la 2e marquée « 2e session »");
ok(s.jours[0].recette === 10000, "recette de la journée : 10 000 F (les deux sessions)");
ok((await appel(C, acc, { action: "ouvrir", fond: 0 })).statut === 201, "et une 3e session est possible après la 2e clôture");

console.log(echecs ? `${echecs} ÉCHEC(S)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
