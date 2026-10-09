import { noter } from "@/lib/serveur/activite";
import { decalerRendezVous } from "@/lib/serveur/ajout-prestation";
import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

const heure = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

// POST /api/gestion/rendez-vous/{id}/heure { debut } — décaler le rendez-vous (retard de la cliente)
export async function POST(request: Request, { params }: RouteContext<"/api/gestion/rendez-vous/[id]/heure">) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const { id } = await params;
    const c = await request.json().catch(() => ({}));
    const r = await decalerRendezVous(membre, id, c.debut);
    if (!r.inchange) await noter(membre, "agenda", `Rendez-vous de ${r.cliente} décalé : ${heure(r.avant)} → ${heure(r.apres)}`, "/gestion");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
