// Captures d'écran du guide (base de TEST, noms fictifs), en taille téléphone.
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
import { mkdirSync } from "node:fs";
const { chromium } = pw;
const S = "http://localhost:3100";
const DOSSIER = new URL("./captures/", import.meta.url).pathname;
mkdirSync(DOSSIER, { recursive: true });
const b = await chromium.launch();
const echecs = [];

async function nouvelle(largeur = 390, hauteur = 844) {
  const ctx = await b.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, locale: "fr-FR" });
  const p = await ctx.newPage();
  p.on("dialog", (d) => (d.type() === "prompt" ? d.accept("Moussa") : d.accept()));
  return p;
}
async function cap(p, nom, { plein = false, haut = null } = {}) {
  await p.waitForTimeout(600);
  if (haut !== null) await p.evaluate((y) => window.scrollTo(0, y), haut);
  await p.screenshot({ path: `${DOSSIER}${nom}.png`, fullPage: plein });
  console.log("📸", nom);
}
async function etape(nom, fn) {
  try {
    await fn();
  } catch (e) {
    echecs.push(nom);
    console.log("❌", nom, e.message.split("\n")[0]);
  }
}
async function connecter(tel) {
  const p = await nouvelle();
  await p.goto(S + "/gestion");
  await p.fill("input[type=tel]", tel);
  await p.fill("input[type=password]", "AzaTest2026!");
  await p.click("button[type=submit]");
  await p.locator('a[href="/gestion/mon-compte"]').waitFor();
  await p.waitForTimeout(1200);
  return p;
}
const vers = async (p, chemin, texte) => {
  await p.goto(S + chemin);
  if (texte) await p.getByText(texte).first().waitFor({ timeout: 15000 });
  await p.waitForTimeout(800);
};
const monter = (p, loc) => loc.first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120));

// ——— Site public ———
const pub = await nouvelle();
await etape("accueil", async () => {
  await vers(pub, "/", "Offrez-vous");
  await cap(pub, "01-accueil");
  await monter(pub, pub.getByText("Nos quatre univers"));
  await cap(pub, "02-accueil-univers");
});
await etape("univers", async () => {
  await vers(pub, "/prestations/onglerie", "L'Onglerie");
  await cap(pub, "03-prestations-onglerie");
});
await etape("reservation", async () => {
  await vers(pub, "/reservation?p=onglerie--vernis-permanent", "Prendre rendez-vous");
  await cap(pub, "04-resa-choix");
  await pub.getByRole("button", { name: "Continuer" }).click();
  const d = new Date(Date.now() + 2 * 86400000);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  await pub.fill('input[type="date"]', d.toISOString().slice(0, 10));
  await pub.getByText("À quelle heure").waitFor();
  await pub.waitForTimeout(1500);
  await pub.locator('input[name="creneau"]').nth(2).locator("..").click();
  await monter(pub, pub.getByText("Quel jour"));
  await cap(pub, "05-resa-heure");
  await pub.getByRole("button", { name: "Continuer" }).click();
  await pub.getByLabel("Votre nom").fill("Coumba Sy (test)");
  await pub.getByLabel("Votre téléphone").fill("77 000 55 23");
  await cap(pub, "06-resa-coordonnees");
  await pub.getByRole("button", { name: "Confirmer le rendez-vous" }).click();
  await pub.waitForTimeout(2500);
  await cap(pub, "07-resa-confirmee", { haut: 0 });
});
await etape("boutique", async () => {
  await vers(pub, "/boutique", "Huile de ricin");
  await cap(pub, "08-boutique");
  await pub.getByText("Huile de ricin 100 ml").first().click();
  await pub.getByRole("button", { name: "Ajouter au panier" }).click();
  await cap(pub, "09-boutique-produit");
  await pub.getByRole("link", { name: "Voir le panier" }).click();
  await pub.getByText("Comment récupérer").waitFor();
  await pub.getByLabel("Votre nom").fill("Ndeye Diop (test)");
  await pub.getByLabel("Votre téléphone (WhatsApp)").fill("77 000 55 24");
  await monter(pub, pub.getByText("Comment récupérer"));
  await cap(pub, "10-panier");
});

