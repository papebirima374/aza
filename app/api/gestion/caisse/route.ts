import { membreConnecte } from "@/lib/serveur/agenda";
import { aEncaisser, annulerTicket, fideliteCliente, encaisserCommande, reglerCredit, cloturerCaisse, encaisser, journal, lireRendezVous, lireTicket, ouvrirCaisse } from "@/lib/serveur/caisse";
import { noter, nomDe, prix } from "@/lib/serveur/activite";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { reponseErreur } from "@/lib/serveur/reponses";

// GET  /api/gestion/caisse?date=AAAA-MM-JJ   journal du jour (caisse, tickets, totaux)
// GET  /api/gestion/caisse?a-encaisser=1     rendez-vous terminés du jour
// GET  /api/gestion/caisse?ticket=ID         un ticket (reçu)
// GET  /api/gestion/caisse?rdv=ID            un rendez-vous à encaisser
// GET  /api/gestion/caisse?fidelite=TEL      points de fidélité de la cliente et règles
// POST /api/gestion/caisse { action: "ouvrir" | "encaisser" | "annuler" | "reglement" | "cloturer", … }
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
    if (q.get("fidelite")) return Response.json(await fideliteCliente(membre, q.get("fidelite")!), sansCache);
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
      case "ouvrir": {
        const r = await ouvrirCaisse(membre, c.fond);
        await noter(membre, "caisse", `Caisse ouverte, fond de caisse ${prix(c.fond)}`);
        return Response.json(r, { status: 201 });
      }
      case "encaisser": {
        const r = await encaisser(membre, {
            lignes: c.lignes,
            paiements: c.paiements,
            remise: c.remise,
            rendezVous: c.rendezVous ? String(c.rendezVous) : undefined,
            cliente: c.cliente ? { nom: String(c.cliente.nom ?? ""), telephone: String(c.cliente.telephone ?? "") } : undefined,
            carteCadeau: c.carteCadeau ? String(c.carteCadeau) : undefined,
            fidelite: c.fidelite === true,
            cadeau: c.cadeau === true,
            idLocal: c.idLocal ? String(c.idLocal) : undefined,
            faitLe: c.faitLe,
          });
        if (!("deja" in r && r.deja)) {
          const qui = c.cliente?.nom ? ` — ${String(c.cliente.nom).slice(0, 60)}` : c.rendezVous ? ` — ${await nomDe(`rendezVous/${c.rendezVous}`, "cliente")}` : "";
          const remise = c.remise?.montant ? ` · remise ${prix(c.remise.montant)} (${String(c.remise.motif ?? "").slice(0, 80)})` : "";
          const plus = `${c.fidelite === true ? " · points de fidélité utilisés" : ""}${c.cadeau === true ? " · 🎁 cadeau fidélité remis" : ""}${c.carteCadeau ? " · payé en partie par carte cadeau" : ""}`;
          await noter(membre, "caisse", `Ticket ${r.reference} encaissé : ${prix(r.total)}${qui}${remise}${plus}`, `/gestion/caisse/ticket/${r.id}`);
        }
        return Response.json(r, { status: 201 });
      }
      case "annuler": {
        const origine = await nomDe(`tickets/${String(c.id ?? "-")}`, "reference");
        const r = await annulerTicket(membre, String(c.id ?? "-"), c.motif);
        await noter(membre, "caisse", `Ticket ${origine} annulé par l'avoir ${r.reference} — motif : ${String(c.motif ?? "").slice(0, 120)}`, `/gestion/caisse/ticket/${r.id}`);
        return Response.json(r, { status: 201 });
      }
      case "commande": {
        const r = await encaisserCommande(membre, String(c.commande ?? "-"), c.paiements, c.cadeau);
        const ref = await nomDe(`commandes/${String(c.commande ?? "-")}`, "reference");
        await noter(membre, "caisse", `Commande ${ref} remise et encaissée (ticket ${r.reference}, ${prix(r.total)})${c.cadeau?.remis ? " · 🎁 cadeau fidélité" : ""}`, `/gestion/caisse/ticket/${r.id}`);
        return Response.json(r, { status: 201 });
      }
      case "reglement": {
        const r = await reglerCredit(membre, String(c.cliente ?? "-"), c.paiements);
        const nom = await nomDe(`clientes/${String(c.cliente ?? "-")}`, "nom");
        await noter(membre, "caisse", `Crédit réglé par ${nom} (ticket ${r.reference}) — reste dû ${prix(r.reste)}`, `/gestion/caisse/ticket/${r.id}`);
        return Response.json(r, { status: 201 });
      }
      case "cloturer": {
        const r = await cloturerCaisse(membre, c.compte, c.justification);
        await noter(membre, "caisse", `Caisse clôturée : ${prix(c.compte)} comptés, écart ${prix(r.ecart)}${c.justification ? ` (${String(c.justification).slice(0, 120)})` : ""}`);
        return Response.json(r);
      }
      default:
        return Response.json({ erreur: "Action inconnue." }, { status: 400 });
    }
  } catch (e) {
    return reponseErreur(e);
  }
}
