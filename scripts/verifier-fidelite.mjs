// Vérification de la carte de fidélité, sur la base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-fidelite.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
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
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const [direction, accueil] = await Promise.all(["direction", "accueil"].map((n) => jeton(`${n}@test.aza`)));
const TEL = "77 000 44 10";
const cliente = { nom: "Cliente fidèle (test)", telephone: TEL };
const vendre = (id, montant, extra = {}) =>
  api("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id }], paiements: [{ mode: "especes", montant }], cliente, ...extra });
const points = async () => (await api(`/api/gestion/caisse?fidelite=${encodeURIComponent(TEL)}`, accueil)).corps.points;

await api("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 0 });
ok((await api("/api/gestion/reglages", accueil, { action: "fidelite", actif: true, gain: "montant", tranche: 1000, seuil: 10, recompense: "remise", valeur: 2000 })).statut === 403, "l'accueil ne règle pas la fidélité");
const sansProgramme = await vendre("onglerie--vernis-permanent", 5000);
ok(sansProgramme.statut === 201 && (await points()) === 0, "programme éteint : aucun point");
ok((await api("/api/gestion/reglages", direction, { action: "fidelite", actif: true, gain: "montant", tranche: 1000, seuil: 10, recompense: "remise", valeur: 2000 })).statut === 200, "la direction active : 1 point par 1 000 F, 10 points = 2 000 F");

const t1 = await vendre("onglerie--vernis-permanent", 5000);
ok(t1.statut === 201, `vente 5 000 F (${t1.corps.reference})`);
const recu1 = (await api(`/api/gestion/caisse?ticket=${t1.corps.id}`, accueil)).corps;
ok(recu1.fidelite?.gagnes === 5 && recu1.fidelite.solde === 5, "le reçu porte +5 points, solde 5");
await vendre("onglerie--vernis-french", 7000);
ok((await points()) === 12, "après 7 000 F de plus : 12 points");

const t3 = await vendre("onglerie--vernis-simple", 1000, { fidelite: true });
ok(t3.statut === 201 && t3.corps.total === 1000, "vernis simple 3 000 F − 2 000 F de fidélité : la cliente paie 1 000 F");
const recu3 = (await api(`/api/gestion/caisse?ticket=${t3.corps.id}`, accueil)).corps;
ok(recu3.fidelite?.utilises === 10 && recu3.fidelite.remise === 2000 && recu3.fidelite.gagnes === 1 && recu3.fidelite.solde === 3, "reçu : 10 points utilisés, +1 gagné, solde 3");
ok((await vendre("onglerie--vernis-simple", 1000, { fidelite: true })).statut === 409, "3 points seulement : la remise est refusée");
ok((await api("/api/gestion/caisse", direction, { action: "annuler", id: t3.corps.id, motif: "Test fidélité" })).statut === 201, "annulation du ticket avec remise fidélité");
ok((await points()) === 12, "les points reviennent : 12");
const fiche = (await api(`/api/gestion/clientes?id=770004410`, accueil)).corps;
ok(fiche.points === 12, "la fiche cliente affiche 12 points");
ok((await api("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: "onglerie--vernis-simple" }], paiements: [{ mode: "especes", montant: 1000 }], fidelite: true })).statut === 400, "points sans téléphone de cliente : refusé");

// Le choix de la gérante : 1 point par passage, cadeau au 10e passage, points remis à zéro.
ok(
  (await api("/api/gestion/reglages", direction, { action: "fidelite", actif: true, gain: "passage", seuil: 10, recompense: "cadeau", cadeau: "Un soin des mains offert" })).statut === 200,
  "la direction passe à 1 point par passage, cadeau au 10e",
);
const TEL2 = "77 000 44 20";
const cliente2 = { nom: "Cliente cadeau (test)", telephone: TEL2 };
const passage = (extra = {}) => api("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: "onglerie--vernis-simple" }], paiements: [{ mode: "especes", montant: 3000 }], cliente: cliente2, ...extra });
const points2 = async () => (await api(`/api/gestion/caisse?fidelite=${encodeURIComponent(TEL2)}`, accueil)).corps;
const r1 = await passage();
const recuP = (await api(`/api/gestion/caisse?ticket=${r1.corps.id}`, accueil)).corps;
ok(recuP.fidelite?.gagnes === 1 && recuP.fidelite.solde === 1 && recuP.fidelite.parPassage && recuP.fidelite.seuil === 10, "1er passage : 1 / 10 sur le ticket");
ok((await passage({ cadeau: true })).statut === 409, "cadeau demandé trop tôt : refusé");
for (let i = 2; i <= 9; i++) await passage();
const avant = await points2();
ok(avant.points === 9 && avant.regles.recompense === "cadeau" && avant.regles.cadeau === "Un soin des mains offert", "après 9 passages : 9 points, la caisse connaît le cadeau");
const dixieme = await passage({ cadeau: true });
ok(dixieme.statut === 201, "10e passage : ticket validé avec le cadeau");
const recu10 = (await api(`/api/gestion/caisse?ticket=${dixieme.corps.id}`, accueil)).corps;
ok(recu10.fidelite?.cadeau === "Un soin des mains offert" && recu10.fidelite.solde === 0 && recu10.fidelite.utilises === 10, "le ticket porte le cadeau, les points repartent à 0");
ok((await points2()).points === 0, "la fiche : 0 point");
const fiche2 = (await api(`/api/gestion/clientes?id=770004420`, accueil)).corps;
ok(fiche2.cadeauxFidelite === 1, "la fiche compte 1 cadeau reçu");
ok((await api("/api/gestion/caisse", direction, { action: "annuler", id: dixieme.corps.id, motif: "Test cadeau" })).statut === 201, "annulation du ticket du cadeau");
ok((await points2()).points === 9, "les 9 points reviennent");
ok((await api(`/api/gestion/clientes?id=770004420`, accueil)).corps.cadeauxFidelite === 0, "le cadeau est retiré de la fiche");
// Cadeau reporté (pas en stock) : les points sont gardés, la caisse le proposera au passage suivant.
const reporte = await passage();
ok(reporte.statut === 201 && (await points2()).points === 10, "cadeau reporté : 10 points gardés");
const onze = await passage({ cadeau: true });
const recu11 = (await api(`/api/gestion/caisse?ticket=${onze.corps.id}`, accueil)).corps;
ok(onze.statut === 201 && recu11.fidelite.solde === 1, "cadeau remis au passage suivant : il reste 1 point");
ok((await passage({ fidelite: true })).statut === 400, "récompense « cadeau » : pas de remise en points");
// Le cadeau est au choix de l'institut : un soin ou un produit, écrit à 0 F sur le ticket.
const TEL3 = "77 000 44 30";
const cliente3 = { nom: "Cliente soin offert (test)", telephone: TEL3 };
const passage3 = (extra = {}) => api("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: "onglerie--vernis-simple" }], paiements: [{ mode: "especes", montant: 3000 }], cliente: cliente3, ...extra });
ok((await api("/api/gestion/caisse", accueil, { action: "encaisser", lignes: [{ id: "onglerie--vernis-simple" }, { id: "soins-visage--hydrafacial", offert: true }], paiements: [{ mode: "especes", montant: 3000 }], cliente: cliente3 })).statut === 409, "un soin offert sans cadeau dû : refusé");
for (let i = 1; i <= 9; i++) await passage3();
const offert = await api("/api/gestion/caisse", accueil, {
  action: "encaisser",
  lignes: [{ id: "onglerie--vernis-simple" }, { id: "soins-visage--hydrafacial", offert: true }],
  paiements: [{ mode: "especes", montant: 3000 }],
  cliente: cliente3,
  cadeau: true,
});
const recuOffert = (await api(`/api/gestion/caisse?ticket=${offert.corps.id}`, accueil)).corps;
const ligneOfferte = recuOffert.lignes?.find((l) => l.offert);
ok(offert.statut === 201 && offert.corps.total === 3000, "10e passage : Hydrafacial offert, la cliente ne paie que son vernis (3 000 F)");
ok(ligneOfferte?.montant === 0 && recuOffert.fidelite?.cadeau === "Hydrafacial" && recuOffert.fidelite.solde === 0, "le ticket : « Hydrafacial (cadeau fidélité) » à 0 F, points à zéro");

// Les commandes en ligne comptent aussi comme un passage.
const stock = (corps) => api("/api/gestion/stock", direction, corps);
const art = (await stock({ action: "creer", nom: "Tiges fidélité", type: "revente", unite: "boîte", seuil: 1, produit: "locks--lot-de-10-tiges-locks-6-pouces" })).corps.id;
await stock({ action: "reception", id: art, quantite: 20, cout: 3000 });
await stock({ action: "boutique", id: art, visible: true, titre: "Tiges pour locks", variante: "6 pouces", rayon: "capillaire", description: "Lot de 10 tiges." });
await api("/api/gestion/boutique", direction, { action: "ouverture", ouverte: true });
const TEL4 = "77 000 44 40";
const commanderEtRemettre = async (extra = {}) => {
  const c = await api("/api/boutique/commandes", null, { nom: "Cliente en ligne (test)", telephone: TEL4, paiement: "sur-place", lignes: [{ article: art, quantite: 1 }], mode: "retrait" });
  const liste = (await api("/api/gestion/commandes", accueil)).corps;
  const id = liste.find((x) => x.reference === c.corps.reference).id;
  await api("/api/gestion/commandes", accueil, { id, statut: "confirmee" });
  return api("/api/gestion/caisse", accueil, { action: "commande", commande: id, paiements: [{ mode: "wave", montant: 6000 }], ...extra });
};
const cmd1 = await commanderEtRemettre();
const recuCmd = (await api(`/api/gestion/caisse?ticket=${cmd1.corps.id}`, accueil)).corps;
ok(cmd1.statut === 201 && recuCmd.fidelite?.gagnes === 1 && recuCmd.fidelite.solde === 1, "commande en ligne remise : +1 passage (1 / 10)");
for (let i = 2; i <= 9; i++) await commanderEtRemettre();
const cmd10 = await commanderEtRemettre({ cadeau: { remis: true, texte: "Un sérum" } });
const recu10c = (await api(`/api/gestion/caisse?ticket=${cmd10.corps.id}`, accueil)).corps;
ok(cmd10.statut === 201 && recu10c.fidelite?.cadeau === "Un sérum" && recu10c.fidelite.solde === 0, "10e commande : cadeau joint (« Un sérum »), points à zéro");

const d = new Date().toISOString().slice(0, 10);
ok((await api(`/api/gestion/rapports?du=${d}&au=${d}`, direction)).corps.ventes.cadeauxFidelite === 3, "le rapport compte 3 cadeaux remis (l'annulé ne compte pas)");

console.log(echecs ? `\n${echecs} échec(s).` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
