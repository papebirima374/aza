import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { notifications } from "@/lib/serveur/notifications";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET /api/gestion/notifications — ce qui attend une action, pour la personne connectée (la cloche)
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    return Response.json(await notifications(membre), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}
