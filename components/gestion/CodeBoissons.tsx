"use client";

import { useEffect, useState } from "react";
import { Qr } from "@/components/gestion/BornePointage";
import { useCompte } from "@/components/gestion/EspaceGestion";

// Le code QR du menu des boissons, à imprimer et poser dans l'institut. S'il a circulé
// (photo partagée…), « Changer le code » rend l'ancien QR inutilisable.

export function CodeBoissons() {
  const compte = useCompte();
  const [code, setCode] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");

  async function appel(changer: boolean) {
    setErreur("");
    try {
      const r = await fetch("/api/gestion/boissons" + (changer ? "" : "?qr=1"), {
        method: changer ? "POST" : "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: changer ? JSON.stringify({ action: "nouveau-code" }) : undefined,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur ?? "Erreur");
      setCode(j.code);
    } catch (e) {
      setErreur((e as Error).message);
    }
  }
  useEffect(() => {
    const t = setTimeout(() => appel(false), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lien = code ? `${window.location.origin}/boissons?c=${code}` : "";
  return (
    <section id="boissons" className="scroll-mt-20 rounded-2xl border border-bordure p-5">
      <style>{`@media print { body * { visibility: hidden } #affiche-boissons, #affiche-boissons * { visibility: visible } #affiche-boissons { position: fixed; inset: 0; padding: 2cm } }`}</style>
      <h2 className="font-serif text-2xl font-semibold text-profond">Menu des boissons (code QR)</h2>
      <p className="mt-1 text-sm text-doux">
        Imprimez ce code et posez-le dans l&apos;institut. La cliente le scanne, choisit sa boisson offerte : la caisse, l&apos;accueil et sa prestataire sont prévenues jusqu&apos;à ce que
        quelqu&apos;un appuie sur « Servie ».
      </p>
      {erreur && <p className="mt-3 rounded-xl bg-aza/10 p-3 text-sm font-semibold text-profond">{erreur}</p>}
      {code && (
        <>
          <div id="affiche-boissons" className="mx-auto mt-4 max-w-xs text-center">
            <p className="font-serif text-2xl font-semibold text-profond">☕ Une boisson offerte</p>
            <p className="text-sm text-doux">Scannez avec l&apos;appareil photo de votre téléphone</p>
            <div className="mt-2">
              <Qr texte={lien} libelle="QR code du menu des boissons" />
            </div>
            <p className="font-serif text-lg text-profond">Anna Zen Attitude</p>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button onClick={() => window.print()} className="min-h-11 rounded-full bg-aza px-5 font-bold text-white">
              🖨️ Imprimer le code QR
            </button>
            <a href={lien} target="_blank" rel="noopener" className="flex min-h-11 items-center rounded-full border border-bordure px-5 font-semibold text-profond">
              Voir le menu
            </a>
            <button
              onClick={() => window.confirm("Changer le code ? L'ancien QR imprimé ne marchera plus : il faudra imprimer le nouveau.") && appel(true)}
              className="min-h-11 rounded-full border border-bordure px-5 text-sm font-semibold text-doux"
            >
              Changer le code
            </button>
          </div>
        </>
      )}
    </section>
  );
}
