import { noter } from "@/lib/serveur/activite";
import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { listerPromos, modifierPromo } from "@/lib/serveur/promos";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET  /api/gestion/promos                       toutes les promotions flash
// POST /api/gestion/promos { action: "creer" | "arreter", … }
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    return Response.json(await listerPromos(await membreConnecte(request)), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = (await request.json().catch(() => ({}))) ?? {};
    const r = await modifierPromo(membre, c);
    await noter(membre, "site", c.action === "creer" ? `Promotion flash créée : ${"nom" in r ? r.nom : ""} à ${c.prix} F, du ${c.du} au ${c.au ?? c.du}` : "Promotion flash arrêtée", "/gestion/promos");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
