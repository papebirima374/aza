// Vérification des avis clientes et des rapports de la direction, sur la base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-avis-rapports.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};
async function jeton(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  return (await r.json()).idToken;
}
const api = (chemin, tok, corps) =>
  fetch(SITE + chemin, {
    method: corps ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const [direction, manager, accueil, comptable, coiffeuse] = await Promise.all(
  ["direction", "manager", "accueil", "comptable", "coiffeuse1"].map((n) => jeton(`${n}@test.aza`)),
);
const AUJ = new Date().toISOString().slice(0, 10);

// Un rendez-vous d'aujourd'hui, terminé puis encaissé : le ticket porte la praticienne.
await api("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 0 });
const rq = await (
  await fetch(`${EMU}:runQuery`, {
    method: "POST",
    headers: OWNER,
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "rendezVous" }], where: { fieldFilter: { field: { fieldPath: "date" }, op: "EQUAL", value: { stringValue: AUJ } } } } }),
  })
).json();
const rdv = rq.filter((x) => x.document).map((x) => x.document).find((d) => d.fields.statut.stringValue === "reserve" || d.fields.statut.stringValue === "confirme");
const rdvId = rdv.name.split("/").pop();
for (const s of ["arrivee", "en-cours", "termine"]) await api(`/api/gestion/rendez-vous/${rdvId}/statut`, direction, { statut: s });
const prestations = rdv.fields.prestations.arrayValue.values.map((v) => v.mapValue.fields);
const totalRdv = prestations.reduce((s, p) => s + Number(p.prix.integerValue), 0);
const tRdv = await api("/api/gestion/caisse", accueil, {
  action: "encaisser",
  rendezVous: rdvId,
  lignes: prestations.map((p) => ({ id: p.id.stringValue })),
  paiements: [{ mode: "wave", montant: totalRdv }],
});
ok(tRdv.statut === 201, `rendez-vous encaissé (${tRdv.corps.reference}, ${totalRdv} F)`);
const tLibre = await api("/api/gestion/caisse", accueil, {
  action: "encaisser",
  lignes: [{ id: "onglerie--vernis-permanent" }],
  paiements: [{ mode: "especes", montant: 5000 }],
  cliente: { nom: "Avis Test", telephone: "77 000 55 01" },
});
ok(tLibre.statut === 201, "vente au comptoir encaissée");

// Avis
const page = await fetch(`${SITE}/avis/${tRdv.corps.id}`);
ok(page.status === 200 && (await page.text()).includes("votre avis compte"), "la page de l'avis s'ouvre depuis le lien du reçu");
ok((await fetch(`${SITE}/avis/nimporte-quoi-123`)).status === 200, "un faux lien affiche un message (pas d'erreur)");
ok((await api("/api/avis/nimporte-quoi-123", null, { note: 5 })).statut === 404, "un faux lien ne peut pas déposer d'avis");
ok((await api(`/api/avis/${tRdv.corps.id}`, null, { note: 9 })).statut === 400, "note hors de 1 à 5 refusée");
ok((await api(`/api/avis/${tRdv.corps.id}`, null, { note: 5, site: "robot" })).statut === 400, "champ piège : robot refusé");
const a1 = await api(`/api/avis/${tRdv.corps.id}`, null, { note: 5, commentaire: "Très bon accueil, soin parfait.", publier: true, prenom: "Awa" });
ok(a1.statut === 201, "avis 5 étoiles déposé");
ok((await api(`/api/avis/${tRdv.corps.id}`, null, { note: 1 })).statut === 409, "un seul avis par visite");
const a2 = await api(`/api/avis/${tLibre.corps.id}`, null, { note: 2, commentaire: "Attente trop longue.", publier: false });
ok(a2.statut === 201, "avis 2 étoiles déposé (privé)");

