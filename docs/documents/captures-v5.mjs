// Captures : caisse — choisir une cliente du fichier, retirer une ligne de la vente. Base de TEST.
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => pw.chromium.launch());
const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "accueil@test.aza", password: "AzaTest2026!", returnSecureToken: true }),
});
const acc = (await r.json()).idToken;
const api = async (corps) => (await fetch(S + "/api/gestion/caisse", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${acc}` }, body: JSON.stringify(corps) })).json();
await api({ action: "ouvrir", fond: 20000 });
await api({ action: "encaisser", lignes: [{ id: "onglerie--vernis-permanent" }], paiements: [{ mode: "especes", montant: 5000 }], cliente: { nom: "Awa Diop (test)", telephone: "77 000 01 01" } });

const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
await p.goto(S + "/gestion");
await p.fill("input[type=tel]", "77 900 00 03");
await p.fill("input[type=password]", "AzaTest2026!");
await p.click("button[type=submit]");
await p.locator('a[href="/gestion/mon-compte"]').waitFor();
await p.goto(S + "/gestion/caisse");
await p.getByRole("button", { name: "+ Nouvelle vente" }).click();
for (const [q, n] of [["hydrafacial", /Hydrafacial/], ["tresses natte", /Tresses natte/]]) {
  await p.locator("input[type=search]").fill(q);
  await p.getByRole("button", { name: n }).first().click();
}
const cap = async (n) => { await p.waitForTimeout(700); await p.screenshot({ path: `${D}${n}.png` }); console.log("📸", n); };
await p.getByText("Nouvelle vente").evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 20));
await cap("79-caisse-retirer");
await p.getByRole("button", { name: /Retirer Tresses natte/ }).click();
const reste = await p.locator("ul li").filter({ hasText: "Tresses natte" }).count();
console.log("Lignes « Tresses natte » restantes :", reste);
const nom = p.getByLabel(/Nom de la cliente/);
await nom.fill("awa");
await p.getByRole("button", { name: /Awa Diop \(test\)/ }).waitFor();
await nom.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 200));
await cap("80-caisse-cliente");
await p.getByRole("button", { name: /Awa Diop \(test\)/ }).click();
console.log("Téléphone rempli :", await p.getByLabel(/Téléphone/).first().inputValue());
await nom.fill("");
await nom.fill("01 01");
console.log("Recherche par numéro :", await p.getByRole("button", { name: /Awa Diop \(test\)/ }).count());
await b.close();
