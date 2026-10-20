// Captures : menu des boissons par code QR (données FICTIVES). Base de test fraîchement remplie.
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const fermer = async (p) => {
  for (let i = 0; i < 6; i++) {
    const x = p.getByRole("button", { name: /^(Compris|Plus tard)$/ }).first();
    if (!(await x.isVisible().catch(() => false))) break;
    await x.click().catch(() => {});
    await p.waitForTimeout(300);
  }
};
const page = async () => {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
  p.on("dialog", (d) => d.accept());
  return p;
};
const entrer = async (tel) => {
  const p = await page();
  await p.goto(S + "/gestion");
  await p.fill("input[type=tel]", tel);
  await p.fill("input[type=password]", "AzaTest2026!");
  await p.click("button[type=submit]");
  await p.locator('a[href="/gestion/mon-compte"]').waitFor();
  await p.waitForTimeout(2000);
  await fermer(p);
  return p;
};
const largeur = (p) => p.evaluate(() => document.documentElement.scrollWidth);

// 138 : le code QR dans Réglages
const d = await entrer("77 900 00 01");
await d.goto(S + "/gestion/reglages#boissons");
await d.getByRole("heading", { name: /Menu des boissons/ }).waitFor();
await d.getByRole("heading", { name: /Menu des boissons/ }).evaluate((e) => e.scrollIntoView({ block: "start" }));
await d.waitForTimeout(800);
await fermer(d);
await d.screenshot({ path: D + "138-qr-boissons.png" });
const lien = await d.getByRole("link", { name: "Voir le menu" }).getAttribute("href");
console.log("largeur réglages", await largeur(d));

// 139 : la cliente choisit sa boisson
const c = await page();
await c.goto(lien);
await c.getByRole("button", { name: "Thé" }).waitFor();
await c.fill("input[autocomplete=given-name]", "Mariama");
await c.fill("input[type=text][inputmode=tel], input[inputmode=tel]", "77 000 66 01");
await c.getByRole("button", { name: "Thé" }).click();
await c.getByText(/Thé : c.est noté/).waitFor();
await c.waitForTimeout(500);
await c.screenshot({ path: D + "139-menu-cliente.png" });
console.log("largeur menu", await largeur(c));

// 140 : l'accueil reçoit la demande
const a = await entrer("77 900 00 03");
await a.getByText(/Boisson.* à servir/).first().waitFor({ timeout: 30000 });
await fermer(a);
await a.waitForTimeout(500);
await a.screenshot({ path: D + "140-alerte-boisson.png" });
await a.getByRole("button", { name: "✓ Servie" }).first().click();
await a.waitForTimeout(1000);
console.log("après servie :", await a.getByText(/Boisson.* à servir/).count());
await b.close();
