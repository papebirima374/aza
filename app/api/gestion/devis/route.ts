import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { changerDevis, listerDevis } from "@/lib/serveur/perruques";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter, nomDe, prix } from "@/lib/serveur/activite";

// GET  /api/gestion/devis                                   les 200 derniers devis
// POST /api/gestion/devis { id, statut, prix?, delai?, motif? }
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    return Response.json(await listerDevis(await membreConnecte(request)), sansCache);
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    const ref = await nomDe(`devis/${String(c.id ?? "-")}`, "reference");
    const r = await changerDevis(membre, String(c.id ?? "-"), c ?? {});
    await noter(membre, "boutique", `Devis perruque ${ref} → ${String(c.statut ?? "")}${c.prix ? ` · ${prix(c.prix)}` : ""}`, "/gestion/commandes");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
