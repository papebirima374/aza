import { membreConnecte } from "@/lib/serveur/agenda";
import { catalogueServeur, modifierCatalogue } from "@/lib/serveur/catalogue";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter, prix } from "@/lib/serveur/activite";

// POST /api/gestion/catalogue { action: "prix" | "masquer" | "ajouter" | "renommer", … } — direction seulement
export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    const avant = c?.id ? ((await catalogueServeur(true)).parId(String(c.id))?.nom ?? "") : "";
    const r = await modifierCatalogue(membre, c ?? {});
    const quoi = String(c?.nom ?? avant ?? c?.id ?? "").slice(0, 80) || String(c?.id ?? "");
    const textes: Record<string, string> = {
      prix: `Prix changé : ${quoi || c?.id} → ${prix(c?.prix)}`,
      ajouter: `Ajouté au catalogue : ${quoi} (${prix(c?.prix)})`,
      masquer: `${c?.masque === false ? "Réaffiché" : "Masqué"} dans le catalogue : ${quoi || c?.id}`,
      renommer: `Renommé dans le catalogue : ${c?.id} → ${quoi}`,
    };
    await noter(membre, "reglages", textes[String(c?.action)] ?? `Catalogue modifié (${String(c?.action)})`, "/gestion/catalogue");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
