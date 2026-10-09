// Captures : le centre de notifications (la cloche). Base de TEST (noms fictifs).
// À lancer juste après verifier-notifications.mjs (caisse oubliée, anniversaire, rendez-vous en ligne).
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const D = new URL("./captures/", import.meta.url).pathname;
const tok = async (e) => (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: "AzaTest2026!", returnSecureToken: true }) })).json()).idToken;
const acc = await tok("accueil@test.aza");
const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
const date = `${p.year}-${p.month}-${p.day}`, min = Number(p.hour) * 60 + Number(p.minute);
// Une cliente en retard, une cliente à encaisser
await fetch(S + "/api/gestion/comptoir", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${acc}` }, body: JSON.stringify({ action: "libre", date, debut: min - 10, lignes: [{ id: "tresses--knotless-mi-long", praticienne: "test-coiffeuse-1" }], nom: "Khady Fall (test)", telephone: "77 000 01 04", dejaFaite: false }) });
await fetch(S + "/api/gestion/comptoir", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${acc}` }, body: JSON.stringify({ action: "libre", date, debut: min - 60, lignes: [{ id: "onglerie--vernis-permanent", praticienne: "test-prothesiste-1" }], nom: "Fatou Ndiaye (test)", telephone: "77 000 01 02", dejaFaite: true }) });
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
async function page(tel, viewport) {
  const pg = await (await b.newContext({ viewport, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
  await pg.goto(S + "/gestion"); await pg.fill("input[type=tel]", tel); await pg.fill("input[type=password]", "AzaTest2026!"); await pg.click("button[type=submit]");
  await pg.locator('a[href="/gestion/mon-compte"]').waitFor(); return pg;
}
const d = await page("77 900 00 01", { width: 390, height: 844 });
await d.goto(S + "/gestion/caisse");
await d.getByRole("button", { name: /Notifications/ }).waitFor();
await d.waitForTimeout(4000);
// L'alerte « c'est l'heure » s'affiche aussi : on la range pour voir la cloche.
for (let i = 0; i < 10 && (await d.getByRole("button", { name: "Plus tard" }).count()); i++) await d.getByRole("button", { name: "Plus tard" }).click();
await d.getByRole("button", { name: /Notifications/ }).click();
await d.waitForTimeout(800);
console.log("badge :", await d.getByRole("button", { name: /Notifications/ }).getAttribute("aria-label"));
await d.screenshot({ path: `${D}110-cloche.png` });
const pc = await page("77 900 00 01", { width: 1366, height: 820 });
await pc.goto(S + "/gestion/caisse/sessions");
await pc.waitForTimeout(4000);
for (let i = 0; i < 10 && (await pc.getByRole("button", { name: "Plus tard" }).count()); i++) await pc.getByRole("button", { name: "Plus tard" }).click();
await pc.getByRole("button", { name: /Notifications/ }).click();
await pc.waitForTimeout(800);
await pc.screenshot({ path: `${D}111-cloche-ordinateur.png` });
console.log("📸 110, 111");
await b.close();
