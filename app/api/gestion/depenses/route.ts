import { CATEGORIES_DEPENSE } from "@/lib/caisse/depenses";
import { membreConnecte } from "@/lib/serveur/agenda";
import { noter, prix } from "@/lib/serveur/activite";
import { ajouterDepense, annulerDepense, depensesDuJour, depensesDuMois } from "@/lib/serveur/depenses";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET  /api/gestion/depenses?date=AAAA-MM-JJ   les dépenses du jour (et la recette, pour qui voit toutes les caisses)
// GET  /api/gestion/depenses?mois=AAAA-MM      le bilan du mois (qui voit les rapports)
// POST /api/gestion/depenses { action: "ajouter", montant, categorie, libelle, mode, deLaCaisse }
// POST /api/gestion/depenses { action: "annuler", id, motif }
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const q = new URL(request.url).searchParams;
    if (q.get("mois")) return Response.json(await depensesDuMois(membre, q.get("mois")), sansCache);
    return Response.json(await depensesDuJour(membre, q.get("date")), sansCache);
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    if (c.action === "ajouter") {
      const r = await ajouterDepense(membre, c);
      const cat = CATEGORIES_DEPENSE.find((x) => x.id === c.categorie)?.libelle ?? "";
      await noter(membre, "caisse", `Dépense ${prix(r.montant)} — ${cat}${c.libelle ? ` (${String(c.libelle).slice(0, 80)})` : ""}${r.deLaCaisse ? ", sortie de sa caisse" : ""}`);
      return Response.json(r, { status: 201 });
    }
    if (c.action === "annuler") {
      const r = await annulerDepense(membre, String(c.id ?? ""), c.motif);
      await noter(membre, "caisse", `Dépense de ${prix(r.montant)} annulée${r.libelle ? ` (${r.libelle.slice(0, 60)})` : ""} : ${String(c.motif ?? "").slice(0, 100)}`);
      return Response.json(r);
    }
    return Response.json({ erreur: "Action inconnue." }, { status: 400 });
  } catch (e) {
    return reponseErreur(e);
  }
}
