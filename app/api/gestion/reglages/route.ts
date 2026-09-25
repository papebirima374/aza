import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { lireReglagesComplets, modifierReglages } from "@/lib/serveur/reglages";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter } from "@/lib/serveur/activite";

// GET  /api/gestion/reglages            — tout l'écran Réglages (direction, manager)
// POST /api/gestion/reglages { action … } — une modification (voir lib/serveur/reglages.ts)
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    return Response.json(await lireReglagesComplets(await membreConnecte(request)), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const corps = await request.json().catch(() => ({}));
    const r = await modifierReglages(membre, corps ?? {});
    const libelles: Record<string, string> = {
      "en-ligne": `Réservation en ligne ${corps?.actif === false || corps?.ouverte === false ? "fermée" : "ouverte"}`,
      horaires: "Horaires de l'institut modifiés",
      "fermeture-ajout": `Fermeture ajoutée : ${String(corps?.date ?? "")} ${String(corps?.motif ?? "")}`.trim(),
      "fermeture-retrait": `Fermeture retirée : ${String(corps?.date ?? "")}`,
      regles: "Règles de réservation modifiées (délai, acompte)",
      fidelite: `Carte de fidélité ${corps?.actif ? "active" : "désactivée"} : ${corps?.gain === "montant" ? "points selon le montant" : "1 point par passage"}, récompense à ${String(corps?.seuil ?? "")}`,
      "poste-ajout": `Poste ajouté : ${String(corps?.nom ?? "")}`,
      "poste-retrait": "Poste retiré",
      prestation: `Durée d'une prestation modifiée : ${String(corps?.id ?? "")}`,
      "prestations-lot": "Durées de toute une famille modifiées",
    };
    await noter(membre, "reglages", libelles[String(corps?.action)] ?? `Réglages modifiés (${String(corps?.action)})`, "/gestion/reglages");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
