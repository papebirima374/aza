import { membreConnecte } from "@/lib/serveur/agenda";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { exportTickets, rapport } from "@/lib/serveur/rapports";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET /api/gestion/rapports?du=AAAA-MM-JJ&au=AAAA-MM-JJ           le rapport de la période
// GET /api/gestion/rapports?du=…&au=…&format=csv                  les tickets de la période (Excel)
export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const q = new URL(request.url).searchParams;
    if (q.get("format") === "csv") {
      const f = await exportTickets(membre, q.get("du"), q.get("au"));
      return new Response(f.contenu, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${f.nom}"`, "Cache-Control": "no-store" },
      });
    }
    return Response.json(await rapport(membre, q.get("du"), q.get("au")), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return reponseErreur(e);
  }
}
