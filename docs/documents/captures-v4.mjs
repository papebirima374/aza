// Captures : minuteur des soins (Ma journée, agenda) et carte de fidélité (réglages, caisse, reçu). Base de TEST.
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const D = new URL("./captures/", import.meta.url).pathname;
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => pw.chromium.launch());
async function jeton(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
const api = async (chemin, tok, corps) => (await fetch(S + chemin, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: corps ? JSON.stringify(corps) : undefined })).json();
const requete = async (q) => (await (await fetch(`${EMU}:runQuery`, { method: "POST", headers: OWNER, body: JSON.stringify({ structuredQuery: q }) })).json()).filter((x) => x.document).map((x) => x.document);
const [dir, acc] = await Promise.all(["direction", "accueil"].map((n) => jeton(`${n}@test.aza`)));
const AUJ = new Date().toISOString().slice(0, 10);

// Deux rendez-vous d'aujourd'hui de la même praticienne passent « En cours » :
// l'un presque fini (il reste 3 min), l'autre qui déborde de 4 min.
const rdvs = await requete({ from: [{ collectionId: "rendezVous" }], where: { fieldFilter: { field: { fieldPath: "date" }, op: "EQUAL", value: { stringValue: AUJ } } } });
const parPraticienne = {};
for (const r of rdvs) for (const v of r.fields.praticiennesIds.arrayValue.values ?? []) (parPraticienne[v.stringValue] ??= []).push(r);
const [prat, liste] = Object.entries(parPraticienne).sort((a, b) => b[1].length - a[1].length)[0];
const choisis = liste.slice(0, 2);
for (const [i, r] of choisis.entries()) {
  const id = r.name.split("/").pop();
  await api(`/api/gestion/rendez-vous/${id}/statut`, dir, { statut: "arrivee" });
  await api(`/api/gestion/rendez-vous/${id}/statut`, dir, { statut: "en-cours" });
  const duree = Number(r.fields.fin.integerValue) - Number(r.fields.debut.integerValue);
  const debut = new Date(Date.now() - (i === 0 ? duree - 3 : duree + 4) * 60_000).toISOString();
  const doc = await (await fetch(`${EMU}/rendezVous/${id}`, { headers: OWNER })).json();
  const hist = doc.fields.historique.arrayValue.values.map((h) => (h.mapValue.fields.statut.stringValue === "en-cours" ? { mapValue: { fields: { ...h.mapValue.fields, le: { timestampValue: debut } } } } : h));
  await fetch(`${EMU}/rendezVous/${id}?updateMask.fieldPaths=historique`, { method: "PATCH", headers: OWNER, body: JSON.stringify({ fields: { historique: { arrayValue: { values: hist } } } }) });
}
const comptes = await requete({ from: [{ collectionId: "comptes" }], where: { fieldFilter: { field: { fieldPath: "praticienne" }, op: "EQUAL", value: { stringValue: prat } } } });
const telPrat = comptes[0].fields.telephone.stringValue;

// Fidélité : règles + trois passages d'une cliente.
await api("/api/gestion/reglages", dir, { action: "fidelite", actif: true, tranche: 1000, seuil: 50, valeur: 5000 });
await api("/api/gestion/caisse", acc, { action: "ouvrir", fond: 20000 });
const cliente = { nom: "Awa Diop (test)", telephone: "77 000 01 01" };
await api("/api/gestion/caisse", acc, { action: "encaisser", lignes: [{ id: "tresses--knotless-mi-long" }], paiements: [{ mode: "wave", montant: 20000 }], cliente });
await api("/api/gestion/caisse", acc, { action: "encaisser", lignes: [{ id: "soins-visage--hydrafacial" }], paiements: [{ mode: "wave", montant: 45000 }], cliente });
const t = await api("/api/gestion/caisse", acc, { action: "encaisser", lignes: [{ id: "onglerie--vernis-permanent" }], paiements: [{ mode: "especes", montant: 5000 }], cliente });

async function page(tel, l = 390) {
  const p = await (await b.newContext({ viewport: { width: l, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
  await p.goto(S + "/gestion");
  await p.fill("input[type=tel]", tel);
  await p.fill("input[type=password]", "AzaTest2026!");
  await p.click("button[type=submit]");
  await p.locator('a[href="/gestion/mon-compte"]').waitFor();
  await p.waitForTimeout(1200);
  return p;
}
const cap = async (p, n) => { await p.waitForTimeout(900); await p.screenshot({ path: `${D}${n}.png` }); console.log("📸", n); };

const m = await page(telPrat);
await m.getByText("Temps restant").or(m.getByText("Bientôt fini")).first().waitFor();
const y1 = await m.locator("[role=timer]").first().evaluate((e) => e.closest("li").getBoundingClientRect().top + window.scrollY - 70);
await m.evaluate((y) => window.scrollTo(0, y), y1);
await cap(m, "73-minuteur-depasse");
const y2 = await m.locator("[role=timer]").nth(1).evaluate((e) => e.closest("li").getBoundingClientRect().top + window.scrollY - 70);
await m.evaluate((y) => window.scrollTo(0, y), y2);
await m.addStyleTag({ content: ".animate-pulse{animation:none!important}" });
await cap(m, "72-minuteur-bientot");

const a = await page("77 900 00 03", 1024);
await a.goto(S + "/gestion");
await a.getByText("⏰").first().waitFor();
await a.addStyleTag({ content: ".animate-pulse{animation:none!important}" });
const y3 = await a.getByText("⏰").first().evaluate((e) => e.getBoundingClientRect().top + window.scrollY - 200);
await a.evaluate((y) => window.scrollTo(0, y), y3);
await cap(a, "74-agenda-depasse");

const c = await page("77 900 00 03");
await c.goto(S + "/gestion/caisse");
await c.getByRole("button", { name: "+ Nouvelle vente" }).click();
await c.locator("input[type=search]").fill("pose cils simple");
await c.getByRole("button", { name: /Pose cils simple/ }).first().click();
await c.getByLabel(/Téléphone/).first().fill("77 000 01 01");
await c.getByText("💗 Fidélité").waitFor();
await c.getByText("💗 Fidélité").evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 250));
await cap(c, "75-caisse-fidelite");
await c.goto(S + `/gestion/caisse/ticket/${t.id}`);
await c.getByText("Carte de fidélité").waitFor();
await c.getByText("Carte de fidélité").evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 380));
await cap(c, "76-recu-fidelite");

const r = await page("77 900 00 01");
await r.goto(S + "/gestion/reglages#fidelite");
await r.getByText("💗 Carte de fidélité").waitFor();
await r.getByText("💗 Carte de fidélité").evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 150));
await cap(r, "77-reglages-fidelite");
await b.close();
