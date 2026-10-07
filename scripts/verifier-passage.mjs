// Vérification de la saisie libre au comptoir (cliente sans rendez-vous, heure passée,
// plusieurs prestataires), sur la base de TEST.
// Prérequis : émulateurs (firestore + auth) + seed, site démarré en mode test.
// Usage : node scripts/verifier-passage.mjs [http://localhost:3100]
// Modifie la base de test : relancer le seed ensuite.

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
const appel = (chemin, tok, corps) =>
  fetch(`${SITE}${chemin}`, {
    method: corps ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const lire = async (chemin) => (await (await fetch(`${EMU}/${chemin}`, { headers: OWNER })).json()).fields ?? {};
const valeurs = (champ) => champ?.arrayValue?.values ?? [];

const AUJ = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date());
const HYDRA = "soins-visage--hydrafacial";
const VERNIS = "onglerie--vernis-permanent";
const KNOTLESS = "tresses--knotless-mi-long";
const [accueil, coiffeuse] = await Promise.all([jeton("accueil@test.aza"), jeton("coiffeuse1@test.aza")]);

ok((await appel("/api/gestion/comptoir", coiffeuse, { action: "libre", date: AUJ, lignes: [{ id: HYDRA }], nom: "X", telephone: "770000000", dejaFaite: true })).statut === 403, "une praticienne ne saisit pas de passage");

// Cliente venue sans rendez-vous, deux prestations, deux prestataires, à 7 h (heure passée)
const passage = await appel("/api/gestion/comptoir", accueil, {
  action: "libre",
  date: AUJ,
  debut: 7 * 60,
  lignes: [
    { id: HYDRA, praticienne: "test-estheticienne-1" },
    { id: VERNIS, praticienne: "test-prothesiste-1" },
  ],
  nom: "Cliente de passage (test)",
  telephone: "77 000 55 01",
  dejaFaite: true,
});
ok(passage.statut === 201 && passage.corps.statut === "termine", "passage à 7 h (heure passée, sans durée) : enregistré, déjà « Terminé »");
const rdv = await lire(`rendezVous/${passage.corps.id}`);
const aff = valeurs(rdv.affectations).map((a) => a.mapValue.fields);
ok(
  aff.length === 2 && aff[0].praticiennes.arrayValue.values[0].stringValue === "test-estheticienne-1" && aff[1].praticiennes.arrayValue.values[0].stringValue === "test-prothesiste-1",
  "chaque prestation a sa prestataire (Esthéticienne 1, puis Prothésiste 1)",
);
ok(Number(aff[1].debut.integerValue) === Number(aff[0].fin.integerValue), "les deux prestations s'enchaînent");
ok((await lire("clientes/770005501")).nom?.stringValue === "Cliente de passage (test)", "la fiche cliente est créée");

// Une deuxième cliente au même moment, avec la même esthéticienne : aucun blocage
const meme = await appel("/api/gestion/comptoir", accueil, {
  action: "libre", date: AUJ, debut: 7 * 60, lignes: [{ id: HYDRA, praticienne: "test-estheticienne-1" }], nom: "Autre cliente (test)", telephone: "77 000 55 02", dejaFaite: true,
});
ok(meme.statut === 201, "même heure, même prestataire : enregistré quand même (rien ne bloque)");

// « Peu importe » : quelqu'un qui sait le faire
const libre = await appel("/api/gestion/comptoir", accueil, {
  action: "libre", date: AUJ, lignes: [{ id: KNOTLESS }], nom: "Cliente sans heure (test)", telephone: "77 000 55 03", dejaFaite: false,
});
const aff3 = valeurs((await lire(`rendezVous/${libre.corps.id}`)).affectations)[0]?.mapValue.fields;
ok(libre.statut === 201 && libre.corps.statut === "reserve", "sans heure ni prestataire : enregistré (heure = maintenant)");
ok(aff3?.praticiennes.arrayValue.values[0].stringValue.startsWith("test-coiffeuse"), `« peu importe » : confiée à une coiffeuse (${aff3?.praticiennes.arrayValue.values[0].stringValue})`);

// Numéro en 71 (nouvelle série sénégalaise)
const n71 = await appel("/api/gestion/comptoir", accueil, {
  action: "libre", date: AUJ, lignes: [{ id: VERNIS }], nom: "Cliente 71 (test)", telephone: "+221 71 111 57 54", dejaFaite: true,
});
ok(n71.statut === 201 && (await lire("clientes/711115754")).nom?.stringValue === "Cliente 71 (test)", "numéro en 71 accepté (fiche 711115754)");

// Hier, déjà fait (oubli de saisie)
const hier = new Date(Date.parse(`${AUJ}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
ok(
  (await appel("/api/gestion/comptoir", accueil, { action: "libre", date: hier, debut: 600, lignes: [{ id: VERNIS }], nom: "Oubli d'hier (test)", telephone: "77 000 55 04", dejaFaite: true })).statut === 201,
  "un passage d'hier oublié peut être rattrapé",
);
ok(
  (await appel("/api/gestion/comptoir", accueil, { action: "libre", date: "2020-01-01", lignes: [{ id: VERNIS }], nom: "Trop vieux", telephone: "77 000 55 05", dejaFaite: true })).statut === 400,
  "date trop ancienne : refusée",
);
ok(
  (await appel("/api/gestion/comptoir", accueil, { action: "libre", date: AUJ, lignes: [{ id: VERNIS, praticienne: "personne" }], nom: "Test", telephone: "77 000 55 06", dejaFaite: true })).statut === 400,
  "prestataire inconnue : refusée",
);

// À la caisse : le passage est à encaisser, chaque ligne garde sa prestataire
const aEnc = await appel("/api/gestion/caisse?a-encaisser=1", accueil);
ok(aEnc.corps.some((r) => r.id === passage.corps.id), "le passage apparaît dans « À encaisser »");
await appel("/api/gestion/caisse", accueil, { action: "ouvrir", fond: 0 });
const totalAttendu = Number(rdv.total.integerValue);
const t = await appel("/api/gestion/caisse", accueil, {
  action: "encaisser", rendezVous: passage.corps.id, lignes: [{ id: HYDRA }, { id: VERNIS }], paiements: [{ mode: "especes", montant: totalAttendu }],
});
const lignes = valeurs((await lire(`tickets/${t.corps.id}`)).lignes).map((l) => l.mapValue.fields.praticienne?.mapValue.fields.id.stringValue);
ok(t.statut === 201 && lignes[0] === "test-estheticienne-1" && lignes[1] === "test-prothesiste-1", "ticket : chaque ligne porte sa prestataire");

// Changer le numéro d'une cliente (saisie en 77 au lieu de 71) : la fiche et l'historique suivent
const mauvais = await appel("/api/gestion/comptoir", accueil, {
  action: "libre", date: AUJ, debut: 9 * 60, lignes: [{ id: VERNIS, praticienne: "test-prothesiste-1" }], nom: "Numéro à corriger (test)", telephone: "77 000 55 10", dejaFaite: true,
});
const ticketMauvais = await appel("/api/gestion/caisse", accueil, {
  action: "encaisser", rendezVous: mauvais.corps.id, lignes: [{ id: VERNIS }], paiements: [{ mode: "especes", montant: 5000 }],
});
ok(ticketMauvais.statut === 201, "fiche et ticket créés sous 77 000 55 10");
ok((await appel("/api/gestion/clientes", coiffeuse, { action: "numero", id: "770005510", telephone: "71 000 55 10" })).statut === 403, "une praticienne ne change pas un numéro");
ok((await appel("/api/gestion/clientes", accueil, { action: "numero", id: "770005510", telephone: "72 000 55 10" })).statut === 400, "numéro invalide : refusé");
ok((await appel("/api/gestion/clientes", accueil, { action: "numero", id: "770005510", telephone: "77 000 55 01" })).statut === 409, "numéro déjà pris par une autre cliente : refusé (pas de doublon)");
const change = await appel("/api/gestion/clientes", accueil, { action: "numero", id: "770005510", telephone: "+221 71 000 55 10" });
ok(change.statut === 200 && change.corps.id === "710005510" && change.corps.rattaches >= 2, `numéro changé : 710005510 (${change.corps.rattaches} rendez-vous/tickets rattachés)`);
const ficheNouvelle = await lire("clientes/710005510");
ok(ficheNouvelle.nom?.stringValue === "Numéro à corriger (test)" && valeurs(ficheNouvelle.anciensNumeros)[0]?.stringValue === "770005510", "la fiche garde son nom et note l'ancien numéro");
ok((await fetch(`${EMU}/clientes/770005510`, { headers: OWNER })).status === 404, "plus de fiche sous l'ancien numéro (pas de doublon)");
ok((await lire(`rendezVous/${mauvais.corps.id}`)).cliente?.mapValue.fields.id.stringValue === "710005510", "le rendez-vous suit la fiche");
ok((await lire(`tickets/${ticketMauvais.corps.id}`)).cliente?.mapValue.fields.id.stringValue === "710005510", "le ticket suit la fiche");
const fiche = await appel("/api/gestion/clientes?id=710005510", accueil);
ok(fiche.statut === 200 && fiche.corps.historique.length >= 2, "l'historique s'affiche sous le nouveau numéro");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
