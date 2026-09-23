// Remplit l'émulateur Firestore LOCAL avec des données de TEST pour essayer la réservation.
//
// Usage (depuis le dossier du projet, émulateurs lancés) :
//   node --experimental-strip-types --no-warnings scripts/seed-emulateur.mjs
//
// SÉCURITÉ : ne parle qu'à l'émulateur (127.0.0.1:8080) et à un projet « demo-* ».
// Aucun chemin vers une vraie base. Il VIDE la base de test avant de la remplir.
//
// ATTENTION : l'équipe, les postes et les durées ci-dessous sont FICTIFS. Ils servent
// uniquement à tester. Les vrais viendront de docs/releve-durees-prestations.xlsx.
// Les horaires de l'institut, eux, sont les vrais (plaquette V2).

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { FAMILLES } from "../lib/catalogue.ts";

const PROJET = process.env.FIREBASE_PROJECT_ID ?? "demo-aza";
if (!PROJET.startsWith("demo-")) throw new Error("Refus : ce script ne tourne que sur un projet demo-*.");
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const db = getFirestore(initializeApp({ projectId: PROJET }));

// Vider la base de test (API de l'émulateur).
await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJET}/databases/(default)/documents`, { method: "DELETE" });

const h = (x) => x * 60;
const semaine = [{ debut: h(9), fin: h(19) }];
const HORAIRES = { 0: [{ debut: h(10), fin: h(18) }], 1: semaine, 2: semaine, 3: semaine, 4: semaine, 5: semaine, 6: semaine };

// --- Réglages de l'institut (horaires réels, le reste = valeurs par défaut du cahier des charges)
await db.doc("reglages/institut").set({
  horaires: HORAIRES,
  fermetures: [],
  delaiMinimumMinutes: 120,
  pasMinutes: 30,
  acompte: { montantMin: 30000, dureeMinMinutes: 120, absencesMax: 2 },
});

// --- Postes (FICTIFS)
const postes = { "cabine-1": "cabine", "cabine-2": "cabine", "table-1": "table-massage",
  "coiffure-1": "coiffure", "coiffure-2": "coiffure", "coiffure-3": "coiffure",
  "onglerie-1": "onglerie", "onglerie-2": "onglerie" };
for (const [id, type] of Object.entries(postes)) await db.doc(`postes/${id}`).set({ type, test: true });

// --- Paramètres de réservation par famille (durées FICTIVES)
const seul = (min) => [{ minutes: min, praticienne: true, poste: true }];
const avecPose = (avant, pose, apres) => [
  { minutes: avant, praticienne: true, poste: true },
  { minutes: pose, praticienne: false, poste: true },
  { minutes: apres, praticienne: true, poste: true },
];
const PAR_FAMILLE = {
  "epilation-femme": ["cabine", seul(30)],
  "epilation-homme": ["cabine", seul(30)],
  tresses: ["coiffure", seul(240)],
  "tresses-enfant": ["coiffure", seul(120)],
  tissage: ["coiffure", seul(120)],
  locks: ["coiffure", seul(180)],
  "soins-cheveux": ["coiffure", seul(45)],
  "traitement-cheveux": ["coiffure", avecPose(15, 30, 15)],
  coiffure: ["coiffure", seul(90)],
  maquillage: ["coiffure", seul(60)],
  onglerie: ["onglerie", avecPose(40, 15, 5)],
  dissolution: ["onglerie", seul(30)],
  "beaute-mains": ["onglerie", seul(45)],
  "beaute-pieds": ["onglerie", seul(60)],
  "pose-cils": ["cabine", seul(90)],
  massage: ["table-massage", seul(60)],
  lipocavitation: ["cabine", seul(45)],
  gommage: ["cabine", seul(60)],
  "soins-visage": ["cabine", avecPose(30, 15, 30)],
};

let n = 0;
const lot = db.batch();
for (const f of FAMILLES) {
  const [typePoste, phases] = PAR_FAMILLE[f.id];
  for (const p of f.prestations) {
    if (p.note === "Produit") continue;
    lot.set(db.doc(`prestationsResa/${p.id}`), {
      phases,
      typePoste,
      competence: f.id,
      praticiennes: p.id === "massage--massage-a-quatre-mains" ? 2 : 1,
      // Prestation à l'extérieur : sur devis, pas en ligne.
      enLigne: !p.nom.includes("à l'extérieur"),
      test: true,
    });
    n++;
  }
}
await lot.commit();

// --- Praticiennes (FICTIVES)
const equipe = [
  ["test-coiffeuse-1", "Coiffeuse test 1", ["tresses", "tresses-enfant", "tissage", "locks", "soins-cheveux", "traitement-cheveux", "coiffure"]],
  ["test-coiffeuse-2", "Coiffeuse test 2", ["tresses", "tresses-enfant", "tissage", "locks", "soins-cheveux", "coiffure"]],
  ["test-maquilleuse", "Maquilleuse test", ["maquillage", "coiffure"]],
  ["test-estheticienne-1", "Esthéticienne test 1", ["epilation-femme", "epilation-homme", "soins-visage", "gommage", "lipocavitation", "pose-cils"]],
  ["test-estheticienne-2", "Esthéticienne test 2", ["epilation-femme", "massage", "gommage", "soins-visage"]],
  ["test-masseuse", "Masseuse test", ["massage", "gommage"]],
  ["test-prothesiste-1", "Prothésiste test 1", ["onglerie", "dissolution", "beaute-mains", "beaute-pieds"]],
  ["test-prothesiste-2", "Prothésiste test 2", ["onglerie", "dissolution", "beaute-mains", "beaute-pieds"]],
];
for (const [id, nom, competences] of equipe) {
  await db.doc(`praticiennes/${id}`).set({ nom, competences, horaires: HORAIRES, actif: true, test: true });
}

console.log(`Base de test « ${PROJET} » prête : ${n} prestations paramétrées, ${equipe.length} praticiennes, ${Object.keys(postes).length} postes (tous FICTIFS).`);
process.exit(0);
