import type { Role } from "@/lib/agenda/statuts";
import { membreConnecte } from "@/lib/serveur/agenda";
import { creerMembre, listerEquipe, modifierMembre } from "@/lib/serveur/equipe";
import { ACCES } from "@/lib/acces";
import { noter, nomDe } from "@/lib/serveur/activite";

const LIBELLE_ROLE: Record<string, string> = { direction: "Direction", manager: "Manager", accueil: "Accueil / caisse", praticienne: "Praticienne", prestataire: "Prestataire", comptable: "Comptable" };

/** « + Rapports, − Caisse » : les accès donnés ou retirés. */
function decrireAcces(a: Record<string, unknown>): string {
  return ACCES.filter((x) => typeof a[x.id] === "boolean")
    .map((x) => `${a[x.id] ? "+" : "−"} ${x.libelle}`)
    .join(", ");
}
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
    await noter(membre, "equipe", `Compte créé : ${String(c.nom ?? "").slice(0, 60)} (${LIBELLE_ROLE[String(c.role)] ?? String(c.role)})`, "/gestion/equipe");
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
    const uid = String(c.uid ?? "-");
    const qui = await nomDe(`comptes/${uid}`, "nom");
    if (c.lienConnexion === true) {
      const lienConnexion = await creerLienConnexion(membre, uid);
      await noter(membre, "equipe", `Lien de connexion WhatsApp créé pour ${qui}`, "/gestion/equipe");
      return Response.json({ lienConnexion });
    }
    const res = await modifierMembre(membre, uid, {
        nom: c.nom === undefined ? undefined : String(c.nom),
        role: c.role === undefined ? undefined : (String(c.role) as Role),
        competences: Array.isArray(c.competences) ? c.competences.map(String) : undefined,
        actif: typeof c.actif === "boolean" ? c.actif : undefined,
        lien: c.lien === true,
        telephone: c.telephone === undefined ? undefined : String(c.telephone),
        motDePasse: c.motDePasse === true ? true : c.motDePasse ? String(c.motDePasse) : undefined,
        acces: c.acces && typeof c.acces === "object" ? c.acces : undefined,
      });
    const changes = [
      c.role !== undefined ? `rôle : ${LIBELLE_ROLE[String(c.role)] ?? String(c.role)}` : "",
      c.acces && typeof c.acces === "object" ? `accès : ${decrireAcces(c.acces) || "ceux du rôle"}` : "",
      typeof c.actif === "boolean" ? (c.actif ? "compte réactivé" : "compte désactivé") : "",
      c.motDePasse ? "nouveau mot de passe" : "",
      c.lien === true ? "lien de mot de passe" : "",
    ].filter(Boolean);
    await noter(membre, "equipe", `Compte de ${qui} modifié${changes.length ? ` — ${changes.join(" · ")}` : ""}`, "/gestion/equipe");
    return Response.json(res);
  } catch (e) {
    return reponseErreur(e);
  }
}
