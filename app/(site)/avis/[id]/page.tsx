import type { Metadata } from "next";
import { FormAvis } from "@/components/avis/FormAvis";
import { avisPublics, infoPourAvis } from "@/lib/serveur/avis";
import { firebaseConfigure } from "@/lib/serveur/firebase";
import { ErreurReservation } from "@/lib/serveur/reservations";

// Page de l'avis d'une cliente : le lien est sur son reçu (WhatsApp ou QR code du ticket).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Votre avis", robots: { index: false, follow: false } };

export default async function PageAvis({ params }: PageProps<"/avis/[id]">) {
  const { id } = await params;
  let info: Awaited<ReturnType<typeof infoPourAvis>> | null = null;
  let message = "";
  if (!firebaseConfigure()) message = "Service momentanément indisponible.";
  else {
    try {
      info = await infoPourAvis(id);
    } catch (e) {
      message = e instanceof ErreurReservation ? e.message : "Service momentanément indisponible.";
    }
  }
  const lienGoogle = info ? (await avisPublics().catch(() => null))?.lienGoogle ?? "" : "";
  const date = info ? new Date(`${info.date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }) : "";

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      {info ? (
        <>
          <h1 className="font-serif text-4xl font-semibold text-profond sm:text-5xl">{info.prenom ? `${info.prenom}, votre avis compte` : "Votre avis compte"}</h1>
          <p className="mt-3 text-doux">
            Votre visite du {date}
            {info.prestations.length > 0 && <> : {info.prestations.slice(0, 3).join(", ")}</>}. Dites-nous en deux touches comment ça s&apos;est passé.
          </p>
          <FormAvis id={id} prenom={info.prenom} dejaDonne={info.dejaDonne} lienGoogle={lienGoogle} />
        </>
      ) : (
        <>
          <h1 className="font-serif text-4xl font-semibold text-profond">Votre avis</h1>
          <p className="mt-4 rounded-2xl bg-creme p-5">{message}</p>
        </>
      )}
    </div>
  );
}
