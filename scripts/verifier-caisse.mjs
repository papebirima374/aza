// Vérification de la caisse (M-05), sur la base de TEST.
// Prérequis : émulateurs + seed (base fraîche : aucune caisse ouverte aujourd'hui), site démarré en mode test.
// Usage : node scripts/verifier-caisse.mjs [http://localhost:3100]
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
const caisse = (tok, corps, q = "") =>
  fetch(`${SITE}/api/gestion/caisse${q}`, {
    method: corps ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
    body: corps ? JSON.stringify(corps) : undefined,
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const lire = async (chemin) => (await (await fetch(`${EMU}/${chemin}`, { headers: OWNER })).json()).fields ?? {};

const [direction, manager, accueil, coiffeuse, comptable] = await Promise.all(
  ["direction", "manager", "accueil", "coiffeuse1", "comptable"].map((n) => jeton(`${n}@test.aza`)),
);
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

// Un rendez-vous d'aujourd'hui, marqué « Terminé » (créé ici pour ne dépendre de rien).
const RDV = "test-caisse-rdv";
await fetch(`${EMU}/rendezVous?documentId=${RDV}`, {
  method: "POST",
  headers: { ...OWNER, "Content-Type": "application/json" },
  body: JSON.stringify({
    fields: {
      date: { stringValue: AUJOURDHUI },
      debut: { integerValue: 600 },
      fin: { integerValue: 660 },
      statut: { stringValue: "termine" },
      total: { integerValue: 15000 },
      prestations: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: "soins-visage--hydrafacial" }, nom: { stringValue: "Hydrafacial" }, prix: { integerValue: 0 } } } }] } },
      cliente: { mapValue: { fields: { id: { stringValue: "770000901" }, nom: { stringValue: "Cliente caisse" }, telephone: { stringValue: "77 000 09 01" } } } },
      historique: { arrayValue: { values: [] } },
    },
  }),
});
const HYDRA = "soins-visage--hydrafacial";
const TIGES = "locks--lot-de-10-tiges-locks-6-pouces";

// Droits et ouverture
ok((await caisse(comptable, { action: "ouvrir", fond: 10000 })).statut === 403, "le comptable n'ouvre pas la caisse");
ok((await caisse(coiffeuse, { action: "ouvrir", fond: 10000 })).statut === 403, "une praticienne non plus");
ok(
  (await caisse(accueil, { action: "encaisser", lignes: [{ id: TIGES }], paiements: [{ mode: "especes", montant: 6000 }] })).statut === 409,
  "encaisser avant l'ouverture : refusé",
);
ok((await caisse(accueil, { action: "ouvrir", fond: 20000 })).statut === 201, "l'accueil ouvre la caisse avec 20 000 F de fond");
ok((await caisse(accueil, { action: "ouvrir", fond: 5000 })).statut === 409, "on n'ouvre pas deux fois la même journée");

// Ticket du rendez-vous terminé, payé en espèces avec monnaie rendue
const aEnc = await caisse(accueil, undefined, "?a-encaisser=1");
ok(aEnc.corps.some((r) => r.id === RDV), "le rendez-vous terminé apparaît dans « À encaisser »");
const t1 = await caisse(accueil, { action: "encaisser", rendezVous: RDV, lignes: [{ id: HYDRA }], paiements: [{ mode: "especes", montant: 100000 }] });
const totalHydra = t1.corps.total;
ok(t1.statut === 201 && t1.corps.reference === "T-000001", `premier ticket : ${t1.corps.reference}, ${totalHydra} F`);
ok(t1.corps.rendu === 100000 - totalHydra, `monnaie rendue : ${t1.corps.rendu} F`);
ok((await lire(`rendezVous/${RDV}`)).statut?.stringValue === "encaisse", "le rendez-vous passe à « Encaissé »");
ok(
  (await caisse(accueil, { action: "encaisser", rendezVous: RDV, lignes: [{ id: HYDRA }], paiements: [{ mode: "especes", montant: totalHydra }] })).statut === 409,
  "impossible d'encaisser deux fois le même rendez-vous",
);

// Vente de produits, paiement mixte Wave + Orange Money
const t2 = await caisse(accueil, {
  action: "encaisser",
  lignes: [{ id: TIGES, quantite: 2 }],
  paiements: [{ mode: "wave", montant: 5000 }, { mode: "orange-money", montant: 7000 }],
});
ok(t2.statut === 201 && t2.corps.total === 12000 && t2.corps.reference === "T-000002", "2 lots de tiges (12 000 F) payés Wave + Orange Money");
ok(
  (await caisse(accueil, { action: "encaisser", lignes: [{ id: TIGES }], paiements: [{ mode: "wave", montant: 5000 }] })).statut === 400,
  "paiement incomplet : refusé",
);
ok(
  (await caisse(accueil, { action: "encaisser", lignes: [{ id: TIGES }], paiements: [{ mode: "wave", montant: 9000 }] })).statut === 400,
  "trop payé par Wave (pas de monnaie à rendre) : refusé",
);
ok(
  (await caisse(accueil, { action: "encaisser", lignes: [{ id: TIGES, prix: 1 }], paiements: [{ mode: "especes", montant: 6000 }] })).corps.total === 6000,
  "le prix vient du catalogue, jamais de l'écran",
);

