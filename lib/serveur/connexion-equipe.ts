// Connexion de l'équipe par NUMÉRO DE TÉLÉPHONE et MOT DE PASSE.
// Le serveur retrouve le compte du numéro, vérifie le mot de passe auprès de Firebase
// (comme le ferait l'écran avec un email), puis rend un jeton de connexion.
// Même réponse que le numéro existe ou non ; 5 erreurs sur un numéro = 15 minutes d'attente.

import { Timestamp } from "firebase-admin/firestore";
import { CONFIG_INSTITUT } from "@/lib/firebase-config";
import { auth, db } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";
import { telephoneCanonique, telephoneValide } from "@/lib/telephone";

const REFUS = "Numéro ou mot de passe incorrect.";

async function motDePasseJuste(email: string, motDePasse: string): Promise<boolean> {
  const emulateur = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const url = emulateur
    ? `http://${emulateur}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`
    : `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CONFIG_INSTITUT.apiKey}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: motDePasse, returnSecureToken: false }),
  });
  return r.ok;
}

export async function connexionTelephone(telephoneBrut: unknown, motDePasseBrut: unknown): Promise<string> {
  const telephone = String(telephoneBrut ?? "");
  const motDePasse = String(motDePasseBrut ?? "");
  if (!telephoneValide(telephone) || motDePasse.length < 1) throw new ErreurReservation(REFUS, 401);
  const tel = telephoneCanonique(telephone);
  const base = db();
  const verrou = base.doc(`securite/connexion-${tel}`);
  const etat = await verrou.get();
  const bloque = etat.get("bloqueJusqua") as Timestamp | undefined;
  if (bloque && bloque.toMillis() > Date.now()) throw new ErreurReservation("Trop d'essais : réessayez dans 15 minutes.", 429);

  const echec = async () => {
    const n = ((etat.get("echecs") as number | undefined) ?? 0) + 1;
    await verrou.set(n >= 5 ? { echecs: 0, bloqueJusqua: Timestamp.fromMillis(Date.now() + 15 * 60_000) } : { echecs: n }, { merge: true });
    return new ErreurReservation(REFUS, 401);
  };

  const comptes = await base.collection("comptes").where("telephoneCanonique", "==", tel).limit(1).get();
  const compte = comptes.docs[0];
  if (!compte || compte.get("actif") === false) throw await echec();
  const utilisateur = await auth().getUser(compte.id).catch(() => null);
  if (!utilisateur?.email || utilisateur.disabled) throw await echec();
  if (!(await motDePasseJuste(utilisateur.email, motDePasse))) throw await echec();
  if (etat.get("echecs")) await verrou.set({ echecs: 0 }, { merge: true });
  return auth().createCustomToken(compte.id);
}
