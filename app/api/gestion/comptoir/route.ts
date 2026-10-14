import { lignes, membreComptoir } from "@/lib/serveur/comptoir-api";
import { db, firebaseConfigure } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";
import { reponseErreur } from "@/lib/serveur/reponses";
import { creneauxComptoir, creerRendezVousComptoir, creerRendezVousLibre, dureesConnues } from "@/lib/serveur/reservations";
import { noter } from "@/lib/serveur/activite";

// POST /api/gestion/comptoir — prise de rendez-vous par l'accueil. Corps :
//   { action: "durees", ids }                                → durées déjà paramétrées
//   { action: "creneaux", date, lignes, praticienne? }       → heures libres (pas de 15 min)
//   { action: "reserver", date, debut, lignes, praticienne?, nom, telephone, remarque? }
//   { action: "libre", date, debut?, lignes: [{ id, duree?, praticienne? }], nom, telephone, remarque?, dejaFaite }
//     → saisie libre : aucune heure imposée, même passée ; une ou plusieurs prestataires par
//       prestation (praticiennes: [..], ou praticienne pour un seul nom)
//   { action: "equipe" }                                     → l'équipe active (id, nom)
// Une prestataire qui a l'accès « Prendre ses propres rendez-vous » ne prend que les siens :
// elle figure sur chaque prestation (seule ou avec une collègue).
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const { membre, moi } = await membreComptoir(request);
    const c = await request.json().catch(() => ({}));
    const praticienne = moi ?? (c.praticienne ? String(c.praticienne) : undefined);
    switch (c.action) {
      case "equipe": {
        const snap = await db().collection("praticiennes").where("actif", "==", true).get();
        return Response.json(
          snap.docs
            .map((d) => ({ id: d.id, nom: d.get("nom") as string, ordre: (d.get("ordre") as number | undefined) ?? 9999 }))
            .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom))
            .map(({ id, nom }) => ({ id, nom })),
        );
      }
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
        const lignesLibres = (Array.isArray(c.lignes) ? c.lignes : []).map((l: { id?: unknown; duree?: unknown; praticienne?: unknown; praticiennes?: unknown }) => {
          const liste = Array.isArray(l?.praticiennes) ? l.praticiennes.map(String).filter(Boolean) : l?.praticienne ? [String(l.praticienne)] : [];
          // Ses propres rendez-vous : elle est sur chaque prestation (la 1re si rien n'est choisi).
          if (moi && liste.length === 0) liste.push(moi);
          if (moi && !liste.includes(moi)) throw new ErreurReservation("Vous ne prenez que vos propres rendez-vous : vous devez faire chaque prestation.", 403);
          return {
            id: String(l?.id ?? ""),
            duree: l?.duree === undefined || l?.duree === "" ? undefined : Number(l.duree),
            praticiennes: liste,
          };
        });
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
