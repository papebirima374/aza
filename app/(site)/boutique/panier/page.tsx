import type { Metadata } from "next";
import { Panier } from "@/components/boutique/Panier";
import { articleCouture, libelleVariante } from "@/lib/couture";
import { etatBoutique, modelesCouture } from "@/lib/serveur/boutique";
import { firebaseConfigure } from "@/lib/serveur/firebase";

export const metadata: Metadata = { title: "Mon panier", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PagePanier() {
  const [e, couture] = await Promise.all([firebaseConfigure() ? etatBoutique().catch(() => null) : null, modelesCouture()]);
  const articles = Object.fromEntries([
    ...(e?.produits ?? []).flatMap((p) =>
      p.variantes.map((v) => [
        v.article,
        {
          titre: p.titre,
          variante: v.variante,
          prix: e!.prixParArticle[v.article] ?? p.prix,
          disponible: v.disponible,
          image: p.photos[0] ? `/api/boutique/photo/${p.photos[0]}` : null,
          lien: `/boutique/${p.cle}`,
        },
      ]),
    ),
    // Anna Zen Couture : une ligne par modèle, taille et couleur, faite sur commande.
    ...couture.flatMap((m) =>
      m.tailles.flatMap((t) =>
        (m.couleurs.length ? m.couleurs : [""]).map((c) => [
          articleCouture(m.ref, t, c),
          { titre: m.nom, variante: libelleVariante(t, c), prix: m.prix, disponible: 20, image: m.photos[0] ?? null, lien: `/boutique/couture/${m.ref}`, surCommande: true },
        ]),
      ),
    ),
  ]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-5xl font-semibold text-profond">Mon panier</h1>
      <Panier ouverte={Boolean(e?.ouverte)} articles={articles} zones={e?.zones ?? []} />
    </div>
  );
}
