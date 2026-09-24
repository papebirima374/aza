import type { Role } from "@/lib/agenda/statuts";
import { membreConnecte } from "@/lib/serveur/agenda";
import { creerMembre, listerEquipe, modifierMembre } from "@/lib/serveur/equipe";
import { creerLienConnexion } from "@/lib/serveur/lien-connexion";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET  /api/gestion/equipe — liste (direction, manager)
// POST /api/gestion/equipe { nom, email, role, competences? } — création (direction)
// PATCH /api/gestion/equipe { uid, nom?, role?, competences?, actif?, lien?, telephone? } — modification (direction)
// PATCH /api/gestion/equipe { uid, lienConnexion: true } — lien de connexion à envoyer par WhatsApp
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    return Response.json(await listerEquipe(await membreConnecte(request)));
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    const res = await creerMembre(membre, {
      nom: String(c.nom ?? ""),
      email: String(c.email ?? ""),
      role: String(c.role ?? "") as Role,
      competences: Array.isArray(c.competences) ? c.competences.map(String) : [],
      telephone: c.telephone === undefined ? undefined : String(c.telephone),
      motDePasse: c.motDePasse ? String(c.motDePasse) : undefined,
    });
    return Response.json(res, { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function PATCH(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    if (c.lienConnexion === true) return Response.json({ lienConnexion: await creerLienConnexion(membre, String(c.uid ?? "-")) });
    return Response.json(
      await modifierMembre(membre, String(c.uid ?? "-"), {
        nom: c.nom === undefined ? undefined : String(c.nom),
        role: c.role === undefined ? undefined : (String(c.role) as Role),
        competences: Array.isArray(c.competences) ? c.competences.map(String) : undefined,
        actif: typeof c.actif === "boolean" ? c.actif : undefined,
        lien: c.lien === true,
        telephone: c.telephone === undefined ? undefined : String(c.telephone),
        motDePasse: c.motDePasse === true ? true : c.motDePasse ? String(c.motDePasse) : undefined,
      }),
    );
  } catch (e) {
    return reponseErreur(e);
  }
}
