import { membreConnecte } from "@/lib/serveur/agenda";
import { alerteCliente, enregistrerCliente, ficheCliente, listerClientes } from "@/lib/serveur/clientes";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter } from "@/lib/serveur/activite";

// GET  /api/gestion/clientes               toutes les fiches (résumé)
// GET  /api/gestion/clientes?id=…          une fiche complète, avec historique et indicateurs
// GET  /api/gestion/clientes?alerte=RDV    allergies et fiche technique pour un rendez-vous (aussi sa praticienne)
// POST /api/gestion/clientes { id?, telephone?, nom, … }  créer (sans id) ou modifier une fiche
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const q = new URL(request.url).searchParams;
    if (q.get("alerte")) return Response.json(await alerteCliente(membre, q.get("alerte")!), sansCache);
    if (q.get("id")) return Response.json(await ficheCliente(membre, q.get("id")!), sansCache);
    return Response.json(await listerClientes(membre), sansCache);
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const c = await request.json().catch(() => ({}));
    const r = await enregistrerCliente(membre, c ?? {});
    await noter(membre, "clientes", `Fiche cliente ${c?.id ? "modifiée" : "créée"} : ${String(c?.nom ?? "").slice(0, 60)}`, "/gestion/clientes");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
