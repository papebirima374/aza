"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Rubrique } from "@/lib/boissons";

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
  const [carte, setCarte] = useState<Rubrique[]>([]);
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
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        setCarte(r.ok ? (j.carte ?? []) : []);
        setValide(r.ok);
      })
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
    <main className="min-h-dvh bg-creme px-4 py-6 text-encre">
      <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-bordure bg-white shadow-lg">
        <header className="bg-bordeaux px-5 pb-5 pt-6 text-center text-or-clair">
          <Image src="/images/logo-or.png" alt="Anna Zen Attitude" width={790} height={257} priority className="mx-auto h-14 w-auto" />
          <h1 className="mt-4 font-serif text-4xl font-semibold text-white">Menu</h1>
          <p className="mt-1 text-sm">C&apos;est offert. Touchez ce qui vous fait plaisir : on vous l&apos;apporte.</p>
        </header>

        <div className="p-5">
          {valide === false ? (
            <p className="rounded-2xl bg-aza/10 p-4 text-center font-semibold text-profond">Ce lien n&apos;est plus valable. Scannez le code QR affiché à l&apos;institut.</p>
          ) : (
            <>
              <div className="grid gap-3">
                <label className="text-sm font-semibold text-profond">
                  Votre numéro <span className="font-normal text-doux">(déjà venue ? on vous reconnaît)</span>
                  <input value={telephone} onChange={(e) => changerTelephone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="77 123 45 67" className="mt-1 block min-h-12 w-full rounded-xl border border-bordure bg-white px-3 text-base font-normal text-encre" />
                </label>
                <label className="text-sm font-semibold text-profond">
                  Votre prénom
                  <input value={prenom} onChange={(e) => (setPrenom(e.target.value), setReconnue(false))} maxLength={40} autoComplete="given-name" className="mt-1 block min-h-12 w-full rounded-xl border border-bordure bg-white px-3 text-base font-normal text-encre" />
                  {reconnue && <span className="mt-1 block font-normal text-[#0d6b37]">✓ Bon retour parmi nous, {prenom} !</span>}
                </label>
              </div>

              {envois.length > 0 && (
                <ul className="mt-5 space-y-2" aria-live="polite">
                  {envois.map((e) => (
                    <li key={e.id} className={`rounded-2xl p-3 text-center font-semibold ${e.statut === "servie" ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-or-clair/40 text-profond"}`}>
                      {e.statut === "servie" ? `✅ ${e.boisson} : c'est servi. Bonne dégustation !` : `⏳ ${e.boisson} : c'est noté, on vous l'apporte.`}
                    </li>
                  ))}
                </ul>
              )}
              {envois.length > 0 && (
                <nav className="mt-4 rounded-2xl bg-creme p-3" aria-label="Le site">
                  <p className="text-center text-sm text-doux">En attendant, découvrez l&apos;institut :</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-bold">
                    {[
                      ["/prestations", "💆🏾‍♀️ Nos prestations"],
                      ["/reservation", "📅 Prendre rendez-vous"],
                      ["/boutique", "🛍️ La boutique"],
                      ["/", "🏠 Le site"],
                    ].map(([href, libelle]) => (
                      <Link key={href} href={href} className="flex min-h-12 items-center justify-center rounded-full bg-aza px-2 text-center text-white">
                        {libelle}
                      </Link>
                    ))}
                  </div>
                </nav>
              )}
              {erreur && (
                <p className="mt-4 rounded-2xl bg-aza/10 p-3 text-center text-sm font-semibold text-profond" role="alert">
                  {erreur}
                </p>
              )}

              {carte.map((g) => (
                <section key={g.groupe} className="mt-6">
                  <h2 className="flex items-center gap-2 border-b-2 border-or pb-1 font-serif text-2xl font-semibold text-profond">
                    <span aria-hidden>{g.icone}</span>
                    {g.groupe}
                  </h2>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {g.boissons.map((b) => (
                      <button
                        key={b.id}
                        disabled={envoi || valide === null}
                        onClick={() => commander(b.id)}
                        className={`min-h-14 rounded-2xl border-2 px-3 font-semibold text-profond transition disabled:opacity-50 ${choix === b.id ? "border-aza bg-aza/10" : "border-bordure bg-white hover:border-aza hover:bg-aza/5"}`}
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
            <p className="font-serif text-2xl italic text-profond">Merci de votre visite</p>
            <p className="mt-1 text-sm text-doux">et profitez pleinement de votre moment de détente chez Anna Zen Attitude.</p>
            <Link href="/" className="mt-3 inline-block text-sm font-semibold text-aza underline">
              Visiter notre site
            </Link>
          </footer>
        </div>
      </div>
    </main>
  );
}
