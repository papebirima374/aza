import Link from "next/link";
import { IconeCalendrier, IconeTelephone, IconeWhatsApp } from "@/components/Icones";
import { lienWhatsApp, TELEPHONE_PRINCIPAL } from "@/lib/institut";

// Barre fixe en bas de l'écran sur téléphone : les trois seules actions qui comptent.
export function BarreMobile() {
  return (
    <nav
      aria-label="Actions rapides"
      className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-3 border-t border-bordure bg-white md:hidden"
    >
      <Link href="/reservation" className="flex flex-col items-center justify-center gap-0.5 bg-aza text-white">
        <IconeCalendrier />
        <span className="text-xs font-bold">Réserver</span>
      </Link>
      <a
        href={`tel:${TELEPHONE_PRINCIPAL.e164}`}
        className="flex flex-col items-center justify-center gap-0.5 text-profond"
      >
        <IconeTelephone />
        <span className="text-xs font-bold">Appeler</span>
      </a>
      <a
        href={lienWhatsApp("Bonjour Anna Zen Attitude, je souhaite un renseignement.")}
        target="_blank"
        rel="noopener"
        className="flex flex-col items-center justify-center gap-0.5 text-[#128C4A]"
      >
        <IconeWhatsApp />
        <span className="text-xs font-bold">WhatsApp</span>
      </a>
    </nav>
  );
}
