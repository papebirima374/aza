"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { reduirePhoto } from "@/lib/client/image";
import { EMPLACEMENTS, urlPhotoSite, type Emplacement } from "@/lib/photos-site";

// « Photos du site » : la direction met ses vraies photos (prises au téléphone, ou
// enregistrées depuis Instagram) aux bons endroits du site. Jamais de banque d'images.

type Photo = { id: string; emplacement: Emplacement; legende: string };

export function PhotosSite() {
  const compte = useCompte();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [version, setVersion] = useState(0);

  const appel = useCallback(
    async (corps?: object) => {
      const r = await fetch("/api/gestion/photos-site", {
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
      .then((p: Photo[]) => actif && setPhotos(p))
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
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message });
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-serif text-4xl font-semibold text-profond">Photos du site</h1>
      <p className="mt-1 text-doux">
        Mettez vos vraies photos : prises au téléphone, ou enregistrées depuis votre Instagram. Elles sont réduites automatiquement et apparaissent sur
        le site en moins d&apos;une minute. Une photo nette, lumineuse, sans texte dessus.
      </p>
      {message && <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`}>{message.texte}</p>}
      {!photos ? (
        <p className="mt-8 text-center text-doux">Chargement…</p>
      ) : (
        <div className="mt-6 space-y-4">
          {EMPLACEMENTS.map((e) => (
            <Bloc key={e.id} e={e} photos={photos.filter((p) => p.emplacement === e.id)} agir={agir} />
          ))}
        </div>
      )}
    </div>
  );
}

function Bloc({ e, photos, agir }: { e: (typeof EMPLACEMENTS)[number]; photos: Photo[]; agir: (c: object, ok: string) => Promise<void> }) {
  const [accord, setAccord] = useState(false);
  const [legende, setLegende] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const plein = e.max > 1 && photos.length >= e.max;
  return (
    <section className="rounded-2xl border border-bordure p-4">
      <h2 className="font-serif text-2xl font-semibold text-profond">{e.nom}</h2>
      <p className="text-sm text-doux">
        {e.aide} {e.max > 1 ? `(${photos.length}/${e.max})` : ""}
      </p>
      {photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlPhotoSite(p.id)} alt={p.legende} className={`rounded-xl object-cover ${e.id === "accueil" ? "h-28 w-48" : "h-24 w-24"}`} />
              <button
                onClick={() => window.confirm("Retirer cette photo du site ?") && agir({ action: "retirer", id: p.id }, "Photo retirée du site.")}
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
                  await agir({ action: "ajouter", emplacement: e.id, image, legende, accord: true }, "Photo ajoutée : elle sera sur le site dans moins d'une minute.");
                  setLegende("");
                } finally {
                  setEnvoi(false);
                }
              }}
            />
          </label>
        </div>
      )}
    </section>
  );
}
