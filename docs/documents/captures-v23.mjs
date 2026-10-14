// Captures : plusieurs prestataires sur un soin, et l'accès « Prendre ses propres rendez-vous »
// (données FICTIVES). À lancer sur la base de test fraîchement remplie (seed).
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
const entrer = async (tel) => {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
  p.on("dialog", (d) => d.accept());
  await p.goto(S + "/gestion");
  await p.fill("input[type=tel]", tel);
  await p.fill("input[type=password]", "AzaTest2026!");
  await p.click("button[type=submit]");
  await p.locator('a[href="/gestion/mon-compte"]').waitFor();
  await p.waitForTimeout(2000);
  await fermer(p);
  return p;
};

// 135 : la direction donne l'accès (Équipe → Modifier → Accès)
const d = await entrer("77 900 00 01");
await d.goto(S + "/gestion/equipe");
await d.waitForTimeout(2000);
await d.locator("li", { hasText: "Coiffeuse test 1" }).first().getByRole("button").filter({ hasText: /Modifier|✏️/ }).first().click();
await d.getByText("🔐 Accès").first().click();
await d.getByText("Prendre ses propres rendez-vous").click();
await d.getByText("Prendre ses propres rendez-vous").evaluate((e) => e.scrollIntoView({ block: "center" }));
await d.waitForTimeout(600);
await fermer(d);
await d.screenshot({ path: D + "135-acces-rdv-perso.png" });
await d.getByRole("button", { name: /Enregistrer/ }).first().click();
await d.waitForTimeout(1500);

// 136 : la coiffeuse prend son rendez-vous depuis Ma journée, avec une collègue
const c = await entrer("77 900 00 04");
await c.getByRole("button", { name: /Nouveau rendez-vous/ }).click();
await c.getByRole("heading", { name: "Nouveau rendez-vous" }).waitFor();
await c.locator("aside input").first().fill("Mariama Exemple");
await c.locator("aside input[type=tel]").first().fill("77 000 66 01");
await c.fill('aside input[placeholder*="herch"]', "knotless");
await c.getByRole("button", { name: /Knotless/i }).first().click();
await c.waitForTimeout(500);
await c.getByRole("button", { name: "+ Une autre prestataire sur ce soin" }).click();
await c.locator("aside li").first().scrollIntoViewIfNeeded();
await fermer(c);
await c.screenshot({ path: D + "136-mon-rendez-vous.png" });

// 137 : à la caisse, deux prestataires sur le même soin
const m = await entrer("77 900 00 02");
await m.goto(S + "/gestion/caisse");
await m.waitForTimeout(2500);
await fermer(m);
const fond = m.locator('input[placeholder="ex. 20 000"]');
if (await fond.isVisible().catch(() => false)) {
  await fond.fill("20000");
  await m.getByRole("button", { name: /Ouvrir/ }).last().click();
  await m.waitForTimeout(1500);
}
await m.fill("input[type=search]", "gainage");
await m.getByRole("button", { name: /Gainage/ }).first().click();
await m.waitForTimeout(500);
await m.locator('select[aria-label^="Qui fait"]').first().selectOption({ label: "Prothésiste test 1" });
await m.getByRole("button", { name: "+ Une autre prestataire sur ce soin" }).first().click();
await m.locator('select[aria-label^="2e prestataire"]').first().selectOption({ label: "Prothésiste test 2" });
await m.getByText("2 prestataires : le soin est partagé").first().evaluate((e) => e.scrollIntoView({ block: "center" }));
await m.waitForTimeout(600);
await fermer(m);
await m.screenshot({ path: D + "137-caisse-deux-prestataires.png" });
await b.close();
console.log("captures 135 à 137 faites");
