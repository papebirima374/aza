// Captures : feuille de caisse du soir (ticket 80 mm et A4). Base de TEST (noms fictifs).
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
await api(acc, { action: "ouvrir", fond: 20000 });
const vente = (tok, id, paiements, cliente) => api(tok, { action: "encaisser", lignes: [{ id }], paiements, ...(cliente ? { cliente } : {}) });
await vente(acc, "soins-visage--hydrafacial", [{ mode: "especes", montant: 50000 }], { nom: "Awa Diop (test)", telephone: "77 000 01 01" });
await vente(acc, "onglerie--vernis-permanent", [{ mode: "orange-money", montant: 5000 }], { nom: "Fatou Ndiaye (test)", telephone: "77 000 01 02" });
const t3 = await vente(man, "tresses--knotless-mi-long", [{ mode: "wave", montant: 20000 }], { nom: "Mariama Sow (test)", telephone: "77 000 01 03" });
await vente(man, "massage--massage-a-la-pierre-chaude", [{ mode: "especes", montant: 10000 }, { mode: "credit", montant: 15000 }], { nom: "Khady Fall (test)", telephone: "77 000 01 04" });
await api(man, { action: "annuler", id: t3.id, motif: "Erreur de prestation" });
// Hydrafacial payé 50 000 pour 45 000 : 5 000 rendus. Tiroir : 20 000 + 45 000 + 10 000 = 75 000.
await api(man, { action: "cloturer", compte: 74500, justification: "Pièce de 500 F manquante" });

const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
await p.goto(S + "/gestion");
await p.fill("input[type=tel]", "77 900 00 02");
await p.fill("input[type=password]", "AzaTest2026!");
await p.click("button[type=submit]");
await p.locator('a[href="/gestion/mon-compte"]').waitFor();
await p.goto(S + "/gestion/caisse");
const lien = p.getByRole("link", { name: /Imprimer la feuille de caisse/ });
await lien.waitFor();
await lien.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 150));
await p.waitForTimeout(800);
await p.screenshot({ path: `${D}95-caisse-bouton-feuille.png` });
await lien.click();
await p.getByText("FEUILLE DE CAISSE").waitFor();
await p.waitForTimeout(1000);
await p.screenshot({ path: `${D}96-feuille-caisse.png`, fullPage: true });
await p.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
await p.emulateMedia({ media: "print" });
await p.pdf({ path: `${D}../feuille-80mm.pdf`, preferCSSPageSize: true, printBackground: true });
await p.emulateMedia({ media: "screen" });
await p.getByLabel(/feuille A4/).check();
await p.evaluate(() => {
  const s = document.getElementById("page-ticket") ?? document.head.appendChild(Object.assign(document.createElement("style"), { id: "page-ticket" }));
  s.textContent = "@page { size: A4; margin: 15mm }";
});
await p.emulateMedia({ media: "print" });
await p.pdf({ path: `${D}../feuille-A4.pdf`, preferCSSPageSize: true, printBackground: true });
console.log("📸 95, 96 ; 🧾 feuille-80mm.pdf, feuille-A4.pdf");
await b.close();
