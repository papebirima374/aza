"use client";

import qrcode from "qrcode-generator";
import { useEffect, useRef, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { heurePointage } from "@/lib/pointage";

// La borne de pointage : un écran posé à l'institut (tablette ou ordinateur de l'accueil).
// Le QR code et le code à 6 chiffres changent toutes les 30 secondes ; chacun les scanne avec
// SON compte (AZA Gestion → ⏱ Pointer). L'écran reste allumé et montre les derniers pointages.

type Borne = { code: string; expireDans: number; periode: number; derniers: { id: string; nom: string; type: "entree" | "sortie"; heure: number }[] };

function Qr({ texte }: { texte: string }) {
  const q = qrcode(0, "M");
  q.addData(texte);
  q.make();
  const n = q.getModuleCount();
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} className="h-auto w-full" role="img" aria-label="QR code de pointage" shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

const horloge = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Africa/Dakar" });

export function BornePointage() {
  const compte = useCompte();
  const [borne, setBorne] = useState<Borne | null>(null);
  const [finLe, setFinLe] = useState(0);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [erreur, setErreur] = useState("");
  const [recent, setRecent] = useState<string | null>(null);
  const connus = useRef<Set<string> | null>(null);
  const cadre = useRef<HTMLDivElement>(null);

  // Le code du moment, relu juste après chaque changement (et toutes les 5 s pour les pointages).
  useEffect(() => {
    let actif = true;
    let t: ReturnType<typeof setTimeout>;
    const lire = async () => {
      try {
        const r = await fetch("/api/gestion/pointage?borne=1", { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
        const j = await r.json();
        if (!actif) return;
        if (!r.ok) {
          setErreur(j.erreur ?? "Lecture impossible.");
          t = setTimeout(lire, 15_000);
          return;
        }
        setErreur("");
        setBorne(j);
        setFinLe(Date.now() + j.expireDans);
        const ids = (j.derniers as Borne["derniers"]).map((d) => d.id);
        if (connus.current && ids[0] && !connus.current.has(ids[0])) setRecent(ids[0]);
        connus.current = new Set(ids);
        t = setTimeout(lire, Math.min(j.expireDans + 300, 5_000));
      } catch {
        if (actif) {
          setErreur("Pas de connexion internet : le code ne se met plus à jour.");
          t = setTimeout(lire, 5_000);
        }
      }
    };
    lire();
    return () => {
      actif = false;
      clearTimeout(t);
    };
  }, [compte.user]);

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!recent) return;
    const t = setTimeout(() => setRecent(null), 6_000);
    return () => clearTimeout(t);
  }, [recent]);

  // L'écran ne s'éteint pas tant que la borne est ouverte.
  useEffect(() => {
    let verrou: { release: () => Promise<void> } | null = null;
    const demander = async () => {
      try {
        verrou = (await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
      } catch {
        // pas permis : l'écran suivra ses propres réglages
      }
    };
    demander();
    const revoir = () => document.visibilityState === "visible" && demander();
    document.addEventListener("visibilitychange", revoir);
    return () => {
      document.removeEventListener("visibilitychange", revoir);
      verrou?.release().catch(() => {});
    };
  }, []);

  // Rendue seulement dans le navigateur (après la connexion) : l'adresse du site est connue.
  const origine = typeof window === "undefined" ? "" : window.location.origin;
  const reste = Math.max(0, finLe - maintenant);
  const part = borne ? reste / borne.periode : 0;
  const nouveau = borne?.derniers.find((d) => d.id === recent);
  return (
    <div ref={cadre} className="min-h-[calc(100vh-3.5rem)] bg-bordeaux px-4 py-6 text-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
        <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-center text-encre shadow-2xl">
          <p className="font-serif text-2xl font-semibold text-profond">Pointage</p>
          <p className="text-sm text-doux">AZA Gestion → ⏱ Pointer → scannez</p>
          <div className="mx-auto mt-3 w-full max-w-[18rem]">{borne && origine ? <Qr texte={`${origine}/gestion/pointer?c=${borne.code}`} /> : <div className="aspect-square animate-pulse rounded-xl bg-creme" />}</div>
          <p className="mt-3 font-mono text-4xl font-bold tracking-[0.25em] text-profond" aria-live="polite">
            {borne ? `${borne.code.slice(0, 3)} ${borne.code.slice(3)}` : "··· ···"}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-creme" aria-hidden>
            <div className="h-full rounded-full bg-aza transition-[width] duration-200 ease-linear" style={{ width: `${Math.round(part * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-doux">Nouveau code dans {Math.ceil(reste / 1000)} s</p>
          {erreur && <p className="mt-3 rounded-xl bg-[#fde8ec] p-2 text-sm font-semibold text-[#a3123a]">{erreur}</p>}
        </div>

        <div className="w-full max-w-sm">
          <p className="text-center font-mono text-5xl font-bold text-or-clair lg:text-left">{horloge(maintenant)}</p>
          {nouveau && (
            <p className={`mt-4 rounded-2xl p-4 text-center text-xl font-bold ${nouveau.type === "entree" ? "bg-[#0d6b37]" : "bg-aza"}`} role="status">
              {nouveau.type === "entree" ? "👋 Bonjour" : "🏠 Au revoir"} {nouveau.nom.split(" ")[0]} · {heurePointage(nouveau.heure)}
            </p>
          )}
          <p className="mt-6 text-sm font-bold tracking-wide text-or uppercase">Derniers pointages</p>
          <ul className="mt-2 space-y-1.5">
            {(borne?.derniers ?? []).map((d) => (
              <li key={d.id} className="flex justify-between gap-3 rounded-xl bg-white/10 px-3 py-2">
                <span className="truncate">
                  {d.type === "entree" ? "🟢" : "🔴"} {d.nom}
                </span>
                <span className="shrink-0 font-semibold">
                  {d.type === "entree" ? "entrée" : "sortie"} {heurePointage(d.heure)}
                </span>
              </li>
            ))}
            {borne && borne.derniers.length === 0 && <li className="text-or-clair/80">Aucun pointage aujourd&apos;hui.</li>}
          </ul>
          <button onClick={() => cadre.current?.requestFullscreen?.().catch(() => {})} className="mt-6 w-full rounded-full border border-or-clair/40 py-3 font-semibold">
            ⛶ Plein écran
          </button>
        </div>
      </div>
    </div>
  );
}
