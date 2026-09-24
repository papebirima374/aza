import { FicheCliente } from "@/components/gestion/FicheCliente";

export default async function PageFiche({ params }: PageProps<"/gestion/clientes/[id]">) {
  const { id } = await params;
  return <FicheCliente id={id} />;
}
