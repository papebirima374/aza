import { lignes, membreAccueil } from "@/lib/serveur/comptoir-api";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { creneauxComptoir, creerRendezVousComptoir, dureesConnues } from "@/lib/serveur/reservations";

// POST /api/gestion/comptoir — prise de rendez-vous par l'accueil. Corps :
//   { action: "durees", ids }                                → durées déjà paramétrées
//   { action: "creneaux", date, lignes, praticienne? }       → heures libres (pas de 15 min)
//   { action: "reserver", date, debut, lignes, praticienne?, nom, telephone, remarque? }
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreAccueil(request);
    const c = await request.json().catch(() => ({}));
    const praticienne = c.praticienne ? String(c.praticienne) : undefined;
    switch (c.action) {
      case "durees":
        return Response.json(await dureesConnues(Array.isArray(c.ids) ? c.ids.map(String) : []));
      case "creneaux":
        return Response.json(await creneauxComptoir(String(c.date ?? ""), lignes(c.lignes), praticienne));
      case "reserver":
        return Response.json(
          await creerRendezVousComptoir(
            { uid: membre.uid, nom: membre.nom },
            {
              date: String(c.date ?? ""),
              debut: Number(c.debut),
              lignes: lignes(c.lignes),
              praticienne,
              nom: String(c.nom ?? ""),
              telephone: String(c.telephone ?? ""),
              remarque: c.remarque ? String(c.remarque) : undefined,
            },
          ),
          { status: 201 },
        );
      default:
        return Response.json({ erreur: "Action inconnue." }, { status: 400 });
    }
  } catch (e) {
    return reponseErreur(e);
  }
}
