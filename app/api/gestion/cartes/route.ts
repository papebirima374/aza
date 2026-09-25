import { membreConnecte } from "@/lib/serveur/agenda";
import { lireCarte, listerCartes, vendreCarte } from "@/lib/serveur/cartes-cadeaux";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter, prix } from "@/lib/serveur/activite";

// GET  /api/gestion/cartes             toutes les cartes (les plus récentes d'abord)
// GET  /api/gestion/cartes?code=…      une carte (solde, historique)
// POST /api/gestion/cartes { montant, pour, dePart, message, telephone, paiements }   vendre une carte
const indisponible = () => Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return indisponible();
  try {
    const membre = await membreConnecte(request);
    const code = new URL(request.url).searchParams.get("code");
    return Response.json(code ? await lireCarte(membre, code) : await listerCartes(membre), sansCache);
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return indisponible();
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    const r = await vendreCarte(membre, c);
    await noter(membre, "caisse", `Carte cadeau ${r.code} vendue : ${prix(c.montant)}${c.pour ? ` pour ${String(c.pour).slice(0, 60)}` : ""} (ticket ${r.reference})`, `/gestion/cartes/${r.code}`);
    return Response.json(r, { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}
