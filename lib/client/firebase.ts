"use client";

// Firebase dans le navigateur, pour l'espace de gestion (connexion de l'équipe et agenda en
// temps réel). Les droits de lecture sont fixés par firestore.rules ; aucune écriture directe.
//
// - En local : NEXT_PUBLIC_EMULATEURS=1 → émulateurs, projet de test « demo-aza ».
// - En ligne : le projet de l'institut « annazen-bb41e ». Cette configuration web n'est pas
//   secrète (elle est lisible par tout navigateur) : la sécurité vient de firestore.rules et
//   du serveur. NEXT_PUBLIC_FIREBASE_CONFIG peut la remplacer si le projet change.

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

const EMULATEURS = process.env.NEXT_PUBLIC_EMULATEURS === "1";
const CONFIG_INSTITUT = {
  apiKey: "AIzaSyAS1FNvlyW9zPBGX90C7NoAUyHDKnuvOhw",
  authDomain: "annazen-bb41e.firebaseapp.com",
  projectId: "annazen-bb41e",
  storageBucket: "annazen-bb41e.firebasestorage.app",
  messagingSenderId: "597725362306",
  appId: "1:597725362306:web:dbb90add4e18297ad51c9b",
};
const CONFIG = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;

let cache: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

export function firebaseClient() {
  if (cache) return cache;
  const app =
    getApps()[0] ??
    initializeApp(
      EMULATEURS
        ? { projectId: "demo-aza", apiKey: "demo-api-key", authDomain: "demo-aza.firebaseapp.com" }
        : CONFIG
          ? JSON.parse(CONFIG)
          : CONFIG_INSTITUT,
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
