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
      affectations: { arrayValue: { values: [{ mapValue: { fields: { prestation: { stringValue: "soins-visage--hydrafacial" }, praticiennes: { arrayValue: { values: [{ stringValue: "test-estheticienne-1" }] } } } } }] } },
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
ok((await caisse(accueil, { action: "ouvrir", fond: 5000 })).statut === 409, "on n'ouvre pas deux fois sa caisse du jour");
// Chaque personne a sa propre caisse : le manager ouvre la sienne, à côté de celle de l'accueil.
ok((await caisse(manager, { action: "ouvrir", fond: 0 })).statut === 201, "le manager ouvre SA caisse en même temps (fond 0 F)");

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
ok((await lire(`tickets/${av.corps.id}`)).caisse?.stringValue === (await lire(`tickets/${t1.corps.id}`)).caisse?.stringValue, "l'avoir sort du tiroir qui avait reçu l'argent (caisse de l'accueil)");
ok((await lire(`rendezVous/${RDV}`)).statut?.stringValue === "termine", "le rendez-vous redevient « Terminé » (à ré-encaisser)");
ok((await caisse(manager, { action: "annuler", id: t1.corps.id, motif: "encore" })).statut === 409, "un ticket ne s'annule qu'une fois");
ok((await fetch(`${EMU}/tickets/${t1.corps.id}`, { headers: OWNER })).status === 200, "le ticket annulé existe toujours (jamais supprimé)");

// Journal et clôture
const j = await caisse(comptable, undefined, `?date=${AUJOURDHUI}`);
ok(j.statut === 200, "le comptable lit le journal du jour");
ok(j.corps.voitTout && j.corps.caisses.length === 2, "le comptable voit les 2 caisses du jour");
// Espèces : fond 20 000 + (t1 annulé : 0) + 6 000 + 5 000 + 2 000 + 10 × 6 000
const attendu = 20000 + 6000 + 5000 + 2000 + 60000;
ok(j.corps.totaux.especesAttendues === attendu, `espèces attendues dans le tiroir : ${j.corps.totaux.especesAttendues} F (calcul manuel ${attendu} F)`);
ok(j.corps.totaux.parMode.wave === 5000 && j.corps.totaux.parMode["orange-money"] === 7000, "Wave 5 000 F, Orange Money 7 000 F");
ok((await caisse(comptable, { action: "cloturer", compte: attendu })).statut === 403, "le comptable ne clôture pas");
// La caisse de l'accueil seule : fond 20 000 + (t1 annulé : l'avoir sort du même tiroir) + 6 000 + 2 000 + 60 000
const ja = await caisse(accueil, undefined, `?date=${AUJOURDHUI}`);
const attenduAccueil = 20000 + 6000 + 2000 + 60000;
ok(!ja.corps.voitTout && ja.corps.tickets.every((t) => t.caisse === ja.corps.caisse.id), "l'accueil ne voit que les tickets de sa caisse");
ok(ja.corps.totaux.especesAttendues === attenduAccueil, `tiroir de l'accueil : ${ja.corps.totaux.especesAttendues} F (calcul manuel ${attenduAccueil} F)`);
ok((await caisse(accueil, { action: "cloturer", compte: attenduAccueil - 500 })).statut === 400, "écart de 500 F sans explication : refusé");
const cl = await caisse(accueil, { action: "cloturer", compte: attenduAccueil - 500, justification: "Pièce de 500 F introuvable" });
ok(cl.statut === 200 && cl.corps.ecart === -500, "clôture avec un écart de −500 F justifié");
ok(
  (await caisse(accueil, { action: "encaisser", lignes: [{ id: TIGES }], paiements: [{ mode: "especes", montant: 6000 }] })).statut === 409,
  "après la clôture : plus d'encaissement ce jour-là",
);
const j2 = await caisse(direction, undefined, `?date=${AUJOURDHUI}`);
const caisseAccueil = j2.corps.caisses.find((c) => c.id === ja.corps.caisse.id);
ok(caisseAccueil.cloture.ecart === -500 && caisseAccueil.cloture.justification.length > 3, "le journal garde l'écart et sa justification");
ok(
  (await caisse(manager, { action: "encaisser", lignes: [{ id: TIGES }], paiements: [{ mode: "especes", montant: 6000 }] })).statut === 201,
  "la caisse du manager reste ouverte après la clôture de l'accueil",
);
ok((await caisse(accueil, { action: "cloturer", caisse: j2.corps.caisses.find((c) => c.id !== caisseAccueil.id).id, compte: 0, justification: "test" })).statut === 403, "l'accueil ne clôture pas la caisse d'une autre");
const caisseManager = j2.corps.caisses.find((c) => c.id !== caisseAccueil.id);
const attenduManager = 5000 + 6000;
const clm = await caisse(direction, { action: "cloturer", caisse: caisseManager.id, compte: attenduManager });
ok(clm.statut === 200 && clm.corps.ecart === 0, `la direction clôture la caisse du manager (attendu ${attenduManager} F, écart 0)`);
ok((await caisse(direction, { action: "ouvrir", fond: 15000 })).statut === 201, "la direction ouvre aussi sa propre caisse");

