"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { lienCarteWhatsApp, normaliserCode, type CarteCadeau } from "@/lib/caisse/cartes";
import { MODES, ROLES_CAISSE, type Mode } from "@/lib/caisse/modes";
import { dateTexte } from "@/lib/caisse/recu";
import { formatPrix } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";

// Écran « Cartes cadeaux » : vendre une carte (ticket de caisse + code), la retrouver par son
// code (solde, historique), voir toutes les cartes et ce qu'il reste à consommer.

const bouton = "min-h-12 rounded-full px-5 font-bold disabled:opacity-40";
const nombre = (v: string) => Math.max(0, Math.round(Number(v.replace(/\s/g, "")) || 0));
const RAPIDES = [5_000, 10_000, 20_000, 50_000];
const ICONE: Partial<Record<Mode, string>> = { especes: "💵", wave: "🌊", "orange-money": "🟠", carte: "💳", virement: "🏦" };
const MODES_VENTE = MODES.filter((m) => m.id in ICONE);

function useAppel() {
  const compte = useCompte();
  return useCallback(
    async (q: string, corps?: object) => {
      const r = await fetch(`/api/gestion/cartes${q}`, {
        method: corps ? "POST" : "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: corps ? JSON.stringify(corps) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erreur ?? "Erreur");
      return j;
    },
    [compte.user],
  );
}

export function CartesCadeaux() {
  const compte = useCompte();
  const appel = useAppel();
  const [liste, setListe] = useState<{ cartes: CarteCadeau[]; enCours: number; nombreActives: number } | null>(null);
  const [version, setVersion] = useState(0);
  const [vente, setVente] = useState(false);
  const [vendue, setVendue] = useState<CarteCadeau | null>(null);
  const [code, setCode] = useState("");
  const [trouvee, setTrouvee] = useState<CarteCadeau | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;
    appel("")
      .then((j) => actif && setListe(j))
      .catch((e: Error) => actif && setErreur(e.message));
    return () => {
      actif = false;
    };
  }, [appel, version]);

  async function chercher() {
    setErreur("");
    setTrouvee(null);
    const c = normaliserCode(code);
    if (!c) return setErreur("Code invalide : 8 lettres et chiffres, par exemple AZA-K7M2-Q9TX.");
    try {
      setTrouvee(await appel(`?code=${encodeURIComponent(c)}`));
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/gestion/caisse" className="text-sm font-semibold text-aza hover:underline">
        ← Caisse
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-4xl font-semibold text-profond">🎁 Cartes cadeaux</h1>
        {ROLES_CAISSE.includes(compte.role) && !vente && (
          <button onClick={() => { setVendue(null); setVente(true); }} className={`${bouton} bg-aza text-white`}>
            + Vendre une carte
          </button>
        )}
      </div>

      {erreur && (
        <p className="mt-4 rounded-xl bg-aza/10 p-3 text-sm font-semibold text-profond" role="alert">
          {erreur}
        </p>
      )}

      {vendue && <CarteVendue carte={vendue} fermer={() => setVendue(null)} />}

      {vente && (
        <Vente
          annuler={() => setVente(false)}
          vendre={async (corps) => {
            setErreur("");
            try {
              const r = await appel("", corps);
              setVendue(await appel(`?code=${encodeURIComponent(r.code)}`));
              setVente(false);
              setVersion((v) => v + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (e) {
              setErreur((e as Error).message);
            }
          }}
        />
      )}

      <section className="mt-6 rounded-2xl border border-bordure p-4">
        <h2 className="font-semibold">Retrouver une carte</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && chercher()}
            placeholder="AZA-XXXX-XXXX"
            autoCapitalize="characters"
            className="min-w-0 flex-1 rounded-xl border border-bordure px-4 py-3 text-lg tracking-widest"
          />
          <button onClick={chercher} className={`${bouton} bg-profond text-white`}>
            Chercher
          </button>
        </div>
        {trouvee && <Detail carte={trouvee} />}
      </section>

      {liste && (
        <section className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-creme p-4">
              <p className="text-sm text-doux">Reste à consommer sur les cartes</p>
              <p className="prix font-serif text-3xl font-semibold text-profond">{formatPrix(liste.enCours)}</p>
            </div>
            <div className="rounded-2xl bg-creme p-4">
              <p className="text-sm text-doux">Cartes avec un solde</p>
              <p className="font-serif text-3xl font-semibold text-profond">{liste.nombreActives}</p>
            </div>
          </div>
          <h2 className="mt-6 font-serif text-2xl font-semibold text-profond">Toutes les cartes</h2>
          {liste.cartes.length === 0 ? (
            <p className="mt-2 text-sm text-doux">Aucune carte vendue pour l&apos;instant.</p>
          ) : (
            <ul className="mt-3 divide-y divide-bordure rounded-2xl border border-bordure">
              {liste.cartes.map((c) => (
                <li key={c.code}>
                  <Link href={`/gestion/cartes/${c.code}`} className="flex items-center justify-between gap-3 p-3 hover:bg-creme">
                    <span className="min-w-0">
                      <span className="block font-semibold tracking-wider">{c.code}</span>
                      <span className="block text-sm text-doux">
                        {c.pour ? `Pour ${c.pour} · ` : ""}
                        {dateTexte(c.vendue.date)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`prix block font-bold ${c.statut === "annulee" || c.solde === 0 ? "text-doux" : "text-profond"}`}>
                        {c.statut === "annulee" ? "Annulée" : c.solde === 0 ? "Utilisée" : formatPrix(c.solde)}
                      </span>
                      <span className="prix block text-xs text-doux">sur {formatPrix(c.montant)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Vente({ vendre, annuler }: { vendre: (corps: object) => Promise<void>; annuler: () => void }) {
  const [montant, setMontant] = useState("");
  const [pour, setPour] = useState("");
  const [dePart, setDePart] = useState("");
  const [message, setMessage] = useState("");
  const [telephone, setTelephone] = useState("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [especes, setEspeces] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const m = nombre(montant);
  const recu = mode === "especes" ? nombre(especes) : m;
  const rendu = recu - m;
  const pret = m >= 1000 && mode !== null && rendu >= 0 && !envoi;
  const champ = "mt-1 block w-full rounded-xl border border-bordure px-4 py-2.5 font-normal";

  return (
    <section className="mt-6 rounded-2xl border-2 border-profond p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold text-profond">Vendre une carte cadeau</h2>
        <button onClick={annuler} className="text-sm font-semibold text-doux underline">
          Abandonner
        </button>
      </div>
      <label className="mt-3 block text-sm font-semibold">
        Montant de la carte (F)
        <input inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="ex. 20 000" className={`${champ} text-lg`} />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {RAPIDES.map((r) => (
          <button key={r} onClick={() => setMontant(String(r))} className={`rounded-full border px-4 py-2 text-sm font-semibold ${m === r ? "border-profond bg-profond text-white" : "border-bordure"}`}>
            {formatPrix(r)}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Pour <span className="font-normal text-doux">(qui la reçoit, facultatif)</span>
          <input value={pour} onChange={(e) => setPour(e.target.value)} className={champ} />
        </label>
        <label className="text-sm font-semibold">
          De la part de <span className="font-normal text-doux">(facultatif)</span>
          <input value={dePart} onChange={(e) => setDePart(e.target.value)} className={champ} />
        </label>
        <label className="text-sm font-semibold">
          Petit message <span className="font-normal text-doux">(facultatif)</span>
          <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} className={champ} />
        </label>
        <label className="text-sm font-semibold">
          Téléphone <span className="font-normal text-doux">(pour envoyer la carte par WhatsApp)</span>
          <input inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} className={champ} />
        </label>
      </div>

      <h3 className="mt-5 font-semibold">Paiement</h3>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {MODES_VENTE.map((x) => (
          <button
            key={x.id}
            onClick={() => setMode(x.id)}
            className={`flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 px-2 font-bold ${mode === x.id ? "border-profond ring-4 ring-profond/30" : "border-bordure"}`}
          >
            <span className="text-3xl" aria-hidden>
              {ICONE[x.id]}
            </span>
            <span className="text-sm">{x.libelle}</span>
          </button>
        ))}
      </div>
      {mode === "especes" && (
        <label className="mt-3 block max-w-xs text-sm font-semibold">
          💵 Espèces reçues
          <input inputMode="numeric" value={especes} onChange={(e) => setEspeces(e.target.value)} placeholder={m ? String(m) : ""} className={`${champ} text-right text-lg`} />
        </label>
      )}
      {mode === "especes" && especes !== "" && (
        <p className={`mt-2 font-bold ${rendu < 0 ? "text-aza-fonce" : "text-[#0d6b37]"}`}>
          {rendu < 0 ? `Il manque ${formatPrix(-rendu)}` : rendu > 0 ? `Monnaie à rendre : ${formatPrix(rendu)}` : "Le compte est bon."}
        </p>
      )}
      <button
        disabled={!pret}
        onClick={async () => {
          setEnvoi(true);
          await vendre({
            montant: m,
            pour,
            dePart,
            message,
            telephone,
            paiements: [{ mode, montant: mode === "especes" && especes !== "" ? nombre(especes) : m }],
          });
          setEnvoi(false);
        }}
        className={`${bouton} mt-4 w-full bg-aza text-lg text-white`}
      >
        {envoi ? "Enregistrement…" : `Encaisser la carte ${m ? formatPrix(m) : ""}`}
      </button>
    </section>
  );
}

function CarteVendue({ carte, fermer }: { carte: CarteCadeau; fermer: () => void }) {
  return (
    <section className="mt-6 rounded-2xl border-2 border-[#0d6b37]/40 bg-[#e7f5ec] p-4">
      <p className="font-bold text-[#0d6b37]">✅ Carte vendue — ticket {carte.vendue.reference}</p>
      <div className="mt-3">
        <CarteVisuelle carte={carte} />
      </div>
      <Actions carte={carte} />
      <button onClick={fermer} className="mt-3 text-sm font-semibold text-doux underline">
        Fermer
      </button>
    </section>
  );
}

function Actions({ carte }: { carte: CarteCadeau }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 print:hidden">
      <a href={lienCarteWhatsApp(carte)} target="_blank" rel="noopener" className="flex min-h-12 items-center rounded-full bg-[#128C4A] px-5 font-bold text-white">
        Envoyer par WhatsApp
      </a>
      <Link href={`/gestion/cartes/${carte.code}`} className="flex min-h-12 items-center rounded-full bg-profond px-5 font-bold text-white">
        Voir / imprimer la carte
      </Link>
      <Link href={`/gestion/caisse/ticket/${carte.vendue.ticket}`} className="flex min-h-12 items-center rounded-full border border-bordure bg-white px-5 font-semibold text-profond">
        Reçu {carte.vendue.reference}
      </Link>
    </div>
  );
}

/** La carte elle-même, aux couleurs de l'institut (à imprimer ou à photographier). */
export function CarteVisuelle({ carte }: { carte: Pick<CarteCadeau, "code" | "montant" | "pour" | "dePart" | "message"> }) {
  return (
    <div className="relative mx-auto aspect-[1.6] w-full max-w-md overflow-hidden rounded-2xl bg-bordeaux p-5 text-white shadow-lg print:shadow-none">
      <Image src="/images/lotus-or.png" alt="" width={244} height={257} className="pointer-events-none absolute -right-8 -bottom-8 w-44 opacity-15" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <Image src="/images/logo-or.png" alt={INSTITUT.nom} width={790} height={257} className="h-9 w-auto" />
          <span className="text-xs font-semibold tracking-[0.2em] text-or uppercase">Carte cadeau</span>
        </div>
        <p className="prix mt-auto font-serif text-4xl font-semibold text-or-clair">{formatPrix(carte.montant)}</p>
        {(carte.pour || carte.dePart) && (
          <p className="mt-1 text-sm">
            {carte.pour && <>Pour <strong>{carte.pour}</strong></>}
            {carte.pour && carte.dePart ? " · " : ""}
            {carte.dePart && <>de la part de <strong>{carte.dePart}</strong></>}
          </p>
        )}
        {carte.message && <p className="mt-1 text-xs text-or-clair italic">« {carte.message} »</p>}
        <p className="mt-3 font-mono text-lg font-bold tracking-[0.15em]">{carte.code}</p>
      </div>
    </div>
  );
}

function Detail({ carte }: { carte: CarteCadeau }) {
  return (
    <div className="mt-4">
      <p className="text-lg">
        {carte.statut === "annulee" ? (
          <strong className="text-aza-fonce">Carte annulée</strong>
        ) : (
          <>
            Solde : <strong className="prix text-profond">{formatPrix(carte.solde)}</strong> sur {formatPrix(carte.montant)}
          </>
        )}
      </p>
      <ul className="mt-2 text-sm">
        {carte.historique.map((h, i) => (
          <li key={i} className="flex justify-between gap-3 border-b border-bordure py-1.5">
            <span>
              {dateTexte(h.date)} · {h.type === "achat" ? "Achat" : h.type === "utilisation" ? "Utilisée" : h.type === "remboursement" ? "Rendue (ticket annulé)" : "Annulée"} · {h.reference} · {h.par}
            </span>
            <span className="prix shrink-0 font-semibold">{formatPrix(h.montant)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FicheCarte({ code }: { code: string }) {
  const appel = useAppel();
  const [carte, setCarte] = useState<CarteCadeau | null>(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    let actif = true;
    appel(`?code=${encodeURIComponent(code)}`)
      .then((c) => actif && setCarte(c))
      .catch((e: Error) => actif && setErreur(e.message));
    return () => {
      actif = false;
    };
  }, [appel, code]);
  if (!carte) return <p className="p-8 text-center text-doux">{erreur || "Chargement…"}</p>;
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Link href="/gestion/cartes" className="flex min-h-12 items-center rounded-full border border-bordure px-5 font-semibold text-profond">
          ← Cartes cadeaux
        </Link>
        <button onClick={() => window.print()} className="min-h-12 rounded-full bg-profond px-5 font-bold text-white">
          Imprimer
        </button>
      </div>
      <CarteVisuelle carte={carte} />
      <p className="mt-3 text-center text-xs text-doux">
        À utiliser à l&apos;institut : soins, coiffure, onglerie, boutique. {INSTITUT.adresse.rue}, {INSTITUT.adresse.ville} · {INSTITUT.telephones[0].affiche}
      </p>
      <div className="print:hidden">
        <Actions carte={carte} />
        <Detail carte={carte} />
      </div>
    </div>
  );
}
