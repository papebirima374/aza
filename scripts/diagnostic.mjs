// Diagnostic complet du site (base de TEST) : chaque page, sur téléphone (390 px) et
// ordinateur (1280 px). Relève : code HTTP, erreurs JavaScript, requêtes en échec, page
// plus large que l'écran, images cassées ou sans texte alternatif, titre / description /
// h1, poids transféré, petites cibles tactiles, liens internes cassés.
// Prérequis : émulateurs + seed, site de test sur le port 3100 (build NEXT_PUBLIC_EMULATEURS=1).
// Usage : node scripts/diagnostic.mjs [http://localhost:3100] > diagnostic.json

import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const S = process.argv[2] ?? "http://localhost:3100";
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => pw.chromium.launch());

const PUBLIQUES = [
  "/", "/prestations", "/prestations/institut", "/prestations/onglerie", "/prestations/epilation", "/prestations/coiffure",
  "/forfaits", "/reservation", "/boutique", "/boutique/couture", "/boutique/couture/C-01", "/boutique/perruques-sur-mesure",
  "/boutique/panier", "/institut", "/contact", "/mentions-legales", "/hors-ligne", "/avis/lien-de-test-inexistant", "/page-qui-n-existe-pas",
];
const GESTION = {
  "77 900 00 01": ["/gestion/jour", "/gestion/rapports", "/gestion/avis", "/gestion/activite", "/gestion", "/gestion/clientes", "/gestion/caisse", "/gestion/caisse/feuille", "/gestion/cartes", "/gestion/commandes", "/gestion/collection", "/gestion/collection/C-01", "/gestion/collection/nouveau", "/gestion/stock", "/gestion/catalogue", "/gestion/photos", "/gestion/equipe", "/gestion/reglages", "/gestion/mon-compte"],
  "77 900 00 03": ["/gestion", "/gestion/caisse", "/gestion/caisse/feuille", "/gestion/commandes"],
  "77 900 00 04": ["/gestion"],
  "77 900 00 06": ["/gestion/rapports", "/gestion/caisse", "/gestion/stock"],
};

const resultats = [];
const liens = new Set();

async function examiner(page, chemin, largeur) {
  const erreurs = [];
  const echecs = [];
  const surErreur = (m) => m.type() === "error" && erreurs.push(m.text().slice(0, 200));
  const surPage = (e) => erreurs.push(`JS : ${e.message.slice(0, 200)}`);
  const surReponse = (r) => {
    if (r.url().startsWith(S) && r.status() >= 400 && !r.url().includes("page-qui-n-existe-pas")) echecs.push(`${r.status()} ${r.url().replace(S, "")}`);
  };
  page.on("console", surErreur);
  page.on("pageerror", surPage);
  page.on("response", surReponse);
  let statut = 0;
  try {
    const r = await page.goto(S + chemin, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
    statut = r?.status() ?? 0;
  } catch (e) {
    erreurs.push(`chargement : ${e.message.slice(0, 120)}`);
  }
  await page.waitForTimeout(1200);
  // Descendre la page pour charger les images « lazy ».
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
  const m = await page.evaluate((largeur) => {
    const nav = performance.getEntriesByType("navigation")[0];
    const ressources = performance.getEntriesByType("resource");
    const petites = [...document.querySelectorAll("a[href], button, input, select, textarea, summary")].filter((e) => {
      const r = e.getBoundingClientRect();
      const st = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && (r.height < 32 || r.width < 32) && !e.closest("p, li li, footer, dd") && e.tagName !== "INPUT";
    });
    const debord = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > largeur + 2).slice(0, 3);
    return {
      titre: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim().slice(0, 60)),
      lang: document.documentElement.lang,
      largeur: document.documentElement.scrollWidth,
      debord: debord.map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 50)}`),
      imagesCassees: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.slice(-60)),
      sansAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
      poidsKo: Math.round(((nav?.transferSize ?? 0) + ressources.reduce((s, x) => s + (x.transferSize || 0), 0)) / 1024),
      imagesKo: Math.round(ressources.filter((x) => x.initiatorType === "img").reduce((s, x) => s + (x.transferSize || 0), 0) / 1024),
      chargementMs: Math.round(nav?.loadEventEnd ?? 0),
      petitesCibles: petites.slice(0, 5).map((e) => `${e.tagName.toLowerCase()} « ${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30)} » ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`),
      nbPetites: petites.length,
      liens: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => h.startsWith("/") && !h.startsWith("//")),
    };
  }, largeur);
  m.liens.forEach((l) => liens.add(l.split("#")[0]));
  delete m.liens;
  page.off("console", surErreur);
  page.off("pageerror", surPage);
  page.off("response", surReponse);
  console.error(largeur, chemin, statut);
  resultats.push({ chemin, largeur, statut, erreurs: [...new Set(erreurs)], echecs: [...new Set(echecs)], ...m });
}

for (const largeur of [390, 1280]) {
  const ctx = await b.newContext({ viewport: { width: largeur, height: largeur === 390 ? 844 : 860 }, locale: "fr-FR" });
  const page = await ctx.newPage();
  for (const c of PUBLIQUES) await examiner(page, c, largeur);
  for (const [tel, chemins] of Object.entries(GESTION)) {
    const g = await (await b.newContext({ viewport: { width: largeur, height: 860 }, locale: "fr-FR" })).newPage();
    await g.goto(S + "/gestion");
    await g.fill("input[type=tel]", tel);
    await g.fill("input[type=password]", "AzaTest2026!");
    await g.click("button[type=submit]");
    await g.locator('a[href="/gestion/mon-compte"]').waitFor();
    for (const c of chemins) await examiner(g, c, largeur);
    await g.context().close();
  }
  await ctx.close();
}

// Liens internes trouvés sur les pages : chacun doit répondre.
const cassés = [];
for (const l of liens) {
  if (l.startsWith("/api/") || l.startsWith("/gestion")) continue;
  const r = await fetch(S + l, { redirect: "manual" });
  if (r.status >= 400) cassés.push(`${r.status} ${l}`);
}
await b.close();
console.log(JSON.stringify({ le: new Date().toISOString(), pages: resultats, liensVerifies: liens.size, liensCasses: cassés }, null, 1));
