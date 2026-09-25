// Captures : accès sur mesure (Équipe), « Qui a fait quoi », ajout d'une prestation en cabine. Base de TEST.
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const D = new URL("./captures/", import.meta.url).pathname;
async function connexion(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  const j = await r.json();
  return { jeton: j.idToken, uid: j.localId };
}
const api = async (chemin, tok, corps, methode) => (await fetch(S + chemin, { method: methode ?? (corps ? "POST" : "GET"), headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: corps ? JSON.stringify(corps) : undefined })).json();
const [dir, man, acc, coif] = await Promise.all(["direction", "manager", "accueil", "coiffeuse1"].map((n) => connexion(`${n}@test.aza`)));
const AUJ = new Date().toISOString().slice(0, 10);

// Une journée d'activité (fictive)
await api("/api/gestion/equipe", dir.jeton, { uid: acc.uid, acces: { rapports: true } }, "PATCH");
await api("/api/gestion/caisse", acc.jeton, { action: "ouvrir", fond: 20000 });
const v = (tok, id, montant, nom, tel) => api("/api/gestion/caisse", tok, { action: "encaisser", lignes: [{ id }], paiements: [{ mode: "especes", montant }], cliente: { nom, telephone: tel } });
await v(acc.jeton, "onglerie--vernis-permanent", 5000, "Awa Diop (test)", "77 000 01 01");
const t2 = await v(man.jeton, "soins-visage--hydrafacial", 45000, "Fatou Ndiaye (test)", "77 000 01 02");
await v(acc.jeton, "tresses--knotless-mi-long", 20000, "Mariama Sow (test)", "77 000 01 03");
await api("/api/gestion/caisse", man.jeton, { action: "annuler", id: t2.id, motif: "Erreur de prestation" });
await api("/api/gestion/catalogue", dir.jeton, { action: "prix", id: "onglerie--vernis-simple", prix: 3500 });

// Un rendez-vous de la coiffeuse, commencé
const compteCoif = await (await fetch(`${EMU}/comptes/${coif.uid}`, { headers: OWNER })).json();
const pratId = compteCoif.fields.praticienne.stringValue;
const rq = await (await fetch(`${EMU}:runQuery`, { method: "POST", headers: OWNER, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "rendezVous" }], where: { fieldFilter: { field: { fieldPath: "date" }, op: "EQUAL", value: { stringValue: AUJ } } } } }) })).json();
const rdv = rq.filter((x) => x.document).map((x) => x.document).filter((d) => (d.fields.praticiennesIds.arrayValue.values ?? []).some((x) => x.stringValue === pratId) && ["reserve", "confirme"].includes(d.fields.statut.stringValue)).sort((a, b) => Number(a.fields.debut.integerValue) - Number(b.fields.debut.integerValue))[0];
const rdvId = rdv.name.split("/").pop();
await api(`/api/gestion/rendez-vous/${rdvId}/statut`, coif.jeton, { statut: "en-cours" });

const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => pw.chromium.launch());
async function page(tel) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
  await p.goto(S + "/gestion");
  await p.fill("input[type=tel]", tel);
  await p.fill("input[type=password]", "AzaTest2026!");
  await p.click("button[type=submit]");
  await p.locator('a[href="/gestion/mon-compte"]').waitFor();
  await p.waitForTimeout(800);
  return p;
}
const cap = async (p, n, opts = {}) => { await p.waitForTimeout(900); await p.screenshot({ path: `${D}${n}.png`, ...opts }); console.log("📸", n); };
const haut = (loc, marge) => loc.evaluate((e, m) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - m), marge);

// Ma journée : la cliente ajoute une prestation
const c = await page("77 900 00 04");
await c.getByRole("button", { name: /La cliente ajoute une prestation/ }).first().click();
await c.getByPlaceholder(/Tapez le soin/).fill("détressage");
await c.getByRole("button", { name: /Détressage cheveux externe/ }).first().click();
await haut(c.getByText(/Ajouter .*Détressage/).first(), 420);
await cap(c, "93-ajout-prestation");
await c.getByRole("button", { name: /Oui, ajouter/ }).click();
await c.getByText(/ajouté/).first().waitFor();
await haut(c.getByText(/ajouté/).first(), 380);
await cap(c, "94-ajout-confirme");

// Équipe : les accès de l'accueil
const d = await page("77 900 00 01");
await d.goto(S + "/gestion/equipe");
const ligne = d.locator("li").filter({ hasText: "Accueil test" }).first();
await ligne.getByRole("button", { name: "Modifier" }).click();
const resume = d.locator("summary").filter({ hasText: "🔐 Accès" });
await resume.waitFor();
await haut(resume, 110);
await cap(d, "91-equipe-acces");

// Qui a fait quoi
await d.goto(S + "/gestion/activite");
await d.getByText("Qui a fait quoi").first().waitFor();
await d.getByText("Toute l'équipe").waitFor();
await cap(d, "92-journal");
await b.close();
