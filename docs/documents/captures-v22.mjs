// Captures : historique de la prestataire, fiche du mois, listes raccourcies (données FICTIVES).
// À lancer juste après scripts/verifier-prestataires.mjs (même base de test).
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
const jeton = async (email) =>
  (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }) })).json()).idToken;
const dir = await jeton("direction@test.aza");
const post = (chemin, corps) => fetch(S + chemin, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${dir}` }, body: JSON.stringify(corps) });
// 60 clientes et 40 robes FICTIVES pour montrer les listes raccourcies
const prenoms = ["Aminata", "Binta", "Coumba", "Dieynaba", "Fatou", "Khady", "Mariama", "Ndeye", "Oumou", "Rokhaya", "Sokhna", "Yacine"];
await post("/api/gestion/clientes", { action: "importer", essai: false, lignes: Array.from({ length: 60 }, (_, i) => ({ nom: `${prenoms[i % 12]} Exemple ${i + 1}`, telephone: `7700099${String(i).padStart(2, "0")}` })) });
await post("/api/gestion/catalogue", { action: "importer", essai: false, lignes: Array.from({ length: 40 }, (_, i) => ({ nom: `${["Robe", "Boubou", "Chemise", "Ensemble"][i % 4]} exemple ${i + 1}`, familleId: "habillement", prix: 10000 + i * 1000, produit: true, site: true })) });
await new Promise((r) => setTimeout(r, 16000));

const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const entrer = async (tel, w = 390, h = 844) => {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
  await p.goto(S + "/gestion");
  await p.fill("input[type=tel]", tel);
  await p.fill("input[type=password]", "AzaTest2026!");
  await p.click("button[type=submit]");
  await p.locator('a[href="/gestion/mon-compte"]').waitFor();
  await p.waitForTimeout(2000);
  for (let i = 0; i < 6 && (await p.getByRole("button", { name: "Plus tard" }).count()); i++) await p.getByRole("button", { name: "Plus tard" }).first().click();
  return p;
};
// 131 : Mon historique (coiffeuse)
const c = await entrer("77 900 00 04");
await c.goto(S + "/gestion/historique");
await c.getByText(/soins?$/).first().waitFor();
await c.waitForTimeout(600);
await c.screenshot({ path: `${D}131-mon-historique.png` });
// 132 : fiche du mois (direction)
const d = await entrer("77 900 00 01");
const mois = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date()).slice(0, 7);
await d.goto(`${S}/gestion/rapports/prestataire?p=test-coiffeuse-1&mois=${mois}`);
await d.getByText("Chiffre des soins").waitFor();
await d.waitForTimeout(800);
await d.screenshot({ path: `${D}132-fiche-du-mois.png` });
// 133 : clientes, lettres et « afficher plus »
await d.goto(S + "/gestion/clientes");
await d.getByRole("button", { name: "Tout", exact: true }).waitFor();
await d.waitForTimeout(500);
await d.screenshot({ path: `${D}133-clientes-lettres.png` });
// 134 : catalogue, famille Habillement compacte
await d.goto(S + "/gestion/catalogue");
await d.waitForTimeout(1500);
await d.getByRole("button", { name: /^Habillement/ }).click();
await d.waitForTimeout(500);
await d.getByRole("button", { name: /^Habillement/ }).evaluate((e) => window.scrollTo({ behavior: "instant", top: e.getBoundingClientRect().top + window.scrollY - 120 }));
await d.waitForTimeout(400);
await d.screenshot({ path: `${D}134-catalogue-compact.png` });
console.log("📸 131 à 134");
await b.close();
