import { membreConnecte } from "@/lib/serveur/agenda";
import { listerCollection, modifierCollection } from "@/lib/serveur/collection";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET  /api/gestion/collection   les modèles Anna Zen Couture (masqués compris) et le tableau des tailles
// POST /api/gestion/collection { action: "creer" | "modifier" | "masquer" | "photo-ajout" | "photo-retrait" | "photo-premiere" | "guide-tailles", … }
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    return Response.json(await listerCollection(await membreConnecte(request)), sansCache);
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    return Response.json(await modifierCollection(membre, c ?? {}), { status: c?.action === "creer" ? 201 : 200 });
  } catch (e) {
    return reponseErreur(e);
  }
}
