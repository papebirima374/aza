import { membreConnecte } from "@/lib/serveur/agenda";
import { changerCommande, compterNouvelles, listerCommandes } from "@/lib/serveur/boutique";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { compterNouveauxDevis } from "@/lib/serveur/perruques";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter, nomDe } from "@/lib/serveur/activite";

// GET  /api/gestion/commandes              les 200 dernières commandes
// GET  /api/gestion/commandes?nouvelles=1  nombre de commandes à traiter (pastille)
// POST /api/gestion/commandes { id, statut, motif?, livreur? }  (la remise passe par la caisse)
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    if (new URL(request.url).searchParams.get("nouvelles")) {
      // La pastille compte aussi les demandes de perruques sur mesure à traiter.
      const [c, d] = await Promise.all([compterNouvelles(membre), compterNouveauxDevis(membre)]);
      return Response.json({ nouvelles: c + d }, sansCache);
    }
    return Response.json(await listerCommandes(membre), sansCache);
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    const ref = await nomDe(`commandes/${String(c.id ?? "-")}`, "reference");
    const r = await changerCommande(membre, String(c.id ?? "-"), c ?? {});
    await noter(membre, "boutique", `Commande ${ref} → ${String(c.statut ?? "")}${c.motif ? ` (${String(c.motif).slice(0, 100)})` : ""}${c.livreur ? ` · livreur ${String(c.livreur).slice(0, 60)}` : ""}`, "/gestion/commandes");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
