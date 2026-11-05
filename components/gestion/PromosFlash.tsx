"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { peut } from "@/lib/acces";
import { formatPrix, jourDakar, periodePromo, type PromoFlash } from "@/lib/catalogue";
import { reduirePhoto } from "@/lib/client/image";
import { useCatalogue } from "@/lib/client/catalogue";
import { correspond } from "@/lib/recherche";
import { urlPhotoSite } from "@/lib/photos-site";
import { texteWhatsApp } from "@/lib/whatsapp";

// « Promos flash » : un prix spécial sur une prestation, pour un jour ou quelques jours
// (ex. « Massage pierres chaudes à 20 000 F le vendredi »). Pendant ces jours, le prix promo
// s'applique partout (site, réservation, caisse). Chaque promotion a sa page, à envoyer aux
// clientes : elles réservent directement depuis le lien.

type Promo = PromoFlash & { id: string; etat: "a-venir" | "en-cours" | "terminee" | "arretee"; nom: string; prixNormal: number | null };

const ETATS = {
  "en-cours": ["🟢 En cours", "bg-[#e7f5ec] text-[#0d6b37]"],
  "a-venir": ["⏳ À venir", "bg-[#fff4d6] text-[#8a6534]"],
  terminee: ["Terminée", "bg-creme text-doux"],
  arretee: ["Arrêtée", "bg-creme text-doux"],
} as const;

const periode = periodePromo;

