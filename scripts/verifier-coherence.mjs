// Vérification d'ensemble : une journée chargée (deux caisses, monnaie rendue, crédit et
// règlement, remise, soin offert, acompte, carte cadeau, annulation, dépenses), puis les
// mêmes chiffres relus sur CHAQUE écran : caisse, sessions, feuille du jour, écran du jour,
// rapports, dépenses, fiche cliente, fidélité, stock. Tout doit tomber juste.
// Prérequis : émulateurs + seed, site démarré en mode test. Données FICTIVES.
// Usage : node scripts/verifier-coherence.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
let echecs = 0;
const ok = (cond, msg, detail = "") => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) echecs++;
};
const egal = (obtenu, attendu, msg) => ok(obtenu === attendu, `${msg} : ${attendu}`, `obtenu ${JSON.stringify(obtenu)}`);
const jeton = async (email) =>
  (await (await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }) })).json()).idToken;
const appel = (chemin, tok, corps) =>
  fetch(`${SITE}${chemin}`, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, ...(corps ? { body: JSON.stringify(corps) } : {}) }).then(async (r) => {
    const j = await r.json();
    if (!r.ok && corps) console.log("   (refus :", chemin, j.erreur, ")");
    return j;
  });
const lire = async (chemin) => (await (await fetch(`${EMU}/${chemin}`, { headers: OWNER })).json()).fields ?? {};
const AUJ = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date());
const C = "/api/gestion/caisse";
const GAINAGE = "onglerie--gainage"; // 15 000 F
const VERNIS = "onglerie--vernis-permanent"; // 5 000 F
const TIGES = "locks--lot-de-10-tiges-locks-6-pouces"; // produit 6 000 F
const PRO = "test-prothesiste-1";
const [dir, man, acc] = await Promise.all(["direction@test.aza", "manager@test.aza", "accueil@test.aza"].map(jeton));
const stockAvant = async () => {
  const q = await (await fetch(`${EMU}:runQuery`, { method: "POST", headers: OWNER, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "articles" }] } }) })).json();
  const a = q.find((x) => x.document?.fields?.produit?.stringValue === TIGES)?.document;
  return a ? { id: a.name.split("/").pop(), q: Number(a.fields.quantite?.integerValue ?? a.fields.quantite?.doubleValue ?? 0) } : null;
};
const stock0 = await stockAvant();

