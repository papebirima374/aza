import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { candidates, reattribuer } from "@/lib/serveur/reattribution";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET  /api/gestion/rendez-vous/{id}/praticienne                      — qui peut remplacer qui
// POST /api/gestion/rendez-vous/{id}/praticienne { remplacer, par }   — confier à une autre praticienne
export async function GET(request: Request, { params }: RouteContext<"/api/gestion/rendez-vous/[id]/praticienne">) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const { id } = await params;
    return Response.json(await candidates(await membreConnecte(request), id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request, { params }: RouteContext<"/api/gestion/rendez-vous/[id]/praticienne">) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const { id } = await params;
    const c = await request.json().catch(() => ({}));
    return Response.json(await reattribuer(await membreConnecte(request), id, String(c.remplacer ?? ""), String(c.par ?? "")));
  } catch (e) {
    return reponseErreur(e);
  }
}
