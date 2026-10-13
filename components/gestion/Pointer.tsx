"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { codeDuTexte, dureeTexte, heurePointage } from "@/lib/pointage";

// « Pointer » : chaque personne, connectée à SON compte, scanne le QR code affiché sur la borne
// de l'institut. Premier pointage du jour : entrée ; puis sortie…
// Le code change toutes les 30 secondes : une photo envoyée par quelqu'un ne marche plus.

type Mon = { date: string; pointages: { type: "entree" | "sortie"; heure: number }[]; arrivee: number | null; depart: number | null; present: boolean; minutes: number };
type Resultat = { type: "entree" | "sortie"; heure: number; deja: boolean };
type Detecteur = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export function Pointer() {
  const compte = useCompte();
  const router = useRouter();
  const parametres = useSearchParams();
  const [mon, setMon] = useState<Mon | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [scan, setScan] = useState(false);
  const dejaAuto = useRef(false);

  const lire = useCallback(async () => {
    const r = await fetch("/api/gestion/pointage?moi=1", { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
    if (r.ok) setMon(await r.json());
  }, [compte.user]);

  const envoyer = useCallback(
    async (code: string) => {
      setEnvoi(true);
      setErreur("");
      setResultat(null);
      try {
        const r = await fetch("/api/gestion/pointage", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
          body: JSON.stringify({ action: "pointer", code }),
        });
        const j = await r.json();
        if (!r.ok) setErreur(j.erreur ?? "Pointage impossible.");
        else {
          setResultat(j);
          navigator.vibrate?.(150);
        }
        await lire();
      } catch {
        setErreur("Pas de connexion internet : réessayez.");
      } finally {
        setEnvoi(false);
      }
    },
    [compte.user, lire],
  );

  useEffect(() => {
    const t = setTimeout(() => lire().catch(() => {}), 0);
    return () => clearTimeout(t);
  }, [lire]);

  // Ouvert depuis l'appareil photo du téléphone (QR code → …/gestion/pointer?c=123456).
  useEffect(() => {
    const c = parametres.get("c");
    if (!c || dejaAuto.current) return;
    dejaAuto.current = true;
    const code = codeDuTexte(`?c=${c}`);
    router.replace("/gestion/pointer");
    if (code) setTimeout(() => envoyer(code), 0);
  }, [parametres, router, envoyer]);

  const prochain = mon?.present ? "sortie" : "entree";
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="font-serif text-3xl font-semibold text-profond">Pointer</h1>
      <p className="mt-1 text-doux">Scannez le code affiché sur la borne de l&apos;institut.</p>

      {resultat && (
        <div className={`mt-4 rounded-2xl p-5 text-center text-white ${resultat.type === "entree" ? "bg-[#0d6b37]" : "bg-profond"}`} role="status">
          <p className="text-5xl" aria-hidden>
            {resultat.type === "entree" ? "👋" : "🏠"}
          </p>
          <p className="mt-2 text-2xl font-bold">
            {resultat.type === "entree" ? "Entrée" : "Sortie"} à {heurePointage(resultat.heure)}
          </p>
          <p className="mt-1 text-sm opacity-90">{resultat.deja ? "Déjà enregistrée il y a un instant." : "Enregistrée. La gérante est prévenue."}</p>
        </div>
      )}
      {erreur && <p className="mt-4 rounded-xl bg-[#fde8ec] p-3 font-semibold text-[#a3123a]">{erreur}</p>}

      {mon && (
        <div className="mt-4 rounded-2xl border border-bordure bg-white p-4">
          {mon.arrivee === null ? (
            <p className="font-semibold">Pas encore pointé aujourd&apos;hui.</p>
          ) : (
            <>
              <p className="font-semibold">
                {mon.present ? "🟢 Vous êtes à l'institut" : "🔴 Sortie enregistrée"} · {dureeTexte(mon.minutes)} aujourd&apos;hui
              </p>
              <p className="mt-1 text-sm text-doux">
                {mon.pointages.map((p) => `${p.type === "entree" ? "Entrée" : "Sortie"} ${heurePointage(p.heure)}`).join(" · ")}
              </p>
            </>
          )}
        </div>
      )}

      {scan ? (
        <Scanner
          trouve={(texte) => {
            const code = codeDuTexte(texte);
            if (!code) return false;
            setScan(false);
            envoyer(code);
            return true;
          }}
          fermer={() => setScan(false)}
        />
      ) : (
        <button
          disabled={envoi}
          onClick={() => {
            setResultat(null);
            setErreur("");
            setScan(true);
          }}
          className={`mt-5 flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold text-white disabled:opacity-50 ${prochain === "entree" ? "bg-[#0d6b37]" : "bg-profond"}`}
        >
          <span aria-hidden className="text-3xl">
            📷
          </span>
          {envoi ? "Enregistrement…" : prochain === "entree" ? "Scanner : j'arrive" : "Scanner : je pars"}
        </button>
      )}

    </div>
  );
}

/** La caméra arrière : lit un QR code (détecteur du téléphone, sinon jsQR). */
function Scanner({ trouve, fermer }: { trouve: (texte: string) => boolean; fermer: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Visez le QR code de la borne.");
  // La caméra reste ouverte même si l'écran se redessine.
  const rappel = useRef(trouve);
  useEffect(() => {
    rappel.current = trouve;
  });

  useEffect(() => {
    let flux: MediaStream | null = null;
    let fini = false;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const toile = document.createElement("canvas");
    (async () => {
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setMessage("La caméra est refusée. Autorisez-la dans les réglages du navigateur, ou scannez le QR code avec l'appareil photo du téléphone.");
        return;
      }
      if (fini || !video.current) return;
      video.current.srcObject = flux;
      await video.current.play().catch(() => {});
      const Natif = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detecteur }).BarcodeDetector;
      const natif = Natif ? new Natif({ formats: ["qr_code"] }) : null;
      const jsQR = natif ? null : (await import("jsqr")).default;
      const regarder = async () => {
        if (fini || !video.current) return;
        const v = video.current;
        if (v.readyState >= 2 && v.videoWidth) {
          let texte: string | null = null;
          if (natif) texte = (await natif.detect(v).catch(() => []))[0]?.rawValue ?? null;
          else if (jsQR) {
            const l = Math.min(640, v.videoWidth);
            const h = Math.round((v.videoHeight * l) / v.videoWidth);
            toile.width = l;
            toile.height = h;
            const ctx = toile.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(v, 0, 0, l, h);
              texte = jsQR(ctx.getImageData(0, 0, l, h).data, l, h, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
          }
          if (texte) {
            if (rappel.current(texte)) return;
            setMessage("Ce n'est pas le code de la borne.");
          }
        }
        minuterie = setTimeout(regarder, 250);
      };
      regarder();
    })();
    return () => {
      fini = true;
      clearTimeout(minuterie);
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="mt-5 overflow-hidden rounded-2xl bg-black">
      <div className="relative">
        <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
        <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80" aria-hidden />
      </div>
      <div className="flex items-center justify-between gap-3 p-3 text-sm text-white">
        <span>{message}</span>
        <button onClick={fermer} className="shrink-0 rounded-full border border-white/50 px-4 py-2 font-semibold">
          Fermer
        </button>
      </div>
    </div>
  );
}
