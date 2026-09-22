// Tests du moteur de disponibilité : une règle du cahier des charges (§6.1) par test.
// Les praticiennes, postes et durées ci-dessous sont FICTIFS (données de test uniquement).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acompteRequis,
  creneauxDisponibles,
  occupationsDuCreneau,
  planifier,
  type Contexte,
  type Demande,
  type PrestationResa,
} from "../lib/reservation/disponibilites.ts";

const h = (x: number) => x * 60;
const semaine = { debut: h(9), fin: h(19) };
const dimanche = { debut: h(10), fin: h(18) };
const HORAIRES = { 0: [dimanche], 1: [semaine], 2: [semaine], 3: [semaine], 4: [semaine], 5: [semaine], 6: [semaine] };

const LUNDI = "2026-10-05";
const DIMANCHE = "2026-10-04";

function contexte(partiel: Partial<Contexte> = {}): Contexte {
  return {
    horairesInstitut: HORAIRES,
    praticiennes: [
      { id: "esth-1", nom: "Esthéticienne 1", competences: ["soins-visage", "massage"], horaires: HORAIRES },
      { id: "esth-2", nom: "Esthéticienne 2", competences: ["massage"], horaires: HORAIRES },
      { id: "coif-1", nom: "Coiffeuse 1", competences: ["tresses", "coiffure"], horaires: HORAIRES },
      { id: "maq-1", nom: "Maquilleuse 1", competences: ["maquillage"], horaires: HORAIRES },
    ],
    postes: [
      { id: "cabine-1", type: "cabine" },
      { id: "table-1", type: "table-massage" },
      { id: "coiffure-1", type: "coiffure" },
      { id: "coiffure-2", type: "coiffure" },
    ],
    occupations: [],
    fermetures: [],
    delaiMinimumMinutes: 120,
    pasMinutes: 30,
    ...partiel,
  };
}

const soin = (minutes: number): PrestationResa => ({
  id: "soin",
  nom: "Soin du visage",
  phases: [{ minutes, praticienne: true, poste: true }],
  typePoste: "cabine",
  competence: "soins-visage",
  praticiennes: 1,
});

const demande = (prestations: PrestationResa[], extra: Partial<Demande> = {}): Demande => ({
  date: LUNDI,
  prestations,
  maintenant: { date: "2026-10-01", minutes: h(12) },
  ...extra,
});

const debuts = (d: Demande, c: Contexte) => creneauxDisponibles(d, c).map((x) => x.debut);

test("durée réelle : seuls les créneaux qui finissent avant la fermeture sont proposés", () => {
  const d = debuts(demande([soin(60)]), contexte());
  assert.equal(d[0], h(9));
  assert.equal(d.at(-1), h(18));
  assert.equal(d.length, 19);
});

test("une praticienne déjà prise bloque le créneau", () => {
  const c = contexte({ occupations: [{ ressource: "esth-1", date: LUNDI, debut: h(10), fin: h(11) }] });
  const d = debuts(demande([soin(60)]), c);
  assert.ok(!d.includes(h(10)));
  assert.ok(!d.includes(h(9) + 30)); // 9h30–10h30 chevauche
  assert.ok(d.includes(h(9)) && d.includes(h(11)));
});

test("double ressource : praticienne libre mais poste occupé = pas de créneau", () => {
  const c = contexte({ occupations: [{ ressource: "cabine-1", date: LUNDI, debut: h(14), fin: h(15) }] });
  assert.ok(!debuts(demande([soin(60)]), c).includes(h(14)));
});

test("compétences : une esthéticienne n'apparaît pas sur des tresses", () => {
  const tresses: PrestationResa = {
    id: "knotless",
    nom: "Knotless",
    phases: [{ minutes: 240, praticienne: true, poste: true }],
    typePoste: "coiffure",
    competence: "tresses",
    praticiennes: 1,
  };
  const c = creneauxDisponibles(demande([tresses]), contexte());
  assert.ok(c.length > 0);
  assert.ok(c.every((x) => x.affectations[0].praticiennes[0] === "coif-1"));
});

test("temps de pause : la praticienne est libérée pendant la pose, le poste reste occupé", () => {
  const avecPose: PrestationResa = {
    id: "soin-pose",
    nom: "Soin avec temps de pose",
    phases: [
      { minutes: 30, praticienne: true, poste: true },
      { minutes: 30, praticienne: false, poste: true },
      { minutes: 30, praticienne: true, poste: true },
    ],
    typePoste: "cabine",
    competence: "soins-visage",
    praticiennes: 1,
  };
  // La praticienne a un autre rendez-vous de 10h30 à 11h, pendant la pose : ça passe.
  const c1 = contexte({ occupations: [{ ressource: "esth-1", date: LUNDI, debut: h(10) + 30, fin: h(11) }] });
  assert.ok(debuts(demande([avecPose]), c1).includes(h(10)));
  // Mais si c'est la cabine qui est prise pendant la pose : impossible.
  const c2 = contexte({ occupations: [{ ressource: "cabine-1", date: LUNDI, debut: h(10) + 30, fin: h(11) }] });
  assert.ok(!debuts(demande([avecPose]), c2).includes(h(10)));
});

