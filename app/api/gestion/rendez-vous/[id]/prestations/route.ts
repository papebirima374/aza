import { noter } from "@/lib/serveur/activite";
import { ajouterPrestation, modifierPrestations } from "@/lib/serveur/ajout-prestation";
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

// PUT /api/gestion/rendez-vous/{id}/prestations { lignes: [{ id, praticienne? }] } — modifier
// le rendez-vous : ajouter, retirer, changer la prestataire de chaque prestation
export async function PUT(request: Request, { params }: RouteContext<"/api/gestion/rendez-vous/[id]/prestations">) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const { id } = await params;
    const c = await request.json().catch(() => ({}));
    const r = await modifierPrestations(membre, id, c.lignes);
    await noter(membre, "agenda", `Rendez-vous de ${r.cliente} modifié : ${r.motif} (total ${new Intl.NumberFormat("fr-FR").format(r.total)} F)`, "/gestion");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