// ——— Gestion ———
await etape("connexion", async () => {
  const p = await nouvelle();
  await p.goto(S + "/gestion");
  await p.getByText("Votre numéro de téléphone").waitFor();
  await p.fill("input[type=tel]", "77 900 00 03");
  await p.fill("input[type=password]", "motdepasse");
  await cap(p, "11-connexion");
});

const dir = await connecter("77 900 00 01");
await etape("jour", async () => {
  await vers(dir, "/gestion/jour", "Recette encaissée");
  await cap(dir, "12-aujourdhui");
  await monter(dir, dir.getByText("L'équipe"));
  await cap(dir, "12b-aujourdhui-equipe");
});
await etape("agenda", async () => {
  await vers(dir, "/gestion", "Par praticienne");
  await cap(dir, "13-agenda");
  await dir.getByText("Awa Diop (test)").first().click();
  await dir.getByText("Avec qui").waitFor();
  await cap(dir, "14-rdv-detail");
  await dir.getByRole("button", { name: "Changer" }).first().click();
  await dir.waitForTimeout(800);
  await monter(dir, dir.getByText("Avec qui"));
  await cap(dir, "14b-rdv-changer");
  await dir.keyboard.press("Escape");
});
await etape("nouveau-rdv", async () => {
  await vers(dir, "/gestion", "Par praticienne");
  await dir.getByRole("button", { name: "+ Nouveau rendez-vous" }).click();
  const panneau = dir.locator('aside[aria-label="Nouveau rendez-vous"]');
  await panneau.locator("input[type=search]").fill("knotless");
  await dir.waitForTimeout(600);
  await panneau.getByRole("button", { name: /Knotless mi-long/ }).first().click();
  await dir.waitForTimeout(1500);
  await cap(dir, "15-nouveau-rdv");
});
await etape("rappels", async () => {
  await vers(dir, "/gestion", "Par praticienne");
  await dir.getByRole("button", { name: /Rappels de demain/ }).click();
  await dir.waitForTimeout(800);
  await cap(dir, "16-rappels");
});

