import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { ficheDuMois, monHistorique } from "@/lib/serveur/prestataires";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET /api/gestion/prestataires?mois=AAAA-MM            mon historique (sans les montants)
// GET /api/gestion/prestataires?fiche=ID&mois=AAAA-MM   la fiche du mois d'une prestataire (qui voit les rapports)
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const q = new URL(request.url).searchParams;
    const r = q.get("fiche") ? await ficheDuMois(membre, q.get("fiche")!, q.get("mois")) : await monHistorique(membre, q.get("mois"));
    return Response.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}
