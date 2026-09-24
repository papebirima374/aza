import type { Metadata } from "next";
import { Suspense } from "react";
import { TunnelReservation } from "@/components/TunnelReservation";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { etatReservationEnLigne } from "@/lib/serveur/reglages";

export const metadata: Metadata = {
  title: "Prendre rendez-vous",
  description: "Réservez votre prestation chez Anna Zen Attitude, au Point-E, Dakar : choisissez, indiquez votre moment, confirmez.",
  alternates: { canonical: "/reservation" },
};

// L'interrupteur « Réservation en ligne » et les durées (écran Réglages) sont relus à chaque
// visite : un changement de la direction s'applique tout de suite.
export const dynamic = "force-dynamic";

async function etat() {
  if (!firebaseConfigure()) return { actif: false, ids: [] as string[] };
  try {
    return await etatReservationEnLigne();
  } catch {
    return { actif: false, ids: [] as string[] };
  }
}

export default async function Reservation() {
  const { actif, ids } = await etat();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-5xl font-semibold text-profond">Prendre rendez-vous</h1>
      <p className="mt-2 text-doux">Sans créer de compte, en moins de trois minutes.</p>
      <Suspense>
        <TunnelReservation enLigne={actif} idsEnLigne={ids} />
      </Suspense>
    </div>
  );
}
