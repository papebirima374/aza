import { ErreurReservation } from "@/lib/serveur/reservations";

/** Réponse d'erreur lisible par la cliente ; le détail technique reste dans les journaux. */
export function reponseErreur(e: unknown) {
  if (e instanceof ErreurReservation) return Response.json({ erreur: e.message }, { status: e.statut });
  console.error(e);
  return Response.json({ erreur: "Une erreur est survenue. Réessayez ou écrivez-nous sur WhatsApp." }, { status: 500 });
}
