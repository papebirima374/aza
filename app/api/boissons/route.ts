import { commanderBoisson, etatBoisson, verifierCode } from "@/lib/serveur/boissons";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { ErreurReservation } from "@/lib/serveur/reservations";

// GET /api/boissons?code=…  — le lien du QR est-il valable ?
// GET /api/boissons?id=…    — ma boisson est-elle servie ?
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Service indisponible." }, { status: 503 });
  try {
    const u = new URL(request.url);
    const id = u.searchParams.get("id");
    const r = id ? await etatBoisson(id) : await verifierCode(u.searchParams.get("code"));
    return Response.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}

// POST /api/boissons { code, boisson, prenom, telephone } — la cliente choisit sa boisson (offerte)
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Service indisponible." }, { status: 503 });
  try {
    const c = await request.json().catch(() => null);
    if (!c || typeof c !== "object") throw new ErreurReservation("Demande invalide.", 400);
    // Champ piège invisible : rempli seulement par les robots.
    if (c.site) throw new ErreurReservation("Demande refusée.", 400);
    return Response.json(await commanderBoisson(c), { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}
