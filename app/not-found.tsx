import Link from "next/link";

export default function PageIntrouvable() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="font-serif text-5xl font-semibold text-profond">Page introuvable</h1>
      <p className="mt-4 text-doux">Cette page n&apos;existe pas ou a été déplacée.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/" className="rounded-full border border-bordure px-6 py-3 font-semibold text-profond">
          Accueil
        </Link>
        <Link href="/prestations" className="rounded-full bg-aza px-6 py-3 font-bold text-white">
          Nos prestations
        </Link>
      </div>
    </div>
  );
}
