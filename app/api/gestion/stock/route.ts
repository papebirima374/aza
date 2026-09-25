import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { compterAlertes, lireStock, modifierStock } from "@/lib/serveur/stock";
import { noter, nomDe, prix } from "@/lib/serveur/activite";

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
    const nom = c?.id ? await nomDe(`articles/${String(c.id)}`, "nom") : String(c?.nom ?? "");
    const r = await modifierStock(membre, c ?? {});
    const q = c?.quantite !== undefined ? ` ${String(c.quantite)}` : "";
    const textes: Record<string, string> = {
      creer: `Article créé : ${String(c?.nom ?? "")}`,
      reception: `Réception :${q} × ${nom}${c?.cout ? ` (coût ${prix(c.cout)})` : ""}`,
      inventaire: `Inventaire : ${nom} compté à${q}`,
      perte: `Perte ou casse :${q} × ${nom}${c?.motif ? ` — ${String(c.motif).slice(0, 80)}` : ""}`,
      consommation: `Consommation cabine :${q} × ${nom}`,
      modifier: `Article modifié : ${nom}`,
      retirer: `Article retiré : ${nom}`,
      boutique: `${c?.visible === false ? "Retiré de" : "Publié dans"} la boutique : ${nom}`,
      "photo-ajout": `Photo ajoutée : ${nom}`,
      "photo-retrait": `Photo retirée : ${nom}`,
    };
    await noter(membre, "stock", textes[String(c?.action)] ?? `Stock modifié (${String(c?.action)})`, "/gestion/stock");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