// Prestataire sur chaque ligne : cliente de passage, sans rendez-vous
const equipe = (await caisse(direction, undefined, "?equipe=1")).corps;
ok(Array.isArray(equipe) && equipe.length > 0, `la caisse connaît l'équipe (${equipe.length} prestataires)`);
const ticketRdv = await lire(`tickets/${t1.corps.id}`);
ok(
  ticketRdv.lignes?.arrayValue?.values?.[0]?.mapValue?.fields?.praticienne?.mapValue?.fields?.id?.stringValue === "test-estheticienne-1",
  "ticket d'un rendez-vous : la prestataire du rendez-vous est reprise sur la ligne",
);
const passage = await caisse(direction, {
  action: "encaisser",
  lignes: [{ id: HYDRA, praticienne: equipe[0].id }, { id: TIGES, praticienne: equipe[1].id }],
  paiements: [{ mode: "especes", montant: totalHydra + 6000 }],
});
const lp = (await lire(`tickets/${passage.corps.id}`)).lignes?.arrayValue?.values ?? [];
ok(
  passage.statut === 201 && lp[0]?.mapValue.fields.praticienne?.mapValue.fields.nom.stringValue === equipe[0].nom && lp[1]?.mapValue.fields.praticienne?.mapValue.fields.id.stringValue === equipe[1].id,
  `cliente de passage : soin fait par ${equipe[0].nom}, produit vendu par ${equipe[1].nom}`,
);
ok(
  (await caisse(direction, { action: "encaisser", lignes: [{ id: TIGES, praticienne: "inconnue" }], paiements: [{ mode: "especes", montant: 6000 }] })).statut === 400,
  "prestataire inconnue : refusée",
);
ok(
  (await caisse(direction, { action: "encaisser", lignes: [{ id: TIGES, praticienne: "../x" }], paiements: [{ mode: "especes", montant: 6000 }] })).statut === 400,
  "identifiant de prestataire malformé : refusé",
);

// Ancienne caisse commune (ouverte avant la mise à jour) : elle reste celle de la personne qui l'a ouverte
const uidAccueil = (await lire(`tickets/${t1.corps.id}`)).caisse.stringValue.split("~")[1];
const HIER = "2000-01-01";
await fetch(`${EMU}/caisses/${HIER}`, { method: "PATCH", headers: { ...OWNER, "Content-Type": "application/json" }, body: JSON.stringify({ fields: { date: { stringValue: HIER }, statut: { stringValue: "cloturee" }, fond: { integerValue: 1000 }, ouvertPar: { mapValue: { fields: { uid: { stringValue: uidAccueil }, nom: { stringValue: "Accueil" } } } } } }) });
await fetch(`${EMU}/tickets/ancien-ticket`, { method: "PATCH", headers: { ...OWNER, "Content-Type": "application/json" }, body: JSON.stringify({ fields: { date: { stringValue: HIER }, numero: { integerValue: 1 }, type: { stringValue: "vente" }, total: { integerValue: 6000 }, paiements: { arrayValue: { values: [{ mapValue: { fields: { mode: { stringValue: "especes" }, montant: { integerValue: 6000 } } } }] } }, lignes: { arrayValue: { values: [] } } } }) });
const ancien = await caisse(accueil, undefined, `?date=${HIER}`);
ok(ancien.corps.caisse?.id === HIER && ancien.corps.tickets.length === 1 && ancien.corps.totaux.especesAttendues === 7000, "ancienne caisse commune : retrouvée avec son ticket (rien n'est perdu)");

// Sessions de caisse : retrouver les caisses d'une période (direction, manager, comptable)
ok((await caisse(accueil, undefined, `?sessions=1&du=${AUJOURDHUI}&au=${AUJOURDHUI}`)).statut === 403, "l'accueil ne voit pas les sessions de toutes les caisses");
const sess = await caisse(comptable, undefined, `?sessions=1&du=2000-01-01&au=2000-01-01`);
ok(sess.statut === 200 && sess.corps.jours[0]?.caisses[0]?.id === "2000-01-01" && sess.corps.jours[0].recette === 6000, "sessions : l'ancienne caisse commune du 1er janvier 2000 est retrouvée avec sa recette");
const sessJour = await caisse(direction, undefined, `?sessions=1&du=${AUJOURDHUI}&au=${AUJOURDHUI}`);
ok(sessJour.statut === 200 && sessJour.corps.jours[0]?.caisses.length === 3, `sessions du jour : ${sessJour.corps.jours[0]?.caisses.length} caisses (accueil, manager, direction)`);
ok(sessJour.corps.jours[0].caisses.some((c) => c.cloture?.ecart === -500), "l'écart de la caisse de l'accueil est dans la session");
ok((await caisse(direction, undefined, `?sessions=1&du=2026-01-01&au=2026-12-31`)).statut === 400, "période de plus de 3 mois : refusée");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
