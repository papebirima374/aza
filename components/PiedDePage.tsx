import Image from "next/image";
import Link from "next/link";
import { MENU } from "@/lib/menu";
import { IconeInstagram } from "@/components/Icones";
import { INSTITUT, LIEN_ITINERAIRE } from "@/lib/institut";

export function PiedDePage() {
  return (
    <footer className="bg-bordeaux text-or-clair">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <Image src="/images/logo-or.png" alt="Anna Zen Attitude" width={790} height={257} className="h-14 w-auto" />
        </div>

        <div>
          <h2 className="font-serif text-xl font-semibold text-white">Adresse</h2>
          <p className="mt-3 text-sm leading-relaxed">
            {INSTITUT.adresse.rue}
            <br />
            {INSTITUT.adresse.repere}
            <br />
            {INSTITUT.adresse.ville}
          </p>
          <a href={LIEN_ITINERAIRE} target="_blank" rel="noopener" className="mt-2 inline-block text-sm font-semibold text-white underline underline-offset-4">
            Itinéraire
          </a>
        </div>

        <div>
          <h2 className="font-serif text-xl font-semibold text-white">Horaires</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {INSTITUT.horaires.map((h) => (
              <li key={h.jours}>
                {h.jours} {h.heures}
              </li>
            ))}
          </ul>
          <ul className="mt-4 space-y-1 text-sm">
            {INSTITUT.telephones.map((t) => (
              <li key={t.e164}>
                <a href={`tel:${t.e164}`} className="hover:text-white">
                  <span className="prix font-semibold">{t.affiche}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-serif text-xl font-semibold text-white">Le site</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {MENU.map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="hover:text-white">
                  {m.libelle}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/mentions-legales" className="hover:text-white">
                Mentions légales
              </Link>
            </li>
          </ul>
          <a href={INSTITUT.instagram} target="_blank" rel="noopener" className="mt-4 inline-flex items-center gap-2 text-sm hover:text-white">
            <IconeInstagram /> {INSTITUT.instagramPseudo}
          </a>
        </div>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-or-clair/70">
        © {new Date().getFullYear()} {INSTITUT.nom} — Point E, Dakar
      </p>
    </footer>
  );
}
