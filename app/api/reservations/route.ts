import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { creerReservation, ErreurReservation } from "@/lib/serveur/reservations";

// POST /api/reservations  { date, debut, prestations[], nom, telephone, remarque? }
// (la cliente ne choisit pas sa praticienne : l'institut répartit)
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Réservation en ligne indisponible." }, { status: 503 });
  try {
    const corps = await request.json().catch(() => null);
    if (!corps || typeof corps !== "object") throw new ErreurReservation("Demande invalide.", 400);
    const rdv = await creerReservation({
      date: String(corps.date ?? ""),
      debut: Number(corps.debut),
      prestations: Array.isArray(corps.prestations) ? corps.prestations.map(String) : [],
      nom: String(corps.nom ?? ""),
      telephone: String(corps.telephone ?? ""),
      remarque: corps.remarque ? String(corps.remarque) : undefined,
    });
    return Response.json(rdv, { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}
