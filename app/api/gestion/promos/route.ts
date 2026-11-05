import { revalidatePath } from "next/cache";
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
    const quoi =
      c.action === "creer" ? `Promotion flash créée : ${"nom" in r ? r.nom : ""} à ${c.prix} F, du ${c.du} au ${c.au ?? c.du}` : c.action === "arreter" ? "Promotion flash arrêtée" : c.action === "photo-ajout" ? "Photo ajoutée à une promotion" : "Photo retirée d'une promotion";
    await noter(membre, "site", quoi, "/gestion/promos");
    // Les pages du site montrent tout de suite le changement (sinon : jusqu'à une minute).
    revalidatePath("/promo/[id]", "page");
    revalidatePath("/");
    revalidatePath("/prestations/[univers]", "page");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
