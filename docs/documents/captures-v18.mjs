// Captures de l'onglet Dépenses (base de TEST, noms fictifs).
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
const jeton = async (email) =>
  (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }) })).json()).idToken;
const appel = (tok, chemin, corps) => fetch(S + chemin, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(corps) });
const [acc, dir] = await Promise.all([jeton("accueil@test.aza"), jeton("direction@test.aza")]);
await appel(acc, "/api/gestion/caisse", { action: "ouvrir", fond: 20000 });
await appel(acc, "/api/gestion/caisse", { action: "encaisser", lignes: [{ id: "onglerie--gainage", praticienne: "test-prothesiste-1" }], paiements: [{ mode: "especes", montant: 15000 }] });
await appel(dir, "/api/gestion/caisse", { action: "ouvrir", fond: 0 });
await appel(dir, "/api/gestion/caisse", { action: "encaisser", lignes: [{ id: "onglerie--vernis-permanent", praticienne: "test-prothesiste-1" }], paiements: [{ mode: "wave", montant: 5000 }] });
await appel(acc, "/api/gestion/depenses", { action: "ajouter", montant: 1500, categorie: "transport", libelle: "Taxi pour le marché", mode: "especes", deLaCaisse: true });
await appel(dir, "/api/gestion/depenses", { action: "ajouter", montant: 3000, categorie: "repas", libelle: "Petit-déjeuner de l'équipe", mode: "wave" });

const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const entrer = async (tel, w, h) => {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
  await p.goto(S + "/gestion");
  await p.fill("input[type=tel]", tel);
  await p.fill("input[type=password]", "AzaTest2026!");
  await p.click("button[type=submit]");
  await p.locator('a[href="/gestion/mon-compte"]').waitFor();
  return p;
};
// 123 : l'accueil note une dépense (montant, type, mode, tiroir)
const p = await entrer("77 900 00 03", 390, 844);
await p.goto(S + "/gestion/depenses");
await p.getByText("+ Nouvelle dépense").waitFor();
await p.fill("#depense-montant", "2500");
await p.getByRole("button", { name: /Produits et fournitures/ }).click();
await p.fill("#depense-libelle", "2 bidons d'eau");
await p.waitForTimeout(400);
await p.evaluate(() => window.scrollTo(0, document.querySelector("form").getBoundingClientRect().top + window.scrollY - 70));
await p.waitForTimeout(400);
await p.screenshot({ path: `${D}123-depenses.png` });
await p.getByRole("button", { name: "Enregistrer la dépense" }).click();
await p.getByText(/enregistrée/).waitFor();
// 124 : la direction, chiffres du jour et bilan du mois
const d = await entrer("77 900 00 01", 390, 844);
await d.goto(S + "/gestion/depenses");
await d.getByText(/Bilan de/).waitFor();
await d.waitForTimeout(1200);
await d.screenshot({ path: `${D}124-depenses-jour.png` });
await d.evaluate(() => window.scrollTo({ behavior: "instant", left: 0, top: [...document.querySelectorAll("h2")].find((h) => h.textContent.startsWith("Bilan")).getBoundingClientRect().top + window.scrollY - 110 }));
await d.waitForTimeout(1500);
await d.screenshot({ path: `${D}124-depenses-mois.png` });
console.log("📸 123, 124");
await b.close();