// ——— La journée ———
await appel(C, acc, { action: "ouvrir", fond: 20000 });
await appel(C, man, { action: "ouvrir", fond: 10000 });
// 1. Accueil : gainage 15 000, la cliente donne 20 000 en espèces → 5 000 rendus
const t1 = await appel(C, acc, { action: "encaisser", lignes: [{ id: GAINAGE, praticienne: PRO }], paiements: [{ mode: "especes", montant: 20000 }], cliente: { nom: "Cliente cohérence (test)", telephone: "77 000 88 01" } });
// 2. Accueil : vernis 5 000 par Wave (sera annulé)
const t2 = await appel(C, acc, { action: "encaisser", lignes: [{ id: VERNIS, praticienne: PRO }], paiements: [{ mode: "wave", montant: 5000 }] });
// 3. Accueil : gainage 15 000 + tiges 6 000 = 21 000 : 6 000 en espèces, 15 000 à crédit
const t3 = await appel(C, acc, { action: "encaisser", lignes: [{ id: GAINAGE, praticienne: PRO }, { id: TIGES }], paiements: [{ mode: "especes", montant: 6000 }, { mode: "credit", montant: 15000 }], cliente: { nom: "Cliente crédit (test)", telephone: "77 000 88 02" } });
// 4. Accueil : la cliente règle 4 000 de son crédit par Orange Money
const fiche = (await appel("/api/gestion/clientes?q=77%20000%2088%2002", acc));
const r4 = await appel(C, acc, { action: "reglement", cliente: "770008802", paiements: [{ mode: "orange-money", montant: 4000 }] });
// 5. Manager : gainage 15 000 avec remise de 3 000 → 12 000 par Orange Money
const t5 = await appel(C, man, { action: "encaisser", lignes: [{ id: GAINAGE, praticienne: PRO }], remise: { montant: 3000, motif: "Fidèle" }, paiements: [{ mode: "orange-money", montant: 12000 }] });
// 6. Manager : soin offert (0 F)
const t6 = await appel(C, man, { action: "encaisser", lignes: [{ id: VERNIS, praticienne: PRO }], remise: { montant: 5000, motif: "Offert (cadeau)" }, paiements: [] });
// 7. Accueil : acompte 5 000 Wave sur un rendez-vous, puis le soin (15 000) : 5 000 d'acompte + 10 000 espèces
const rdv = await appel("/api/gestion/comptoir", acc, { action: "libre", date: AUJ, debut: 17 * 60, lignes: [{ id: GAINAGE, praticienne: PRO }], nom: "Cliente acompte (test)", telephone: "77 000 88 03", dejaFaite: false });
const a7 = await appel(C, acc, { action: "acompte", rendezVous: rdv.id, montant: 5000, mode: "wave" });
for (const s of ["arrivee", "en-cours", "termine"]) await appel(`/api/gestion/rendez-vous/${rdv.id}/statut`, acc, { statut: s });
const t8 = await appel(C, acc, { action: "encaisser", rendezVous: rdv.id, lignes: [{ id: GAINAGE }], paiements: [{ mode: "acompte", montant: 5000 }, { mode: "especes", montant: 10000 }] });
// 9. Accueil : carte cadeau de 20 000 vendue en espèces, puis un vernis (5 000) payé avec
const c9 = await appel("/api/gestion/cartes", acc, { montant: 20000, pour: "Awa (test)", telephone: "77 000 88 04", paiements: [{ mode: "especes", montant: 20000 }] });
const t10 = await appel(C, acc, { action: "encaisser", lignes: [{ id: VERNIS, praticienne: PRO }], paiements: [{ mode: "carte-cadeau", montant: 5000 }], carteCadeau: c9.code });
// 11. Manager annule le vernis Wave (ticket 2)
const av = await appel(C, man, { action: "annuler", id: t2.id, motif: "Erreur de saisie" });
// 12. Dépenses : 1 500 pris dans le tiroir de l'accueil ; 3 000 payés par Wave (direction)
await appel("/api/gestion/depenses", acc, { action: "ajouter", montant: 1500, categorie: "transport", mode: "especes", deLaCaisse: true });
await appel("/api/gestion/depenses", dir, { action: "ajouter", montant: 3000, categorie: "repas", mode: "wave" });
ok([t1, t2, t3, r4, t5, t6, a7, t8, c9, t10, av].every((x) => x && (x.id || x.code || x.reference)), "les 11 opérations de la journée sont passées");

// ——— Le calcul à la main ———
// Recette (ce que la journée a rapporté) : 15 000 + 5 000 + 21 000 + 0 (règlement : déjà compté
// dans la vente à crédit) + 12 000 + 0 (offert) + 5 000 (acompte) + 10 000 (soin moins acompte)
// + 20 000 (carte vendue) + 0 (payé par carte) − 5 000 (annulation) = 83 000
const RECETTE = 83000;
// Tiroir de l'accueil : 20 000 de fond + (20 000 − 5 000 rendus) + 6 000 + 10 000 + 20 000 − 1 500 = 69 500
const TIROIR_ACCUEIL = 69500;
// Tiroir du manager : 10 000 de fond (rien en espèces)
const TIROIR_MANAGER = 10000;

// ——— Les écrans ———
const j = await appel(`${C}?date=${AUJ}`, dir);
egal(j.totaux.recette, RECETTE, "Caisse (toutes les caisses) : recette du jour");
const ca = j.caisses.find((c) => c.ouvertPar.nom === "Accueil test");
const cm = j.caisses.find((c) => c.ouvertPar.nom === "Manager test");
egal(ca.totaux.especesAttendues, TIROIR_ACCUEIL, "Caisse de l'accueil : espèces attendues");
egal(cm.totaux.especesAttendues, TIROIR_MANAGER, "Caisse du manager : espèces attendues");
egal(ca.totaux.recette + cm.totaux.recette, RECETTE, "Somme des deux caisses = recette du jour");
egal(j.totaux.parMode.wave, 5000 + 5000 - 5000, "Wave encaissé (vernis + acompte − annulation)");
egal(j.totaux.parMode["orange-money"], 4000 + 12000, "Orange Money (règlement + remise)");
egal(j.totaux.parMode.especes, 15000 + 6000 + 10000 + 20000, "Espèces nettes (monnaie rendue déduite)");
egal(j.totaux.parMode.credit, 15000 - 4000, "Crédit restant ouvert ce jour-là");
egal(j.totaux.depenses, 1500, "Dépenses sorties des tiroirs");

