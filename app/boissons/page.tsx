import type { Metadata } from "next";
import { Suspense } from "react";
import { MenuBoissons } from "@/components/boissons/MenuBoissons";

export const metadata: Metadata = { title: "Menu des boissons", robots: { index: false, follow: false } };

// Le menu des boissons offertes : on y arrive en scannant le code QR de l'institut.
export default function PageBoissons() {
  return (
    <Suspense>
      <MenuBoissons />
    </Suspense>
  );
}
