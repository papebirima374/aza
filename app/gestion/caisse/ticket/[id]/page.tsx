import { Recu } from "@/components/gestion/Recu";

export default async function PageRecu({ params }: PageProps<"/gestion/caisse/ticket/[id]">) {
  const { id } = await params;
  return <Recu id={id} />;
}
