import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { lireReglagesComplets, modifierReglages } from "@/lib/serveur/reglages";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET  /api/gestion/reglages            — tout l'écran Réglages (direction, manager)
// POST /api/gestion/reglages { action … } — une modification (voir lib/serveur/reglages.ts)
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    return Response.json(await lireReglagesComplets(await membreConnecte(request)), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const corps = await request.json().catch(() => ({}));
    return Response.json(await modifierReglages(membre, corps ?? {}));
  } catch (e) {
    return reponseErreur(e);
  }
}
