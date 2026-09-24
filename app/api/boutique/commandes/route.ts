import { passerCommande } from "@/lib/serveur/boutique";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { ErreurReservation } from "@/lib/serveur/reservations";

// POST /api/boutique/commandes { lignes: [{ article, quantite }], mode, zone?, adresse?, nom, telephone, paiement, remarque? }
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Boutique indisponible." }, { status: 503 });
  try {
    const c = await request.json().catch(() => null);
    if (!c || typeof c !== "object") throw new ErreurReservation("Demande invalide.", 400);
    // Champ piège invisible : rempli seulement par les robots.
    if (c.site) throw new ErreurReservation("Demande refusée.", 400);
    return Response.json(await passerCommande(c), { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}
