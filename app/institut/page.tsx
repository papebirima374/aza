import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { INSTITUT } from "@/lib/institut";

export const metadata: Metadata = {
  title: "L'institut",
  description:
    "Anna Zen Attitude, institut de beauté, coiffure et bien-être au Point-E, Dakar : notre philosophie, notre équipe et les marques que nous utilisons.",
  alternates: { canonical: "/institut" },
};

// L'histoire, l'équipe (photo et spécialité) et les cabines viendront avec l'immersion
// et le shooting photo : rien n'est inventé ici.
export default function Institut() {
  return (
    <div>
      <section className="bg-bordeaux text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-[1fr_auto]">
          <div>
            <h1 className="font-serif text-5xl font-semibold">L&apos;institut</h1>
            <p className="mt-4 max-w-2xl text-lg text-or-clair">
              Notre espace beauté vous propose une large gamme de soins du visage et du corps pour révéler votre
              éclat naturel. Offrez-vous des soins hydratants, anti-âge, purifiants, des modelages relaxants, des
              épilations professionnelles et des mises en beauté sophistiquées. Plongez dans une atmosphère de
              sérénité dans notre espace bien-être.
            </p>
          </div>
          <Image src="/images/lotus-or.png" alt="" width={244} height={257} className="hidden w-48 md:block" />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-14">
        <section>
          <h2 className="font-serif text-3xl font-semibold text-profond">L&apos;équipe</h2>
          <p className="mt-2 max-w-2xl text-doux">
            Esthéticiennes, coiffeuses, tresseuses et prothésistes ongulaires : la présentation de chacune, avec sa
            photo et sa spécialité, arrive très bientôt.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-3xl font-semibold text-profond">Les marques que nous utilisons</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {INSTITUT.marques.map((m) => (
              <li key={m} className="rounded-full border border-or/50 bg-creme px-4 py-2 font-semibold text-[#8a6534]">
                {m}
              </li>
            ))}
          </ul>
        </section>

        <Link href="/reservation" className="mt-12 inline-block rounded-full bg-aza px-7 py-3.5 font-bold text-white hover:bg-aza-fonce">
          Prendre rendez-vous
        </Link>
      </div>
    </div>
  );
}
