// Vérification : menu des boissons par code QR (cliente → caisse, accueil et SA prestataire
// prévenues, jusqu'à « Servie »). Données FICTIVES. Prérequis : émulateurs + seed, site en mode test.
// Usage : node scripts/verifier-boissons.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
let echecs = 0;
const ok = (cond, msg, detail = "") => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) echecs++;
};
async function connexion(email) {
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
  }).then(async (r) => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const AUJ = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date());
const [dir, man, acc, coif, esth] = await Promise.all(["direction", "manager", "accueil", "coiffeuse1", "estheticienne1"].map((n) => connexion(`${n}@test.aza`)));

// La cliente a rendez-vous aujourd'hui avec la coiffeuse.
const rdv = await api("/api/gestion/comptoir", acc, { action: "libre", date: AUJ, debut: 600, lignes: [{ id: "tresses--knotless-mi-long", praticienne: "test-coiffeuse-1" }], nom: "Cliente boisson", telephone: "77 000 66 01", dejaFaite: false });
ok(rdv.statut === 201, "rendez-vous de la cliente créé", JSON.stringify(rdv.corps));

ok((await api("/api/gestion/boissons?qr=1", acc)).statut === 403, "l'accueil ne voit pas le code du QR (direction, manager)");
const qr = await api("/api/gestion/boissons?qr=1", man);
ok(qr.statut === 200 && qr.corps.code?.length >= 8, "le manager obtient le code du QR");
const code = qr.corps.code;
ok((await api(`/api/boissons?code=${code}`)).statut === 200, "le lien du QR est valable");
ok((await api("/api/boissons?code=fauxcode123")).statut === 403, "un faux lien est refusé");
ok((await api("/api/boissons", null, { code: "fauxcode123", boisson: "the", prenom: "Awa" })).statut === 403, "on ne commande pas sans le bon code");
ok((await api("/api/boissons", null, { code, boisson: "whisky", prenom: "Awa" })).statut === 400, "une boisson hors menu est refusée");
ok((await api("/api/boissons", null, { code, boisson: "the", prenom: "" })).statut === 400, "le prénom est demandé");

ok((await api(`/api/boissons?code=${code}&tel=77%20000%2066%2001`)).corps.prenom === "Cliente", "une cliente connue : son prénom vient tout seul avec son numéro");
ok((await api(`/api/boissons?code=${code}&tel=770009999`)).corps.prenom === null, "un numéro inconnu : rien");
ok((await api("/api/boissons?code=fauxcode123&tel=770006601")).statut === 403, "sans le bon code, on ne retrouve personne");
const c1 = await api("/api/boissons", null, { code, boisson: "the", prenom: "Awa", telephone: "770006601" });
ok(c1.statut === 201 && c1.corps.boisson === "Thé", "la cliente demande un thé", JSON.stringify(c1.corps));
const c2 = await api("/api/boissons", null, { code, boisson: "coca", prenom: "Fatou" });
ok(c2.statut === 201, "une cliente sans rendez-vous demande un Coca");

const vueAcc = (await api("/api/gestion/boissons", acc)).corps;
const t = vueAcc.find((d) => d.id === c1.corps.id);
ok(vueAcc.length >= 2 && t?.cliente === "Cliente boisson" && t.avec.length === 1, "l'accueil voit les deux demandes, avec le nom du rendez-vous et la prestataire", JSON.stringify(vueAcc));
const vueCo = (await api("/api/gestion/boissons", coif)).corps;
ok(vueCo.length === 1 && vueCo[0].id === c1.corps.id, "la coiffeuse ne voit que la boisson de SA cliente", JSON.stringify(vueCo));
ok((await api("/api/gestion/boissons", esth)).corps.length === 0, "une autre prestataire ne voit rien");
ok((await api("/api/gestion/boissons", esth, { action: "servir", id: c1.corps.id })).statut === 403, "une autre prestataire ne peut pas la marquer servie");

ok((await api(`/api/boissons?id=${c1.corps.id}`)).corps.statut === "demandee", "côté cliente : demandée");
ok((await api("/api/gestion/boissons", coif, { action: "servir", id: c1.corps.id })).statut === 200, "la coiffeuse note « Servie »");
ok((await api(`/api/boissons?id=${c1.corps.id}`)).corps.statut === "servie", "côté cliente : servie");
ok(!(await api("/api/gestion/boissons", acc)).corps.some((d) => d.id === c1.corps.id), "la demande disparaît chez l'accueil aussi");
ok((await api("/api/gestion/boissons", man, { action: "servir", id: c2.corps.id })).statut === 200, "la caisse sert le Coca");

for (let i = 0; i < 3; i++) await api("/api/boissons", null, { code, boisson: "eau", prenom: "Binta", telephone: "770006699" });
ok((await api("/api/boissons", null, { code, boisson: "eau", prenom: "Binta", telephone: "770006699" })).statut === 429, "au plus 3 boissons en attente par cliente");

const nouveau = await api("/api/gestion/boissons", dir, { action: "nouveau-code" });
ok(nouveau.statut === 200 && nouveau.corps.code !== code, "la direction change le code");
ok((await api(`/api/boissons?code=${code}`)).statut === 403, "l'ancien QR ne marche plus");

console.log(echecs ? `${echecs} ÉCHEC(S)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
