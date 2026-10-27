import sharp from "sharp";
import { srcExemple } from "@/lib/photos-site";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { imagePhotoSite } from "@/lib/serveur/photos-site";

// GET /api/site/apercu/{clé} — la photo en JPEG 1200 px, pour l'aperçu des liens (WhatsApp,
// Facebook… ne savent pas toujours afficher le WebP). Une photo ne change jamais : cache long.
export async function GET(request: Request, { params }: RouteContext<"/api/site/apercu/[cle]">) {
  const { cle } = await params;
  let source: Buffer | null = null;
  const exemple = srcExemple(cle);
  if (exemple) {
    const r = await fetch(new URL(exemple, request.url)).catch(() => null);
    if (r?.ok) source = Buffer.from(await r.arrayBuffer());
  } else if (firebaseConfigure() && /^[A-Za-z0-9]{1,40}$/.test(cle)) {
    source = (await imagePhotoSite(cle).catch(() => null))?.data ?? null;
  }
  if (!source) return new Response(null, { status: 404 });
  const jpeg = await sharp(source).rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
}
