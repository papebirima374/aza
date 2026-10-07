import { lignes, membreAccueil } from "@/lib/serveur/comptoir-api";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { creneauxComptoir, creerRendezVousComptoir, creerRendezVousLibre, dureesConnues } from "@/lib/serveur/reservations";
import { noter } from "@/lib/serveur/activite";

// POST /api/gestion/comptoir — prise de rendez-vous par l'accueil. Corps :
//   { action: "durees", ids }                                → durées déjà paramétrées
//   { action: "creneaux", date, lignes, praticienne? }       → heures libres (pas de 15 min)
//   { action: "reserver", date, debut, lignes, praticienne?, nom, telephone, remarque? }
//   { action: "libre", date, debut?, lignes: [{ id, duree?, praticienne? }], nom, telephone, remarque?, dejaFaite }
//     → saisie libre : aucune heure imposée, même passée, une prestataire par prestation
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
      case "reserver": {
        const r = await creerRendezVousComptoir(
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
          );
        const h = Number(c.debut);
        await noter(membre, "agenda", `Rendez-vous pris au comptoir : ${String(c.nom ?? "").slice(0, 60)}, le ${String(c.date ?? "")} à ${Math.floor(h / 60)}h${String(h % 60).padStart(2, "0")}`, "/gestion");
        return Response.json(r, { status: 201 });
      }
      case "libre": {
        const lignesLibres = (Array.isArray(c.lignes) ? c.lignes : []).map((l: { id?: unknown; duree?: unknown; praticienne?: unknown }) => ({
          id: String(l?.id ?? ""),
          duree: l?.duree === undefined || l?.duree === "" ? undefined : Number(l.duree),
          praticienne: l?.praticienne ? String(l.praticienne) : undefined,
        }));
        const debut = c.debut === undefined || c.debut === null || c.debut === "" ? undefined : Number(c.debut);
        const r = await creerRendezVousLibre(
          { uid: membre.uid, nom: membre.nom },
          {
            date: String(c.date ?? ""),
            debut,
            lignes: lignesLibres,
            nom: String(c.nom ?? ""),
            telephone: String(c.telephone ?? ""),
            remarque: c.remarque ? String(c.remarque) : undefined,
            dejaFaite: c.dejaFaite === true,
          },
        );
        const h = r.debut;
        await noter(
          membre,
          "agenda",
          `${c.dejaFaite === true ? "Passage enregistré (prestation faite)" : "Rendez-vous pris au comptoir"} : ${String(c.nom ?? "").slice(0, 60)}, le ${r.date} à ${Math.floor(h / 60)}h${String(h % 60).padStart(2, "0")}`,
          "/gestion",
        );
        return Response.json(r, { status: 201 });
      }
      default:
        return Response.json({ erreur: "Action inconnue." }, { status: 400 });
    }
  } catch (e) {
    return reponseErreur(e);
  }
}
