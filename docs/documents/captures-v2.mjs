// Captures des nouveautés (cartes cadeaux, Couture, perruques sur mesure) — base de TEST.
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());

async function jeton(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
const api = async (chemin, tok, corps) => {
  const r = await fetch(S + chemin, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: corps ? JSON.stringify(corps) : undefined });
  return r.json().catch(() => ({}));
};
const [dir, acc] = await Promise.all(["direction", "accueil"].map((n) => jeton(`${n}@test.aza`)));
await api("/api/gestion/boutique", dir, { action: "ouverture", ouverte: true });
await api("/api/gestion/boutique", dir, { action: "zones", zones: [{ nom: "Point-E / Fann", prix: 1000 }, { nom: "Plateau", prix: 1500 }] });
await api("/api/gestion/caisse", acc, { action: "ouvrir", fond: 20000 });
await api("/api/boutique/devis", null, { type: "Frontale", texture: "Ondulée", longueur: "20 pouces", couleur: "1B naturel", tourDeTete: "56 cm", pourQuand: "Mariage le 12 décembre", remarque: "Raie au milieu, bébé cheveux", nom: "Coumba Sy (test)", telephone: "77 000 55 40" });
await api("/api/boutique/commandes", null, { lignes: [{ article: "couture:C-12:L", quantite: 1 }], mode: "retrait", nom: "Aïssatou Ba (test)", telephone: "77 000 55 41", paiement: "sur-place" });

async function nouvelle() {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" });
  const p = await ctx.newPage();
  p.on("dialog", (d) => d.accept());
  return p;
}
async function cap(p, nom, plein = false) {
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${D}${nom}.png`, fullPage: plein });
  console.log("📸", nom);
}
async function connecter(tel) {
  const p = await nouvelle();
  await p.goto(S + "/gestion");
  await p.fill("input[type=tel]", tel);
  await p.fill("input[type=password]", "AzaTest2026!");
  await p.click("button[type=submit]");
  await p.locator('a[href="/gestion/mon-compte"]').waitFor();
  await p.waitForTimeout(1000);
  return p;
}
const bas = (p, sel) => p.locator(sel).first().evaluate((e) => e.scrollIntoView({ block: "start" }));

// ——— Cartes cadeaux (accueil) ———
const a = await connecter("77 900 00 03");
await a.goto(S + "/gestion/cartes");
await a.getByRole("button", { name: "+ Vendre une carte" }).click();
await a.getByRole("button", { name: "20 000 F" }).click();
await a.getByLabel(/Pour/).fill("Awa Diop (test)");
await a.getByLabel(/De la part de/).fill("Fatou (test)");
await a.getByLabel(/Petit message/).fill("Joyeux anniversaire !");
await a.getByLabel(/Téléphone/).fill("77 000 55 30");
await a.getByRole("button", { name: /Wave/ }).click();
await bas(a, "h2:has-text('Vendre une carte')");
await a.evaluate(() => window.scrollBy(0, -80));
await cap(a, "50-carte-vente");
await a.getByRole("button", { name: /Encaisser la carte/ }).click();
await a.getByText(/Carte vendue/).waitFor();
await cap(a, "51-carte-vendue");
const code = (await a.locator("p.font-mono").first().textContent()).trim();
await a.goto(S + "/gestion/caisse");
await a.getByRole("button", { name: "+ Nouvelle vente" }).click();
await a.locator("input[type=search]").fill("vernis perm");
await a.getByRole("button", { name: /Vernis permanent/ }).first().click();
await a.getByRole("button", { name: /Carte cadeau/ }).click();
await a.getByLabel(/Code de la carte/).fill(code);
await a.getByRole("button", { name: "Vérifier la carte" }).click();
await a.getByText(/payés avec la carte/).waitFor();
await bas(a, "h3:has-text('Paiement')");
await a.evaluate(() => window.scrollBy(0, -80));
await cap(a, "52-caisse-carte");
await a.getByRole("button", { name: /^Encaisser/ }).click();
await a.waitForTimeout(1500);
await a.goto(S + "/gestion/cartes/" + code);
await a.getByText(/Solde/).waitFor();
await cap(a, "53-fiche-carte");

// ——— Commandes : devis perruque + commande couture ———
await a.goto(S + "/gestion/commandes");
await a.getByText("D-000001").waitFor();
await a.getByRole("button", { name: /Proposer un prix/ }).click();
await a.getByLabel("Prix (F)").fill("85000");
await a.getByLabel("Délai").fill("10 jours");
await a.getByRole("button", { name: "Enregistrer le prix" }).click();
await a.getByText(/Prix proposé :/).waitFor();
await cap(a, "58-devis-gestion");
await bas(a, "h2:has-text('Commandes de la boutique')");
await cap(a, "59-commande-couture");

// ——— Catalogue : prix des modèles Couture (direction) ———
const d = await connecter("77 900 00 01");
await d.goto(S + "/gestion/catalogue");
await d.getByText("Catalogue et prix").first().waitFor();
await d.fill("input[type=search]", "modèle c-0");
await d.waitForTimeout(800);
await cap(d, "60-catalogue-couture");

// ——— Ce que voit la cliente ———
const c = await nouvelle();
await c.goto(S + "/boutique/couture");
await c.waitForTimeout(800);
await bas(c, "ul");
await c.evaluate(() => window.scrollBy(0, -90));
await cap(c, "54-couture-liste");
await c.goto(S + "/boutique/couture/C-14");
await c.getByRole("button", { name: "M", exact: true }).click();
await c.evaluate(() => window.scrollTo(0, 560));
await cap(c, "55-couture-modele");
await c.getByRole("button", { name: "Commander", exact: true }).click();
await c.waitForURL("**/boutique/panier");
await c.waitForTimeout(1200);
await cap(c, "56-panier-couture");
await c.goto(S + "/boutique/perruques-sur-mesure");
await c.getByRole("button", { name: "Frontale" }).click();
await c.getByRole("button", { name: "Ondulée" }).click();
await c.evaluate(() => window.scrollTo(0, 330));
await cap(c, "57-perruques");
await c.goto(S + "/boutique");
await c.waitForTimeout(800);
await cap(c, "61-boutique");
await b.close();