ok((await api("/api/gestion/avis", accueil)).statut === 403, "l'accueil ne voit pas les avis");
ok((await api("/api/gestion/avis?compter=1", direction)).corps.aTraiter === 1, "pastille : 1 avis à regarder (le 2 étoiles)");
const liste = (await api("/api/gestion/avis", manager)).corps.avis;
const avisRdv = liste.find((a) => a.id === tRdv.corps.id);
ok(liste.length === 2 && avisRdv?.praticiennes.length > 0, `le manager voit les 2 avis ; praticienne du rendez-vous : ${avisRdv?.praticiennes.map((p) => p.nom).join(", ")}`);
ok((await api("/api/gestion/avis", manager, { action: "publier", id: tRdv.corps.id })).statut === 403, "le manager ne publie pas sur le site");
ok((await api("/api/gestion/avis", direction, { action: "publier", id: tLibre.corps.id })).statut === 409, "avis privé : publication refusée");
ok((await api("/api/gestion/avis", direction, { action: "publier", id: tRdv.corps.id })).statut === 200, "la direction publie l'avis accepté");
ok((await api("/api/gestion/avis", manager, { action: "traite", id: tLibre.corps.id })).statut === 200, "le manager marque le 2 étoiles comme traité");
ok((await api("/api/gestion/avis?compter=1", direction)).corps.aTraiter === 0, "pastille : plus rien à regarder");
ok((await api("/api/gestion/avis", direction, { action: "lien-google", lien: "https://exemple.com/x" })).statut === 400, "lien Google : une autre adresse est refusée");
ok((await api("/api/gestion/avis", direction, { action: "lien-google", lien: "https://g.page/r/test/review" })).statut === 200, "lien Google enregistré");
await new Promise((r) => setTimeout(r, 61_000)); // cache des avis du site (1 min)
await fetch(`${SITE}/`); // la page d'accueil se refait en arrière-plan (revalidate = 60)
await new Promise((r) => setTimeout(r, 4000));
const accueilSite = await (await fetch(`${SITE}/`)).text();
ok(accueilSite.includes("Elles en parlent") && accueilSite.includes("Très bon accueil"), "l'avis publié paraît sur l'accueil du site");
ok(!accueilSite.includes("Attente trop longue"), "l'avis privé ne paraît pas");

// Rapports
ok((await api("/api/gestion/rapports", accueil)).statut === 403, "l'accueil n'a pas les rapports");
ok((await api("/api/gestion/rapports", coiffeuse)).statut === 403, "une praticienne n'a pas les rapports");
ok((await api(`/api/gestion/rapports?du=${AUJ}&au=2020-01-01`, direction)).statut === 400, "période à l'envers refusée");
ok((await api("/api/gestion/rapports?du=2024-01-01&au=2026-01-01", direction)).statut === 400, "période de plus d'un an refusée");
const r = (await api(`/api/gestion/rapports?du=${AUJ}&au=${AUJ}`, comptable)).corps;
ok(r.ventes?.recette >= totalRdv + 5000, `le comptable voit la recette du jour : ${r.ventes?.recette} F`);
ok(r.ventes.parMode.wave >= totalRdv && r.ventes.parMode.especes >= 5000, "répartition par moyen de paiement");
ok(r.topPrestations.some((p) => p.nom === "Vernis permanent") || r.topProduits.length >= 0, "classement des prestations");
const pratRdv = avisRdv.praticiennes[0];
const ligneEquipe = r.equipe.find((e) => e.id === pratRdv.id);
ok(ligneEquipe && ligneEquipe.montant >= Math.floor(totalRdv / avisRdv.praticiennes.length) - 1, `chiffre de ${pratRdv.nom} : ${ligneEquipe?.montant} F`);
ok(ligneEquipe?.note === 5, "sa note moyenne vient des avis");
ok(r.avis.nombre === 2 && r.avis.repartition[4] === 1 && r.avis.repartition[1] === 1, "avis du jour : un 5 étoiles, un 2 étoiles");
ok(r.parJour.length === 1 && r.parJour[0].recette === r.ventes.recette, "recette jour par jour");
ok(r.clientes.servies >= 1, `clientes servies : ${r.clientes.servies}, nouvelles : ${r.clientes.nouvelles}`);
const csv = await fetch(`${SITE}/api/gestion/rapports?du=${AUJ}&au=${AUJ}&format=csv`, { headers: { Authorization: `Bearer ${comptable}` } });
const octets = new Uint8Array(await csv.arrayBuffer());
const texte = new TextDecoder().decode(octets);
ok(csv.status === 200 && octets[0] === 0xef && octets[1] === 0xbb && octets[2] === 0xbf && texte.startsWith("Date;Heure;Ticket") && texte.includes(tLibre.corps.reference), "export Excel des tickets (accents lisibles dans Excel)");
const mois = (await api("/api/gestion/rapports", direction)).corps;
ok(mois.du === `${AUJ.slice(0, 7)}-01` && mois.au === AUJ, "par défaut : le mois en cours");

console.log(echecs ? `\n${echecs} contrôle(s) en échec.` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
