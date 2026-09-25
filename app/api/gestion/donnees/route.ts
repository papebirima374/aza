import { membreConnecte } from "@/lib/serveur/agenda";
import { restaurer, sauvegarder, vider } from "@/lib/serveur/donnees";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter } from "@/lib/serveur/activite";

// POST /api/gestion/donnees { action: "sauvegarder" | "vider" | "restaurer", code, parties?, sauvegarde? }
// Direction seulement, avec le code de sécurité (variable CODE_DONNEES dans Vercel).
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    switch (c.action) {
      case "sauvegarder": {
        const r = await sauvegarder(membre, c.code);
        await noter(membre, "donnees", "Sauvegarde des données téléchargée");
        return Response.json(r, { headers: { "Cache-Control": "no-store" } });
      }
      case "vider": {
        const r = await vider(membre, c.code, c.parties);
        await noter(membre, "donnees", `Remise à zéro : ${Array.isArray(c.parties) ? c.parties.join(", ") : "données"}`);
        return Response.json(r);
      }
      case "restaurer": {
        const r = await restaurer(membre, c.code, c.sauvegarde);
        await noter(membre, "donnees", "Données restaurées depuis une sauvegarde");
        return Response.json(r);
      }
      default:
        return Response.json({ erreur: "Action inconnue." }, { status: 400 });
    }
  } catch (e) {
    return reponseErreur(e);
  }
}
