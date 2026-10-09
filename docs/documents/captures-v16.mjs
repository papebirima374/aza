// Capture : l'ordre des colonnes de l'agenda (écran Équipe). Base de TEST (noms fictifs).
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
await p.goto(S + "/gestion"); await p.fill("input[type=tel]", "77 900 00 01"); await p.fill("input[type=password]", "AzaTest2026!"); await p.click("button[type=submit]");
await p.locator('a[href="/gestion/mon-compte"]').waitFor();
await p.goto(S + "/gestion/equipe");
const titre = p.getByText("Ordre dans l'agenda");
await titre.waitFor();
await p.getByRole("button", { name: /Monter Masseuse test/ }).click();
await p.waitForTimeout(300);
for (let i = 0; i < 10 && (await p.getByRole("button", { name: "Plus tard" }).count()); i++) await p.getByRole("button", { name: "Plus tard" }).click();
await titre.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 120));
await p.waitForTimeout(500);
await p.screenshot({ path: `${D}112-ordre-agenda.png` });
console.log("📸 112");
await b.close();
