"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { LIBELLE_MODE } from "@/lib/caisse/modes";
import { dateTexte, heureTexte, lienRecuWhatsApp, type Ticket } from "@/lib/caisse/recu";
import { formatPrix } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";

// Reçu d'un ticket, aux couleurs de l'institut : à imprimer ou à envoyer par WhatsApp.
export function Recu({ id }: { id: string }) {
  const compte = useCompte();
  const [t, setT] = useState<Ticket | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;
    (async () => {
      const r = await fetch(`/api/gestion/caisse?ticket=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` },
      });
      const j = await r.json();
      if (!actif) return;
      if (r.ok) setT(j);
      else setErreur(j.erreur ?? "Ticket introuvable.");
    })().catch(() => actif && setErreur("Connexion impossible."));
    return () => {
      actif = false;
    };
  }, [id, compte.user]);

  if (!t) return <p className="p-8 text-center text-doux">{erreur || "Chargement du reçu…"}</p>;
  const whatsapp = lienRecuWhatsApp(t);

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Link href="/gestion/caisse" className="flex min-h-12 items-center rounded-full border border-bordure px-5 font-semibold text-profond">
          ← Caisse
        </Link>
        <button onClick={() => window.print()} className="min-h-12 rounded-full bg-profond px-5 font-bold text-white">
          Imprimer
        </button>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener" className="flex min-h-12 items-center rounded-full bg-[#128C4A] px-5 font-bold text-white">
            Envoyer par WhatsApp
          </a>
        )}
      </div>

      <article className="rounded-2xl border border-bordure bg-white p-6 print:border-0 print:p-0">
        <div className="text-center">
          <Image src="/images/logo-rose.png" alt={INSTITUT.nom} width={790} height={257} className="mx-auto h-14 w-auto" />
          <p className="mt-2 text-xs text-doux">
            {INSTITUT.adresse.rue} · {INSTITUT.adresse.ville}
            <br />
            {INSTITUT.telephones.map((x) => x.affiche).join(" · ")}
          </p>
        </div>
        <h1 className="mt-5 text-center font-serif text-2xl font-semibold text-profond">
          {t.type === "avoir" ? "Avoir" : "Reçu"} {t.reference}
        </h1>
        <p className="text-center text-sm text-doux">
          {dateTexte(t.date)} à {heureTexte(t.heure)} · {t.par.nom}
        </p>
        {t.cliente && <p className="mt-2 text-center text-sm">Cliente : {t.cliente.nom}</p>}
        {t.annule && (
          <p className="mt-2 text-center text-sm font-bold text-aza-fonce">
            ANNULÉ par {t.annule.reference} — {t.annule.motif}
          </p>
        )}
        {t.origine && (
          <p className="mt-2 text-center text-sm">
            Annule le ticket {t.origine.reference} — {t.motif}
          </p>
        )}

        <table className="mt-5 w-full text-sm">
          <tbody>
            {t.lignes.map((l, i) => (
              <tr key={i} className="border-b border-bordure">
                <td className="py-1.5">
                  {l.quantite > 1 ? `${l.quantite} × ` : ""}
                  {l.nom}
                </td>
                <td className="prix py-1.5 text-right">{formatPrix(l.montant)}</td>
              </tr>
            ))}
            {t.remise && (
              <tr>
                <td className="py-1.5">Remise ({t.remise.motif})</td>
                <td className="prix py-1.5 text-right">−{formatPrix(t.remise.montant)}</td>
              </tr>
            )}
            <tr className="text-lg font-bold text-profond">
              <td className="pt-3">Total</td>
              <td className="prix pt-3 text-right">{formatPrix(t.total)}</td>
            </tr>
            {t.paiements.map((p) => (
              <tr key={p.mode}>
                <td className="py-0.5">{LIBELLE_MODE[p.mode]}</td>
                <td className="prix py-0.5 text-right">{formatPrix(p.montant)}</td>
              </tr>
            ))}
            {t.rendu > 0 && (
              <tr>
                <td className="py-0.5">Monnaie rendue</td>
                <td className="prix py-0.5 text-right">{formatPrix(t.rendu)}</td>
              </tr>
            )}
            {t.credit > 0 && (
              <tr className="font-semibold">
                <td className="py-0.5">Reste à régler</td>
                <td className="prix py-0.5 text-right">{formatPrix(t.credit)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-6 text-center font-serif text-lg text-profond">Merci de votre visite !</p>
      </article>
    </div>
  );
}
