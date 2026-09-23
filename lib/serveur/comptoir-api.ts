import { ROLES_AGENDA } from "@/lib/agenda/statuts";
import { membreConnecte, type Membre } from "@/lib/serveur/agenda";
import { ErreurReservation, type LigneComptoir } from "@/lib/serveur/reservations";

/** Seules la direction, le manager et l'accueil prennent des rendez-vous au comptoir. */
export async function membreAccueil(request: Request): Promise<Membre> {
  const m = await membreConnecte(request);
  if (!ROLES_AGENDA.includes(m.role)) throw new ErreurReservation("Réservé à l'accueil et à la direction.", 403);
  return m;
}

export function lignes(v: unknown): LigneComptoir[] {
  if (!Array.isArray(v)) return [];
  return v.map((l) => ({ id: String(l?.id ?? ""), duree: l?.duree === undefined || l?.duree === "" ? undefined : Number(l.duree) }));
}
