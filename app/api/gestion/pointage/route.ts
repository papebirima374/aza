import { membreConnecte } from "@/lib/serveur/agenda";
import { noter } from "@/lib/serveur/activite";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { annulerPointage, codeBorne, corrigerPointage, monPointage, pointagesDuJour, pointagesDuMois, pointer } from "@/lib/serveur/pointage";
import { reponseErreur } from "@/lib/serveur/reponses";
import { heurePointage } from "@/lib/pointage";

// GET  /api/gestion/pointage?borne=1          le code du moment (écran de la borne)
// GET  /api/gestion/pointage?moi=1            son propre pointage du jour
// GET  /api/gestion/pointage?date=AAAA-MM-JJ  la journée de l'équipe (direction, manager)
// GET  /api/gestion/pointage?mois=AAAA-MM     le mois de chacun (direction, manager)
// POST /api/gestion/pointage { action: "pointer", code }
// POST /api/gestion/pointage { action: "corriger", uid, date, type, heure, motif }
// POST /api/gestion/pointage { action: "annuler", id, motif }
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const q = new URL(request.url).searchParams;
    if (q.get("borne")) return Response.json(await codeBorne(membre), sansCache);
    if (q.get("moi")) return Response.json(await monPointage(membre), sansCache);
    if (q.get("mois")) return Response.json(await pointagesDuMois(membre, q.get("mois")), sansCache);
    return Response.json(await pointagesDuJour(membre, q.get("date")), sansCache);
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    if (c.action === "pointer") return Response.json(await pointer(membre, c.code), { status: 201 });
    if (c.action === "corriger") {
      const r = await corrigerPointage(membre, c);
      await noter(membre, "equipe", `Pointage ajouté pour ${r.nom} : ${c.type === "entree" ? "entrée" : "sortie"} le ${c.date} à ${heurePointage(Number(c.heure))} (${String(c.motif ?? "").slice(0, 100)})`, "/gestion/pointage");
      return Response.json(r, { status: 201 });
    }
    if (c.action === "annuler") {
      const r = await annulerPointage(membre, String(c.id ?? ""), c.motif);
      await noter(membre, "equipe", `Pointage annulé : ${r.nom}, ${r.type === "entree" ? "entrée" : "sortie"} de ${heurePointage(r.heure)} (${String(c.motif ?? "").slice(0, 100)})`, "/gestion/pointage");
      return Response.json(r);
    }
    return Response.json({ erreur: "Action inconnue." }, { status: 400 });
  } catch (e) {
    return reponseErreur(e);
  }
}
