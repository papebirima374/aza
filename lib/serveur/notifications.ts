// Centre de notifications (la cloche) : ce qui attend une action, pour CETTE personne,
// selon ses accès. Chaque rubrique est calculée à part ; une rubrique non permise (ou en
// erreur) est simplement absente. Les retards et les clientes à encaisser, eux, arrivent en
// direct sur l'écran (pas besoin du serveur).

import { Timestamp } from "firebase-admin/firestore";
import { peut } from "@/lib/acces";
import { ROLES_AGENDA } from "@/lib/agenda/statuts";
import type { Membre } from "@/lib/serveur/agenda";
import { compterAvisATraiter } from "@/lib/serveur/avis";
import { compterNouvelles } from "@/lib/serveur/boutique";
import { voitToutesLesCaisses } from "@/lib/serveur/caisse";
import { db } from "@/lib/serveur/firebase";
import { maintenantDakar } from "@/lib/serveur/reservations";
import { compterNouveauxDevis } from "@/lib/serveur/perruques";
import { compterAlertes } from "@/lib/serveur/stock";

export type Notification = {
  id: string;
  icone: string;
  titre: string;
  detail?: string;
  lien: string;
  nombre: number;
  /** Rendez-vous en ligne : chacun peut être marqué « vu » sur l'appareil. */
  elements?: { id: string; texte: string; lien: string }[];
};

const essayer = async <T>(f: () => Promise<T>): Promise<T | null> => {
  try {
    return await f();
  } catch {
    return null;
  }
};
const heure = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
const jourCourt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export async function notifications(membre: Membre): Promise<Notification[]> {
  const { date } = maintenantDakar();
  const base = db();
  const agenda = ROLES_AGENDA.includes(membre.role);
  const [commandes, devis, avis, stock, anniversaires, enLigne, caisses] = await Promise.all([
    peut(membre, "commandes") ? essayer(() => compterNouvelles(membre)) : null,
    peut(membre, "commandes") ? essayer(() => compterNouveauxDevis(membre)) : null,
    peut(membre, "avis") ? essayer(() => compterAvisATraiter(membre)) : null,
    essayer(() => compterAlertes(membre)),
    peut(membre, "clientes") ? essayer(async () => (await base.collection("clientes").where("anniversaire", "==", date.slice(5)).limit(20).get()).docs) : null,
    agenda
      ? essayer(async () => (await base.collection("rendezVous").where("creeLe", ">=", Timestamp.fromMillis(Date.now() - 48 * 3600_000)).get()).docs)
      : null,
    voitToutesLesCaisses(membre) ? essayer(async () => (await base.collection("caisses").where("statut", "==", "ouverte").get()).docs) : null,
  ]);

  const res: Notification[] = [];
  if (enLigne) {
    const rdvs = enLigne
      .filter((d) => d.get("source") === "site" && ["reserve", "confirme"].includes(d.get("statut")) && (d.get("date") as string) >= date)
      .sort((a, b) => ((b.get("creeLe") as Timestamp)?.toMillis() ?? 0) - ((a.get("creeLe") as Timestamp)?.toMillis() ?? 0));
    if (rdvs.length)
      res.push({
        id: "rdv-en-ligne",
        icone: "📅",
        titre: `${rdvs.length} rendez-vous pris en ligne`,
        detail: "Ces 2 derniers jours",
        lien: "/gestion",
        nombre: rdvs.length,
        elements: rdvs.map((d) => ({
          id: d.id,
          texte: `${(d.get("cliente") as { nom: string }).nom} · ${jourCourt(d.get("date"))} à ${heure(d.get("debut"))} · ${((d.get("prestations") as { nom: string }[]) ?? []).map((p) => p.nom).join(" + ")}`,
          lien: `/gestion?date=${d.get("date")}`,
        })),
      });
  }
  const totalCommandes = (commandes ?? 0) + (devis ?? 0);
  if (totalCommandes)
    res.push({
      id: "commandes",
      icone: "🛍️",
      titre: [commandes ? `${commandes} commande${commandes > 1 ? "s" : ""} en ligne` : "", devis ? `${devis} demande${devis > 1 ? "s" : ""} de perruque` : ""].filter(Boolean).join(" · "),
      detail: "À confirmer",
      lien: "/gestion/commandes",
      nombre: totalCommandes,
    });
  if (avis?.aTraiter) res.push({ id: "avis", icone: "⭐", titre: `${avis.aTraiter} avis à regarder`, detail: "Note de 3 étoiles ou moins", lien: "/gestion/avis", nombre: avis.aTraiter });
  if (stock) res.push({ id: "stock", icone: "📦", titre: `${stock} article${stock > 1 ? "s" : ""} à commander ou bientôt périmé${stock > 1 ? "s" : ""}`, lien: "/gestion/stock", nombre: stock });
  if (anniversaires?.length)
    res.push({
      id: "anniversaires",
      icone: "🎂",
      titre: `${anniversaires.length} anniversaire${anniversaires.length > 1 ? "s" : ""} aujourd'hui`,
      detail: anniversaires.slice(0, 4).map((d) => d.get("nom") as string).join(", "),
      lien: "/gestion/clientes?groupe=anniversaires",
      nombre: anniversaires.length,
    });
  const oubliees = (caisses ?? []).filter((d) => (d.get("date") as string) < date);
  if (oubliees.length)
    res.push({
      id: "caisses",
      icone: "🔓",
      titre: `${oubliees.length} caisse${oubliees.length > 1 ? "s" : ""} pas clôturée${oubliees.length > 1 ? "s" : ""} les jours passés`,
      detail: oubliees
        .slice(0, 3)
        .map((d) => `${(d.get("ouvertPar") as { nom: string }).nom} (${jourCourt(d.get("date"))})`)
        .join(", "),
      lien: "/gestion/caisse/sessions",
      nombre: oubliees.length,
    });
  return res;
}
