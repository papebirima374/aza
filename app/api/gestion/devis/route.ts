import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { changerDevis, listerDevis } from "@/lib/serveur/perruques";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET  /api/gestion/devis                                   les 200 derniers devis
// POST /api/gestion/devis { id, statut, prix?, delai?, motif? }
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    return Response.json(await listerDevis(await membreConnecte(request)), sansCache);
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    return Response.json(await changerDevis(membre, String(c.id ?? "-"), c ?? {}));
  } catch (e) {
    return reponseErreur(e);
  }
}
