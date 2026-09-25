// Vérification du fichier clientes, du règlement de crédit et des rappels, sur la base de TEST.
// Prérequis : émulateurs + seed (base fraîche : caisse du jour pas encore ouverte), site démarré en mode test.
// Usage : node scripts/verifier-clientes.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner" };
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
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const [accueil, coiffeuse, estheticienne, manager] = await Promise.all(["accueil", "coiffeuse1", "estheticienne1", "manager"].map((n) => jeton(`${n}@test.aza`)));
const TIGES = "locks--lot-de-10-tiges-locks-6-pouces";

// Droits et liste
ok((await api("/api/gestion/clientes", coiffeuse)).statut === 403, "une praticienne n'ouvre pas le fichier clientes");
const liste = await api("/api/gestion/clientes", accueil);
ok(liste.statut === 200 && liste.corps.length >= 8, `l'accueil voit le fichier (${liste.corps.length} fiches de test)`);

// Création, sans doublon
const c = await api("/api/gestion/clientes", accueil, { nom: "Mariama Test", telephone: "77 000 44 55" });
ok(c.statut === 200 && c.corps.id === "770004455", "fiche créée (identité = le numéro)");
ok((await api("/api/gestion/clientes", accueil, { nom: "Mariama Bis", telephone: "+221 77 000 44 55" })).statut === 409, "même numéro écrit autrement : pas de seconde fiche");

// Fiche technique et allergies, visibles par la praticienne du rendez-vous seulement
ok((await api("/api/gestion/clientes", accueil, { id: "770000101", allergies: "Henné noir", peau: "sensible" })).statut === 200, "allergie notée sur la fiche d'Awa Diop");
const rdvs = await fetch(`${EMU}:runQuery`, {
  method: "POST",
  headers: { ...OWNER, "Content-Type": "application/json" },
  body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "rendezVous" }], where: { fieldFilter: { field: { fieldPath: "cliente.id" }, op: "EQUAL", value: { stringValue: "770000101" } } } } }),
}).then((r) => r.json());
const rdv = rdvs[0].document.name.split("/").pop();
const a1 = await api(`/api/gestion/clientes?alerte=${rdv}`, coiffeuse);
ok(a1.statut === 200 && a1.corps.allergies === "Henné noir" && a1.corps.technique.some((t) => t.champ === "peau"), "sa coiffeuse voit l'allergie (en rouge) et la fiche technique");
ok((await api(`/api/gestion/clientes?alerte=${rdv}`, estheticienne)).statut === 403, "une autre praticienne ne la voit pas");

// Vente à crédit, puis règlement
await api("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 0 });
await api("/api/gestion/caisse", accueil, {
  action: "encaisser",
  lignes: [{ id: TIGES }],
  paiements: [{ mode: "especes", montant: 2000 }, { mode: "credit", montant: 4000 }],
  cliente: { nom: "Mariama Test", telephone: "770004455" },
});
let f = (await api("/api/gestion/clientes?id=770004455", accueil)).corps;
ok(f.credit === 4000 && f.indicateurs.visites === 1 && f.indicateurs.total === 6000, "fiche : 1 venue, 6 000 F dépensés, doit 4 000 F");
const avant = (await api("/api/gestion/caisse", accueil)).corps.totaux;
ok((await api("/api/gestion/caisse", accueil, { action: "reglement", cliente: "770004455", paiements: [{ mode: "wave", montant: 5000 }] })).statut === 400, "régler plus que la dette : refusé");
const reg = await api("/api/gestion/caisse", accueil, { action: "reglement", cliente: "770004455", paiements: [{ mode: "wave", montant: 3000 }] });
ok(reg.statut === 201 && reg.corps.reste === 1000, `règlement ${reg.corps.reference} : 3 000 F par Wave, reste 1 000 F`);
const apres = (await api("/api/gestion/caisse", accueil)).corps.totaux;
ok(apres.recette === avant.recette && (apres.parMode.wave ?? 0) === (avant.parMode.wave ?? 0) + 3000, "la recette ne change pas (déjà comptée), Wave reçu +3 000 F");
f = (await api("/api/gestion/clientes?id=770004455", accueil)).corps;
ok(f.credit === 1000 && f.historique.some((h) => h.statut === "reglement"), "fiche : doit encore 1 000 F, règlement dans l'historique");
const liste2 = (await api("/api/gestion/clientes", manager)).corps;
ok(liste2.find((x) => x.id === "770004455")?.derniereVisite === new Date().toISOString().slice(0, 10), "liste : date de dernière venue tenue à jour");

// Rappels de demain
const r = await api("/api/gestion/rappels", accueil);
ok(r.statut === 200 && r.corps.rendezVous.length >= 1, `rappels : ${r.corps.rendezVous.length} rendez-vous demain`);
const premier = r.corps.rendezVous[0];
await api("/api/gestion/rappels", accueil, { rdv: premier.id });
ok((await api("/api/gestion/rappels", accueil)).corps.rendezVous.find((x) => x.id === premier.id).rappel?.par === "Accueil test", "rappel noté « envoyé par Accueil test »");
ok((await api("/api/gestion/rappels", coiffeuse)).statut === 403, "une praticienne n'a pas la liste des rappels");

// Anniversaires et relances WhatsApp
const auj = new Date().toISOString().slice(0, 10);
const cree = await api("/api/gestion/clientes", accueil, { nom: "Anniversaire Test", telephone: "77 000 99 11", naissance: `1990-${auj.slice(5)}` });
ok(cree.statut === 200, "fiche créée avec une date de naissance");
const jour = (await api(`/api/gestion/jour?date=${auj}`, manager)).corps;
ok(jour.anniversaires?.some((a) => a.nom === "Anniversaire Test"), "le tableau de bord du jour annonce son anniversaire");
const resumeAnniv = (await api("/api/gestion/clientes", accueil)).corps.find((c) => c.id === cree.corps.id);
ok(resumeAnniv?.naissance === `1990-${auj.slice(5)}`, "la liste des clientes connaît sa date de naissance");
ok((await api("/api/gestion/clientes", accueil, { action: "relance", id: cree.corps.id, type: "inconnu" })).statut === 400, "relance inconnue refusée");
ok((await api("/api/gestion/clientes", coiffeuse, { action: "relance", id: cree.corps.id, type: "anniversaire" })).statut === 403, "une praticienne ne relance pas les clientes");
ok((await api("/api/gestion/clientes", accueil, { action: "relance", id: cree.corps.id, type: "anniversaire" })).statut === 200, "l'accueil note l'anniversaire souhaité");
const apresRelance = (await api("/api/gestion/clientes", accueil)).corps.find((c) => c.id === cree.corps.id);
ok(apresRelance?.derniereRelance?.type === "anniversaire" && apresRelance.derniereRelance.par === "Accueil test" && apresRelance.derniereRelance.date === auj, "la fiche garde « souhaité le … par Accueil test »");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
