import { noter } from "@/lib/serveur/activite";
import { ajouterPrestation } from "@/lib/serveur/ajout-prestation";
import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// POST /api/gestion/rendez-vous/{id}/prestations { prestation } — la cliente prend un soin de plus
export async function POST(request: Request, { params }: RouteContext<"/api/gestion/rendez-vous/[id]/prestations">) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const { id } = await params;
    const c = await request.json().catch(() => ({}));
    const r = await ajouterPrestation(membre, id, String(c.prestation ?? ""));
    await noter(membre, "agenda", `Prestation ajoutée au rendez-vous de ${r.cliente} : ${r.nom} (${new Intl.NumberFormat("fr-FR").format(r.prix)} F${r.duree ? `, +${r.duree} min` : ""})`, "/gestion");
    return Response.json(r, { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}
