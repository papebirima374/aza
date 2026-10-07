// Captures : une caisse par personne, écran comptoir (services à gauche, ticket à droite),
// prestataire sur chaque ligne, toutes les caisses du jour, feuilles. Base de TEST (noms fictifs).
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
async function jeton(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
const api = async (tok, corps) => (await fetch(S + "/api/gestion/caisse", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(corps) })).json();
const [acc, man] = await Promise.all(["accueil", "manager"].map((n) => jeton(`${n}@test.aza`)));
// Deux caisses ouvertes en même temps : l'accueil et le manager.
await api(acc, { action: "ouvrir", fond: 20000 });
await api(man, { action: "ouvrir", fond: 10000 });
const vente = (tok, lignes, paiements, cliente) => api(tok, { action: "encaisser", lignes, paiements, ...(cliente ? { cliente } : {}) });
await vente(acc, [{ id: "soins-visage--hydrafacial", praticienne: "test-estheticienne-1" }], [{ mode: "especes", montant: 50000 }], { nom: "Awa Diop (test)", telephone: "77 000 01 01" });
await vente(acc, [{ id: "onglerie--vernis-permanent", praticienne: "test-prothesiste-1" }], [{ mode: "orange-money", montant: 5000 }], { nom: "Fatou Ndiaye (test)", telephone: "77 000 01 02" });
await vente(man, [{ id: "tresses--knotless-mi-long", praticienne: "test-coiffeuse-1" }], [{ mode: "wave", montant: 20000 }], { nom: "Mariama Sow (test)", telephone: "77 000 01 03" });
await vente(man, [{ id: "massage--massage-a-la-pierre-chaude", praticienne: "test-masseuse" }], [{ mode: "especes", montant: 25000 }], { nom: "Khady Fall (test)", telephone: "77 000 01 04" });

const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function page(tel, viewport = { width: 390, height: 844 }) {
  const p = await (await b.newContext({ viewport, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
  await p.goto(S + "/gestion");
  await p.fill("input[type=tel]", tel);
  await p.fill("input[type=password]", "AzaTest2026!");
  await p.click("button[type=submit]");
  await p.locator('a[href="/gestion/mon-compte"]').waitFor();
  return p;
}
// L'accueil sur ordinateur : une cliente de passage, sans rendez-vous.
const pc = await page("77 900 00 03", { width: 1366, height: 820 });
await pc.goto(S + "/gestion/caisse");
await pc.getByText("Ma caisse est ouverte").waitFor();
await pc.getByRole("button", { name: /^Soins visage$/ }).click().catch(() => {});
await pc.waitForTimeout(500);
await pc.locator("#comptoir").scrollIntoViewIfNeeded();
await pc.getByPlaceholder(/Chercher une prestation/).fill("hydra");
await pc.getByRole("button", { name: /Hydrafacial/ }).first().click();
await pc.getByPlaceholder(/Chercher une prestation/).fill("");
await pc.getByRole("button", { name: /^Onglerie$/ }).click().catch(() => {});
await pc.waitForTimeout(400);
const selects = pc.locator("#comptoir select");
await selects.nth(0).selectOption("test-estheticienne-1");
await pc.evaluate(() => window.scrollTo(0, document.querySelector("#comptoir").getBoundingClientRect().top + window.scrollY - 90));
await pc.waitForTimeout(800);
await pc.screenshot({ path: `${D}101-caisse-ecran.png` });

// Sur téléphone : « Fait par » sous chaque ligne.
const a = await page("77 900 00 03");
await a.goto(S + "/gestion/caisse");
await a.getByText("Ma caisse est ouverte").waitFor();
await a.getByPlaceholder(/Chercher une prestation/).fill("vernis perm");
await a.getByRole("button", { name: /Vernis permanent/ }).first().click();
await a.getByPlaceholder(/Chercher une prestation/).fill("hydra");
await a.getByRole("button", { name: /Hydrafacial/ }).first().click();
await a.locator("#comptoir select").nth(0).selectOption("test-prothesiste-1");
await a.locator("#comptoir select").nth(1).selectOption("test-estheticienne-1");
await a.evaluate(() => window.scrollTo(0, document.querySelector("#comptoir").getBoundingClientRect().top + window.scrollY - 70));
await a.waitForTimeout(800);
await a.screenshot({ path: `${D}102-caisse-fait-par.png` });

// L'accueil clôture sa caisse : 20 000 + 45 000 (Hydrafacial, monnaie rendue) = 65 000.
const ja = await (await fetch(S + "/api/gestion/caisse", { headers: { Authorization: `Bearer ${acc}` } })).json();
await api(acc, { action: "cloturer", compte: ja.totaux.especesAttendues - 500, justification: "Pièce de 500 F manquante" });

// La feuille de l'accueil (la sienne seulement).
await a.goto(S + "/gestion/caisse/feuille");
await a.getByText("FEUILLE DE CAISSE").waitFor();
await a.waitForTimeout(1000);
await a.screenshot({ path: `${D}97-feuille-personne.png`, fullPage: true });

// La direction : toutes les caisses du jour, puis la feuille de toute la journée.
const d = await page("77 900 00 01");
await d.goto(S + "/gestion/caisse");
const bloc = d.getByText(/Toutes les caisses du jour/);
await bloc.waitFor();
await bloc.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 80));
await d.waitForTimeout(800);
await d.screenshot({ path: `${D}103-caisses-du-jour.png` });
await d.goto(S + "/gestion/caisse/feuille");
await d.getByText("FEUILLE DE CAISSE").waitFor();
await d.waitForTimeout(1000);
await d.screenshot({ path: `${D}96-feuille-caisse.png`, fullPage: true });
await d.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
await d.emulateMedia({ media: "print" });
await d.pdf({ path: `${D}../feuille-80mm.pdf`, preferCSSPageSize: true, printBackground: true });
// Le rendez-vous libre : cliente retrouvée dans le fichier, deux prestataires, déjà faite.
await a.goto(S + "/gestion");
await a.getByRole("button", { name: /Nouveau rendez-vous/ }).click();
await a.getByLabel("Nom de la cliente").fill("Awa");
await a.locator("aside").getByRole("button", { name: /Awa Diop \(test\)/ }).click();
const cherche = a.getByPlaceholder(/Chercher : knotless/);
await cherche.fill("hydra");
await a.locator("aside").getByRole("button", { name: /Hydrafacial/ }).first().click();
await cherche.fill("vernis perm");
await a.locator("aside").getByRole("button", { name: /Vernis permanent/ }).first().click();
await a.getByLabel(/Qui fait Hydrafacial/).selectOption("test-estheticienne-1");
await a.getByLabel(/Qui fait Vernis permanent/).selectOption("test-prothesiste-1");
await a.getByLabel("Heure").fill("08:30");
await a.waitForTimeout(600);
await a.locator("aside").screenshot({ path: `${D}104-rdv-passage.png` });
console.log("📸 96, 97, 101, 102, 103, 104 ; 🧾 feuille 80 mm de la journée");
await b.close();
