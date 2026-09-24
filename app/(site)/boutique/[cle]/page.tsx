import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AjoutPanier } from "@/components/boutique/AjoutPanier";
import { Galerie } from "@/components/boutique/Galerie";
import { RAYONS } from "@/lib/boutique";
import { etatBoutique } from "@/lib/serveur/boutique";
import { firebaseConfigure } from "@/lib/serveur/firebase";

export const dynamic = "force-dynamic";

async function produit(cle: string) {
  if (!firebaseConfigure()) return null;
  const e = await etatBoutique().catch(() => null);
  if (!e?.ouverte) return null;
  const p = e.produits.find((x) => x.cle === cle);
  return p ? { p, prix: e.prixParArticle } : null;
}

export async function generateMetadata({ params }: PageProps<"/boutique/[cle]">): Promise<Metadata> {
  const r = await produit((await params).cle);
  if (!r) return {};
  return { title: r.p.titre, description: r.p.description.slice(0, 150) || `${r.p.titre} — boutique Anna Zen Attitude, Point-E, Dakar.` };
}

export default async function PageProduit({ params }: PageProps<"/boutique/[cle]">) {
  const r = await produit((await params).cle);
  if (!r) notFound();
  const { p } = r;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href={`/boutique?rayon=${p.rayon}`} className="text-sm font-semibold text-doux underline inline-block py-2">
        ← {RAYONS.find((x) => x.id === p.rayon)?.nom ?? "Boutique"}
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <Galerie photos={p.photos} titre={p.titre} />
        <div>
          <h1 className="font-serif text-4xl font-semibold text-profond">{p.titre}</h1>
          {p.description && <p className="mt-3 whitespace-pre-line text-doux">{p.description}</p>}
          <AjoutPanier variantes={p.variantes.map((v) => ({ ...v, prix: r.prix[v.article] ?? p.prix }))} />
          <p className="mt-6 rounded-2xl bg-creme p-4 text-sm">
            🏠 <strong>Retrait gratuit</strong> à l&apos;institut, Point-E · 🛵 ou livraison à Dakar
          </p>
        </div>
      </div>
    </div>
  );
}
