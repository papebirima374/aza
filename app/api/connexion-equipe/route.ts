import { connexionTelephone } from "@/lib/serveur/connexion-equipe";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// POST /api/connexion-equipe { telephone, motDePasse } → { jeton } (jeton de connexion Firebase)
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const c = await request.json().catch(() => ({}));
    return Response.json({ jeton: await connexionTelephone(c.telephone, c.motDePasse) });
  } catch (e) {
    return reponseErreur(e);
  }
}
