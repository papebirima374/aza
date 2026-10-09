// Captures : acompte (agenda et caisse), rendez-vous offert, doublons de clientes. Base de TEST.
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const D = new URL("./captures/", import.meta.url).pathname;
const tok = async (e) => (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: "AzaTest2026!", returnSecureToken: true }) })).json()).idToken;
const post = async (t, url, c) => (await fetch(S + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(c) })).json();
const dir = await tok("direction@test.aza");
const AUJ = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date());
await post(dir, "/api/gestion/caisse", { action: "ouvrir", fond: 10000 });
const rdv = await post(dir, "/api/gestion/comptoir", { action: "libre", date: AUJ, debut: 18 * 60, lignes: [{ id: "onglerie--gainage", praticienne: "test-prothesiste-1" }], nom: "Mariama Sow (test)", telephone: "77 000 01 03", dejaFaite: false });
// Doublons pour l'écran Clientes
await fetch(`${EMU}/clientes?documentId=${encodeURIComponent("77 000 01 05")}`, { method: "POST", headers: OWNER, body: JSON.stringify({ fields: { nom: { stringValue: "Khady Fall (test)" }, telephone: { stringValue: "77 000 01 05" }, nbTickets: { integerValue: 1 }, credit: { integerValue: 2000 } } }) });
await fetch(`${EMU}/clientes?documentId=770000105`, { method: "POST", headers: OWNER, body: JSON.stringify({ fields: { nom: { stringValue: "Khady Fall (test)" }, telephone: { stringValue: "770000105" }, nbTickets: { integerValue: 3 } } }) });

const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
await p.goto(S + "/gestion"); await p.fill("input[type=tel]", "77 900 00 01"); await p.fill("input[type=password]", "AzaTest2026!"); await p.click("button[type=submit]");
await p.locator('a[href="/gestion/mon-compte"]').waitFor();
const ranger = async () => { for (let i = 0; i < 12 && (await p.getByRole("button", { name: "Plus tard" }).count()); i++) await p.getByRole("button", { name: "Plus tard" }).click(); };
// 119 : l'acompte dans le rendez-vous
await p.goto(S + "/gestion"); await p.waitForTimeout(2500); await ranger();
await p.getByText(/18h · Mariama Sow/).first().click();
await p.getByRole("button", { name: /Elle verse un acompte/ }).click();
await p.getByRole("button", { name: /Wave/ }).last().click();
await p.waitForTimeout(400);
await p.locator("aside").screenshot({ path: `${D}119-acompte.png` });
await p.getByRole("button", { name: /Enregistrer l'acompte/ }).click();
await p.getByText(/Acompte versé/).waitFor();
// Le soin est fait : à encaisser
for (const s of ["arrivee", "en-cours", "termine"]) await post(dir, `/api/gestion/rendez-vous/${rdv.id}/statut`, { statut: s });
// 120 : au comptoir, l'acompte est déduit
await p.goto(S + `/gestion/caisse?rdv=${rdv.id}`);
await p.getByText(/Acompte déjà versé/).first().waitFor();
await p.waitForTimeout(500); await ranger();
await p.evaluate(() => window.scrollTo(0, document.querySelector("#comptoir").getBoundingClientRect().top + window.scrollY - 105));
await p.waitForTimeout(400);
await p.screenshot({ path: `${D}120-comptoir-acompte.png` });
await p.locator("#comptoir").getByRole("button", { name: /Vider/ }).click().catch(() => {});
// 121 : offert
await p.getByPlaceholder(/Chercher une prestation/).fill("vernis perm");
await p.getByRole("button", { name: /Vernis permanent/ }).first().click();
await p.locator("#comptoir").getByRole("button", { name: /Offert/ }).click();
await p.waitForTimeout(400);
await p.locator("#comptoir").evaluate((e) => (e.scrollTop = 0));
await p.locator("#comptoir").screenshot({ path: `${D}121-offert.png` });
// 122 : doublons
await p.goto(S + "/gestion/clientes");
await p.getByText(/en double/).waitFor();
await p.getByRole("button", { name: /Voir et fusionner/ }).click();
await p.waitForTimeout(400); await ranger();
await p.screenshot({ path: `${D}122-doublons.png` });
console.log("📸 119, 120, 121, 122");
await b.close();
