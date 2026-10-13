// Vérification : import d'une liste dans le catalogue (doublons, lignes existantes) et case
// « Sur le site ». Données FICTIVES. Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-import-catalogue.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};
const jeton = async (email) =>
  (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }) })).json()).idToken;
const appel = (tok, corps) =>
  fetch(`${SITE}/api/gestion/catalogue`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(corps) }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const modifs = async () => (await (await fetch(`${SITE}/api/catalogue`, { cache: "no-store" })).json()).modifs;
const [direction, accueil] = await Promise.all([jeton("direction@test.aza"), jeton("accueil@test.aza")]);

const lignes = [
  { nom: "Soin test import", familleId: "soins-visage", prix: 12000, produit: false, site: true },
  { nom: "Soin caché import", familleId: "soins-visage", prix: 13000, produit: false, site: false },
  { nom: "MASSAGE RELAXANT", familleId: "massage", prix: 18000, produit: false, site: true }, // existe déjà (accents, majuscules)
  { nom: "Soin test import", familleId: "soins-visage", prix: 9000, produit: false, site: true }, // doublon dans la liste
  { nom: "Robe test import", familleId: "habillement", prix: 25000, produit: true, site: true },
  { nom: "Ligne sans famille", familleId: "inconnue", prix: 1000 },
  { nom: "Ligne sans prix", familleId: "onglerie", prix: 0 },
];
ok((await appel(accueil, { action: "importer", lignes, essai: true })).statut === 403, "l'accueil n'importe pas dans le catalogue");
const avant = Object.keys(await modifs()).length;
const e = await appel(direction, { action: "importer", lignes, essai: true });
ok(e.statut === 200 && e.corps.nouvelles.length === 3 && e.corps.existantes.length === 1 && e.corps.doublons.length === 1 && e.corps.refusees.length === 2, "compte rendu : 3 nouvelles, 1 déjà présente, 1 doublon, 2 refusées");
ok(e.corps.existantes[0].existante === "Massage relaxant" && e.corps.existantes[0].prixActuel === 20000, "« MASSAGE RELAXANT » reconnu comme « Massage relaxant » (prix actuel 20 000 F gardé)");
ok(Object.keys(await modifs()).length === avant, "l'essai n'écrit rien");
const i = await appel(direction, { action: "importer", lignes, essai: false });
ok(i.statut === 200 && i.corps.importees === 3, "import : 3 lignes ajoutées");
await new Promise((r) => setTimeout(r, 16_000)); // le catalogue se relit toutes les 15 s
const m = await modifs();
const trouve = (nom) => Object.entries(m).find(([, x]) => x.nom === nom);
ok(trouve("Soin test import")?.[1].prix === 12000, "le premier « Soin test import » est gardé (12 000 F), pas son doublon");
ok(trouve("Robe test import")?.[1].note === "Produit", "la robe est rangée comme produit");
ok(trouve("Soin caché import")?.[1].horsSite === true, "« Soin caché import » est marqué « pas sur le site »");
const relance = await appel(direction, { action: "importer", lignes, essai: true });
ok(relance.corps.nouvelles.length === 0, "relancer le même import n'ajoute rien");

// La case « Sur le site » (les pages du site se refont au plus toutes les 60 s)
const pageFraiche = async () => {
  await new Promise((r) => setTimeout(r, 62_000));
  await fetch(`${SITE}/prestations/institut`); // déclenche la nouvelle version
  await new Promise((r) => setTimeout(r, 4_000));
  return (await fetch(`${SITE}/prestations/institut`)).text();
};
let page = await pageFraiche();
ok(page.includes("Soin test import") && !page.includes("Soin caché import"), "le site montre « Soin test import », pas « Soin caché import »");
const relaxant = "massage--massage-relaxant";
ok((await appel(direction, { action: "site", id: relaxant, site: false })).statut === 200, "la direction décoche « Sur le site » pour le massage relaxant");
page = await pageFraiche();
ok(!page.includes("Massage relaxant"), "le massage relaxant disparaît du site");
const caisse = await (await fetch(`${SITE}/api/gestion/caisse`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${direction}` }, body: JSON.stringify({ action: "ouvrir", fond: 0 }) })).json();
const t = await fetch(`${SITE}/api/gestion/caisse`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${direction}` }, body: JSON.stringify({ action: "encaisser", lignes: [{ id: relaxant }], paiements: [{ mode: "wave", montant: 20000 }] }) });
ok(t.status === 201, "il reste en caisse (encaissé normalement)");
ok((await appel(accueil, { action: "site", id: relaxant, site: true })).statut === 403, "l'accueil ne change pas la case");
await appel(direction, { action: "site", id: relaxant, site: true });

console.log(echecs ? `${echecs} ÉCHEC(S)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
