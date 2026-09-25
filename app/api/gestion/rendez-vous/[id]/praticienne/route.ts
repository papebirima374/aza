import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { candidates, reattribuer } from "@/lib/serveur/reattribution";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter, nomDe } from "@/lib/serveur/activite";

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
    const membre = await membreConnecte(request);
    const r = await reattribuer(membre, id, String(c.remplacer ?? ""), String(c.par ?? ""));
    const ancienne = await nomDe(`praticiennes/${String(c.remplacer ?? "-")}`, "nom");
    await noter(membre, "agenda", `Rendez-vous de ${await nomDe(`rendezVous/${id}`, "cliente")} confié à ${r.nom} (à la place de ${ancienne})`, "/gestion");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
