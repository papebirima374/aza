"use client";

import { useEffect, useRef, useState } from "react";
import { recadrerCarre } from "@/lib/client/image";

// La photo d'une prestation ou d'un produit (écran Catalogue) : choisir la photo, la
// recadrer en carré (glisser pour placer, curseur pour zoomer), puis l'envoyer allégée.

const CADRE = 280;

export function PhotoPrestation(props: {
  nom: string;
  actuelle?: string;
  fermer: () => void;
  enregistrer: (image: string) => Promise<boolean>;
  retirer: () => Promise<boolean>;
}) {
  const [accord, setAccord] = useState(false);
  const [img, setImg] = useState<{ bitmap: ImageBitmap; url: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [envoi, setEnvoi] = useState(false);
  const glisse = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => () => {
    if (img) URL.revokeObjectURL(img.url);
  }, [img]);

  const echelle = img ? (CADRE / Math.min(img.bitmap.width, img.bitmap.height)) * zoom : 1;
  // La photo couvre toujours tout le cadre : on ne laisse jamais de bord vide.
  const borner = (x: number, y: number, e = echelle) =>
    img ? { x: Math.min(0, Math.max(CADRE - img.bitmap.width * e, x)), y: Math.min(0, Math.max(CADRE - img.bitmap.height * e, y)) } : { x, y };

  async function choisir(f: File) {
    const bitmap = await createImageBitmap(f);
    const e = CADRE / Math.min(bitmap.width, bitmap.height);
    setImg({ bitmap, url: URL.createObjectURL(f) });
    setZoom(1);
    setPos({ x: (CADRE - bitmap.width * e) / 2, y: (CADRE - bitmap.height * e) / 2 });
  }

  function zoomer(z: number) {
    if (!img) return;
    const nouvelle = (CADRE / Math.min(img.bitmap.width, img.bitmap.height)) * z;
    // On zoome autour du centre du cadre.
    const cx = (CADRE / 2 - pos.x) / echelle;
    const cy = (CADRE / 2 - pos.y) / echelle;
    setZoom(z);
    setPos(borner(CADRE / 2 - cx * nouvelle, CADRE / 2 - cy * nouvelle, nouvelle));
  }

  async function valider() {
    if (!img) return;
    setEnvoi(true);
    const image = recadrerCarre(img.bitmap, -pos.x / echelle, -pos.y / echelle, CADRE / echelle);
    if (await props.enregistrer(image)) props.fermer();
    setEnvoi(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-encre/40 sm:items-center" onClick={props.fermer}>
      <div className="max-h-[95dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Photo de ${props.nom}`}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold text-profond">Photo : {props.nom}</h2>
          <button onClick={props.fermer} className="h-11 w-11 shrink-0 rounded-full text-2xl text-doux" aria-label="Fermer">
            ×
          </button>
        </div>

        {!img ? (
          <>
            {props.actuelle && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={props.actuelle} alt="" className="mx-auto mt-3 h-40 w-40 rounded-2xl object-cover" />
            )}
            <p className="mt-3 text-sm text-doux">Une vraie photo de l&apos;institut, nette et lumineuse. Elle est recadrée en carré et allégée avant l&apos;envoi.</p>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={accord} onChange={(x) => setAccord(x.target.checked)} className="mt-0.5 h-5 w-5 accent-[#7E0A4C]" />
              Les personnes visibles sur la photo sont d&apos;accord pour qu&apos;elle soit sur le site.
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <label className={`inline-flex min-h-12 cursor-pointer items-center rounded-full bg-aza px-5 font-bold text-white ${!accord ? "pointer-events-none opacity-40" : ""}`}>
                📷 {props.actuelle ? "Changer la photo" : "Choisir une photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(x) => {
                    const f = x.target.files?.[0];
                    x.target.value = "";
                    if (f) choisir(f).catch(() => window.alert("Cette photo ne s'ouvre pas. Essayez-en une autre."));
                  }}
                />
              </label>
              {props.actuelle && (
                <button
                  disabled={envoi}
                  onClick={async () => {
                    if (!window.confirm("Retirer la photo de cette prestation ?")) return;
                    setEnvoi(true);
                    if (await props.retirer()) props.fermer();
                    setEnvoi(false);
                  }}
                  className="min-h-12 rounded-full border border-bordure px-5 font-semibold text-profond"
                >
                  Retirer la photo
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-doux">Glissez la photo pour la placer, zoomez avec le curseur.</p>
            <div
              className="relative mx-auto mt-3 touch-none overflow-hidden rounded-2xl bg-creme select-none"
              style={{ width: CADRE, height: CADRE }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                glisse.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
              }}
              onPointerMove={(e) => glisse.current && setPos(borner(e.clientX - glisse.current.x, e.clientY - glisse.current.y))}
              onPointerUp={() => (glisse.current = null)}
              onPointerCancel={() => (glisse.current = null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{ left: pos.x, top: pos.y, width: img.bitmap.width * echelle, height: img.bitmap.height * echelle }}
              />
            </div>
            <label className="mx-auto mt-4 flex max-w-xs items-center gap-3 text-sm font-semibold text-profond">
              ➖
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => zoomer(Number(e.target.value))} className="h-12 flex-1 accent-[#7E0A4C]" aria-label="Zoom" />
              ➕
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={envoi} onClick={valider} className="min-h-12 flex-1 rounded-full bg-aza px-5 font-bold text-white disabled:opacity-40">
                {envoi ? "⏳ Envoi…" : "✅ Enregistrer la photo"}
              </button>
              <button disabled={envoi} onClick={() => setImg(null)} className="min-h-12 rounded-full border border-bordure px-5 font-semibold text-profond">
                Autre photo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
