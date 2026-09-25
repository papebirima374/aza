// Rapports de la direction : une période (un mois, une semaine, des dates au choix) comparée
// à la période d'avant de même longueur. Ventes, moyens de paiement, prestations et produits
// qui rapportent, chiffre de chaque praticienne, rendez-vous, clientes, avis — et l'export
// des tickets pour le comptable.

import { LIBELLE_MODE, MODES, recetteDuTicket } from "@/lib/caisse/modes";
import type { Membre } from "@/lib/serveur/agenda";
import { db } from "@/lib/serveur/firebase";
import { ErreurReservation, maintenantDakar } from "@/lib/serveur/reservations";
import { telephoneCanonique } from "@/lib/telephone";

const Erreur = ErreurReservation;
export const ROLES_RAPPORTS = ["direction", "manager", "comptable"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function exiger(membre: Membre) {
  if (!ROLES_RAPPORTS.includes(membre.role)) throw new Erreur("Réservé à la direction, au manager et au comptable.", 403);
}

const jour = (d: string) => Date.parse(`${d}T12:00:00Z`);
const versDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const decaler = (d: string, n: number) => versDate(jour(d) + n * 86400000);

type Ligne = { id: string; nom: string; type: string; quantite: number; montant: number };
type TicketLu = {
  id: string;
  reference: string;
  type: "vente" | "avoir" | "reglement";
  date: string;
  heure: number;
  lignes: Ligne[];
  total: number;
  paiements: { mode: string; montant: number }[];
  rendu: number;
  credit: number;
  remise?: { montant: number; motif: string };
  fidelite?: { remise: number };
  cliente: { nom: string; telephone: string } | null;
  rendezVous?: string | null;
  annule?: unknown;
  par: { nom: string };
};

export function periodeValide(du?: string | null, au?: string | null) {
  const auj = maintenantDakar().date;
  const fin = au && DATE.test(au) ? au : auj;
  const debut = du && DATE.test(du) ? du : `${fin.slice(0, 7)}-01`;
  if (debut > fin) throw new Erreur("La date de début est après la date de fin.", 400);
  const jours = Math.round((jour(fin) - jour(debut)) / 86400000) + 1;
  if (jours > 366) throw new Erreur("Choisissez une période d'un an au plus.", 400);
  return { du: debut, au: fin, jours };
}

async function ticketsEntre(du: string, au: string): Promise<TicketLu[]> {
  const snap = await db().collection("tickets").where("date", ">=", du).where("date", "<=", au).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TicketLu);
}

function totaux(tickets: TicketLu[]) {
  const recette = tickets.reduce((s, t) => s + recetteDuTicket(t), 0);
  const nombre = tickets.filter((t) => t.type === "vente").length - tickets.filter((t) => t.type === "avoir").length;
  return { recette, nombre, panierMoyen: nombre > 0 ? Math.round(recette / nombre) : 0 };
}

