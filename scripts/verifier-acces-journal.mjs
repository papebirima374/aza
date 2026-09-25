// Vérification des accès sur mesure, du journal « qui a fait quoi » et de l'ajout d'une
// prestation par la praticienne, sur la base de TEST.
// Prérequis : émulateurs + seed, site démarré en mode test.
// Usage : node scripts/verifier-acces-journal.mjs [http://localhost:3100]

const SITE = process.argv[2] ?? "http://localhost:3100";
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};
async function connexion(email) {
  const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "AzaTest2026!", returnSecureToken: true }),
  });
  const j = await r.json();
  return { jeton: j.idToken, uid: j.localId };
}
const api = (chemin, tok, corps, methode) =>
  fetch(SITE + chemin, {
    method: methode ?? (corps ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json().catch(() => ({})) }));
const [dir, acc, compta, coif, coif2] = await Promise.all(["direction", "accueil", "comptable", "coiffeuse1", "estheticienne1"].map((n) => connexion(`${n}@test.aza`)));
const AUJ = new Date().toISOString().slice(0, 10);

// ——— Accès sur mesure ———
ok((await api("/api/gestion/rapports", acc.jeton)).statut === 403, "l'accueil n'a pas les rapports (rôle)");
ok((await api("/api/gestion/equipe", acc.jeton, { uid: acc.uid, acces: { rapports: true } }, "PATCH")).statut === 403, "l'accueil ne peut pas se donner d'accès");
ok((await api("/api/gestion/equipe", dir.jeton, { uid: dir.uid, acces: { caisse: false } }, "PATCH")).statut === 400, "la direction ne change pas ses propres accès");
ok((await api("/api/gestion/equipe", dir.jeton, { uid: acc.uid, acces: { rapports: true, caisse: false, inconnu: true } }, "PATCH")).statut === 200, "la direction donne les Rapports à l'accueil et lui retire la caisse");
ok((await api("/api/gestion/rapports", acc.jeton)).statut === 200, "l'accueil voit maintenant les rapports");
ok((await api("/api/gestion/caisse", acc.jeton, { action: "ouvrir", fond: 0 })).statut === 403, "…et ne peut plus tenir la caisse");
const equipe = (await api("/api/gestion/equipe", dir.jeton)).corps;
const fiche = equipe.find((m) => m.uid === acc.uid);
ok(fiche.acces.rapports === true && fiche.acces.caisse === false && Object.keys(fiche.acces).length === 2, "seules les vraies exceptions sont gardées (pas « inconnu »)");
ok((await api("/api/gestion/clientes", compta.jeton)).statut === 403, "le comptable n'a pas le fichier clientes (rôle)");
await api("/api/gestion/equipe", dir.jeton, { uid: compta.uid, acces: { clientes: true } }, "PATCH");
ok((await api("/api/gestion/clientes", compta.jeton)).statut === 200, "accès « Fichier clientes » donné au comptable : il le lit");
await api("/api/gestion/equipe", dir.jeton, { uid: acc.uid, acces: {} }, "PATCH");
ok((await api("/api/gestion/caisse", acc.jeton, { action: "ouvrir", fond: 5000 })).statut === 201, "accès remis comme le rôle : l'accueil ouvre la caisse");
ok((await api("/api/gestion/rapports", acc.jeton)).statut === 403, "…et n'a plus les rapports");

