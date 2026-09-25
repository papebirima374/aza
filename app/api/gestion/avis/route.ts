import { membreConnecte } from "@/lib/serveur/agenda";
import { compterAvisATraiter, listerAvis, modifierAvis } from "@/lib/serveur/avis";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter, nomDe } from "@/lib/serveur/activite";

// GET  /api/gestion/avis?du=AAAA-MM-JJ&au=…   les avis de la période (12 derniers mois par défaut)
// GET  /api/gestion/avis?compter               nombre d'avis à regarder (pastille)
// POST /api/gestion/avis { action: publier | retirer | traite | a-traiter, id } ou { action: "lien-google", lien }
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const q = new URL(request.url).searchParams;
    if (q.has("compter")) return Response.json(await compterAvisATraiter(membre), sansCache);
    return Response.json(await listerAvis(membre, q.get("du") ?? undefined, q.get("au") ?? undefined), sansCache);
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    const r = await modifierAvis(membre, c ?? {});
    const textes: Record<string, string> = { publier: "Avis mis sur le site", retirer: "Avis retiré du site", traite: "Avis marqué traité", "a-traiter": "Avis remis à traiter", "lien-google": "Lien des avis Google modifié" };
    await noter(membre, "site", `${textes[String(c?.action)] ?? "Avis modifié"}${c?.id ? ` (${await nomDe(`avis/${String(c.id)}`, "prenom")})` : ""}`, "/gestion/avis");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
