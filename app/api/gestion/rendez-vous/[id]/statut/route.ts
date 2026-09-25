import { LIBELLES, type Statut } from "@/lib/agenda/statuts";
import { changerStatut, membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { ErreurReservation } from "@/lib/serveur/reservations";
import { noter, nomDe } from "@/lib/serveur/activite";

// POST /api/gestion/rendez-vous/{id}/statut  { statut, motif? }  — jeton de l'équipe requis.
export async function POST(request: Request, ctx: RouteContext<"/api/gestion/rendez-vous/[id]/statut">) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const { id } = await ctx.params;
    const corps = await request.json().catch(() => null);
    const statut = corps?.statut as Statut;
    if (!(statut in LIBELLES)) throw new ErreurReservation("Statut inconnu.", 400);
    const r = await changerStatut(membre, id, statut, corps?.motif);
    const cliente = await nomDe(`rendezVous/${id}`, "cliente");
    await noter(membre, "agenda", `Rendez-vous de ${cliente} → ${LIBELLES[statut]}${corps?.motif ? ` (${String(corps.motif).slice(0, 100)})` : ""}`, "/gestion");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
