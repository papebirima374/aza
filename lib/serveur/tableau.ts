// Écran du jour (cahier des charges §12) : rendez-vous prévus, clientes reçues, recette
// encaissée, panier moyen, absences, temps libre restant par praticienne, alertes de stock.
// Direction et manager seulement.

import type { Statut } from "@/lib/agenda/statuts";
import type { Horaires } from "@/lib/reservation/disponibilites";
import type { Membre } from "@/lib/serveur/agenda";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation, maintenantDakar } from "@/lib/serveur/reservations";

type Intervalle = { debut: number; fin: number };

function recouvrement(a: Intervalle, b: Intervalle) {
  return Math.max(0, Math.min(a.fin, b.fin) - Math.max(a.debut, b.debut));
}

function decaler(date: string, jours: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

type TicketLu = { type: string; total: number; paiements: { mode: string; montant: number }[]; rendu: number; lignes: { type: string; montant: number }[] };

function recette(tickets: TicketLu[]) {
  const ventes = tickets.filter((t) => t.type === "vente");
  const total = tickets.reduce((s, t) => s + t.total, 0);
  const parMode: Record<string, number> = {};
  let prestations = 0;
  let produits = 0;
  for (const t of tickets) {
    for (const p of t.paiements) parMode[p.mode] = (parMode[p.mode] ?? 0) + p.montant;
    if (t.rendu) parMode.especes = (parMode.especes ?? 0) - t.rendu;
    for (const l of t.lignes) {
      if (l.type === "produit") produits += l.montant;
      else if (l.type === "prestation") prestations += l.montant;
    }
  }
  const nombre = ventes.length - tickets.filter((t) => t.type === "avoir").length;
  return { total, nombre, panierMoyen: nombre > 0 ? Math.round(total / nombre) : 0, parMode, prestations, produits };
}

export async function ecranDuJour(membre: Membre, dateBrute?: string) {
  if (membre.role !== "direction" && membre.role !== "manager") throw new ErreurReservation("Réservé à la direction et au manager.", 403);
  const maintenant = maintenantDakar();
  const date = dateBrute && /^\d{4}-\d{2}-\d{2}$/.test(dateBrute) ? dateBrute : maintenant.date;
  const semaineDerniere = decaler(date, -7);
  const base = db();
  const [rdvs, tickets, ticketsAvant, occupations, praticiennes, reglages, caisse, articles] = await Promise.all([
    base.collection("rendezVous").where("date", "==", date).get(),
    base.collection("tickets").where("date", "==", date).get(),
    base.collection("tickets").where("date", "==", semaineDerniere).get(),
    base.collection("occupations").where("date", "==", date).get(),
    base.collection("praticiennes").where("actif", "==", true).get(),
    base.doc("reglages/institut").get(),
    base.doc(`caisses/${date}`).get(),
    base.collection("articles").get(),
  ]);

  // Rendez-vous
  const compte: Partial<Record<Statut, number>> = {};
  for (const d of rdvs.docs) compte[d.get("statut") as Statut] = (compte[d.get("statut") as Statut] ?? 0) + 1;
  const n = (...s: Statut[]) => s.reduce((t, x) => t + (compte[x] ?? 0), 0);
  // Réservés mais l'heure est passée sans que la cliente soit notée arrivée.
  const passe = (fin: number) => date < maintenant.date || (date === maintenant.date && fin <= maintenant.minutes);
  const sansNouvelles = rdvs.docs.filter((d) => ["reserve", "confirme"].includes(d.get("statut")) && passe(d.get("fin"))).length;
  const prochains = rdvs.docs
    .filter((d) => ["reserve", "confirme", "arrivee"].includes(d.get("statut")) && (date !== maintenant.date || (d.get("fin") as number) > maintenant.minutes))
    .sort((a, b) => a.get("debut") - b.get("debut"))
    .slice(0, 5)
    .map((d) => ({
      id: d.id,
      debut: d.get("debut") as number,
      cliente: (d.get("cliente") as { nom: string }).nom,
      prestations: (d.get("prestations") as { nom: string }[]).map((p) => p.nom).join(" + "),
      statut: d.get("statut") as Statut,
      enLigne: d.get("source") === "site",
    }));

  // Temps libre restant par praticienne (à partir de maintenant si c'est aujourd'hui)
  const jourSemaine = new Date(`${date}T12:00:00Z`).getUTCDay();
  const horairesInstitut = (reglages.get("horaires") as Horaires | undefined) ?? {};
  const fermetures = (reglages.get("fermetures") as string[] | undefined) ?? [];
  const depuis = date === maintenant.date ? maintenant.minutes : date < maintenant.date ? 24 * 60 : 0;
  const equipe = praticiennes.docs
    .map((d) => {
      const horaires = ((d.get("horaires") as Horaires | undefined) ?? horairesInstitut)[jourSemaine] ?? [];
      const plages = fermetures.includes(date) ? [] : horaires;
      const travail = plages.reduce((s, p) => s + (p.fin - p.debut), 0);
      const fenetres = plages.map((p) => ({ debut: Math.max(p.debut, depuis), fin: p.fin })).filter((p) => p.fin > p.debut);
      const siennes = occupations.docs.filter((o) => o.get("ressource") === d.id).map((o) => ({ debut: o.get("debut") as number, fin: o.get("fin") as number }));
      const occupeTotal = siennes.reduce((s, o) => s + plages.reduce((t, p) => t + recouvrement(o, p), 0), 0);
      const libre = fenetres.reduce((s, f) => s + (f.fin - f.debut) - siennes.reduce((t, o) => t + recouvrement(o, f), 0), 0);
      return {
        id: d.id,
        nom: d.get("nom") as string,
        travaille: travail > 0,
        occupation: travail > 0 ? Math.round((occupeTotal / travail) * 100) : 0,
        libreRestant: Math.max(0, libre),
      };
    })
    .filter((p) => p.travaille)
    .sort((a, b) => b.occupation - a.occupation);

  // Stock
  const limite = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const alertesStock = articles.docs
    .filter((d) => d.get("actif") !== false)
    .filter((d) => (d.get("quantite") ?? 0) <= (d.get("seuil") ?? 0) || (d.get("peremption") && d.get("peremption") <= limite))
    .map((d) => ({ nom: d.get("nom") as string, quantite: (d.get("quantite") as number) ?? 0, unite: (d.get("unite") as string) ?? "" }));

  return {
    date,
    aujourdhui: date === maintenant.date,
    rendezVous: {
      total: rdvs.size - n("annule"),
      aVenir: n("reserve", "confirme") - sansNouvelles,
      sansNouvelles,
      surPlace: n("arrivee", "en-cours"),
      recues: n("termine", "encaisse"),
      aEncaisser: n("termine"),
      absentes: n("absente"),
      annules: n("annule"),
      enLigne: rdvs.docs.filter((d) => d.get("source") === "site" && d.get("statut") !== "annule").length,
    },
    prochains,
    recette: recette(tickets.docs.map((d) => d.data() as TicketLu)),
    recetteSemaineDerniere: recette(ticketsAvant.docs.map((d) => d.data() as TicketLu)).total,
    caisse: caisse.exists ? { statut: caisse.get("statut") as string, ecart: (caisse.get("cloture.ecart") as number | undefined) ?? null } : null,
    equipe,
    libreRestant: equipe.reduce((s, p) => s + p.libreRestant, 0),
    alertesStock,
  };
}