test("massage à quatre mains : les deux agendas sont réservés ensemble", () => {
  const quatreMains: PrestationResa = {
    id: "massage-4-mains",
    nom: "Massage à quatre mains",
    phases: [{ minutes: 60, praticienne: true, poste: true }],
    typePoste: "table-massage",
    competence: "massage",
    praticiennes: 2,
  };
  const c = planifier(demande([quatreMains]), contexte(), h(15));
  assert.deepEqual(c?.affectations[0].praticiennes.sort(), ["esth-1", "esth-2"]);
  // Une des deux masseuses est prise : plus de créneau à 15h.
  const occupe = contexte({ occupations: [{ ressource: "esth-2", date: LUNDI, debut: h(15), fin: h(16) }] });
  assert.equal(planifier(demande([quatreMains]), occupe, h(15)), null);
});

test("prestations enchaînées : coiffure puis maquillage, à la suite, avec la bonne praticienne", () => {
  const coiffure: PrestationResa = {
    id: "coiffure-ceremonie",
    nom: "Coiffure cérémonie",
    phases: [{ minutes: 90, praticienne: true, poste: true }],
    typePoste: "coiffure",
    competence: "coiffure",
    praticiennes: 1,
  };
  const maquillage: PrestationResa = {
    id: "maquillage-ceremonie",
    nom: "Maquillage cérémonie",
    phases: [{ minutes: 60, praticienne: true, poste: true }],
    typePoste: "coiffure",
    competence: "maquillage",
    praticiennes: 1,
  };
  const c = planifier(demande([coiffure, maquillage]), contexte(), h(9));
  assert.ok(c);
  assert.equal(c.fin, h(11) + 30);
  assert.deepEqual(
    c.affectations.map((a) => [a.praticiennes[0], a.debut, a.fin]),
    [
      ["coif-1", h(9), h(10) + 30],
      ["maq-1", h(10) + 30, h(11) + 30],
    ],
  );
  // La maquilleuse est prise à 10h30 : le créneau de 9h n'est plus proposé.
  const occupe = contexte({ occupations: [{ ressource: "maq-1", date: LUNDI, debut: h(10) + 30, fin: h(11) }] });
  assert.equal(planifier(demande([coiffure, maquillage]), occupe, h(9)), null);
});

test("délai minimum de 2 heures", () => {
  const d = debuts(demande([soin(60)], { maintenant: { date: LUNDI, minutes: h(10) + 10 } }), contexte());
  assert.equal(d[0], h(12) + 30);
});

test("délai minimum la veille au soir, et jamais dans le passé", () => {
  const veille = debuts(demande([soin(60)], { maintenant: { date: "2026-10-04", minutes: h(23) + 30 } }), contexte());
  assert.equal(veille[0], h(9)); // 23h30 + 2h = 1h30 : l'institut ouvre à 9h
  const passe = debuts(demande([soin(60)], { maintenant: { date: "2026-10-06", minutes: h(8) } }), contexte());
  assert.equal(passe.length, 0);
});

test("fermetures : un jour fermé ne propose rien", () => {
  assert.equal(debuts(demande([soin(60)]), contexte({ fermetures: [LUNDI] })).length, 0);
});

test("dimanche : horaires de 10h à 18h", () => {
  const d = debuts(demande([soin(60)], { date: DIMANCHE }), contexte());
  assert.equal(d[0], h(10));
  assert.equal(d.at(-1), h(17));
});

test("praticienne souhaitée : ses créneaux à elle seulement", () => {
  const massage: PrestationResa = {
    id: "massage",
    nom: "Massage relaxant",
    phases: [{ minutes: 60, praticienne: true, poste: true }],
    typePoste: "table-massage",
    competence: "massage",
    praticiennes: 1,
  };
  const occupe = contexte({ occupations: [{ ressource: "esth-2", date: LUNDI, debut: h(9), fin: h(19) }] });
  assert.equal(debuts(demande([massage], { praticienneSouhaitee: "esth-2" }), occupe).length, 0);
  // « Peu importe » : l'autre masseuse prend le relais.
  assert.ok(debuts(demande([massage]), occupe).length > 0);
});

test("les occupations enregistrées ne bloquent pas la praticienne pendant la pose", () => {
  const avecPose: PrestationResa = {
    id: "p",
    nom: "p",
    phases: [
      { minutes: 30, praticienne: true, poste: true },
      { minutes: 30, praticienne: false, poste: true },
    ],
    typePoste: "cabine",
    competence: "soins-visage",
    praticiennes: 1,
  };
  const c = planifier(demande([avecPose]), contexte(), h(9));
  assert.ok(c);
  assert.deepEqual(occupationsDuCreneau(c, [avecPose]), [
    { ressource: "esth-1", date: LUNDI, debut: h(9), fin: h(9) + 30 },
    { ressource: "cabine-1", date: LUNDI, debut: h(9), fin: h(10) },
  ]);
});

test("acompte : au-delà du montant, de la durée, ou après deux absences", () => {
  const regle = { montantMin: 30000, dureeMinMinutes: 120, absencesMax: 2 };
  const court = { ...soin(60), prix: 20000 };
  assert.equal(acompteRequis([court], 0, regle), false);
  assert.equal(acompteRequis([{ ...soin(60), prix: 35000 }], 0, regle), true);
  assert.equal(acompteRequis([{ ...soin(180), prix: 20000 }], 0, regle), true);
  assert.equal(acompteRequis([court], 2, regle), true);
});
