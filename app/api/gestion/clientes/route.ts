import { membreConnecte } from "@/lib/serveur/agenda";
import { alerteCliente, changerNumero, doublonsClientes, enregistrerCliente, fusionnerDoublons, ficheCliente, listerClientes, noterRelance } from "@/lib/serveur/clientes";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";
import { noter } from "@/lib/serveur/activite";

// GET  /api/gestion/clientes               toutes les fiches (résumé)
// GET  /api/gestion/clientes?id=…          une fiche complète, avec historique et indicateurs
// GET  /api/gestion/clientes?alerte=RDV    allergies et fiche technique pour un rendez-vous (aussi sa praticienne)
// POST /api/gestion/clientes { id?, telephone?, nom, … }  créer (sans id) ou modifier une fiche
// POST /api/gestion/clientes { action: "relance", id, type }  noter une relance WhatsApp
// GET  /api/gestion/clientes?doublons=1    fiches en double (même numéro écrit autrement)
// POST /api/gestion/clientes { action: "fusionner", cle }  fusionner les doublons d'un numéro (direction, manager)
// POST /api/gestion/clientes { action: "numero", id, telephone }  changer le numéro (la fiche et son historique suivent)
const sansCache = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  if (!firebaseConfigure()) return Response.json({ erreur: "Gestion indisponible." }, { status: 503 });
  try {
    const membre = await membreConnecte(request);
    const q = new URL(request.url).searchParams;
    if (q.get("alerte")) return Response.json(await alerteCliente(membre, q.get("alerte")!), sansCache);
    if (q.get("doublons")) return Response.json(await doublonsClientes(membre), sansCache);
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
    if (c?.action === "relance") {
      const r = await noterRelance(membre, String(c.id ?? "-"), String(c.type ?? ""));
      const quoi: Record<string, string> = { anniversaire: "souhaité l'anniversaire de", revoir: "relancé", credit: "rappelé son crédit à" };
      await noter(membre, "clientes", `A ${quoi[String(c.type)] ?? "relancé"} ${r.nom} par WhatsApp`, `/gestion/clientes/${String(c.id)}`);
      return Response.json(r);
    }
    if (c?.action === "fusionner") {
      const r = await fusionnerDoublons(membre, String(c.cle ?? ""));
      await noter(membre, "clientes", `Fiches en double fusionnées : ${r.nom} (${r.fusionnees + 1} fiches → 1, numéro ${r.id})`, `/gestion/clientes/${r.id}`);
      return Response.json(r);
    }
    if (c?.action === "numero") {
      const r = await changerNumero(membre, String(c.id ?? "-"), c.telephone);
      await noter(membre, "clientes", `Numéro de ${r.nom} changé : ${String(c.id)} → ${r.id}`, `/gestion/clientes/${r.id}`);
      return Response.json(r);
    }
    const r = await enregistrerCliente(membre, c ?? {});
    await noter(membre, "clientes", `Fiche cliente ${c?.id ? "modifiée" : "créée"} : ${String(c?.nom ?? "").slice(0, 60)}`, "/gestion/clientes");
    return Response.json(r);
  } catch (e) {
    return reponseErreur(e);
  }
}