export async function rapport(membre: Membre, duBrut?: string | null, auBrut?: string | null) {
  exiger(membre);
  const { du, au, jours } = periodeValide(duBrut, auBrut);
  const avant = { du: decaler(du, -jours), au: decaler(du, -1) };
  const base = db();
  const [tickets, ticketsAvant, rdvs, praticiennes, nouvelles, avis] = await Promise.all([
    ticketsEntre(du, au),
    ticketsEntre(avant.du, avant.au),
    base.collection("rendezVous").where("date", ">=", du).where("date", "<=", au).get(),
    base.collection("praticiennes").get(),
    base.collection("clientes").where("premiereVisite", ">=", du).where("premiereVisite", "<=", au).get(),
    base.collection("avis").where("date", ">=", du).where("date", "<=", au).get(),
  ]);
  const nomPraticienne = new Map(praticiennes.docs.map((d) => [d.id, d.get("nom") as string]));

  // Ventes
  const parMode: Record<string, number> = {};
  const parType: Record<string, number> = {};
  let remises = 0;
  let creditAccorde = 0;
  let creditRembourse = 0;
  const avoirs = { nombre: 0, montant: 0 };
  const parJour = new Map<string, { recette: number; tickets: number }>();
  for (let i = 0; i < jours; i++) parJour.set(decaler(du, i), { recette: 0, tickets: 0 });
  const parJourSemaine = Array.from({ length: 7 }, () => ({ recette: 0, tickets: 0 }));
  const parHeure = new Map<number, number>();
  const articles = new Map<string, { nom: string; type: string; nombre: number; montant: number }>();
  const clientesServies = new Map<string, { nom: string; telephone: string; montant: number; visites: number }>();

  for (const t of tickets) {
    const r = recetteDuTicket(t);
    const j = parJour.get(t.date);
    const signe = t.type === "avoir" ? -1 : t.type === "vente" ? 1 : 0;
    if (j) {
      j.recette += r;
      j.tickets += signe;
    }
    const js = new Date(jour(t.date)).getUTCDay();
    parJourSemaine[js].recette += r;
    parJourSemaine[js].tickets += signe;
    for (const p of t.paiements) if (p.mode !== "carte-cadeau") parMode[p.mode] = (parMode[p.mode] ?? 0) + p.montant;
    if (t.rendu) parMode.especes = (parMode.especes ?? 0) - t.rendu;
    if (t.type === "reglement") creditRembourse += t.total;
    if (t.type === "avoir") {
      avoirs.nombre++;
      avoirs.montant += -t.total;
    }
    if (t.type === "vente" && !t.annule) {
      remises += (t.remise?.montant ?? 0) + (t.fidelite?.remise ?? 0);
      creditAccorde += t.credit ?? 0;
      parHeure.set(Math.floor(t.heure / 60), (parHeure.get(Math.floor(t.heure / 60)) ?? 0) + 1);
      if (t.cliente?.telephone) {
        const cle = telephoneCanonique(t.cliente.telephone);
        const c = clientesServies.get(cle) ?? { nom: t.cliente.nom, telephone: t.cliente.telephone, montant: 0, visites: 0 };
        c.montant += t.total;
        c.visites++;
        clientesServies.set(cle, c);
      }
    }
    for (const l of t.lignes) {
      parType[l.type] = (parType[l.type] ?? 0) + l.montant;
      if (l.type !== "prestation" && l.type !== "produit") continue;
      const a = articles.get(l.id) ?? { nom: l.nom, type: l.type, nombre: 0, montant: 0 };
      a.nombre += t.type === "avoir" ? -l.quantite : l.quantite;
      a.montant += l.montant;
      articles.set(l.id, a);
    }
  }
  const classer = (type: string, n: number) =>
    [...articles.values()].filter((a) => a.type === type && a.nombre > 0).sort((a, b) => b.montant - a.montant).slice(0, n);

  // Chiffre de chaque praticienne : les prestations d'un ticket de rendez-vous sont partagées
  // entre les praticiennes qui les ont faites (à parts égales si elles étaient plusieurs).
  const rdvParId = new Map(rdvs.docs.map((d) => [d.id, d]));
  const manquants = [...new Set(tickets.map((t) => t.rendezVous).filter((x): x is string => Boolean(x) && !rdvParId.has(x!)))];
  for (let i = 0; i < manquants.length; i += 100) {
    const lus = await base.getAll(...manquants.slice(i, i + 100).map((id) => base.doc(`rendezVous/${id}`)));
    for (const d of lus) if (d.exists) rdvParId.set(d.id, d as FirebaseFirestore.QueryDocumentSnapshot);
  }
  const equipe = new Map<string, { id: string; nom: string; montant: number; prestations: number; rendezVous: number; absentes: number; notes: number[] }>();
  const fiche = (id: string) => {
    let e = equipe.get(id);
    if (!e) {
      e = { id, nom: nomPraticienne.get(id) ?? "Ancienne praticienne", montant: 0, prestations: 0, rendezVous: 0, absentes: 0, notes: [] };
      equipe.set(id, e);
    }
    return e;
  };
  let sansPraticienne = 0;
  for (const t of tickets) {
    if (t.type === "reglement") continue;
    const rdv = t.rendezVous ? rdvParId.get(t.rendezVous) : undefined;
    const affectations = (rdv?.get("affectations") as { prestation: string; praticiennes: string[] }[] | undefined) ?? [];
    const toutes = (rdv?.get("praticiennesIds") as string[] | undefined) ?? [];
    for (const l of t.lignes) {
      if (l.type !== "prestation") continue;
      const faites = [...new Set(affectations.filter((a) => a.prestation === l.id).flatMap((a) => a.praticiennes))];
      const qui = faites.length > 0 ? faites : toutes;
      if (qui.length === 0) {
        sansPraticienne += l.montant;
        continue;
      }
      for (const p of qui) {
        const e = fiche(p);
        e.montant += Math.round(l.montant / qui.length);
        e.prestations += (t.type === "avoir" ? -l.quantite : l.quantite) / qui.length;
      }
    }
  }

  // Rendez-vous
  const compte: Record<string, number> = {};
  let enLigne = 0;
  for (const d of rdvs.docs) {
    const s = d.get("statut") as string;
    compte[s] = (compte[s] ?? 0) + 1;
    if (d.get("source") === "site" && s !== "annule") enLigne++;
    if (s === "annule") continue;
    for (const p of (d.get("praticiennesIds") as string[] | undefined) ?? []) {
      const e = fiche(p);
      e.rendezVous++;
      if (s === "absente") e.absentes++;
    }
  }
  const totalRdv = rdvs.size - (compte.annule ?? 0);

  // Avis
  const notes = avis.docs.map((d) => d.get("note") as number);
  for (const d of avis.docs) for (const p of (d.get("praticiennes") as { id: string }[] | undefined) ?? []) fiche(p.id).notes.push(d.get("note") as number);
  const moyenne = (n: number[]) => (n.length ? Math.round((n.reduce((s, x) => s + x, 0) / n.length) * 10) / 10 : null);

  const t = totaux(tickets);
  const servies = clientesServies.size;
  return {
    du,
    au,
    jours,
    avant,
    ventes: {
      ...t,
      parMode,
      prestations: parType.prestation ?? 0,
      produits: parType.produit ?? 0,
      cartesCadeaux: parType["carte-cadeau"] ?? 0,
      livraisons: parType.livraison ?? 0,
      remises,
      avoirs,
      creditAccorde,
      creditRembourse,
    },
    precedente: totaux(ticketsAvant),
    parJour: [...parJour.entries()].map(([date, v]) => ({ date, ...v })),
    parJourSemaine,
    parHeure: [...parHeure.entries()].sort((a, b) => a[0] - b[0]).map(([heure, tickets]) => ({ heure, tickets })),
    topPrestations: classer("prestation", 10),
    topProduits: classer("produit", 5),
    equipe: [...equipe.values()]
      .filter((e) => e.montant !== 0 || e.rendezVous > 0)
      .map(({ notes: n, ...e }) => ({ ...e, prestations: Math.round(e.prestations), avis: n.length, note: moyenne(n) }))
      .sort((a, b) => b.montant - a.montant),
    sansPraticienne,
    rendezVous: {
      total: totalRdv,
      honores: (compte.termine ?? 0) + (compte.encaisse ?? 0),
      absentes: compte.absente ?? 0,
      annules: compte.annule ?? 0,
      enLigne,
      tauxAbsence: totalRdv > 0 ? Math.round(((compte.absente ?? 0) / totalRdv) * 100) : 0,
    },
    clientes: {
      servies,
      nouvelles: nouvelles.size,
      revenues: Math.max(0, servies - nouvelles.size),
      meilleures: [...clientesServies.values()].sort((a, b) => b.montant - a.montant).slice(0, 5),
    },
    avis: {
      nombre: notes.length,
      moyenne: moyenne(notes),
      repartition: [1, 2, 3, 4, 5].map((n) => notes.filter((x) => x === n).length),
    },
  };
}

