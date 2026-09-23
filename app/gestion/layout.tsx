import type { Metadata } from "next";
import { EspaceGestion } from "@/components/gestion/EspaceGestion";

export const metadata: Metadata = {
  title: "Gestion",
  robots: { index: false, follow: false },
};

// Espace de l'équipe : connexion obligatoire, droits selon le rôle (firestore.rules).
export default function LayoutGestion({ children }: LayoutProps<"/gestion">) {
  return (
    <div className="min-h-full flex-1 bg-white">
      <EspaceGestion>{children}</EspaceGestion>
    </div>
  );
}
