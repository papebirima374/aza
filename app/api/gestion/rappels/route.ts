import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { listerRappels, noterRappel } from "@/lib/serveur/rappels";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET  /api/gestion/rappels?date=…   rendez-vous à rappeler (demain par défaut)
// POST /api/gestion/rappels { rdv }  rappel envoyé
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const date = new URL(request.url).searchParams.get("date") ?? undefined;
    return Response.json(await listerRappels(await membreConnecte(request), date), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const c = await request.json().catch(() => ({}));
    return Response.json(await noterRappel(await membreConnecte(request), String(c.rdv ?? "-")));
  } catch (e) {
    return reponseErreur(e);
  }
}