// Praticienne : Ma journée, puis « J'ai fini » → la caisse est prévenue
const acc = await connecter("77 900 00 03");
await vers(acc, "/gestion/caisse", "À encaisser");
const coif = await connecter("77 900 00 04");
await etape("majournee", async () => {
  await coif.getByText("Bonjour").waitFor();
  await cap(coif, "17-ma-journee");
  await coif.getByRole("button", { name: /J'ai fini/ }).first().click();
  await coif.waitForTimeout(1200);
  await cap(coif, "18-ma-journee-fini");
});
await etape("alerte", async () => {
  await acc.getByText(/a fini/).waitFor({ timeout: 15000 });
  await cap(acc, "19-caisse-alerte");
});
await etape("caisse", async () => {
  await acc.getByRole("link", { name: "Encaisser" }).last().click();
  await acc.getByText(/Ticket —/).waitFor();
  await acc.fill("input[type=search]", "ricin");
  await acc.getByRole("button", { name: /Huile de ricin/ }).first().click();
  await cap(acc, "20-caisse-ticket", { haut: 0 });
  await acc.getByRole("button", { name: /Espèces/ }).first().click();
  await acc.locator('input[inputmode="numeric"]').last().waitFor();
  await monter(acc, acc.getByText("Paiement", { exact: true }));
  await cap(acc, "21-caisse-paiement");
  await acc.getByRole("button", { name: /^Encaisser / }).click();
  await acc.getByText(/enregistré/).waitFor();
  await cap(acc, "22-caisse-confirmation", { haut: 0 });
  await acc.getByRole("link", { name: "Voir / imprimer le reçu" }).click();
  await acc.getByText("Merci de votre visite").waitFor();
  await cap(acc, "23-recu");
  await vers(acc, "/gestion/caisse", "Bilan et clôture");
  await monter(acc, acc.getByText("Tickets du jour"));
  await cap(acc, "24-caisse-tickets");
  await monter(acc, acc.getByText("Bilan et clôture"));
  await cap(acc, "24b-caisse-bilan");
});
await etape("clientes", async () => {
  await vers(acc, "/gestion/clientes", "Awa Diop");
  await cap(acc, "25-clientes");
  await vers(acc, "/gestion/clientes/770000101", "Fiche technique beauté");
  await cap(acc, "26-fiche-cliente");
  await vers(acc, "/gestion/clientes/770005522", "Doit");
  await monter(acc, acc.getByText(/^Doit/));
  await cap(acc, "27-fiche-credit");
});
await etape("commandes", async () => {
  await vers(acc, "/gestion/commandes", "C-000001");
  await cap(acc, "28-commandes");
  await acc.getByRole("button", { name: /Bon de préparation/ }).first().click();
  await acc.getByText("Bon de préparation").first().waitFor();
  await cap(acc, "29-bon-preparation");
});
const man = await connecter("77 900 00 02");
await etape("stock", async () => {
  await vers(man, "/gestion/stock", "Valeur au coût");
  await cap(man, "30-stock");
  await man.getByRole("button", { name: "📦 Réception" }).first().click();
  await man.waitForTimeout(400);
  await cap(man, "31-stock-reception", { haut: 250 });
  await vers(man, "/gestion/stock", "Valeur au coût");
  await man.getByRole("button", { name: /[Bb]outique/ }).first().click();
  await man.waitForTimeout(400);
  await monter(man, man.getByText("🛍️ Boutique en ligne"));
  await cap(man, "32-stock-boutique");
  await vers(man, "/gestion/stock", "Valeur au coût");
  await man.getByRole("button", { name: /Soins/ }).click();
  await man.waitForTimeout(400);
  await cap(man, "33-stock-soins");
});
await etape("catalogue", async () => {
  await vers(dir, "/gestion/catalogue", "Catalogue et prix");
  await dir.fill("input[type=search]", "vernis");
  await dir.waitForTimeout(600);
  await cap(dir, "34-catalogue");
  await vers(dir, "/gestion/photos", "Bandeau de l'accueil");
  await cap(dir, "35-photos-site");
});
await etape("equipe", async () => {
  await vers(dir, "/gestion/equipe", "Membres");
  await cap(dir, "36-equipe");
  const f = dir.locator("form");
  await f.locator("input").first().fill("Aïda Onglerie");
  await f.getByText("Praticienne", { exact: true }).click();
  await f.locator('input[inputmode="tel"]').fill("77 000 55 25");
  await f.getByText("Onglerie", { exact: true }).click();
  await monter(dir, f.getByText("Ajouter une personne"));
  await cap(dir, "37-equipe-ajout");
  await f.getByRole("button", { name: "Créer le compte" }).click();
  await dir.getByText("Compte créé pour").waitFor();
  await cap(dir, "38-equipe-identifiants", { haut: 0 });
  const ligne = dir.locator("li", { hasText: "Coiffeuse test 1" });
  await ligne.getByRole("button", { name: "Modifier" }).click();
  await dir.waitForTimeout(500);
  await monter(dir, ligne);
  await cap(dir, "39-equipe-modifier");
});
await etape("reglages", async () => {
  await vers(dir, "/gestion/reglages", "Réservation en ligne");
  await cap(dir, "40-reglages");
  await dir.getByRole("button", { name: /Massages/ }).first().click();
  await monter(dir, dir.getByText("Durées des prestations"));
  await dir.waitForTimeout(500);
  await cap(dir, "41-reglages-durees");
  await vers(dir, "/gestion/reglages#donnees", "Sauvegarde et remise à zéro");
  await monter(dir, dir.getByText("Sauvegarde et remise à zéro"));
  await cap(dir, "42-sauvegarde");
});
await etape("mon-compte", async () => {
  await vers(coif, "/gestion/mon-compte", "Changer mon mot de passe");
  await cap(coif, "43-mon-compte");
});
await etape("hors-ligne", async () => {
  await vers(acc, "/gestion/caisse", "À encaisser");
  await acc.getByRole("button", { name: "+ Nouvelle vente" }).click();
  await acc.fill("input[type=search]", "crème");
  await acc.getByRole("button", { name: /Crème coiffante/ }).first().click();
  await acc.context().setOffline(true);
  await acc.getByRole("button", { name: /Espèces/ }).first().click();
  await acc.getByRole("button", { name: /^Encaisser / }).click();
  await acc.getByText("Vente gardée sur cet appareil").waitFor();
  await cap(acc, "44-hors-ligne", { haut: 0 });
  await acc.context().setOffline(false);
});

console.log(echecs.length ? `\nÉtapes en échec : ${echecs.join(", ")}` : "\nToutes les captures sont faites.");
await b.close();
