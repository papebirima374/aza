"use client";

import { Agenda } from "@/components/gestion/Agenda";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { MaJournee } from "@/components/gestion/MaJournee";

/** Page d'accueil de la gestion : l'agenda complet, ou « Ma journée » pour une praticienne. */
export function Accueil() {
  const { role } = useCompte();
  return role === "praticienne" || role === "prestataire" ? <MaJournee /> : <Agenda />;
}
