import { Suspense } from "react";
import { Pointer } from "@/components/gestion/Pointer";

// Pointer : chacun scanne, avec son compte, le code de la borne (entrée, puis sortie).
export default function PagePointer() {
  return (
    <Suspense>
      <Pointer />
    </Suspense>
  );
}