// ——— Qui a fait quoi ———
const t = await api("/api/gestion/caisse", acc.jeton, { action: "encaisser", lignes: [{ id: "onglerie--vernis-permanent" }], paiements: [{ mode: "especes", montant: 5000 }], cliente: { nom: "Journal Test", telephone: "77 000 88 01" } });
ok(t.statut === 201, `vente encaissée par l'accueil (${t.corps.reference})`);
ok((await api("/api/gestion/activite", acc.jeton)).statut === 403, "l'accueil ne lit pas le journal");
const j = (await api(`/api/gestion/activite?date=${AUJ}`, dir.jeton)).corps;
const ligneVente = j.lignes?.find((l) => l.texte.includes(t.corps.reference));
ok(ligneVente?.par.nom && ligneVente.par.role === "accueil" && ligneVente.texte.includes("Journal Test"), `journal : « ${ligneVente?.texte} » — par ${ligneVente?.par.nom}`);
ok(j.lignes.some((l) => l.type === "equipe" && l.texte.includes("accès") && l.texte.includes("+ Rapports")), "journal : les accès donnés sont tracés");
ok(j.lignes.some((l) => l.type === "caisse" && l.texte.startsWith("Caisse ouverte")), "journal : l'ouverture de caisse est tracée");

// ——— La praticienne ajoute une prestation en cabine ———
const compteCoif = await (await fetch(`${EMU}/comptes/${coif.uid}`, { headers: OWNER })).json();
const pratId = compteCoif.fields.praticienne.stringValue;
const rq = await (await fetch(`${EMU}:runQuery`, { method: "POST", headers: OWNER, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "rendezVous" }], where: { fieldFilter: { field: { fieldPath: "date" }, op: "EQUAL", value: { stringValue: AUJ } } } } }) })).json();
const rdv = rq.filter((x) => x.document).map((x) => x.document).find((d) => (d.fields.praticiennesIds.arrayValue.values ?? []).some((v) => v.stringValue === pratId) && ["reserve", "confirme"].includes(d.fields.statut.stringValue));
const rdvId = rdv.name.split("/").pop();
const finAvant = Number(rdv.fields.fin.integerValue);
const totalAvant = Number(rdv.fields.total.integerValue);
ok((await api(`/api/gestion/rendez-vous/${rdvId}/prestations`, coif.jeton, { prestation: "soins-cheveux--detressage-cheveux-externe" })).statut === 409, "avant « Je commence » : pas d'ajout");
await api(`/api/gestion/rendez-vous/${rdvId}/statut`, coif.jeton, { statut: "en-cours" });
ok((await api(`/api/gestion/rendez-vous/${rdvId}/prestations`, coif2.jeton, { prestation: "soins-cheveux--detressage-cheveux-externe" })).statut === 403, "une autre praticienne ne peut pas ajouter sur ce rendez-vous");
ok((await api(`/api/gestion/rendez-vous/${rdvId}/prestations`, coif.jeton, { prestation: "n-existe-pas" })).statut === 400, "prestation inconnue : refusée");
const ajout = await api(`/api/gestion/rendez-vous/${rdvId}/prestations`, coif.jeton, { prestation: "soins-cheveux--detressage-cheveux-externe" });
ok(ajout.statut === 201 && ajout.corps.nom === "Détressage cheveux externe", `la praticienne ajoute « Détressage cheveux externe » (${ajout.corps.duree} min)`);
const apres = await (await fetch(`${EMU}/rendezVous/${rdvId}`, { headers: OWNER })).json();
ok(Number(apres.fields.total.integerValue) === totalAvant + 4000, "le total du rendez-vous augmente de 4 000 F");
ok(Number(apres.fields.fin.integerValue) === finAvant + ajout.corps.duree, "la fin du rendez-vous est repoussée de la durée du soin");
await api(`/api/gestion/rendez-vous/${rdvId}/statut`, coif.jeton, { statut: "termine" });
const info = (await api(`/api/gestion/caisse?rdv=${rdvId}`, acc.jeton)).corps;
ok(info.prestations?.some((p) => p.nom === "Détressage cheveux externe"), "à la caisse, le ticket contient déjà la prestation ajoutée");
const j2 = (await api(`/api/gestion/activite?date=${AUJ}`, dir.jeton)).corps;
ok(j2.lignes.some((l) => l.type === "agenda" && l.texte.includes("Prestation ajoutée") && l.par.role === "praticienne"), "journal : l'ajout est tracé au nom de la praticienne");

console.log(echecs ? `\n${echecs} contrôle(s) en échec.` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
