import type { Metadata } from "next";
import { Suspense } from "react";
import { TunnelReservation } from "@/components/TunnelReservation";

export const metadata: Metadata = {
  title: "Prendre rendez-vous",
  description: "Réservez votre prestation chez Anna Zen Attitude, au Point E, Dakar : choisissez, indiquez votre moment, confirmez.",
  alternates: { canonical: "/reservation" },
};

export default function Reservation() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-5xl font-semibold text-profond">Prendre rendez-vous</h1>
      <p className="mt-2 text-doux">Sans créer de compte, en moins de trois minutes.</p>
      <Suspense>
        <TunnelReservation />
      </Suspense>
    </div>
  );
}
