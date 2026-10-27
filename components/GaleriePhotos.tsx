"use client";

import Image from "next/image";
import { useState } from "react";
import { IconeWhatsApp } from "@/components/Icones";
import { INSTITUT, lienWhatsApp } from "@/lib/institut";
import { clePhoto } from "@/lib/photos-site";
import { texteWhatsApp } from "@/lib/whatsapp";

// Galerie d'une section : toucher une photo l'agrandit ; chaque photo se demande sur
// WhatsApp (l'institut reçoit le lien de la photo) ou se partage à une amie.

type Photo = { src: string; legende: string };

// Le lien partagé est la page de la photo (avec son aperçu), pas l'image elle-même.
const absolu = (src: string) => {
  const cle = clePhoto(src);
  return cle ? `${INSTITUT.site}/photo/${cle}` : INSTITUT.site + src;
};

export function GaleriePhotos({ photos, section }: { photos: Photo[]; section: string }) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  const photo = ouverte === null ? null : photos[ouverte];
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.src} className="relative">
            <button onClick={() => setOuverte(i)} className="block w-full" aria-label={`Agrandir la photo${p.legende ? ` : ${p.legende}` : ""}`}>
              <Image
                src={p.src}
                alt={p.legende || `${section} — Anna Zen Attitude`}
                width={600}
                height={600}
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                loading="lazy"
                className="aspect-square w-full rounded-2xl object-cover"
              />
            </button>
            <a
              href={lienWhatsApp(demande(section, p))}
              target="_blank"
              rel="noopener"
              className="absolute right-2 bottom-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#1a7f45] text-white shadow-lg"
              aria-label="Demander ce service sur WhatsApp"
            >
              <IconeWhatsApp className="h-6 w-6" />
            </a>
            {p.legende && <p className="mt-1 text-sm text-doux">{p.legende}</p>}
          </li>
        ))}
      </ul>

      {photo && (
        <div className="fixed inset-0 z-50 flex flex-col bg-encre/95 p-4" onClick={() => setOuverte(null)} role="dialog" aria-label="Photo agrandie">
          <div className="flex justify-end">
            <button onClick={() => setOuverte(null)} className="h-12 w-12 rounded-full text-3xl text-white" aria-label="Fermer">
              ×
            </button>
          </div>
          <div className="relative min-h-0 flex-1" onClick={(e) => e.stopPropagation()}>
            <Image src={photo.src} alt={photo.legende || section} fill sizes="100vw" className="object-contain" />
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setOuverte((ouverte! - 1 + photos.length) % photos.length)}
                  className="absolute top-1/2 left-0 h-12 w-12 -translate-y-1/2 rounded-full bg-black/40 text-2xl text-white"
                  aria-label="Photo précédente"
                >
                  ‹
                </button>
                <button
                  onClick={() => setOuverte((ouverte! + 1) % photos.length)}
                  className="absolute top-1/2 right-0 h-12 w-12 -translate-y-1/2 rounded-full bg-black/40 text-2xl text-white"
                  aria-label="Photo suivante"
                >
                  ›
                </button>
              </>
            )}
          </div>
          {photo.legende && <p className="mt-3 text-center text-or-clair">{photo.legende}</p>}
          <div className="mx-auto mt-3 flex w-full max-w-md flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
            <a
              href={lienWhatsApp(demande(section, photo))}
              target="_blank"
              rel="noopener"
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#1a7f45] px-4 font-bold text-white"
            >
              <IconeWhatsApp className="h-5 w-5" /> Demander ce service
            </a>
            <button onClick={() => partager(section, photo)} className="min-h-12 rounded-full border border-white/40 px-5 font-bold text-white">
              Partager
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function demande(section: string, p: Photo) {
  return `Bonjour ${INSTITUT.nom}, je voudrais ce service (${section}${p.legende ? ` : ${p.legende}` : ""}). Voici la photo : ${absolu(p.src)}`;
}

async function partager(section: string, p: Photo) {
  const texte = `${p.legende || section} chez ${INSTITUT.nom}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: INSTITUT.nom, text: texte, url: absolu(p.src) });
    } catch {
      // Partage refermé : rien à faire.
    }
    return;
  }
  window.open(`https://wa.me/?text=${texteWhatsApp(`${texte} : ${absolu(p.src)}`)}`, "_blank", "noopener");
}
