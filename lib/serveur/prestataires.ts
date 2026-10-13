// Le travail de chaque prestataire, mois par mois : son historique (ce qu'elle voit, sans les
// montants) et la fiche du mois (ce que voit la direction : chiffre, soins, heures, retards,
// avis, primes versées).
//
// Une intervention = une ligne d'un ticket encaissé, attribuée comme dans les Rapports : la
// prestataire notée sur la ligne à la caisse, sinon celles du rendez-vous (à parts égales).

import { exigerAcces } from "@/lib/serveur/acces";
import type { Membre } from "@/lib/serveur/agenda";
import { montantsNets } from "@/lib/caisse/modes";
import { db } from "@/lib/serveur/firebase";
import { pointagesDuMois } from "@/lib/serveur/pointage";
import { rapport } from "@/lib/serveur/rapports";
import { ErreurReservation as Erreur, maintenantDakar } from "@/lib/serveur/reservations";

export type Intervention = {
  date: string;
  heure: number;
  type: "prestation" | "produit";
  nom: string;
  quantite: number;
  cliente: string;
  /** Partagée avec d'autres prestataires (rendez-vous à plusieurs). */
  avec: number;
  montant: number;
  reference: string;
};

type TicketLu = {
  date: string;
  heure: number;
  type: string;
  reference: string;
  total: number;
  sousTotal?: number;
  annule?: unknown;
  rendezVous?: string | null;
  cliente: { nom: string } | null;
  lignes: { id: string; nom: string; type: string; quantite: number; montant: number; praticienne?: { id: string } }[];
};

const moisValide = (m?: string | null) => (m && /^\d{4}-\d{2}$/.test(m) ? m : maintenantDakar().date.slice(0, 7));

/** Les interventions de cette prestataire sur le mois (tickets encaissés, non annulés). */
export async function interventionsDe(praticienne: string, mois: string): Promise<Intervention[]> {
  const base = db();
  const snap = await base.collection("tickets").where("date", ">=", `${mois}-01`).where("date", "<=", `${mois}-31`).get();
  const tickets = snap.docs.map((d) => d.data() as TicketLu).filter((t) => t.type === "vente" && !t.annule);
  const ids = [...new Set(tickets.map((t) => t.rendezVous).filter((x): x is string => Boolean(x)))];
  const rdvs = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  for (let i = 0; i < ids.length; i += 100) for (const d of await base.getAll(...ids.slice(i, i + 100).map((id) => base.doc(`rendezVous/${id}`)))) rdvs.set(d.id, d);
  const res: Intervention[] = [];
  for (const t of tickets) {
    const rdv = t.rendezVous ? rdvs.get(t.rendezVous) : undefined;
    const affectations = (rdv?.get("affectations") as { prestation: string; praticiennes: string[] }[] | undefined) ?? [];
    const toutes = (rdv?.get("praticiennesIds") as string[] | undefined) ?? [];
    const nets = montantsNets(t);
    t.lignes.forEach((l, i) => {
      if (l.type !== "prestation" && l.type !== "produit") return;
      const faites = l.praticienne?.id ? [l.praticienne.id] : [...new Set(affectations.filter((a) => a.prestation === l.id).flatMap((a) => a.praticiennes))];
      const qui = faites.length > 0 ? faites : l.type === "prestation" ? toutes : [];
      if (!qui.includes(praticienne)) return;
      res.push({
        date: t.date,
        heure: t.heure,
        type: l.type as "prestation" | "produit",
        nom: l.nom,
        quantite: l.quantite,
        cliente: t.cliente?.nom ?? "",
        avec: qui.length,
        montant: Math.round(nets[i] / qui.length),
        reference: t.reference,
      });
    });
  }
  return res.sort((a, b) => b.date.localeCompare(a.date) || b.heure - a.heure);
}

/** Son historique : ses soins du mois, SANS les montants (demande de la direction). */
export async function monHistorique(membre: Membre, moisBrut?: string | null) {
  if (!membre.praticienne) throw new Erreur("Ce compte n'a pas de prestations.", 403);
  const mois = moisValide(moisBrut);
  const liste = await interventionsDe(membre.praticienne, mois);
  return {
    mois,
    soins: liste.filter((x) => x.type === "prestation").reduce((n, x) => n + x.quantite, 0),
    jours: new Set(liste.map((x) => x.date)).size,
    interventions: liste.map(({ date, heure, type, nom, quantite, cliente, avec }) => ({ date, heure, type, nom, quantite, cliente, avec })),
  };
}

/** La fiche du mois d'une prestataire (direction, manager, ou qui voit les rapports). */
export async function ficheDuMois(membre: Membre, praticienne: string, moisBrut?: string | null) {
  exigerAcces(membre, "rapports", "La fiche du mois est réservée à qui voit les rapports.");
  if (!/^[\w-]{1,80}$/.test(praticienne)) throw new Erreur("Prestataire introuvable.", 404);
  const mois = moisValide(moisBrut);
  const base = db();
  const fiche = await base.doc(`praticiennes/${praticienne}`).get();
  if (!fiche.exists) throw new Erreur("Prestataire introuvable.", 404);
  const dernier = new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)), 0)).getUTCDate();
  const [liste, r, comptes, primes, equipe] = await Promise.all([
    interventionsDe(praticienne, mois),
    rapport(membre, `${mois}-01`, `${mois}-${String(dernier).padStart(2, "0")}`),
    base.collection("comptes").where("praticienne", "==", praticienne).get(),
    base.collection("depenses").where("pour.id", "==", praticienne).get(),
    base.collection("praticiennes").where("actif", "==", true).get(),
  ]);
  const uid = comptes.docs[0]?.id;
  // Heures et retards : seulement si l'on voit les pointages.
  let presence: { jours: number; minutes: number; retards: number; minutesRetard: number; oublis: number } | null = null;
  try {
    const p = (await pointagesDuMois(membre, mois)).personnes.find((x) => x.uid === uid);
    if (p) presence = { jours: p.jours, minutes: p.minutes, retards: p.retards, minutesRetard: p.minutesRetard, oublis: p.oublis };
  } catch {
    presence = null;
  }
  const e = r.equipe.find((x) => x.id === praticienne);
  const prestations = liste.filter((x) => x.type === "prestation");
  const produits = liste.filter((x) => x.type === "produit");
  return {
    mois,
    praticienne: { id: praticienne, nom: fiche.get("nom") as string, externe: fiche.get("externe") === true },
    chiffre: prestations.reduce((s, x) => s + x.montant, 0),
    ventesProduits: produits.reduce((s, x) => s + x.montant, 0),
    soins: prestations.reduce((n, x) => n + x.quantite, 0),
    joursTravailles: new Set(liste.map((x) => x.date)).size,
    rendezVous: e?.rendezVous ?? 0,
    absentes: e?.absentes ?? 0,
    avis: e?.avis ?? 0,
    note: e?.note ?? null,
    presence,
    primes: primes.docs
      .map((d) => ({ id: d.id, date: d.get("date") as string, montant: d.get("montant") as number, libelle: (d.get("libelle") as string) ?? "", mode: d.get("mode") as string, annulee: Boolean(d.get("annulee")) }))
      .filter((x) => x.date.startsWith(mois) && !x.annulee),
    interventions: liste,
    /** Pour passer d'une prestataire à l'autre. */
    equipe: equipe.docs
      .map((d) => ({ id: d.id, nom: d.get("nom") as string, ordre: (d.get("ordre") as number | undefined) ?? 9999 }))
      .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom))
      .map(({ id, nom }) => ({ id, nom })),
  };
}
