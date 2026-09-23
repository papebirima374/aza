import { auth, db, firebaseConfigure } from "@/lib/serveur/firebase";

// GET /api/gestion/diagnostic — aide à la mise en service, sans aucun secret :
// quel projet la clé serveur ouvre, si le compte connecté existe, quelle version tourne.
export async function GET(request: Request) {
  const res: Record<string, unknown> = {
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    cleServeur: firebaseConfigure(),
    directionEmails: (process.env.DIRECTION_EMAILS ?? "").split(",").filter((e) => e.trim()).length,
  };
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      res.projetCle = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).project_id ?? "illisible";
    } catch {
      res.projetCle = "JSON illisible (mal copié ?)";
    }
  }
  if (!firebaseConfigure()) return Response.json(res);

  const jeton = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (jeton) {
    try {
      const d = await auth().verifyIdToken(jeton);
      res.jeton = { projet: d.aud, email: d.email };
      const compte = await db().doc(`comptes/${d.uid}`).get();
      res.compte = compte.exists ? compte.get("role") : "absent";
      res.emailDeclare = (process.env.DIRECTION_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .includes((d.email ?? "").toLowerCase());
    } catch (e) {
      res.jeton = `refusé : ${(e as Error).message.slice(0, 160)}`;
    }
  }
  try {
    res.reglages = (await db().doc("reglages/institut").get()).exists;
    res.directions = (await db().collection("comptes").where("role", "==", "direction").get()).size;
  } catch (e) {
    res.base = `erreur : ${(e as Error).message.slice(0, 160)}`;
  }
  return Response.json(res, { headers: { "Cache-Control": "no-store" } });
}
