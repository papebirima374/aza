// GET /api/gestion/diagnostic — aide à la mise en service, sans aucun secret :
// quel projet la clé serveur ouvre, si le compte connecté existe, quelle version tourne.
// Chaque étape a un délai maximum, pour savoir laquelle bloque. La bibliothèque Firebase est
// chargée à l'intérieur d'un bloc protégé : si son chargement échoue, l'erreur est affichée.

function avecDelai<T>(p: Promise<T>, etape: string, ms = 7000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rejeter) => setTimeout(() => rejeter(new Error(`${etape} : aucune réponse après ${ms / 1000} s`)), ms)),
  ]);
}

const court = (e: unknown) => ((e as Error)?.message ?? String(e)).slice(0, 220);

export async function GET(request: Request) {
  const res: Record<string, unknown> = {
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    node: process.version,
    cleServeur: Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_SERVICE_ACCOUNT),
  };
  try {
    const jeton = request.headers.get("authorization")?.replace(/^Bearer /, "");
    // Sans connexion, seulement l'essentiel (version, clé présente ou non).
    if (!res.cleServeur || !jeton) return Response.json(res, { headers: { "Cache-Control": "no-store" } });
    let fb: typeof import("@/lib/serveur/firebase");
    try {
      fb = await import("@/lib/serveur/firebase");
    } catch (e) {
      res.chargementFirebase = `erreur : ${court(e)}`;
      return Response.json(res);
    }
    const { auth, db } = fb;
    res.directionEmails = (process.env.DIRECTION_EMAILS ?? "").split(",").filter((e) => e.trim()).length;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const cle = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        res.projetCle = cle.project_id ?? "illisible";
        res.cleComplete = Boolean(cle.private_key && cle.client_email);
      } catch {
        res.projetCle = "JSON illisible (mal copié ?)";
      }
    }

    {
      try {
        const d = await avecDelai(auth().verifyIdToken(jeton), "vérification du jeton");
        res.jeton = { projet: d.aud, email: d.email };
        const compte = await avecDelai(db().doc(`comptes/${d.uid}`).get(), "lecture du compte");
        res.compte = compte.exists ? compte.get("role") : "absent";
        res.emailDeclare = (process.env.DIRECTION_EMAILS ?? "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .includes((d.email ?? "").toLowerCase());
      } catch (e) {
        res.jeton = `erreur : ${court(e)}`;
        return Response.json(res, { headers: { "Cache-Control": "no-store" } });
      }
    }
    try {
      res.reglages = (await avecDelai(db().doc("reglages/institut").get(), "lecture de la base")).exists;
      res.directions = (await avecDelai(db().collection("comptes").where("role", "==", "direction").get(), "requête comptes")).size;
    } catch (e) {
      res.base = `erreur : ${court(e)}`;
    }
  } catch (e) {
    res.plantage = court(e);
  }
  return Response.json(res, { headers: { "Cache-Control": "no-store" } });
}
