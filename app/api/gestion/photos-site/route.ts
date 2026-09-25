import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { modifierPhotosSite, photosDuSite } from "@/lib/serveur/photos-site";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter } from "@/lib/serveur/activite";

// GET  /api/gestion/photos-site                        toutes les photos du site
// POST /api/gestion/photos-site { action: "ajouter" | "retirer", … }
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    await membreConnecte(request);
    return Response.json(await photosDuSite(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    const r = await modifierPhotosSite(membre, c ?? {});
    await noter(membre, "site", `Photo du site ${c?.action === "retirer" ? "retirée" : "ajoutée"}${c?.emplacement ? ` (${String(c.emplacement)})` : ""}`, "/gestion/photos");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
