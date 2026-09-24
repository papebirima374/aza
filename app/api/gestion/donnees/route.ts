import { membreConnecte } from "@/lib/serveur/agenda";
import { restaurer, sauvegarder, vider } from "@/lib/serveur/donnees";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// POST /api/gestion/donnees { action: "sauvegarder" | "vider" | "restaurer", code, parties?, sauvegarde? }
// Direction seulement, avec le code de sécurité (variable CODE_DONNEES dans Vercel).
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    switch (c.action) {
      case "sauvegarder":
        return Response.json(await sauvegarder(membre, c.code), { headers: { "Cache-Control": "no-store" } });
      case "vider":
        return Response.json(await vider(membre, c.code, c.parties));
      case "restaurer":
        return Response.json(await restaurer(membre, c.code, c.sauvegarde));
      default:
        return Response.json({ erreur: "Action inconnue." }, { status: 400 });
    }
  } catch (e) {
    return reponseErreur(e);
  }
}
