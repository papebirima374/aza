"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { reduirePhoto } from "@/lib/client/image";
import { EMPLACEMENTS, emplacementGalerie, MAX_GALERIES, PHOTOS_FOURNIES, PHOTOS_PAR_GALERIE, urlPhotoSite, type Emplacement, type Galerie } from "@/lib/photos-site";

// « Photos du site » : la direction met ses vraies photos (prises au téléphone, ou
// enregistrées depuis Instagram) aux bons endroits du site. Jamais de banque d'images.
// Deux onglets : les photos des pages, et les galeries (créées et nommées par la direction).

type Photo = { id: string; emplacement: string; legende: string };
type Place = { id: string; nom: string; aide: string; max: number };

const PAGES: Place[] = EMPLACEMENTS.filter((e) => e.id !== "galerie").map((e) => ({ ...e }));
const ANCIENNE = EMPLACEMENTS.find((e) => e.id === "galerie")!;

export function PhotosSite() {
  const compte = useCompte();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [galeries, setGaleries] = useState<Galerie[]>([]);
  const [onglet, setOnglet] = useState<"galeries" | "pages">("galeries");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [version, setVersion] = useState(0);

  const appel = useCallback(
    async (corps?: object, q = "") => {
      const r = await fetch("/api/gestion/photos-site" + q, {
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
    Promise.all([appel(), appel(undefined, "?galeries=1")])
      .then(([p, g]: [Photo[], Galerie[]]) => {
        if (!actif) return;
        setPhotos(p);
        setGaleries(g);
      })
      .catch((e: Error) => actif && setMessage({ ok: false, texte: e.message }));
    return () => {
      actif = false;
    };
  }, [appel, version]);

  const agir = async (corps: object, ok: string) => {
    try {
      await appel(corps);
      setMessage({ ok: true, texte: ok });
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message });
      return false;
    }
  };

  const places: Place[] =
    onglet === "pages"
      ? PAGES
      : [
          ...galeries.map((g) => ({ id: emplacementGalerie(g.id), nom: g.nom, aide: `Page du site : /galerie/${g.id}`, max: PHOTOS_PAR_GALERIE })),
          ...(photos?.some((p) => p.emplacement === "galerie") ? [{ ...ANCIENNE }] : []),
        ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-serif text-4xl font-semibold text-profond">Photos du site</h1>
      <p className="mt-1 text-sm text-doux">Vos vraies photos (téléphone ou Instagram), réduites automatiquement. Une photo nette, lumineuse, sans texte dessus.</p>
      <div className="mt-4 flex rounded-full border border-bordure p-1 font-semibold" role="tablist">
        {(
          [
            ["galeries", "🖼️ Galeries"],
            ["pages", "📄 Photos des pages"],
          ] as const
        ).map(([id, nom]) => (
          <button
            key={id}
            role="tab"
            aria-selected={onglet === id}
            onClick={() => {
              setOnglet(id);
              setOuvert(null);
            }}
            className={`min-h-11 flex-1 rounded-full ${onglet === id ? "bg-profond text-white" : "text-profond"}`}
          >
            {nom}
          </button>
        ))}
      </div>
      {message && <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`}>{message.texte}</p>}
      {!photos ? (
        <p className="mt-8 text-center text-doux">Chargement…</p>
      ) : (
        <div className="mt-4 space-y-2">
          {places.map((e, i) => {
            const galerie = onglet === "galeries" && e.id !== "galerie" ? galeries.find((g) => emplacementGalerie(g.id) === e.id) : undefined;
            return (
              <Bloc
                key={e.id}
                e={e}
                photos={photos.filter((p) => p.emplacement === e.id)}
                ouvert={ouvert === e.id}
                basculer={() => setOuvert(ouvert === e.id ? null : e.id)}
                agir={agir}
                outils={
                  galerie && (
                    <OutilsGalerie
                      g={galerie}
                      premier={i === 0}
                      dernier={i === galeries.length - 1}
                      vide={!photos.some((p) => p.emplacement === e.id)}
                      agir={agir}
                    />
                  )
                }
              />
            );
          })}
          {onglet === "galeries" && galeries.length < MAX_GALERIES && <NouvelleGalerie agir={agir} />}
        </div>
      )}
    </div>
  );
}

function Bloc(props: { e: Place; photos: Photo[]; ouvert: boolean; basculer: () => void; agir: (c: object, ok: string) => Promise<boolean>; outils?: React.ReactNode }) {
  const { e, photos } = props;
  const [accord, setAccord] = useState(false);
  const [legende, setLegende] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const plein = e.max > 1 && photos.length >= e.max;
  return (
    <section className="overflow-hidden rounded-2xl border border-bordure">
      <button onClick={props.basculer} aria-expanded={props.ouvert} className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left">
        <span className="flex shrink-0 -space-x-3">
          {photos.slice(0, 3).map((p) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={p.id} src={urlPhotoSite(p.id)} alt="" loading="lazy" className="h-11 w-11 rounded-lg border-2 border-white object-cover" />
          ))}
          {photos.length === 0 && <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-creme text-lg">📷</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-profond">{e.nom}</span>
          <span className="block text-xs text-doux">
            {photos.length} photo{photos.length > 1 ? "s" : ""}
            {e.max > 1 ? ` sur ${e.max}` : ""}
          </span>
        </span>
        <span className="text-lg text-profond" aria-hidden>
          {props.ouvert ? "▾" : "▸"}
        </span>
      </button>
      {props.ouvert && (
        <div className="border-t border-bordure p-3">
          <p className="text-sm text-doux">{e.aide}</p>
          {photos.length === 0 && (PHOTOS_FOURNIES[e.id as Emplacement]?.length ?? 0) > 1 && (
            <p className="mt-1 text-sm text-doux">Le site montre {PHOTOS_FOURNIES[e.id as Emplacement]!.length} photos d&apos;exemple tant que vous n&apos;en ajoutez pas.</p>
          )}
          {props.outils}
          {photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlPhotoSite(p.id)} alt={p.legende} loading="lazy" className={`rounded-xl object-cover ${e.id === "accueil" ? "h-24 w-40" : "h-20 w-20"}`} />
                  <button
                    onClick={() => window.confirm("Retirer cette photo du site ?") && props.agir({ action: "retirer", id: p.id }, "Photo retirée du site.")}
                    className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white text-lg shadow"
                    aria-label="Retirer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {!plein && (
            <div className="mt-3 rounded-xl bg-creme p-3">
              {e.max > 1 && (
                <input value={legende} onChange={(x) => setLegende(x.target.value)} placeholder="Légende (facultatif), ex. Knotless mi-long" className="mb-2 block w-full rounded-xl border border-bordure bg-white px-3 py-2.5" />
              )}
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={accord} onChange={(x) => setAccord(x.target.checked)} className="mt-0.5 h-5 w-5 accent-[#7E0A4C]" />
                Les personnes visibles sur la photo sont d&apos;accord pour qu&apos;elle soit sur le site.
              </label>
              <label className={`mt-3 inline-flex min-h-12 cursor-pointer items-center rounded-full bg-aza px-5 font-bold text-white ${!accord || envoi ? "pointer-events-none opacity-40" : ""}`}>
                {envoi ? "⏳ Envoi…" : e.max === 1 && photos.length ? "📷 Remplacer la photo" : "📷 Ajouter une photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (x) => {
                    const f = x.target.files?.[0];
                    x.target.value = "";
                    if (!f) return;
                    setEnvoi(true);
                    try {
                      const image = await reduirePhoto(f, e.id === "accueil" ? 1600 : 1200);
                      if (await props.agir({ action: "ajouter", emplacement: e.id, image, legende, accord: true }, "Photo ajoutée : elle sera sur le site dans moins d'une minute.")) setLegende("");
                    } finally {
                      setEnvoi(false);
                    }
                  }}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Renommer, déplacer ou supprimer (si vide) une galerie.
function OutilsGalerie({ g, premier, dernier, vide, agir }: { g: Galerie; premier: boolean; dernier: boolean; vide: boolean; agir: (c: object, ok: string) => Promise<boolean> }) {
  const outil = "min-h-10 rounded-full border border-bordure bg-white px-3 text-sm font-semibold text-profond disabled:opacity-30";
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        className={outil}
        onClick={() => {
          const nom = window.prompt("Nouveau nom de la galerie :", g.nom)?.trim();
          if (nom && nom !== g.nom) agir({ galerie: true, action: "renommer", id: g.id, nom }, `Galerie renommée : « ${nom} ».`);
        }}
      >
        ✏️ Renommer
      </button>
      <button className={outil} disabled={premier} onClick={() => agir({ galerie: true, action: "deplacer", id: g.id, sens: "haut" }, "Ordre des galeries changé.")} aria-label="Monter">
        ↑
      </button>
      <button className={outil} disabled={dernier} onClick={() => agir({ galerie: true, action: "deplacer", id: g.id, sens: "bas" }, "Ordre des galeries changé.")} aria-label="Descendre">
        ↓
      </button>
      <button
        className={outil}
        disabled={!vide}
        title={vide ? "" : "Retirez d'abord ses photos"}
        onClick={() => window.confirm(`Supprimer la galerie « ${g.nom} » ?`) && agir({ galerie: true, action: "supprimer", id: g.id, nom: g.nom }, `Galerie « ${g.nom} » supprimée.`)}
      >
        🗑️ Supprimer
      </button>
    </div>
  );
}

function NouvelleGalerie({ agir }: { agir: (c: object, ok: string) => Promise<boolean> }) {
  const [nom, setNom] = useState("");
  return (
    <div className="flex gap-2 rounded-2xl border border-dashed border-bordure p-3">
      <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} placeholder="Nouvelle galerie, ex. Maquillage mariée" className="min-h-12 min-w-0 flex-1 rounded-xl border border-bordure px-3" />
      <button
        disabled={nom.trim().length < 2}
        onClick={async () => (await agir({ galerie: true, action: "creer", nom }, `Galerie « ${nom.trim()} » créée.`)) && setNom("")}
        className="min-h-12 shrink-0 rounded-full bg-profond px-5 font-bold text-white disabled:opacity-40"
      >
        + Créer
      </button>
    </div>
  );
}
