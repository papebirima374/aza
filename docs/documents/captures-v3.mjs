// Captures : Collection (nouveau modèle), fiche produit façon maison de couture, livraison à l'international.
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
import { readFileSync } from "node:fs";
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
const PUB = new URL("../../public/images/couture/", import.meta.url).pathname;
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => pw.chromium.launch());
async function jeton(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
const api = async (chemin, tok, corps) => (await fetch(S + chemin, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: corps ? JSON.stringify(corps) : undefined })).json();
const dir = await jeton("direction@test.aza");
await api("/api/gestion/boutique", dir, { action: "ouverture", ouverte: true });
await api("/api/gestion/boutique", dir, { action: "zones", zones: [{ nom: "Point-E / Fann", prix: 1000 }, { nom: "Plateau", prix: 1500 }, { nom: "France", prix: 25000, international: true }, { nom: "États-Unis", prix: null, international: true }] });
// Un modèle d'exemple, avec des photos déjà présentes (base de TEST).
const m = await api("/api/gestion/collection", dir, { action: "creer", nom: "Robe Ndeye (exemple)", prix: 45000, description: "Exemple de fiche : tissu, coupe, entretien…\nFaite sur commande à l'atelier Anna Zen.", tailles: ["S", "M", "L", "XL", "Sur mesure"], couleurs: ["Bleu roi", "Noir"] });
for (const f of ["modele-14.webp", "modele-01.webp", "modele-23.webp"]) {
  await api("/api/gestion/collection", dir, { action: "photo-ajout", id: m.id, image: `data:image/webp;base64,${readFileSync(PUB + f).toString("base64")}` });
}
await api("/api/gestion/collection", dir, { action: "guide-tailles", texte: "Exemple — à remplacer par les mesures de l'atelier :\nS : poitrine …, taille …, hanches …\nM : …" });
await new Promise((r) => setTimeout(r, 16000));

const tel = async () => (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
const cap = async (p, nom) => { await p.waitForTimeout(900); await p.screenshot({ path: `${D}${nom}.png` }); console.log("📸", nom); };
const aller = async (p, y) => { await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y); await p.waitForTimeout(700); };

const c = await tel();
await c.goto(S + "/boutique/couture"); await c.waitForTimeout(1200);
await cap(c, "64-collection-grille");
await c.goto(S + `/boutique/couture/${m.ref}`, { waitUntil: "networkidle" }); await c.waitForTimeout(2000);
await cap(c, "65-fiche-modele");
await c.getByRole("button", { name: "Bleu roi" }).click();
await c.getByRole("button", { name: "M", exact: true }).click();
await aller(c, 560);
await cap(c, "66-fiche-options");
await c.getByRole("button", { name: "Commander", exact: true }).click();
await c.waitForURL("**/boutique/panier"); await c.waitForTimeout(1200);
await c.getByText("🌍 Livraison à l'international").click();
await c.selectOption("select", { label: "France · 25 000 F" });
await c.getByLabel(/Adresse complète/).fill("12 rue de la Paix, 75002 Paris, France");
const y = await c.getByText("Comment récupérer votre commande").evaluate((e) => e.getBoundingClientRect().top + window.scrollY - 80);
await aller(c, y);
await cap(c, "67-panier-international");

const ordi = await (await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, locale: "fr-FR" })).newPage();
await ordi.goto(S + `/boutique/couture/${m.ref}`, { waitUntil: "networkidle" }); await ordi.waitForTimeout(2500);
await ordi.getByRole("button", { name: "Bleu roi" }).click();
await ordi.waitForTimeout(300);
await ordi.getByRole("button", { name: "M", exact: true }).click();
await ordi.getByRole("button", { name: "M", exact: true, pressed: true }).waitFor();
await ordi.mouse.move(0, 0);
await ordi.waitForTimeout(400);
await ordi.screenshot({ path: `${D}68-fiche-ordinateur.png` }); console.log("📸 68");

// Écran Collection (direction)
const g = await tel();
await g.goto(S + "/gestion");
await g.fill("input[type=tel]", "77 900 00 01");
await g.fill("input[type=password]", "AzaTest2026!");
await g.click("button[type=submit]");
await g.locator('a[href="/gestion/mon-compte"]').waitFor();
await g.goto(S + "/gestion/collection");
await g.getByText("Robe Ndeye (exemple)").first().waitFor();
await cap(g, "69-collection-admin");
await g.getByText("Robe Ndeye (exemple)").first().click();
await aller(g, 380);
await cap(g, "70-collection-modele");
await g.goto(S + "/gestion/commandes");
await g.getByRole("button", { name: /Boutique en ligne/ }).click();
await g.getByText("🌍 Livraison à l'international").waitFor();
const y2 = await g.getByText("🛵 Livraison à Dakar").evaluate((e) => e.getBoundingClientRect().top + window.scrollY - 80);
await aller(g, y2);
await cap(g, "71-zones-international");
await b.close();
