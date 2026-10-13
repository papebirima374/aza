// Captures : import d'une liste dans le catalogue et case « Sur le site » (données FICTIVES).
import { writeFileSync } from "node:fs";
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
const fichier = "/tmp/claude-0/exemple-import.csv";
writeFileSync(
  fichier,
  "﻿Nom;Famille;Prix;Type;Sur le site\nMassage relaxant;Massages;20000;Prestation;oui\nSoin du visage exemple;Soins du visage;25000;Prestation;oui\nOffre exemple fête des mères;Offres & forfaits;30000;Prestation;non\nParfum exemple;Parfums;15000;Produit;oui\nRobe exemple;Habillement;35000;Produit;oui\nSoin du visage exemple;Soins du visage;20000;Prestation;oui\n",
);
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
await p.goto(S + "/gestion");
await p.fill("input[type=tel]", "77 900 00 01");
await p.fill("input[type=password]", "AzaTest2026!");
await p.click("button[type=submit]");
await p.locator('a[href="/gestion/mon-compte"]').waitFor();
await p.goto(S + "/gestion/catalogue");
await p.waitForTimeout(2500);
for (let i = 0; i < 6 && (await p.getByRole("button", { name: "Plus tard" }).count()); i++) await p.getByRole("button", { name: "Plus tard" }).first().click();
await p.getByRole("button", { name: /Importer une liste/ }).click();
await p.setInputFiles("input[type=file]", fichier);
await p.getByText(/Déjà présentes, laissées de côté/).waitFor();
await p.getByText(/Déjà présentes, laissées de côté/).click();
await p.waitForTimeout(500);
await p.evaluate(() => window.scrollTo({ behavior: "instant", top: document.querySelector("section").getBoundingClientRect().top + window.scrollY - 110 }));
await p.waitForTimeout(400);
await p.screenshot({ path: `${D}129-import-catalogue.png` });
await p.getByRole("button", { name: "Fermer" }).first().click();
await p.getByRole("button", { name: /^Massages/ }).click();
await p.waitForTimeout(400);
await p.getByText("Massage relaxant").first().evaluate((e) => window.scrollTo({ behavior: "instant", top: e.getBoundingClientRect().top + window.scrollY - 140 }));
await p.waitForTimeout(400);
await p.screenshot({ path: `${D}130-sur-le-site.png` });
console.log("📸 129, 130");
await b.close();
