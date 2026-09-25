import { membreConnecte } from "@/lib/serveur/agenda";
import { listerCollection, modifierCollection } from "@/lib/serveur/collection";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter } from "@/lib/serveur/activite";

// GET  /api/gestion/collection   les modèles Anna Zen Couture (masqués compris) et le tableau des tailles
// POST /api/gestion/collection { action: "creer" | "modifier" | "masquer" | "photo-ajout" | "photo-retrait" | "photo-premiere" | "guide-tailles", … }
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    return Response.json(await listerCollection(await membreConnecte(request)), sansCache);
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    const r = await modifierCollection(membre, c ?? {});
    await noter(membre, "site", `Collection Couture : ${String(c?.action ?? "")}${c?.ref ? ` ${String(c.ref)}` : ""}${c?.nom ? ` « ${String(c.nom).slice(0, 60)} »` : ""}`, "/gestion/collection");
    return Response.json(r, { status: c?.action === "creer" ? 201 : 200 });
  } catch (e) {
    return reponseErreur(e);
  }
}
