"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { firebaseClient } from "@/lib/client/firebase";

// Page ouverte depuis le lien WhatsApp de la direction : connecte le téléphone, puis
// ouvre l'espace de gestion. Le lien est après « # » : il ne part jamais dans les journaux.
export function Entrer() {
  const router = useRouter();
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const jeton = window.location.hash.slice(1);
    (async () => {
      const r = await fetch("/api/entrer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeton }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur ?? "Lien invalide.");
      await signInWithCustomToken(firebaseClient().auth, j.jeton);
      history.replaceState(null, "", "/entrer");
      router.replace("/gestion");
    })().catch((e: Error) => setErreur(e.message || "Connexion impossible."));
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bordeaux px-4 text-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <Image src="/images/logo-rose.png" alt="Anna Zen Attitude" width={790} height={257} className="mx-auto h-12 w-auto" />
        {erreur ? (
          <>
            <p className="mt-6 text-5xl" aria-hidden>
              ⚠️
            </p>
            <p className="mt-3 font-semibold text-profond">{erreur}</p>
          </>
        ) : (
          <>
            <p className="mt-6 text-5xl" aria-hidden>
              ⏳
            </p>
            <p className="mt-3 font-semibold text-profond">Connexion…</p>
          </>
        )}
      </div>
    </div>
  );
}
