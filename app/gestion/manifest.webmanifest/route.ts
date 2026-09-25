import { MANIFESTE_GESTION, reponseManifeste } from "@/lib/pwa";

// L'application de l'équipe : elle s'ouvre directement sur l'espace de gestion.
export const dynamic = "force-static";
export function GET() {
  return reponseManifeste(MANIFESTE_GESTION);
}
