import { ACCES, peut, type Acces } from "@/lib/acces";
import type { Membre } from "@/lib/serveur/agenda";
import { ErreurReservation } from "@/lib/serveur/reservations";

/** Refuse l'action si la personne n'a pas cet accès (rôle, ou exception posée par la direction). */
export function exigerAcces(membre: Membre, id: Acces, message?: string) {
  if (!peut(membre, id)) {
    const a = ACCES.find((x) => x.id === id);
    throw new ErreurReservation(message ?? `Accès « ${a?.libelle ?? id} » non autorisé pour ce compte. Demandez-le à la direction.`, 403);
  }
}
