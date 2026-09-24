import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { ecranDuJour } from "@/lib/serveur/tableau";

// GET /api/gestion/jour?date=AAAA-MM-JJ — écran du jour (direction, manager)
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const date = new URL(request.url).searchParams.get("date") ?? undefined;
    return Response.json(await ecranDuJour(await membreConnecte(request), date), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}
