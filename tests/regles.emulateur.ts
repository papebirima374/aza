// Tests des règles de sécurité Firestore (firestore.rules), sur l'émulateur.
// Usage (émulateurs lancés) : npm run test:regles
//
// Critère C-08 : une praticienne n'accède qu'à son propre planning.
import { test, before, after } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";

let env: RulesTestEnvironment;
const DATE = "2026-10-05";

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-regles-aza",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "comptes/u-accueil"), { nom: "Accueil", role: "accueil" });
    await setDoc(doc(db, "comptes/u-awa"), { nom: "Awa", role: "praticienne", praticienne: "awa" });
    await setDoc(doc(db, "comptes/u-compta"), { nom: "Compta", role: "comptable" });
    await setDoc(doc(db, "rendezVous/rdv-awa"), { date: DATE, praticiennesIds: ["awa"], cliente: { nom: "A" } });
    await setDoc(doc(db, "rendezVous/rdv-fatou"), { date: DATE, praticiennesIds: ["fatou"], cliente: { nom: "B" } });
    await setDoc(doc(db, "praticiennes/awa"), { nom: "Awa" });
    await setDoc(doc(db, "praticiennes/fatou"), { nom: "Fatou" });
    await setDoc(doc(db, "clientes/770000000"), { nom: "Cliente" });
    await setDoc(doc(db, "reglages/institut"), { horaires: {} });
  });
});

after(async () => {
  await env.clearFirestore();
  await env.cleanup();
});

const db = (uid?: string) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());

test("un visiteur non connecté ne lit rien", async () => {
  await assertFails(getDoc(doc(db(), "rendezVous/rdv-awa")));
  await assertFails(getDoc(doc(db(), "reglages/institut")));
  await assertFails(getDoc(doc(db(), "clientes/770000000")));
});

test("un compte connecté mais sans fiche dans comptes/ ne lit rien", async () => {
  await assertFails(getDoc(doc(db("inconnu"), "rendezVous/rdv-awa")));
  await assertFails(getDoc(doc(db("inconnu"), "reglages/institut")));
});

test("l'accueil lit tout l'agenda du jour", async () => {
  const snap = await assertSucceeds(getDocs(query(collection(db("u-accueil"), "rendezVous"), where("date", "==", DATE))));
  if (snap.size !== 2) throw new Error(`attendu 2 rendez-vous, lu ${snap.size}`);
});

test("C-08 : une praticienne lit ses rendez-vous…", async () => {
  await assertSucceeds(getDoc(doc(db("u-awa"), "rendezVous/rdv-awa")));
  await assertSucceeds(
    getDocs(query(collection(db("u-awa"), "rendezVous"), where("date", "==", DATE), where("praticiennesIds", "array-contains", "awa"))),
  );
});

test("C-08 : … mais pas ceux d'une autre, ni tout l'agenda", async () => {
  await assertFails(getDoc(doc(db("u-awa"), "rendezVous/rdv-fatou")));
  await assertFails(getDocs(query(collection(db("u-awa"), "rendezVous"), where("date", "==", DATE))));
  await assertFails(getDoc(doc(db("u-awa"), "praticiennes/fatou")));
});

test("une praticienne ne lit ni le fichier clientes ni les comptes des autres", async () => {
  await assertFails(getDoc(doc(db("u-awa"), "clientes/770000000")));
  await assertFails(getDoc(doc(db("u-awa"), "comptes/u-accueil")));
});

test("le comptable ne lit pas l'agenda", async () => {
  await assertFails(getDoc(doc(db("u-compta"), "rendezVous/rdv-awa")));
});

test("personne n'écrit directement : tout passe par le serveur", async () => {
  await assertFails(updateDoc(doc(db("u-accueil"), "rendezVous/rdv-awa"), { statut: "annule" }));
  await assertFails(setDoc(doc(db("u-accueil"), "rendezVous/nouveau"), { date: DATE }));
  // Pas d'auto-promotion : on ne peut pas se donner un rôle.
  await assertFails(setDoc(doc(db("u-awa"), "comptes/u-awa"), { role: "direction" }));
});