const s = await appel(`${C}?sessions=1&du=${AUJ}&au=${AUJ}`, dir);
egal(s.jours[0]?.recette, RECETTE, "Sessions de caisse : recette du jour");
egal(s.recette, RECETTE, "Sessions de caisse : recette de la période");

const jour = await appel(`/api/gestion/jour?date=${AUJ}`, dir);
egal(jour.recette?.total, RECETTE, "Tableau de bord (Aujourd'hui) : recette");

const rap = await appel(`/api/gestion/rapports?du=${AUJ}&au=${AUJ}`, dir);
egal(rap.ventes.recette, RECETTE, "Rapports : recette");
egal(rap.parJour.find((x) => x.date === AUJ)?.recette, RECETTE, "Rapports : recette du jour dans le détail par jour");
egal(rap.parCaisse.reduce((n, c) => n + c.montant, 0), RECETTE, "Rapports : somme par personne qui encaisse");
egal(rap.ventes.creditAccorde, 15000, "Rapports : crédit accordé");
egal(rap.ventes.creditRembourse, 4000, "Rapports : crédit remboursé");
egal(rap.ventes.remises, 3000 + 5000, "Rapports : remises (dont le soin offert)");
egal(rap.ventes.avoirs.montant, 5000, "Rapports : annulations");
egal(rap.ventes.produits, 6000, "Rapports : produits vendus");
egal(rap.ventes.cartesCadeaux, 20000, "Rapports : cartes cadeaux vendues");
const pro = rap.equipe.find((e) => e.id === PRO);
// Prestations de la prothésiste : 15 000 + 5 000 − 5 000 (annulé) + 15 000 + 12 000 + 0 + 15 000 + 5 000 = 62 000
egal(pro?.montant, 62000, "Rapports : chiffre de la prothésiste");

egal(rap.ventes.prestations, 62000, "Rapports : prestations (remise et soin offert déduits)");
egal(rap.equipe.reduce((n, e) => n + e.montant, 0) + rap.sansPraticienne, rap.ventes.prestations, "Rapports : la somme des chiffres de l'équipe = total des prestations");
// Prestations + produits + cartes vendues = recette − acompte reçu + ce qui a été payé par acompte et par carte
egal(rap.ventes.prestations + rap.ventes.produits + rap.ventes.cartesCadeaux + rap.ventes.livraisons, rap.ventes.recette - 5000 + 5000 + 5000, "Rapports : le détail des ventes retombe sur la recette");
egal(jour.recette?.prestations, 62000, "Tableau de bord : prestations du jour");
const dep = await appel(`/api/gestion/depenses?date=${AUJ}`, dir);
egal(dep.total, 4500, "Dépenses du jour");
egal(dep.recette, RECETTE, "Dépenses : recette affichée");
egal(dep.reste, RECETTE - 4500, "Dépenses : il reste");
const mois = await appel(`/api/gestion/depenses?mois=${AUJ.slice(0, 7)}`, dir);
egal(mois.jours.find((x) => x.date === AUJ)?.recette, RECETTE, "Dépenses du mois : recette du jour");

const cl = await lire("clientes/770008802");
egal(Number(cl.credit?.integerValue ?? 0), 11000, "Fiche cliente : crédit restant (15 000 − 4 000)");
const carte = await appel(`/api/gestion/cartes?code=${c9.code}`, dir);
egal(carte.solde, 15000, "Carte cadeau : solde restant");
const rdvApres = await lire(`rendezVous/${rdv.id}`);
egal(rdvApres.statut?.stringValue, "encaisse", "Rendez-vous de l'acompte : encaissé");
if (stock0) {
  const st = await stockAvant();
  egal(st.q, stock0.q - 1, "Stock : 1 lot de tiges sorti");
}

// ——— Clôture : le comptage tombe juste ———
const clo = await appel(C, acc, { action: "cloturer", compte: TIROIR_ACCUEIL });
egal(clo.ecart, 0, "Clôture de l'accueil : écart");
const clm = await appel(C, man, { action: "cloturer", compte: TIROIR_MANAGER });
egal(clm.ecart, 0, "Clôture du manager : écart");

console.log(echecs ? `${echecs} ÉCHEC(S)` : "Tout est bon.");
process.exit(echecs ? 1 : 0);
