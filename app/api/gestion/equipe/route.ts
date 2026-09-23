import type { Role } from "@/lib/agenda/statuts";
import { membreConnecte } from "@/lib/serveur/agenda";
import { creerMembre, listerEquipe } from "@/lib/serveur/equipe";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET  /api/gestion/equipe — liste (direction, manager)
// POST /api/gestion/equipe { nom, email, role, competences? } — création (direction)
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
    });
    return Response.json(res, { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}
