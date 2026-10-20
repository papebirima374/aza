import { membreConnecte } from "@/lib/serveur/agenda";
import { boissonsEnAttente, codeBoissons, enregistrerCarte, servirBoisson } from "@/lib/serveur/boissons";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { ErreurReservation } from "@/lib/serveur/reservations";

// GET /api/gestion/boissons         — les boissons demandées, pas encore servies (pour moi)
// GET /api/gestion/boissons?qr=1    — le code du QR du menu (direction, manager)
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const qr = new URL(request.url).searchParams.get("qr");
    return Response.json(qr ? await codeBoissons(membre) : await boissonsEnAttente(membre), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}

// POST /api/gestion/boissons { action: "servir", id } | { action: "nouveau-code" } | { action: "menu", carte }
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => null);
    if (c?.action === "servir") return Response.json(await servirBoisson(membre, String(c.id ?? "")));
    if (c?.action === "menu") return Response.json(await enregistrerCarte(membre, c.carte));
    if (c?.action === "nouveau-code") return Response.json(await codeBoissons(membre, true));
    throw new ErreurReservation("Action inconnue.", 400);
  } catch (e) {
    return reponseErreur(e);
  }
}
