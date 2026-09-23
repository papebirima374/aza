// Accès à Firestore depuis le serveur du site (routes /api) — jamais depuis le navigateur.
//
// - En local : FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 → base de test « demo-aza ».
// - En ligne : FIREBASE_SERVICE_ACCOUNT (le JSON du compte de service, dans Vercel).
// Sans l'un ni l'autre, la réservation en ligne est simplement indisponible.

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export function firebaseConfigure(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_SERVICE_ACCOUNT);
}

let app: App | undefined;

export function db(): Firestore {
  if (!app) {
    app = getApps()[0];
    if (!app) {
      if (process.env.FIRESTORE_EMULATOR_HOST) {
        const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-aza";
        if (!projectId.startsWith("demo-")) throw new Error("Émulateur : seul un projet demo-* est accepté.");
        app = initializeApp({ projectId });
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
      } else {
        throw new Error("Firebase n'est pas configuré.");
      }
    }
  }
  return getFirestore(app);
}
