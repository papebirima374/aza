import { BarreMobile } from "@/components/BarreMobile";
import { DonneesStructurees } from "@/components/DonneesStructurees";
import { EnTete } from "@/components/EnTete";
import { PiedDePage } from "@/components/PiedDePage";

// Présentation du site public : en-tête, pied de page et barre mobile Réserver · Appeler · WhatsApp.
export default function LayoutSite({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col pb-16 md:pb-0">
      <DonneesStructurees />
      <EnTete />
      <main className="flex-1">{children}</main>
      <PiedDePage />
      <BarreMobile />
    </div>
  );
}
