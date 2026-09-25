// Captures : menu « Plus », rapports, avis clientes, ticket de caisse 80 mm. Base de TEST (noms fictifs).
// Écrit d'abord un mois de tickets fictifs dans l'émulateur, pour que les rapports aient de quoi montrer.
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const D = new URL("./captures/", import.meta.url).pathname;
if (!EMU.includes("demo-aza")) throw new Error("Base de test seulement.");
async function jeton(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
const api = async (chemin, tok, corps) => (await fetch(S + chemin, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: corps ? JSON.stringify(corps) : undefined })).json();
const [dir, acc] = await Promise.all(["direction", "accueil"].map((n) => jeton(`${n}@test.aza`)));
const AUJ = new Date().toISOString().slice(0, 10);

// Valeurs Firestore REST
const v = (x) =>
  x === null ? { nullValue: null } : typeof x === "string" ? { stringValue: x } : typeof x === "boolean" ? { booleanValue: x } : Number.isInteger(x) ? { integerValue: String(x) } : Array.isArray(x) ? { arrayValue: { values: x.map(v) } } : { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, v(y)])) } };
const ecrire = (chemin, obj) => fetch(`${EMU}/${chemin}`, { method: "PATCH", headers: OWNER, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(obj).map(([k, y]) => [k, v(y)])) }) });

const prats = (await (await fetch(`${EMU}/praticiennes?pageSize=50`, { headers: OWNER })).json()).documents.map((d) => ({ id: d.name.split("/").pop(), nom: d.fields.nom.stringValue }));
const SOINS = [
  ["soins-visage--hydrafacial", "Hydrafacial", 45000],
  ["onglerie--vernis-permanent", "Vernis permanent", 5000],
  ["onglerie--vernis-french", "Vernis french", 7000],
  ["onglerie--vernis-simple", "Vernis simple", 3000],
  ["tresses--knotless-mi-long", "Knotless mi-long", 20000],
  ["massage--massage-a-la-pierre-chaude", "Massage à la pierre chaude", 25000],
];
const PRODUITS = [
  ["locks--lot-de-10-tiges-locks-6-pouces", "Lot de 10 tiges locks 6 pouces", 6000],
  ["locks--lot-de-10-tiges-locks-8-pouces", "Lot de 10 tiges locks 8 pouces", 8000],
];
const CLIENTES = ["Awa Diop (test)", "Fatou Ndiaye (test)", "Mariama Sow (test)", "Khady Fall (test)", "Aminata Ba (test)", "Coumba Sy (test)", "Ndèye Mbaye (test)"];
let graine = 7;
const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
const choisir = (t) => t[Math.floor(hasard() * t.length)];
const MODES = ["especes", "wave", "wave", "orange-money", "especes", "carte"];
let n = 500;
const premierJour = Number(AUJ.slice(8, 10));
for (let j = 1; j < premierJour; j++) {
  const date = `${AUJ.slice(0, 8)}${String(j).padStart(2, "0")}`;
  if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) continue; // fermé le dimanche
  const combien = 3 + Math.floor(hasard() * (new Date(`${date}T12:00:00Z`).getUTCDay() === 6 ? 9 : 6));
  for (let k = 0; k < combien; k++) {
    n++;
    const soin = choisir(SOINS);
    const lignes = [{ id: soin[0], nom: soin[1], type: "prestation", prixUnitaire: soin[2], quantite: 1, montant: soin[2] }];
    if (hasard() < 0.25) {
      const p = choisir(PRODUITS);
      lignes.push({ id: p[0], nom: p[1], type: "produit", prixUnitaire: p[2], quantite: 1, montant: p[2] });
    }
    const total = lignes.reduce((s, l) => s + l.montant, 0);
    const prat = choisir(prats.slice(0, 5));
    const rdv = `historique-${n}`;
    const tel = `77 000 60 ${String(CLIENTES.indexOf(choisir(CLIENTES)) + 10)}`;
    const nom = CLIENTES[Number(tel.slice(-2)) - 10];
    const heure = (9 + Math.floor(hasard() * 10)) * 60 + Math.floor(hasard() * 4) * 15;
    await ecrire(`rendezVous/${rdv}`, { date, debut: heure - 60, fin: heure, statut: "encaisse", source: hasard() < 0.35 ? "site" : "accueil", prestations: [{ id: soin[0], nom: soin[1], prix: soin[2] }], affectations: [{ prestation: soin[0], praticiennes: [prat.id] }], praticiennesIds: [prat.id], cliente: { id: tel.replace(/\D/g, ""), nom, telephone: tel } });
    await ecrire(`tickets/historique-${n}`, { numero: n, reference: `T-000${n}`, type: "vente", date, heure, lignes, sousTotal: total, total, paiements: [{ mode: choisir(MODES), montant: total }], rendu: 0, credit: 0, cliente: { nom, telephone: tel }, rendezVous: rdv, par: { uid: "x", nom: "Accueil test" } });
  }
}
// Quelques absences
for (let i = 0; i < 4; i++) await ecrire(`rendezVous/abs-${i}`, { date: `${AUJ.slice(0, 8)}0${3 + i * 2}`, debut: 600, fin: 660, statut: "absente", source: "site", prestations: [], affectations: [], praticiennesIds: [prats[i].id], cliente: { id: "x", nom: "x", telephone: "x" } });

