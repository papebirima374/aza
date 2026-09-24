import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { compterAlertes, lireStock, modifierStock } from "@/lib/serveur/stock";

// GET  /api/gestion/stock              articles, alertes, consommations des soins
// GET  /api/gestion/stock?alertes=1    nombre d'alertes (pastille de l'onglet)
// POST /api/gestion/stock { action: "creer" | "modifier" | "retirer" | "reception" | "perte" | "inventaire" | "consommation", … }
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    if (new URL(request.url).searchParams.get("alertes")) return Response.json({ alertes: await compterAlertes(membre) }, sansCache);
    return Response.json(await lireStock(membre), sansCache);
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    return Response.json(await modifierStock(membre, c ?? {}));
  } catch (e) {
    return reponseErreur(e);
  }
}
