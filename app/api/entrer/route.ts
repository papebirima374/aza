import { firebaseConfigure } from "@/lib/serveur/firebase";
import { utiliserLienConnexion } from "@/lib/serveur/lien-connexion";
import { reponseErreur } from "@/lib/serveur/reponses";

// POST /api/entrer { jeton } — lien de connexion envoyé par la direction → jeton Firebase.
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const c = await request.json().catch(() => ({}));
    return Response.json({ jeton: await utiliserLienConnexion(String(c.jeton ?? "")) });
  } catch (e) {
    return reponseErreur(e);
  }
}
