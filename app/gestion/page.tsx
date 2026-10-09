import { Suspense } from "react";
import { Accueil } from "@/components/gestion/Accueil";

export default function PageGestion() {
  return (
    <Suspense>
      <Accueil />
    </Suspense>
  );
}
