import { FeuilleCaisse } from "@/components/gestion/FeuilleCaisse";

// Feuille de caisse d'un jour : /gestion/caisse/feuille?date=AAAA-MM-JJ (aujourd'hui par défaut),
// &caisse=ID pour une caisse précise, &caisse=tout pour toute la journée.
export default async function PageFeuilleCaisse({ searchParams }: PageProps<"/gestion/caisse/feuille">) {
  const { date, caisse } = await searchParams;
  return (
    <FeuilleCaisse
      date={typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined}
      caisseInitiale={typeof caisse === "string" && /^[\w~-]{1,80}$/.test(caisse) ? caisse : undefined}
    />
  );
}
