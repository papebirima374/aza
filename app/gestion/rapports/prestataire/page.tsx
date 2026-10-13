import { Suspense } from "react";
import { FicheDuMois } from "@/components/gestion/FicheDuMois";

// La fiche du mois d'une prestataire : chiffre, soins, présence, avis, primes versées.
export default function PageFicheDuMois() {
  return (
    <Suspense>
      <FicheDuMois />
    </Suspense>
  );
}
