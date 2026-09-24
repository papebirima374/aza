import type { Metadata } from "next";
import { Panier } from "@/components/boutique/Panier";
import { etatBoutique } from "@/lib/serveur/boutique";
import { firebaseConfigure } from "@/lib/serveur/firebase";

export const metadata: Metadata = { title: "Mon panier", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PagePanier() {
  const e = firebaseConfigure() ? await etatBoutique().catch(() => null) : null;
  const articles = Object.fromEntries(
    (e?.produits ?? []).flatMap((p) =>
      p.variantes.map((v) => [
        v.article,
        { titre: p.titre, variante: v.variante, prix: e!.prixParArticle[v.article] ?? p.prix, disponible: v.disponible, photo: p.photos[0] ?? null, cle: p.cle },
      ]),
    ),
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-5xl font-semibold text-profond">Mon panier</h1>
      <Panier ouverte={Boolean(e?.ouverte)} articles={articles} zones={e?.zones ?? []} />
    </div>
  );
}
