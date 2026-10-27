import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { lireGaleries, modifierGaleries } from "@/lib/serveur/galeries";
import { modifierPhotosSite, photosDuSite } from "@/lib/serveur/photos-site";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter } from "@/lib/serveur/activite";

// GET  /api/gestion/photos-site                        toutes les photos du site
// GET  /api/gestion/photos-site?galeries=1             la liste des galeries
// POST /api/gestion/photos-site { action: "ajouter" | "retirer", … }
// POST /api/gestion/photos-site { galerie: true, action: "creer" | "renommer" | "deplacer" | "supprimer", … }
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    await membreConnecte(request);
    if (new URL(request.url).searchParams.get("galeries")) return Response.json(await lireGaleries(), { headers: { "Cache-Control": "no-store" } });
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
    if (c?.galerie === true) {
      const g = await modifierGaleries(membre, c);
      const quoi = { creer: "créée", renommer: "renommée", deplacer: "déplacée", supprimer: "supprimée" }[String(c.action)] ?? "modifiée";
      await noter(membre, "site", `Galerie ${quoi}${c.nom ? ` : ${String(c.nom).slice(0, 40)}` : ""}`, "/gestion/photos");
      return Response.json(g);
    }
    const r = await modifierPhotosSite(membre, c ?? {});
    await noter(membre, "site", `Photo du site ${c?.action === "retirer" ? "retirée" : "ajoutée"}${c?.prestation ? ` (prestation ${String(c.prestation).slice(0, 80)})` : c?.emplacement ? ` (${String(c.emplacement)})` : ""}`, "/gestion/photos");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
