// Captures : carte de fidélité par passages (réglages, carte à tampons, alerte cadeau, ticket). Base de TEST.
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
async function jeton(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
const api = async (chemin, tok, corps) => (await fetch(S + chemin, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: corps ? JSON.stringify(corps) : undefined })).json();
const [dir, acc] = await Promise.all(["direction", "accueil"].map((n) => jeton(`${n}@test.aza`)));
await api("/api/gestion/reglages", dir, { action: "fidelite", actif: true, gain: "passage", seuil: 10, recompense: "cadeau", cadeau: "Un soin ou un produit, au choix de l'institut" });
await api("/api/gestion/caisse", acc, { action: "ouvrir", fond: 20000 });
const vente = (cliente, extra = {}) => api("/api/gestion/caisse", acc, { action: "encaisser", lignes: [{ id: "onglerie--vernis-permanent" }], paiements: [{ mode: "especes", montant: 5000 }], cliente, ...extra });
const awa = { nom: "Awa Diop (test)", telephone: "77 000 01 01" };
const fatou = { nom: "Fatou Ndiaye (test)", telephone: "77 000 01 02" };
for (let i = 0; i < 4; i++) await vente(awa);
for (let i = 0; i < 9; i++) await vente(fatou);

const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => pw.chromium.launch());
async function page(tel) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
  await p.goto(S + "/gestion");
  await p.fill("input[type=tel]", tel);
  await p.fill("input[type=password]", "AzaTest2026!");
  await p.click("button[type=submit]");
  await p.locator('a[href="/gestion/mon-compte"]').waitFor();
  await p.waitForTimeout(800);
  return p;
}
const cap = async (p, n, opts = {}) => { await p.waitForTimeout(900); await p.screenshot({ path: `${D}${n}.png`, ...opts }); console.log("📸", n); };
const haut = (p, loc, marge) => loc.evaluate((e, m) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - m), marge);

const r = await page("77 900 00 01");
await r.goto(S + "/gestion/reglages#fidelite");
await r.getByText("💗 Carte de fidélité").waitFor();
await haut(r, r.getByText("💗 Carte de fidélité"), 90);
await cap(r, "77-reglages-fidelite");

const c = await page("77 900 00 03");
const nouvelle = async (cl) => {
  await c.goto(S + "/gestion/caisse");
  await c.getByRole("button", { name: "+ Nouvelle vente" }).click();
  await c.locator("input[type=search]").fill("vernis permanent");
  await c.getByRole("button", { name: /Vernis permanent/ }).first().click();
  await c.getByLabel(/Nom de la cliente/).fill(cl.nom);
  await c.getByLabel(/Téléphone/).first().fill(cl.telephone);
};
await nouvelle(awa);
await c.getByText("avec ce passage").waitFor();
await haut(c, c.getByText("avec ce passage"), 330);
await cap(c, "75-caisse-fidelite");
await nouvelle(fatou);
await c.getByRole("alert").filter({ hasText: "Remettez-lui son cadeau" }).waitFor();
await c.getByPlaceholder(/Quel cadeau/).fill("pose vernis");
await c.getByRole("button", { name: /Vernis simple/ }).last().click().catch(async () => {
  await c.getByPlaceholder(/Quel cadeau/).fill("vernis");
  await c.getByRole("button", { name: /Vernis/ }).last().click();
});
await c.getByRole("button", { name: /^Espèces/ }).click().catch(() => {});
await haut(c, c.getByRole("alert").filter({ hasText: "Remettez-lui" }), 200);
await cap(c, "89-caisse-cadeau");
await c.getByRole("button", { name: /cadeau remis/ }).click();
await c.getByText("N'oublie").or(c.getByText("oubliez pas le cadeau")).first().waitFor();
await cap(c, "90-caisse-cadeau-confirmation", { clip: { x: 0, y: 0, width: 390, height: 844 } });
await c.getByRole("link", { name: /Voir \/ imprimer le reçu/ }).click();
await c.getByText("CADEAU OFFERT").waitFor();
await haut(c, c.getByText("CARTE DE FIDÉLITÉ"), 420);
await cap(c, "76-recu-fidelite");
await b.close();
