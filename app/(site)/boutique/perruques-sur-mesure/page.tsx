import type { Metadata } from "next";
import Link from "next/link";
import { FormDevis } from "@/components/boutique/FormDevis";

export const metadata: Metadata = {
  title: "Perruques sur mesure",
  description: "Perruque, closure ou frontale confectionnée sur mesure à l'institut Anna Zen Attitude (Point-E, Dakar) : demandez votre devis gratuit.",
  alternates: { canonical: "/boutique/perruques-sur-mesure" },
};

export default function PagePerruques() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/boutique" className="text-sm font-semibold text-doux underline">
        ← La boutique
      </Link>
      <h1 className="mt-3 font-serif text-5xl font-semibold text-profond">Perruques sur mesure</h1>
      <p className="mt-3 text-doux">
        Perruque complète, closure ou frontale, confectionnée pour vous à l&apos;institut. Décrivez ce que vous aimez : nous vous répondons sur
        WhatsApp avec le prix et le délai, puis nous prenons vos mesures à l&apos;institut.
      </p>
      <ol className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
        {["Vous décrivez votre perruque", "Nous vous envoyons le prix et le délai", "Nous la confectionnons, vous la récupérez"].map((e, i) => (
          <li key={e} className="flex items-center gap-2 rounded-2xl bg-creme p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-profond font-bold text-white">{i + 1}</span>
            {e}
          </li>
        ))}
      </ol>
      <FormDevis />
    </div>
  );
}
