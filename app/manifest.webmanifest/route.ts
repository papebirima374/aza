import { MANIFESTE_SITE, reponseManifeste } from "@/lib/pwa";

// L'application des clientes (le site). L'espace de gestion a la sienne : /gestion/manifest.webmanifest.
export const dynamic = "force-static";
export function GET() {
  return reponseManifeste(MANIFESTE_SITE);
}
