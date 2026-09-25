import { deposerAvis } from "@/lib/serveur/avis";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { ErreurReservation } from "@/lib/serveur/reservations";

// POST /api/avis/{ticketId} { note, commentaire, prenom, publier } — l'avis d'une cliente (lien de son reçu)
export async function POST(request: Request, { params }: RouteContext<"/api/avis/[id]">) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Service indisponible." }, { status: 503 });
  try {
    const c = await request.json().catch(() => null);
    if (!c || typeof c !== "object") throw new ErreurReservation("Demande invalide.", 400);
    // Champ piège invisible : rempli seulement par les robots.
    if (c.site) throw new ErreurReservation("Demande refusée.", 400);
    return Response.json(await deposerAvis((await params).id, c), { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}
