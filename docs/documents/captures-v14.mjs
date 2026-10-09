// Captures : alerte à l'heure du rendez-vous (accueil), décaler en cas de retard, envoi de la
// recette en PDF. Base de TEST (noms fictifs).
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
const tok = async (e) => (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: "AzaTest2026!", returnSecureToken: true }) })).json()).idToken;
const post = async (t, url, c) => (await fetch(S + url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(c) })).json();
const acc = await tok("accueil@test.aza");
const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
const date = `${p.year}-${p.month}-${p.day}`;
const maintenant = Number(p.hour) * 60 + Number(p.minute);
await post(acc, "/api/gestion/comptoir", { action: "libre", date, debut: maintenant - 2, lignes: [{ id: "tresses--knotless-mi-long", praticienne: "test-coiffeuse-1" }], nom: "Khady Fall (test)", telephone: "77 000 01 04", dejaFaite: false });
await post(acc, "/api/gestion/caisse", { action: "ouvrir", fond: 20000 });
await post(acc, "/api/gestion/caisse", { action: "encaisser", lignes: [{ id: "onglerie--vernis-permanent", praticienne: "test-prothesiste-1" }], paiements: [{ mode: "especes", montant: 5000 }] });
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function page(tel, viewport = { width: 390, height: 844 }) {
  const pg = await (await b.newContext({ viewport, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
  await pg.goto(S + "/gestion"); await pg.fill("input[type=tel]", tel); await pg.fill("input[type=password]", "AzaTest2026!"); await pg.click("button[type=submit]");
  await pg.locator('a[href="/gestion/mon-compte"]').waitFor(); return pg;
}
const a = await page("77 900 00 03");
await a.getByText(/c'est l'heure de/).waitFor({ timeout: 60000 });
for (let i = 0; i < 8 && !(await a.getByText(/c'est l'heure de Khady/).count()); i++) {
  await a.getByRole("button", { name: "Plus tard" }).click();
  await a.waitForTimeout(300);
}
await a.waitForTimeout(400);
await a.screenshot({ path: `${D}107-alerte-heure.png` });
await a.getByRole("button", { name: /Retard : décaler/ }).click();
await a.waitForTimeout(400);
await a.screenshot({ path: `${D}108-alerte-decaler.png` });
await a.goto(S + "/gestion/caisse/feuille");
await a.getByText("FEUILLE DE CAISSE").waitFor();
await a.waitForTimeout(600);
await a.screenshot({ path: `${D}109-recette-whatsapp.png` });
console.log("📸 107, 108, 109");
await b.close();
