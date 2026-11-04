import { noter } from "@/lib/serveur/activite";
import { corrigerCliente } from "@/lib/serveur/ajout-prestation";
import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// POST /api/gestion/rendez-vous/{id}/cliente { nom, telephone } — corriger une faute sur la cliente
export async function POST(request: Request, { params }: RouteContext<"/api/gestion/rendez-vous/[id]/cliente">) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const { id } = await params;
    const c = await request.json().catch(() => ({}));
    const r = await corrigerCliente(membre, id, c.nom, c.telephone);
    if (!r.inchange) await noter(membre, "agenda", `Cliente d'un rendez-vous corrigée : ${r.avant} → ${r.apres}`, "/gestion");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
