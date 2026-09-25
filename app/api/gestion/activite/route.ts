import { listerActivite } from "@/lib/serveur/activite";
import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET /api/gestion/activite?date=AAAA-MM-JJ — le journal d'activité du jour (accès « journal »)
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    return Response.json(await listerActivite(membre, new URL(request.url).searchParams.get("date")), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}
