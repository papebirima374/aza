import { Suspense } from "react";
import { Caisse } from "@/components/gestion/Caisse";

export default function PageCaisse() {
  return (
    <Suspense>
      <Caisse />
    </Suspense>
  );
}