export function PromosFlash() {
  const compte = useCompte();
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [version, setVersion] = useState(0);

  const appel = useCallback(
    async (corps?: object) => {
      const r = await fetch("/api/gestion/promos", {
        method: corps ? "POST" : "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: corps ? JSON.stringify(corps) : undefined,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur ?? "Erreur");
      return j;
    },
    [compte.user],
  );

  useEffect(() => {
    let actif = true;
    appel()
      .then((p: Promo[]) => actif && setPromos(p))
      .catch((e: Error) => actif && setMessage({ ok: false, texte: e.message }));
    return () => {
      actif = false;
    };
  }, [appel, version]);

  const agir = async (corps: object, ok: string) => {
    try {
      const r = await appel(corps);
      setMessage({ ok: true, texte: ok });
      setVersion((v) => v + 1);
      return r;
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message });
      return null;
    }
  };

  if (!peut(compte, "catalogue")) return <p className="p-8 text-center text-doux">Réservé à la direction.</p>;
  const actuelles = (promos ?? []).filter((p) => p.etat === "en-cours" || p.etat === "a-venir");
  const passees = (promos ?? []).filter((p) => p.etat === "terminee" || p.etat === "arretee").slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-serif text-4xl font-semibold text-profond">⚡ Promos flash</h1>
      <p className="mt-1 text-sm text-doux">
        Un prix spécial sur une prestation, pour un jour ou quelques jours. Pendant ces jours, le prix promo s&apos;applique partout : site, réservation et
        caisse. Chaque promotion a son lien : envoyez-le, la cliente réserve directement.
      </p>
      {message && <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`}>{message.texte}</p>}
      <NouvellePromo creer={(c) => agir({ action: "creer", ...c }, "Promotion créée : envoyez son lien aux clientes.")} />

      <h2 className="mt-8 font-serif text-2xl font-semibold text-profond">En cours et à venir</h2>
      {!promos ? (
        <p className="mt-3 text-doux">Chargement…</p>
      ) : actuelles.length === 0 ? (
        <p className="mt-3 rounded-xl bg-creme p-4 text-sm text-doux">Aucune promotion en cours.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {actuelles.map((p) => (
            <CartePromo key={p.id} p={p} arreter={() => window.confirm(`Arrêter la promotion « ${p.nom} » ? Le prix habituel revient tout de suite.`) && agir({ action: "arreter", id: p.id }, "Promotion arrêtée.")} />
          ))}
        </ul>
      )}
      {passees.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-xl font-semibold text-doux">Passées</h2>
          <ul className="mt-3 space-y-2">
            {passees.map((p) => (
              <CartePromo key={p.id} p={p} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function CartePromo({ p, arreter }: { p: Promo; arreter?: () => void }) {
  const [copie, setCopie] = useState(false);
  const lien = typeof window === "undefined" ? `/promo/${p.id}` : `${window.location.origin}/promo/${p.id}`;
  const texte = `${p.titre} chez Anna Zen Attitude : ${p.nom} à ${formatPrix(p.prix)}${p.prixNormal ? ` au lieu de ${formatPrix(p.prixNormal)}` : ""}, ${periode(p.du, p.au)}. Réservez ici : ${lien}`;
  const [etat, style] = ETATS[p.etat];
  const outil = "flex min-h-11 items-center rounded-full border border-bordure px-4 text-sm font-semibold text-profond";
  return (
    <li className={`flex gap-3 rounded-2xl border border-bordure p-3 ${arreter ? "" : "opacity-70"}`}>
      {p.affiche ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={urlPhotoSite(p.affiche)} alt="" loading="lazy" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-creme text-3xl">⚡</span>
      )}
      <div className="min-w-0 flex-1">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${style}`}>{etat}</span>
        <p className="mt-1 font-bold text-profond">{p.nom}</p>
        <p className="text-sm">
          <b className="prix">{formatPrix(p.prix)}</b>
          {p.prixNormal && <span className="prix ml-2 text-doux line-through">{formatPrix(p.prixNormal)}</span>} · {periode(p.du, p.au)}
        </p>
        {arreter && (
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${texteWhatsApp(texte)}`} target="_blank" rel="noopener" className="flex min-h-11 items-center rounded-full bg-[#1a7f45] px-4 text-sm font-bold text-white">
              📲 Envoyer sur WhatsApp
            </a>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(lien);
                  setCopie(true);
                } catch {
                  window.prompt("Copiez ce lien :", lien);
                }
              }}
              className={outil}
            >
              {copie ? "✓ Lien copié" : "🔗 Copier le lien"}
            </button>
            <Link href={`/promo/${p.id}`} target="_blank" className={outil}>
              Voir la page
            </Link>
            <button onClick={arreter} className={outil}>
              Arrêter
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function NouvellePromo({ creer }: { creer: (c: Record<string, unknown>) => Promise<unknown> }) {
  const cat = useCatalogue();
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [prestation, setPrestation] = useState<string>("");
  const [prix, setPrix] = useState("");
  const [du, setDu] = useState(jourDakar());
  const [au, setAu] = useState(jourDakar());
  const [titre, setTitre] = useState("Promo Flash");
  const [affiche, setAffiche] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const choisie = cat.parId(prestation);
  const prixHabituel = choisie ? (choisie.prixNormal ?? choisie.prix) : 0;
  const trouvees = useMemo(
    () => (recherche.trim().length < 2 ? [] : cat.prestations.filter((p) => p.note !== "Produit" && correspond(`${p.nom} ${p.famille}`, recherche)).slice(0, 8)),
    [cat, recherche],
  );
  const champ = "mt-1 block w-full rounded-xl border border-bordure px-3 py-2.5";
  if (!ouvert)
    return (
      <button onClick={() => setOuvert(true)} className="mt-5 min-h-12 rounded-full bg-aza px-6 font-bold text-white">
        + Nouvelle promotion
      </button>
    );
  return (
    <section className="mt-5 rounded-2xl border-2 border-profond p-4">
      <h2 className="font-serif text-2xl font-semibold text-profond">Nouvelle promotion</h2>
      <label className="mt-3 block text-sm font-semibold">
        1. La prestation
        {choisie ? (
          <span className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-creme px-3 py-2.5 font-normal">
            <span>
              <b>{choisie.nom}</b> · prix habituel <span className="prix">{formatPrix(prixHabituel)}</span>
            </span>
            <button type="button" onClick={() => setPrestation("")} className="min-h-10 text-sm font-semibold text-profond underline">
              Changer
            </button>
          </span>
        ) : (
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="ex. pierres chaudes" className={champ} autoFocus />
        )}
      </label>
      {!choisie && trouvees.length > 0 && (
        <ul className="mt-1 divide-y divide-bordure rounded-xl border border-bordure">
          {trouvees.map((p) => (
            <li key={p.id}>
              <button onClick={() => setPrestation(p.id)} className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left text-sm hover:bg-creme">
                <span>
                  {p.nom} <span className="text-doux">· {p.famille}</span>
                </span>
                <span className="prix shrink-0 whitespace-nowrap">{formatPrix(p.prixNormal ?? p.prix)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          2. Prix promo (F)
          <input inputMode="numeric" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="ex. 20000" className={`${champ} text-right`} />
        </label>
        <label className="text-sm font-semibold">
          3. Premier jour
          <input
            type="date"
            value={du}
            min={jourDakar()}
            onChange={(e) => {
              setDu(e.target.value);
              if (au < e.target.value) setAu(e.target.value);
            }}
            className={champ}
          />
        </label>
        <label className="text-sm font-semibold">
          Dernier jour
          <input type="date" value={au} min={du} onChange={(e) => setAu(e.target.value)} className={champ} />
        </label>
      </div>
      {du && au && <p className="mt-1 text-sm text-doux">Valable {periode(du, au)}.</p>}
      <label className="mt-3 block text-sm font-semibold">
        4. Titre <span className="font-normal text-doux">(ex. Promo Flash du Vendredi)</span>
        <input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={60} className={champ} />
      </label>
      <div className="mt-3 text-sm font-semibold">
        5. L&apos;affiche <span className="font-normal text-doux">(facultatif : celle que vous publiez sur les réseaux)</span>
        <div className="mt-2 flex items-center gap-3">
          {affiche && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={affiche} alt="" className="h-24 w-24 rounded-xl object-cover" />
          )}
          <label className="flex min-h-11 cursor-pointer items-center rounded-full border border-bordure px-4 font-semibold text-profond">
            📷 {affiche ? "Changer l'affiche" : "Ajouter l'affiche"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) setAffiche(await reduirePhoto(f, 1200));
              }}
            />
          </label>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          disabled={!choisie || !(Number(prix) > 0) || !du || !au || envoi}
          onClick={async () => {
            setEnvoi(true);
            const r = await creer({ prestation, prix: Number(prix.replace(/\s/g, "")), du, au, titre, ...(affiche ? { affiche } : {}) });
            setEnvoi(false);
            if (r) {
              setOuvert(false);
              setPrestation("");
              setRecherche("");
              setPrix("");
              setAffiche(null);
            }
          }}
          className="min-h-12 rounded-full bg-aza px-6 font-bold text-white disabled:opacity-40"
        >
          {envoi ? "Création…" : "Créer la promotion"}
        </button>
        <button onClick={() => setOuvert(false)} className="min-h-12 rounded-full border border-bordure px-5 font-semibold text-profond">
          Annuler
        </button>
      </div>
    </section>
  );
}
