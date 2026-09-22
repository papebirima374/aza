import type { Metadata } from "next";
import Link from "next/link";
import { formatPrix, PRESTATIONS } from "@/lib/catalogue";
import { lienWhatsApp } from "@/lib/institut";

export const metadata: Metadata = {
  title: "Forfaits & cérémonies",
  description:
    "Forfaits mariage et cérémonie, cures de soins et traitements capillaires chez Anna Zen Attitude, Point E, Dakar. Devis personnalisé pour les groupes.",
  alternates: { canonical: "/forfaits" },
};

export default function Forfaits() {
  const forfaits = PRESTATIONS.filter((p) => p.note === "Forfait");

  return (
    <div>
      <section className="bg-bordeaux text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h1 className="font-serif text-5xl font-semibold">Forfaits & cérémonies</h1>
          <p className="mt-4 max-w-2xl text-or-clair">
            Mariage, baptême, Tabaski, Korité ou soirée : coiffure, maquillage, ongles et soins réunis pour être
            prête le jour J. Pour un groupe ou une prestation à domicile, nous établissons un devis.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {forfaits.map((p) => (
            <div key={p.id} className="flex flex-col rounded-2xl border border-or/40 bg-creme p-6">
              <p className="text-xs font-bold tracking-widest text-[#8a6534] uppercase">{p.famille}</p>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-profond">{p.nom}</h2>
              <p className="prix mt-3 text-2xl font-bold text-encre">{formatPrix(p.prix)}</p>
              <Link
                href={`/reservation?p=${p.id}`}
                className="mt-6 inline-block self-start rounded-full bg-aza px-5 py-2.5 text-sm font-bold text-white hover:bg-aza-fonce"
              >
                Réserver
              </Link>
            </div>
          ))}
        </div>

        <section className="mt-12 rounded-2xl border border-bordure p-8">
          <h2 className="font-serif text-3xl font-semibold text-profond">Un événement, un groupe ?</h2>
          <p className="mt-2 max-w-2xl text-doux">
            Dites-nous la date, le lieu, le nombre de personnes et les prestations souhaitées : nous vous répondons
            avec un devis.
          </p>
          <a
            href={lienWhatsApp(
              "Bonjour Anna Zen Attitude, je souhaite un devis pour un événement.\nDate :\nLieu (institut ou domicile) :\nNombre de personnes :\nPrestations souhaitées :",
            )}
            target="_blank"
            rel="noopener"
            className="mt-6 inline-block rounded-full bg-aza px-6 py-3 font-bold text-white hover:bg-aza-fonce"
          >
            Demander un devis
          </a>
        </section>
      </div>
    </div>
  );
}
