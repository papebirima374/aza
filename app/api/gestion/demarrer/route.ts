import { demarrer } from "@/lib/serveur/equipe";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { ErreurReservation } from "@/lib/serveur/reservations";

// POST /api/gestion/demarrer — premier compte direction (voir lib/serveur/equipe.ts).
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const jeton = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!jeton) throw new ErreurReservation("Connexion requise.", 401);
    return Response.json(await demarrer(jeton));
  } catch (e) {
    return reponseErreur(e);
  }
}
