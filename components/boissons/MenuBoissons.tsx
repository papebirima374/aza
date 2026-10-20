"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MENU_BOISSONS } from "@/lib/boissons";

// La cliente choisit sa boisson (offerte) ; l'équipe est prévenue et la lui apporte.
// Son prénom et son numéro restent sur son téléphone pour la boisson suivante.

const MEMO = "aza-boissons-cliente";
type Envoi = { id: string; boisson: string; statut: "demandee" | "servie" };
function memoire(): { prenom?: string; telephone?: string } {
  try {
    return typeof window === "undefined" ? {} : JSON.parse(localStorage.getItem(MEMO) ?? "{}");
  } catch {
    return {}; // pas de mémoire : elle retapera son prénom
  }
}

export function MenuBoissons() {
  const code = useSearchParams().get("c") ?? "";
  const [valide, setValide] = useState<boolean | null>(null);
  const [prenom, setPrenom] = useState(() => memoire().prenom ?? "");
  const [telephone, setTelephone] = useState(() => memoire().telephone ?? "");
  const [choix, setChoix] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envois, setEnvois] = useState<Envoi[]>([]);
  const [reconnue, setReconnue] = useState(false);

  // Une cliente déjà venue : son numéro complet suffit, son prénom se met tout seul.
  async function changerTelephone(v: string) {
    setTelephone(v);
    const chiffres = v.replace(/\D/g, "");
    if (chiffres.length < 9 || (prenom && !reconnue)) return;
    const r = await fetch(`/api/boissons?code=${encodeURIComponent(code)}&tel=${encodeURIComponent(v)}`).catch(() => null);
    const j = r?.ok ? await r.json() : null;
    if (j?.prenom) {
      setPrenom(j.prenom);
      setReconnue(true);
    }
  }

  useEffect(() => {
    fetch(`/api/boissons?code=${encodeURIComponent(code)}`)
      .then((r) => setValide(r.ok))
      .catch(() => setValide(false));
  }, [code]);

  // Tant qu'une boisson est en route : on regarde toutes les 15 secondes si elle est servie.
  const enRoute = envois.filter((e) => e.statut === "demandee").map((e) => e.id).join(",");
  useEffect(() => {
    if (!enRoute) return;
    const t = setInterval(async () => {
      for (const id of enRoute.split(",")) {
        const r = await fetch(`/api/boissons?id=${id}`).catch(() => null);
        const j = r?.ok ? await r.json() : null;
        if (j?.statut === "servie") setEnvois((l) => l.map((e) => (e.id === id ? { ...e, statut: "servie" } : e)));
      }
    }, 15_000);
    return () => clearInterval(t);
  }, [enRoute]);

  async function commander(boisson: string) {
    setErreur("");
    if (prenom.trim().length < 2) {
      setChoix(boisson);
      setErreur("Écrivez d'abord votre prénom.");
      return;
    }
    setEnvoi(true);
    try {
      const r = await fetch("/api/boissons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, boisson, prenom, telephone }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur ?? "La demande n'est pas partie. Réessayez.");
      try {
        localStorage.setItem(MEMO, JSON.stringify({ prenom, telephone }));
      } catch {
        // navigation privée
      }
      setEnvois((l) => [{ id: j.id, boisson: j.boisson, statut: "demandee" }, ...l]);
      setChoix(null);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#0b0b0b] px-4 py-8 text-[#f3e3b5]">
      <div className="mx-auto max-w-md rounded-3xl border border-[#c9a54c]/60 p-5 shadow-[0_0_40px_rgba(201,165,76,0.15)]">
        <header className="text-center">
          <Image src="/images/lotus-or.png" alt="" width={64} height={64} className="mx-auto h-14 w-auto" />
          <p className="mt-2 font-serif text-4xl tracking-wide text-[#d9b65d]">ANNA ZEN</p>
          <p className="text-sm tracking-[0.4em] text-[#d9b65d]">ATTITUDE</p>
          <p className="mt-1 font-serif text-lg italic">Institut de Beauté &amp; Bien-être</p>
          <h1 className="mx-auto mt-4 inline-block rounded-full border-2 border-[#c9a54c] px-8 py-1 font-serif text-4xl font-semibold text-[#e8c66a]">MENU</h1>
          <p className="mt-3 text-sm">Une boisson vous est offerte. Touchez celle qui vous fait plaisir : on vous l&apos;apporte.</p>
        </header>

        {valide === false ? (
          <p className="mt-6 rounded-2xl bg-[#3a1d1d] p-4 text-center font-semibold text-[#ffd7d7]">Ce lien n&apos;est plus valable. Scannez le code QR affiché à l&apos;institut.</p>
        ) : (
          <>
            <div className="mt-6 grid gap-3">
              <label className="text-sm">
                Votre numéro <span className="text-[#bfa978]">(déjà venue ? on vous reconnaît)</span>
                <input value={telephone} onChange={(e) => changerTelephone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="77 123 45 67" className="mt-1 block min-h-12 w-full rounded-xl border border-[#c9a54c]/60 bg-[#151515] px-3 text-base text-white placeholder:text-[#6f6550]" />
              </label>
              <label className="text-sm">
                Votre prénom
                <input value={prenom} onChange={(e) => (setPrenom(e.target.value), setReconnue(false))} maxLength={40} autoComplete="given-name" className="mt-1 block min-h-12 w-full rounded-xl border border-[#c9a54c]/60 bg-[#151515] px-3 text-base text-white" />
                {reconnue && <span className="mt-1 block text-[#b9f0cd]">✓ Bon retour parmi nous, {prenom} !</span>}
              </label>
            </div>

            {envois.length > 0 && (
              <ul className="mt-5 space-y-2" aria-live="polite">
                {envois.map((e) => (
                  <li key={e.id} className={`rounded-2xl p-3 text-center font-semibold ${e.statut === "servie" ? "bg-[#163322] text-[#b9f0cd]" : "bg-[#2a2310] text-[#f3e3b5]"}`}>
                    {e.statut === "servie" ? `✅ ${e.boisson} : c'est servi. Bonne dégustation !` : `⏳ ${e.boisson} : c'est noté, on vous l'apporte.`}
                  </li>
                ))}
              </ul>
            )}
            {envois.length > 0 && (
              <nav className="mt-4 rounded-2xl border border-[#c9a54c]/50 p-3" aria-label="Le site">
                <p className="text-center text-sm">En attendant, découvrez l&apos;institut :</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-semibold">
                  {[
                    ["/prestations", "💆🏾‍♀️ Nos prestations"],
                    ["/reservation", "📅 Prendre rendez-vous"],
                    ["/boutique", "🛍️ La boutique"],
                    ["/", "🏠 Le site"],
                  ].map(([href, libelle]) => (
                    <Link key={href} href={href} className="flex min-h-12 items-center justify-center rounded-xl bg-[#c9a54c] px-2 text-center text-[#1a1406]">
                      {libelle}
                    </Link>
                  ))}
                </div>
              </nav>
            )}
            {erreur && (
              <p className="mt-4 rounded-2xl bg-[#3a1d1d] p-3 text-center text-sm font-semibold text-[#ffd7d7]" role="alert">
                {erreur}
              </p>
            )}

            {MENU_BOISSONS.map((g) => (
              <section key={g.groupe} className="mt-6">
                <h2 className="rounded-full bg-gradient-to-r from-[#b88a2e] to-[#e8c66a] px-4 py-1.5 font-serif text-xl font-bold uppercase text-[#1a1406]">
                  <span aria-hidden>{g.icone} </span>
                  {g.groupe}
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {g.boissons.map((b) => (
                    <button
                      key={b.id}
                      disabled={envoi || valide === null}
                      onClick={() => commander(b.id)}
                      className={`min-h-14 rounded-2xl border px-3 font-serif text-xl font-semibold transition disabled:opacity-50 ${choix === b.id ? "border-[#e8c66a] bg-[#2a2310]" : "border-[#c9a54c]/50 bg-[#151515] hover:bg-[#2a2310]"}`}
                    >
                      {b.nom}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}

        <footer className="mt-8 text-center">
          <p className="font-serif text-2xl italic text-[#d9b65d]">Merci de votre visite</p>
          <p className="mt-1 text-sm">et profitez pleinement de votre moment de détente chez Anna Zen Attitude.</p>
          <Link href="/" className="mt-3 inline-block text-sm font-semibold text-[#d9b65d] underline">Visiter notre site</Link>
        </footer>
      </div>
    </main>
  );
}
