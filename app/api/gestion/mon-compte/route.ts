import { membreConnecte } from "@/lib/serveur/agenda";
import { changerMonMotDePasse } from "@/lib/serveur/equipe";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// POST /api/gestion/mon-compte { motDePasse } — changer son propre mot de passe
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const c = await request.json().catch(() => ({}));
    return Response.json(await changerMonMotDePasse(await membreConnecte(request), c.motDePasse));
  } catch (e) {
    return reponseErreur(e);
  }
}
