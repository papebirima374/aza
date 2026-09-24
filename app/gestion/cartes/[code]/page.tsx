import { FicheCarte } from "@/components/gestion/CartesCadeaux";

export default async function PageCarte({ params }: PageProps<"/gestion/cartes/[code]">) {
  const { code } = await params;
  return <FicheCarte code={code} />;
}
