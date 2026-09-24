import type { Metadata } from "next";
import { Entrer } from "@/components/gestion/Entrer";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default function PageEntrer() {
  return <Entrer />;
}
