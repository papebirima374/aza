// Vérification de bout en bout de la réservation en ligne, sur la base de TEST.
//
// Prérequis : émulateur lancé + seed, puis le site démarré avec
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
// Usage : node scripts/verifier-reservation.mjs [http://localhost:3100]
//
// Contrôle notamment le critère C-03 : dix clientes qui réservent le même créneau au
// même instant → seules les places réellement libres sont données, les autres sont refusées.

const SITE = process.argv[2] ?? "http://localhost:3100";
let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "OK   " : "ÉCHEC"} ${msg}`);
  if (!cond) echecs++;
};

// Un lundi dans 14 jours (les créneaux « dans moins de 2 h » ne gênent pas).
const d = new Date();
d.setUTCDate(d.getUTCDate() + 14);
while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
const DATE = d.toISOString().slice(0, 10);

const get = (chemin) => fetch(SITE + chemin).then(async (r) => ({ statut: r.status, corps: await r.json() }));
const post = (corps) =>
  fetch(`${SITE}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  }).then(async (r) => ({ statut: r.status, corps: await r.json() }));

const SOIN = "soins-visage--hydrafacial";
const MASSAGE_4 = "massage--massage-a-quatre-mains";
const KNOTLESS = "tresses--knotless-mi-long";

// 1. Créneaux d'un soin
const c1 = await get(`/api/creneaux?date=${DATE}&p=${SOIN}`);
ok(c1.statut === 200, `créneaux du soin visage le ${DATE} (statut ${c1.statut})`);
ok(c1.corps.creneaux?.[0]?.debut === 540, "premier créneau à 9h");
ok(c1.corps.acompte === true, "Hydrafacial à 45 000 F : acompte demandé (> 30 000 F)");

// 2. Course : 10 réservations simultanées sur 9h
const course = await Promise.all(
  Array.from({ length: 10 }, (_, i) =>
    post({ date: DATE, debut: 540, prestations: [SOIN], nom: `Cliente test ${i}`, telephone: `77 000 00 ${String(i).padStart(2, "0")}` }),
  ),
);
const reussies = course.filter((r) => r.statut === 201).length;
const refusees = course.filter((r) => r.statut === 409).length;
// Deux esthéticiennes savent faire le soin, mais il n'y a que 2 cabines : 2 places au plus à 9h.
ok(reussies === 2 && refusees === 8, `10 réservations simultanées à 9h : ${reussies} acceptées, ${refusees} refusées (attendu 2 et 8)`);

// 3. Le créneau de 9h n'est plus proposé
const c2 = await get(`/api/creneaux?date=${DATE}&p=${SOIN}`);
ok(!c2.corps.creneaux.some((c) => c.debut === 540), "9h n'est plus proposé après les réservations");

// 4. Massage à quatre mains : deux masseuses et la table de massage
const m = await post({ date: DATE, debut: 660, prestations: [MASSAGE_4], nom: "Cliente quatre mains", telephone: "+221 77 111 11 11" });
ok(m.statut === 201, `massage à quatre mains à 11h réservé (statut ${m.statut})`);
const m2 = await post({ date: DATE, debut: 660, prestations: ["massage--massage-relaxant"], nom: "Autre", telephone: "77 111 11 12" });
ok(m2.statut === 409, "un autre massage à 11h est refusé (table déjà prise)");

// 5. Prestations enchaînées ; aucun nom de l'équipe sur le site public
const p = await get(`/api/creneaux?date=${DATE}&p=${KNOTLESS}`);
ok(p.statut === 200 && !("praticiennes" in p.corps) && !JSON.stringify(p.corps).includes("Coiffeuse"), "le site ne montre aucun nom de praticienne");
const enchaine = await post({
  date: DATE, debut: 900, prestations: ["coiffure--coiffure-ceremonie", "maquillage--maquillage-ceremonie"],
  nom: "Mariée test", telephone: "0022177 222 22 22",
});
ok(enchaine.statut === 201 && enchaine.corps.fin === 900 + 90 + 60, "coiffure + maquillage enchaînés de 15h à 17h30");

// 6. Contrôles de saisie
const mauvais = await post({ date: DATE, debut: 660, prestations: [SOIN], nom: "X", telephone: "12" });
ok(mauvais.statut === 400, "nom ou téléphone invalide refusé");
const passe = await post({ date: "2020-01-06", debut: 600, prestations: [SOIN], nom: "Passé", telephone: "77 333 33 33" });
ok(passe.statut === 400, "une date passée est refusée");
const produit = await get(`/api/creneaux?date=${DATE}&p=locks--lot-de-10-tiges-locks-6-pouces`);
ok(produit.statut === 422, "un produit (tiges locks) ne se réserve pas");

// 7. Un même numéro écrit autrement = la même cliente
const a = await post({ date: DATE, debut: 720, prestations: ["epilation-femme--aisselles"], nom: "Awa Test", telephone: "77 444 44 44" });
const b = await post({ date: DATE, debut: 780, prestations: ["epilation-femme--aisselles"], nom: "Awa T.", telephone: "+221774444444" });
ok(a.statut === 201 && b.statut === 201, "deux rendez-vous pour le même numéro écrit autrement");
const EMU = "http://127.0.0.1:8080/v1/projects/demo-aza/databases/(default)/documents";
const fiche = await fetch(`${EMU}/clientes/774444444`, { headers: { Authorization: "Bearer owner" } });
const doublon = await fetch(`${EMU}/clientes/221774444444`, { headers: { Authorization: "Bearer owner" } });
ok(fiche.status === 200 && doublon.status === 404, "une seule fiche cliente pour ce numéro (pas de doublon)");

console.log(echecs === 0 ? "\nTout est bon." : `\n${echecs} contrôle(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
