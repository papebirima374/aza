import { membreConnecte } from "@/lib/serveur/agenda";
import { modifierCatalogue } from "@/lib/serveur/catalogue";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// POST /api/gestion/catalogue { action: "prix" | "masquer" | "ajouter" | "renommer", … } — direction seulement
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    return Response.json(await modifierCatalogue(membre, c ?? {}));
  } catch (e) {
    return reponseErreur(e);
  }
}
