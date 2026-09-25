// Captures : anniversaires et relances WhatsApp des clientes. Base de TEST (noms fictifs).
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const D = new URL("./captures/", import.meta.url).pathname;
const r0 = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "accueil@test.aza", password: "AzaTest2026!", returnSecureToken: true }),
});
const acc = (await r0.json()).idToken;
const api = async (corps) => (await fetch(S + "/api/gestion/clientes", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${acc}` }, body: JSON.stringify(corps) })).json();
const jour = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
await api({ nom: "Aïssatou Diallo (test)", telephone: "77 000 70 01", naissance: `1992-${jour(0).slice(5)}` });
await api({ nom: "Rokhaya Gueye (test)", telephone: "77 000 70 02", naissance: `1988-${jour(3).slice(5)}` });
await api({ nom: "Bineta Sarr (test)", telephone: "77 000 70 03", naissance: `1995-${jour(6).slice(5)}` });
// Deux clientes pas venues depuis longtemps
for (const [tel, nom, mois] of [["770007004", "Seynabou Kane (test)", 4], ["770007005", "Astou Mbaye (test)", 5]]) {
  await api({ nom, telephone: tel });
  await fetch(`${EMU}/clientes/${tel}?updateMask.fieldPaths=derniereVisite&updateMask.fieldPaths=nbTickets&updateMask.fieldPaths=totalAchats`, {
    method: "PATCH", headers: OWNER, body: JSON.stringify({ fields: { derniereVisite: { stringValue: jour(-mois * 30) }, nbTickets: { integerValue: "6" }, totalAchats: { integerValue: "180000" } } }),
  });
}
await api({ action: "relance", id: "770007005", type: "revoir" });

const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function page(tel) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
  await p.goto(S + "/gestion");
  await p.fill("input[type=tel]", tel);
  await p.fill("input[type=password]", "AzaTest2026!");
  await p.click("button[type=submit]");
  await p.locator('a[href="/gestion/mon-compte"]').waitFor();
  return p;
}
const a = await page("77 900 00 03");
await a.goto(S + "/gestion/clientes?groupe=anniversaires");
await a.getByText("Aïssatou Diallo (test)").waitFor();
await a.waitForTimeout(800);
await a.screenshot({ path: `${D}98-clientes-anniversaires.png` });
await a.goto(S + "/gestion/clientes?groupe=inactives3");
await a.getByText("Seynabou Kane (test)").waitFor();
await a.waitForTimeout(800);
await a.screenshot({ path: `${D}99-clientes-relance.png` });
const m = await page("77 900 00 01");
await m.goto(S + "/gestion/jour");
await m.getByText("Anniversaire aujourd'hui").waitFor();
const y = await m.getByText("Anniversaire aujourd'hui").evaluate((e) => e.getBoundingClientRect().top + window.scrollY - 250);
await m.evaluate((y) => window.scrollTo(0, y), y);
await m.waitForTimeout(800);
await m.screenshot({ path: `${D}100-jour-anniversaire.png` });
console.log("📸 98, 99, 100");
await b.close();
