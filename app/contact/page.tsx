import type { Metadata } from "next";
import { IconeHorloge, IconeInstagram, IconeLieu, IconeTelephone, IconeWhatsApp } from "@/components/Icones";
import { INSTITUT, LIEN_ITINERAIRE, lienWhatsApp } from "@/lib/institut";

export const metadata: Metadata = {
  title: "Contact & accès",
  description: `Anna Zen Attitude — ${INSTITUT.adresse.rue}, ${INSTITUT.adresse.repere}, Dakar. Horaires, téléphone, WhatsApp et itinéraire.`,
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  const carte = `https://maps.google.com/maps?q=${encodeURIComponent("Anna Zen Attitude, Point E, Dakar")}&z=16&output=embed`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-serif text-5xl font-semibold text-profond">Contact & accès</h1>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <div className="space-y-8">
          <div className="flex gap-4">
            <IconeLieu className="h-6 w-6 shrink-0 text-profond" />
            <div>
              <h2 className="font-semibold">Adresse</h2>
              <p className="text-doux">
                {INSTITUT.adresse.rue}
                <br />
                {INSTITUT.adresse.repere}, {INSTITUT.adresse.ville}
              </p>
              <a href={LIEN_ITINERAIRE} target="_blank" rel="noopener" className="mt-2 inline-block rounded-full bg-profond px-5 py-2.5 text-sm font-bold text-white">
                Itinéraire
              </a>
            </div>
          </div>

          <div className="flex gap-4">
            <IconeHorloge className="h-6 w-6 shrink-0 text-profond" />
            <div>
              <h2 className="font-semibold">Horaires</h2>
              <ul className="text-doux">
                {INSTITUT.horaires.map((h) => (
                  <li key={h.jours}>
                    {h.jours} {h.heures}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex gap-4">
            <IconeTelephone className="h-6 w-6 shrink-0 text-profond" />
            <div>
              <h2 className="font-semibold">Téléphone</h2>
              <ul>
                {INSTITUT.telephones.map((t) => (
                  <li key={t.e164}>
                    <a href={`tel:${t.e164}`} className="text-doux hover:text-profond">
                      <span className="prix font-semibold text-encre">{t.affiche}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={lienWhatsApp("Bonjour Anna Zen Attitude, je souhaite un renseignement.")}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full bg-[#128C4A] px-5 py-3 font-bold text-white"
            >
              <IconeWhatsApp /> Écrire sur WhatsApp
            </a>
            <a href={INSTITUT.instagram} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full border border-bordure px-5 py-3 font-bold text-profond">
              <IconeInstagram /> {INSTITUT.instagramPseudo}
            </a>
          </div>
        </div>

        <iframe
          title="Carte : Anna Zen Attitude au Point E"
          src={carte}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-80 w-full rounded-2xl border border-bordure md:h-full md:min-h-96"
        />
      </div>
    </div>
  );
}
