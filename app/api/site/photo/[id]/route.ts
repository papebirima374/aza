import { firebaseConfigure } from "@/lib/serveur/firebase";
import { imagePhotoSite } from "@/lib/serveur/photos-site";

// GET /api/site/photo/{id} — une photo du site (une photo ne change jamais : on en ajoute une autre)
export async function GET(_: Request, { params }: RouteContext<"/api/site/photo/[id]">) {
  if (!firebaseConfigure()) return new Response(null, { status: 404 });
  const photo = await imagePhotoSite((await params).id).catch(() => null);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(photo.data), { headers: { "Content-Type": photo.type, "Cache-Control": "public, max-age=31536000, immutable" } });
}
