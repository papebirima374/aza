import { lireModifs } from "@/lib/serveur/catalogue";

// GET /api/catalogue — les changements de la direction (prix, lignes masquées ou ajoutées),
// que chaque écran applique à la plaquette. Public : ce sont les prix affichés sur le site.
export async function GET() {
  const modifs = await lireModifs().catch(() => ({}));
  return Response.json({ modifs }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60" } });
}
