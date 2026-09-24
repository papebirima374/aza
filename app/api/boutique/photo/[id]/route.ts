import { firebaseConfigure } from "@/lib/serveur/firebase";
import { photoProduit } from "@/lib/serveur/boutique";

// GET /api/boutique/photo/{id} — photo d'un produit (gardée longtemps en cache : une photo ne change jamais, on en ajoute une autre)
export async function GET(_: Request, { params }: RouteContext<"/api/boutique/photo/[id]">) {
  if (!firebaseConfigure()) return new Response(null, { status: 404 });
  const photo = await photoProduit((await params).id).catch(() => null);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.type, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