// Avis déposés comme une cliente, par le lien du reçu.
const avis = [
  [5, "Accueil chaleureux et un Hydrafacial parfait, ma peau est lumineuse. Je reviendrai !", true, "Fatou"],
  [5, "Très professionnelle, mes tresses tiennent super bien.", true, "Mariama"],
  [4, "Très bon massage, juste un peu d'attente à l'arrivée.", true, "Khady"],
  [5, "", true, "Awa"],
  [2, "J'ai attendu 30 minutes alors que j'avais rendez-vous.", false, "Coumba"],
];
for (const [i, [note, commentaire, publier, prenom]] of avis.entries()) await api(`/api/avis/historique-${520 + i * 7}`, null, { note, commentaire, publier, prenom });
await api("/api/gestion/avis", dir, { action: "publier", id: "historique-520" });
await api("/api/gestion/avis", dir, { action: "publier", id: "historique-527" });

// Un ticket du jour, pour le reçu 80 mm.
await api("/api/gestion/reglages", dir, { action: "fidelite", actif: true, tranche: 1000, seuil: 50, valeur: 5000 });
await api("/api/gestion/caisse", acc, { action: "ouvrir", fond: 20000 });
const t = await api("/api/gestion/caisse", acc, {
  action: "encaisser",
  lignes: [{ id: "soins-visage--hydrafacial" }, { id: "onglerie--vernis-permanent", quantite: 2 }],
  paiements: [{ mode: "wave", montant: 40000 }, { mode: "especes", montant: 20000 }],
  cliente: { nom: "Fatou Ndiaye (test)", telephone: "77 000 60 11" },
});

const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => pw.chromium.launch());
async function page(tel, l = 390, h = 844) {
  const p = await (await b.newContext({ viewport: { width: l, height: h }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
  await p.goto(S + "/gestion");
  await p.fill("input[type=tel]", tel);
  await p.fill("input[type=password]", "AzaTest2026!");
  await p.click("button[type=submit]");
  await p.locator('a[href="/gestion/mon-compte"]').waitFor();
  await p.waitForTimeout(800);
  return p;
}
const cap = async (p, nom, opts = {}) => { await p.waitForTimeout(900); await p.screenshot({ path: `${D}${nom}.png`, ...opts }); console.log("📸", nom); };

const m = await page("77 900 00 01");
await m.getByRole("button", { name: "Plus ▾" }).click();
await cap(m, "81-menu-plus", { clip: { x: 0, y: 0, width: 390, height: 520 } });
await m.goto(S + "/gestion/rapports");
await m.getByText("Recette jour par jour").waitFor();
await cap(m, "82-rapports");
await m.getByText("👥 L'équipe").click();
await m.getByText("👥 L'équipe").evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 130));
await cap(m, "83-rapports-equipe");
await m.goto(S + "/gestion/avis");
await m.getByText("Avis des clientes").waitFor();
await m.getByRole("button", { name: /^Tous/ }).click();
await cap(m, "84-avis-gestion");

const large = await page("77 900 00 01", 1100, 900);
await large.goto(S + "/gestion/rapports");
await large.getByText("Recette jour par jour").waitFor();
await large.locator("[data-rapport] details").evaluateAll((ds) => ds.forEach((d) => (d.open = true)));
await cap(large, "85-rapports-large", { fullPage: true });

const c = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
await c.goto(`${S}/avis/${t.id}`);
await c.getByRole("radio", { name: /5 étoiles/ }).click();
await c.locator("textarea").fill("Super accueil, merci à toute l'équipe !");
await cap(c, "86-avis-cliente");

const r = await page("77 900 00 03");
await r.goto(`${S}/gestion/caisse/ticket/${t.id}`);
await r.getByText("Votre avis compte").waitFor();
await cap(r, "87-ticket-80mm", { fullPage: true });
await r.getByRole("button", { name: /Réglage de l'imprimante/ }).click();
await r.getByRole("button", { name: "Voir le ticket de réglage" }).click();
await cap(r, "88-ticket-reglage", { fullPage: true });
// Le PDF de l'impression : la page doit faire 80 mm de large et la hauteur du ticket.
await r.getByRole("button", { name: "Revoir le ticket" }).click();
await r.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
await r.emulateMedia({ media: "print" });
await r.pdf({ path: `${D}../ticket-80mm.pdf`, preferCSSPageSize: true, printBackground: true });
console.log("🧾 ticket-80mm.pdf");
await b.close();
