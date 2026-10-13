// Capture : Équipe → Modifier, une caissière qui fait aussi des prestations (base de TEST).
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
await p.goto(S + "/gestion");
await p.fill("input[type=tel]", "77 900 00 01");
await p.fill("input[type=password]", "AzaTest2026!");
await p.click("button[type=submit]");
await p.locator('a[href="/gestion/mon-compte"]').waitFor();
await p.goto(S + "/gestion/equipe");
await p.waitForTimeout(2500);
for (let i = 0; i < 6 && (await p.getByRole("button", { name: "Plus tard" }).count()); i++) await p.getByRole("button", { name: "Plus tard" }).first().click();
const ligne = p.locator("li", { hasText: "Accueil test" }).first();
await ligne.getByRole("button", { name: /Modifier/ }).click();
await ligne.getByText("💅 Fait aussi des prestations").click();
await p.locator("li", { hasText: "Accueil test" }).first().getByText("Onglerie", { exact: true }).first().click();
await p.waitForTimeout(400);
await p.evaluate(() => {
  const li = [...document.querySelectorAll("li")].find((l) => l.textContent.includes("Accueil test") && l.textContent.includes("Fait aussi des prestations"));
  const el = [...li.querySelectorAll("label")].find((l) => l.textContent.includes("Fait aussi des prestations"));
  window.scrollTo({ behavior: "instant", top: el.getBoundingClientRect().top + window.scrollY - 330 });
});
await p.waitForTimeout(500);
await p.screenshot({ path: `${D}125-equipe-cumul.png` });
console.log("📸 125");
await b.close();
