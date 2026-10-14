import { peut } from "@/lib/acces";
import { ROLES_AGENDA } from "@/lib/agenda/statuts";
import { membreConnecte, type Membre } from "@/lib/serveur/agenda";
import { ErreurReservation, type LigneComptoir } from "@/lib/serveur/reservations";

/** Seules la direction, le manager et l'accueil prennent des rendez-vous au comptoir. */
export async function membreAccueil(request: Request): Promise<Membre> {
  const m = await membreConnecte(request);
  if (!ROLES_AGENDA.includes(m.role)) throw new ErreurReservation("Réservé à l'accueil et à la direction.", 403);
  return m;
}

/**
 * Le comptoir, ou une prestataire à qui la direction a donné l'accès « Prendre ses propres
 * rendez-vous » : elle ne prend alors que SES rendez-vous (moi = sa fiche).
 */
export async function membreComptoir(request: Request): Promise<{ membre: Membre; moi: string | null }> {
  const m = await membreConnecte(request);
  if (ROLES_AGENDA.includes(m.role)) return { membre: m, moi: null };
  if (m.praticienne && peut(m, "rdvPerso")) return { membre: m, moi: m.praticienne };
  throw new ErreurReservation(m.praticienne ? "Accès « Prendre ses propres rendez-vous » non autorisé. Demandez-le à la direction." : "Réservé à l'accueil et à la direction.", 403);
}

export function lignes(v: unknown): LigneComptoir[] {
  if (!Array.isArray(v)) return [];
  return v.map((l) => ({ id: String(l?.id ?? ""), duree: l?.duree === undefined || l?.duree === "" ? undefined : Number(l.duree) }));
}