export type Rapport = Awaited<ReturnType<typeof rapport>>;

/** Tous les tickets de la période, un par ligne (Excel, séparateur « ; »). */
export async function exportTickets(membre: Membre, duBrut?: string | null, auBrut?: string | null) {
  exiger(membre);
  const { du, au } = periodeValide(duBrut, auBrut);
  const tickets = (await ticketsEntre(du, au)).sort((a, b) => (a.date === b.date ? a.heure - b.heure : a.date < b.date ? -1 : 1));
  const modes = MODES.map((m) => m.id);
  const cellule = (v: unknown) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const entete = ["Date", "Heure", "Ticket", "Type", "Cliente", "Téléphone", "Détail", "Remise", "Total", ...modes.map((m) => LIBELLE_MODE[m]), "Monnaie rendue", "Annulé", "Caissière"];
  const lignes = tickets.map((t) => {
    const paye = (m: string) => t.paiements.filter((p) => p.mode === m).reduce((s, p) => s + p.montant, 0) || "";
    return [
      t.date,
      `${Math.floor(t.heure / 60)}h${String(t.heure % 60).padStart(2, "0")}`,
      t.reference,
      t.type === "vente" ? "Vente" : t.type === "avoir" ? "Avoir" : "Règlement de crédit",
      t.cliente?.nom ?? "",
      t.cliente?.telephone ?? "",
      t.lignes.map((l) => (l.quantite > 1 ? `${l.quantite} x ${l.nom}` : l.nom)).join(" + "),
      (t.remise?.montant ?? 0) + (t.fidelite?.remise ?? 0) || "",
      t.total,
      ...modes.map(paye),
      t.rendu || "",
      t.annule ? "oui" : "",
      t.par?.nom ?? "",
    ]
      .map(cellule)
      .join(";");
  });
  return { nom: `tickets-${du}-au-${au}.csv`, contenu: "﻿" + [entete.join(";"), ...lignes].join("\r\n") };
}
