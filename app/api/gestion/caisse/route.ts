import { membreConnecte } from "@/lib/serveur/agenda";
import { aEncaisser, annulerTicket, cloturerCaisse, encaisser, journal, lireRendezVous, lireTicket, ouvrirCaisse } from "@/lib/serveur/caisse";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET  /api/gestion/caisse?date=AAAA-MM-JJ   journal du jour (caisse, tickets, totaux)
// GET  /api/gestion/caisse?a-encaisser=1     rendez-vous terminés du jour
// GET  /api/gestion/caisse?ticket=ID         un ticket (reçu)
// GET  /api/gestion/caisse?rdv=ID            un rendez-vous à encaisser
// POST /api/gestion/caisse { action: "ouvrir" | "encaisser" | "annuler" | "cloturer", … }
const indisponible = () => Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return indisponible();
  try {
    const membre = await membreConnecte(request);
    const q = new URL(request.url).searchParams;
    if (q.get("ticket")) return Response.json(await lireTicket(membre, q.get("ticket")!), sansCache);
    if (q.get("rdv")) return Response.json(await lireRendezVous(membre, q.get("rdv")!), sansCache);
    if (q.get("a-encaisser")) return Response.json(await aEncaisser(membre), sansCache);
    return Response.json(await journal(membre, q.get("date") ?? undefined), sansCache);
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return indisponible();
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    switch (c.action) {
      case "ouvrir":
        return Response.json(await ouvrirCaisse(membre, c.fond), { status: 201 });
      case "encaisser":
        return Response.json(
          await encaisser(membre, {
            lignes: c.lignes,
            paiements: c.paiements,
            remise: c.remise,
            rendezVous: c.rendezVous ? String(c.rendezVous) : undefined,
            cliente: c.cliente ? { nom: String(c.cliente.nom ?? ""), telephone: String(c.cliente.telephone ?? "") } : undefined,
          }),
          { status: 201 },
        );
      case "annuler":
        return Response.json(await annulerTicket(membre, String(c.id ?? "-"), c.motif), { status: 201 });
      case "cloturer":
        return Response.json(await cloturerCaisse(membre, c.compte, c.justification));
      default:
        return Response.json({ erreur: "Action inconnue." }, { status: 400 });
    }
  } catch (e) {
    return reponseErreur(e);
  }
}
