import { firebaseConfigure } from "@/lib/serveur/firebase";
import { demanderDevis } from "@/lib/serveur/perruques";
import { reponseErreur } from "@/lib/serveur/reponses";
import { ErreurReservation } from "@/lib/serveur/reservations";

// POST /api/boutique/devis { type, texture, longueur, couleur, tourDeTete, pourQuand, remarque, nom, telephone }
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Service indisponible." }, { status: 503 });
  try {
    const c = await request.json().catch(() => null);
    if (!c || typeof c !== "object") throw new ErreurReservation("Demande invalide.", 400);
    // Champ piège invisible : rempli seulement par les robots.
    if (c.site) throw new ErreurReservation("Demande refusée.", 400);
    return Response.json(await demanderDevis(c), { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}
