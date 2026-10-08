// Captures refaites avec le nouvel écran de caisse (comptoir) : ticket d'un rendez-vous,
// paiement, confirmation, choix de la cliente, bilan. Base de TEST (noms fictifs).
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const D = new URL("./captures/", import.meta.url).pathname;
const r0 = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "accueil@test.aza", password: "AzaTest2026!", returnSecureToken: true }),
});
const acc = (await r0.json()).idToken;
await fetch(S + "/api/gestion/caisse", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${acc}` }, body: JSON.stringify({ action: "ouvrir", fond: 20000 }) });
// Un rendez-vous d'aujourd'hui, terminé : il attend d'être encaissé.
const AUJ = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date());
const q = await (await fetch(`${EMU}:runQuery`, {
  method: "POST", headers: OWNER,
  body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "rendezVous" }], where: { fieldFilter: { field: { fieldPath: "date" }, op: "EQUAL", value: { stringValue: AUJ } } } } }),
})).json();
const rdv = q.find((x) => x.document)?.document;
const rdvId = rdv.name.split("/").pop();
const cliente = rdv.fields.cliente.mapValue.fields.nom.stringValue;
await fetch(`${EMU}/rendezVous/${rdvId}?updateMask.fieldPaths=statut`, { method: "PATCH", headers: OWNER, body: JSON.stringify({ fields: { statut: { stringValue: "termine" } } }) });

const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
await p.goto(S + "/gestion");
await p.fill("input[type=tel]", "77 900 00 03");
await p.fill("input[type=password]", "AzaTest2026!");
await p.click("button[type=submit]");
await p.locator('a[href="/gestion/mon-compte"]').waitFor();
await p.goto(S + "/gestion/caisse");
await p.getByText("Ma caisse est ouverte").waitFor();
const haut = (sel) => p.evaluate((s) => window.scrollTo(0, document.querySelector(s).getBoundingClientRect().top + window.scrollY - 105), sel);

// 20 : le ticket du rendez-vous, déjà rempli
await p.getByRole("button", { name: new RegExp(cliente.replace(/[()]/g, ".")) }).first().click();
await p.waitForTimeout(600);
await haut("#comptoir");
await p.waitForTimeout(500);
await p.screenshot({ path: `${D}20-caisse-ticket.png` });

// 21 : le paiement en espèces, monnaie à rendre
await p.locator("#comptoir").getByRole("button", { name: /Espèces/ }).click();
await p.waitForTimeout(300);
const recu = p.locator("#comptoir input[inputmode=numeric]").last();
await recu.fill("100000").catch(() => {});
await p.waitForTimeout(400);
await p.locator("#comptoir").getByRole("button", { name: /^Encaisser/ }).scrollIntoViewIfNeeded();
await p.evaluate(() => window.scrollBy(0, 120));
await p.waitForTimeout(400);
await p.screenshot({ path: `${D}21-caisse-paiement.png` });

// 22 : ticket enregistré
await p.locator("#comptoir").getByRole("button", { name: /^Encaisser/ }).click();
await p.getByText(/enregistré/).first().waitFor();
await p.waitForTimeout(800);
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(400);
await p.screenshot({ path: `${D}22-caisse-confirmation.png` });

// 80 : vente directe, retrouver une cliente du fichier
await p.getByPlaceholder(/Chercher une prestation/).fill("vernis perm");
await p.getByRole("button", { name: /Vernis permanent/ }).first().click();
const nom = p.locator("#comptoir").getByLabel(/Nom de la cliente/);
await nom.fill("awa");
await p.waitForTimeout(600);
await haut("#comptoir");
await p.waitForTimeout(500);
await p.screenshot({ path: `${D}80-caisse-cliente.png` });

// 24b : le bilan de ma caisse (bouton « Clôture » en haut)
await p.getByRole("button", { name: /Clôture/ }).first().click();
await p.getByText(/Ma caisse : bilan et clôture/).waitFor();
await p.waitForTimeout(600);
await p.screenshot({ path: `${D}24b-caisse-bilan.png` });
await p.keyboard.press("Escape");
// 106 : les sessions de caisse (direction, sur ordinateur)
const r1 = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "manager@test.aza", password: "AzaTest2026!", returnSecureToken: true }),
});
const man = (await r1.json()).idToken;
await fetch(S + "/api/gestion/caisse", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${man}` }, body: JSON.stringify({ action: "ouvrir", fond: 10000 }) });
await fetch(S + "/api/gestion/caisse", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${man}` }, body: JSON.stringify({ action: "encaisser", lignes: [{ id: "onglerie--vernis-permanent", praticienne: "test-prothesiste-1" }], paiements: [{ mode: "wave", montant: 5000 }] }) });
await fetch(S + "/api/gestion/caisse", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${man}` }, body: JSON.stringify({ action: "cloturer", compte: 10000 }) });
const d = await (await b.newContext({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
await d.goto(S + "/gestion");
await d.fill("input[type=tel]", "77 900 00 01");
await d.fill("input[type=password]", "AzaTest2026!");
await d.click("button[type=submit]");
await d.locator('a[href="/gestion/mon-compte"]').waitFor();
await d.goto(S + "/gestion/caisse/sessions");
await d.getByText(/Recette de la journée/).first().waitFor();
await d.waitForTimeout(800);
await d.screenshot({ path: `${D}106-sessions-caisse.png` });
console.log("📸 20, 21, 22, 24b, 80, 106");
await b.close();
