"use client";

// Firebase dans le navigateur, pour l'espace de gestion (connexion de l'équipe et agenda en
// temps réel). Les droits de lecture sont fixés par firestore.rules ; aucune écriture directe.
//
// - En local : NEXT_PUBLIC_EMULATEURS=1 → émulateurs, projet de test « demo-aza ».
// - En ligne : NEXT_PUBLIC_FIREBASE_CONFIG = la configuration web du projet (JSON).

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

const EMULATEURS = process.env.NEXT_PUBLIC_EMULATEURS === "1";
const CONFIG = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;

let cache: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

export function gestionConfiguree(): boolean {
  return EMULATEURS || Boolean(CONFIG);
}

export function firebaseClient() {
  if (cache) return cache;
  const app =
    getApps()[0] ??
    initializeApp(
      EMULATEURS
        ? { projectId: "demo-aza", apiKey: "demo-api-key", authDomain: "demo-aza.firebaseapp.com" }
        : JSON.parse(CONFIG ?? "{}"),
    );
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (EMULATEURS) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  cache = { app, auth, db };
  return cache;
}