// Remises
const remise = (tok, motif) =>
  caisse(tok, { action: "encaisser", lignes: [{ id: TIGES }], remise: { montant: 1000, motif }, paiements: [{ mode: "especes", montant: 5000 }] });
ok((await remise(accueil, "fidélité")).statut === 403, "l'accueil ne donne pas de remise");
ok((await remise(manager, "")).statut === 400, "remise sans motif : refusée");
const t5 = await remise(manager, "Cliente fidèle");
ok(t5.statut === 201 && t5.corps.total === 5000, "remise de 1 000 F par le manager, avec motif");

// Crédit (créance)
ok(
  (await caisse(accueil, { action: "encaisser", lignes: [{ id: TIGES }], paiements: [{ mode: "credit", montant: 6000 }] })).statut === 400,
  "vente à crédit sans cliente : refusée",
);
const t6 = await caisse(accueil, {
  action: "encaisser",
  lignes: [{ id: TIGES }],
  paiements: [{ mode: "especes", montant: 2000 }, { mode: "credit", montant: 4000 }],
  cliente: { nom: "Cliente crédit", telephone: "77 000 09 02" },
});
ok(t6.statut === 201, "vente avec 4 000 F à crédit");
ok(Number((await lire("clientes/770000902")).credit?.integerValue) === 4000, "la fiche cliente doit 4 000 F");

// Numérotation : 10 ventes en même temps
const lot = await Promise.all(
  Array.from({ length: 10 }, () => caisse(accueil, { action: "encaisser", lignes: [{ id: TIGES }], paiements: [{ mode: "especes", montant: 6000 }] })),
);
const numeros = lot.map((r) => Number(r.corps.reference?.slice(2))).sort((a, b) => a - b);
ok(
  lot.every((r) => r.statut === 201) && numeros.every((n, i) => i === 0 || n === numeros[i - 1] + 1) && numeros[0] === 6,
  `10 ventes simultanées : numéros ${numeros[0]} à ${numeros.at(-1)}, sans trou ni doublon`,
);

// Annulation par avoir
ok((await caisse(accueil, { action: "annuler", id: t1.corps.id, motif: "erreur" })).statut === 403, "l'accueil n'annule pas un ticket");
ok((await caisse(manager, { action: "annuler", id: t1.corps.id, motif: "" })).statut === 400, "annulation sans motif : refusée");
const av = await caisse(manager, { action: "annuler", id: t1.corps.id, motif: "Mauvaise prestation saisie" });
ok(av.statut === 201 && av.corps.reference === "T-000016", `avoir ${av.corps.reference} créé`);
ok((await lire(`rendezVous/${RDV}`)).statut?.stringValue === "termine", "le rendez-vous redevient « Terminé » (à ré-encaisser)");
ok((await caisse(manager, { action: "annuler", id: t1.corps.id, motif: "encore" })).statut === 409, "un ticket ne s'annule qu'une fois");
ok((await fetch(`${EMU}/tickets/${t1.corps.id}`, { headers: OWNER })).status === 200, "le ticket annulé existe toujours (jamais supprimé)");

// Journal et clôture
const j = await caisse(comptable, undefined, `?date=${AUJOURDHUI}`);
ok(j.statut === 200, "le comptable lit le journal du jour");
// Espèces : fond 20 000 + (t1 annulé : 0) + 6 000 + 5 000 + 2 000 + 10 × 6 000
const attendu = 20000 + 6000 + 5000 + 2000 + 60000;
ok(j.corps.totaux.especesAttendues === attendu, `espèces attendues dans le tiroir : ${j.corps.totaux.especesAttendues} F (calcul manuel ${attendu} F)`);
ok(j.corps.totaux.parMode.wave === 5000 && j.corps.totaux.parMode["orange-money"] === 7000, "Wave 5 000 F, Orange Money 7 000 F");
ok((await caisse(comptable, { action: "cloturer", compte: attendu })).statut === 403, "le comptable ne clôture pas");
ok((await caisse(accueil, { action: "cloturer", compte: attendu - 500 })).statut === 400, "écart de 500 F sans explication : refusé");
const cl = await caisse(accueil, { action: "cloturer", compte: attendu - 500, justification: "Pièce de 500 F introuvable" });
ok(cl.statut === 200 && cl.corps.ecart === -500, "clôture avec un écart de −500 F justifié");
ok(
  (await caisse(accueil, { action: "encaisser", lignes: [{ id: TIGES }], paiements: [{ mode: "especes", montant: 6000 }] })).statut === 409,
  "après la clôture : plus d'encaissement ce jour-là",
);
const j2 = await caisse(direction, undefined, `?date=${AUJOURDHUI}`);
ok(j2.corps.caisse.cloture.ecart === -500 && j2.corps.caisse.cloture.justification.length > 3, "le journal garde l'écart et sa justification");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
