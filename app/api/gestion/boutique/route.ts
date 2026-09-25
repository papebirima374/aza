import { membreConnecte } from "@/lib/serveur/agenda";
import { etatBoutique, reglerBoutique } from "@/lib/serveur/boutique";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter } from "@/lib/serveur/activite";

// GET  /api/gestion/boutique                         ouverture, zones de livraison, produits publiés
// POST /api/gestion/boutique { action: "ouverture" | "zones", … }
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    await membreConnecte(request);
    const e = await etatBoutique();
    return Response.json({ ouverte: e.ouverte, zones: e.zones, publies: e.produits.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    const r = await reglerBoutique(membre, c ?? {});
    await noter(membre, "boutique", c?.action === "ouverture" ? `Boutique en ligne ${c.ouverte ? "ouverte" : "fermée"}` : c?.action === "zones" ? "Zones de livraison modifiées" : `Boutique : ${String(c?.action)}`, "/gestion/commandes");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
