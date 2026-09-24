import { EditeurModele, NouveauModele } from "@/components/gestion/GestionCollection";

export default async function PageModele({ params }: PageProps<"/gestion/collection/[ref]">) {
  const { ref } = await params;
  return ref === "nouveau" ? <NouveauModele /> : <EditeurModele reference={decodeURIComponent(ref)} />;
}
