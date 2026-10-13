// Captures du pointage : borne, écran « Pointer », suivi de la direction (base de TEST).
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const D = new URL("./captures/", import.meta.url).pathname;
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
const calmer = async (p) => {
  await p.waitForTimeout(2000);
  for (let i = 0; i < 6 && (await p.getByRole("button", { name: "Plus tard" }).count()); i++) await p.getByRole("button", { name: "Plus tard" }).first().click();
};
// 126 : la borne (tablette en paysage), connectée en direction
const borne = await entrer("77 900 00 01", 1180, 820);
await borne.goto(S + "/gestion/pointage/borne");
await calmer(borne);
await borne.getByText(/Nouveau code dans/).waitFor();
// 127 : la coiffeuse pointe en tapant le code
const code = (await borne.locator("p.font-mono").first().textContent()).replace(/\D/g, "");
const tel = await entrer("77 900 00 04", 390, 844);
await tel.goto(S + "/gestion/pointer");
await tel.fill("#code-pointage", code);
await tel.getByRole("button", { name: "Valider" }).click();
await tel.getByText(/(Entrée|Sortie) à/).first().waitFor();
await tel.waitForTimeout(500);
await tel.screenshot({ path: `${D}127-pointer.png` });
await borne.waitForTimeout(5500);
await borne.screenshot({ path: `${D}126-borne.png` });
await borne.locator("svg[aria-label='QR code de pointage']").screenshot({ path: "/tmp/claude-0/qr-borne.png" });
// 128 : le suivi (manager, téléphone)
const m = await entrer("77 900 00 02", 390, 844);
await m.goto(S + "/gestion/pointage");
await calmer(m);
await m.getByText(/à l'institut maintenant/).waitFor();
await m.waitForTimeout(800);
await m.screenshot({ path: `${D}128-pointages.png` });
console.log("📸 126, 127, 128 ; code", code);
await b.close();
