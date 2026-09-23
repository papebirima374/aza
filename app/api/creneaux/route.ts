import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { chercherCreneaux } from "@/lib/serveur/reservations";

// GET /api/creneaux?date=2026-10-05&p=<prestation>&p=<prestation>&praticienne=<id>
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Réservation en ligne indisponible." }, { status: 503 });
  const url = new URL(request.url);
  try {
    const res = await chercherCreneaux(
      url.searchParams.get("date") ?? "",
      url.searchParams.getAll("p"),
      url.searchParams.get("praticienne") || undefined,
    );
    return Response.json(res, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}

