import type { Metadata } from "next";
import { INSTITUT } from "@/lib/institut";

export const metadata: Metadata = {
  title: "Mentions légales",
  robots: { index: false },
};

// Raison sociale, NINEA, registre de commerce et siège : à fournir par l'institut
// avant la mise en ligne (cahier des charges §21.1). CGV et conditions d'annulation
// viendront avec la boutique et l'acompte.
export default function MentionsLegales() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-5xl font-semibold text-profond">Mentions légales</h1>

      <section className="mt-8 space-y-2">
        <h2 className="font-serif text-2xl font-semibold text-profond">Éditeur du site</h2>
        <p>{INSTITUT.nom}</p>
        <p>
          {INSTITUT.adresse.rue}, {INSTITUT.adresse.repere}, {INSTITUT.adresse.ville}, Sénégal
        </p>
        <p>Raison sociale, NINEA et registre du commerce : à compléter.</p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="font-serif text-2xl font-semibold text-profond">Réalisation</h2>
        <p>Kër Salaatu Tech — Birima Gueye, Cité Damel, Dakar.</p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="font-serif text-2xl font-semibold text-profond">Hébergement</h2>
        <p>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.</p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="font-serif text-2xl font-semibold text-profond">Données personnelles</h2>
        <p>
          Les informations que vous transmettez pour prendre rendez-vous (nom, téléphone) servent uniquement à
          organiser votre venue. Elles sont traitées conformément à la loi sénégalaise n° 2008-12 du 25 janvier 2008
          sur la protection des données à caractère personnel. Vous pouvez demander leur consultation ou leur
          suppression en contactant l&apos;institut.
        </p>
      </section>
    </div>
  );
}
