"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { formatPrix } from "@/lib/catalogue";
import { reduirePhoto } from "@/lib/client/image";
import { TAILLES, TAILLES_DEFAUT, type ModeleCouture } from "@/lib/couture";

// Écran « Collection » : la direction ajoute ses modèles Anna Zen Couture (photos, nom,
// prix, tailles, couleurs, description) et ils apparaissent aussitôt dans la boutique.

type Modele = ModeleCouture & { photoIds: string[] };
type Brouillon = { nom: string; prix: string; description: string; tailles: string[]; couleurs: string };

const bouton = "min-h-12 rounded-full px-5 font-bold disabled:opacity-40";
const champ = "mt-1 block w-full rounded-xl border border-bordure px-4 py-2.5 font-normal";

export function GestionCollection() {
  const compte = useCompte();
  const direction = compte.role === "direction";
  const [liste, setListe] = useState<{ modeles: Modele[]; guide: string } | null>(null);
  const [version, setVersion] = useState(0);
  const [ouvert, setOuvert] = useState<string | "nouveau" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [filtre, setFiltre] = useState("");

  const appel = useCallback(
    async (corps?: object) => {
      const r = await fetch("/api/gestion/collection", {
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
      .then((j) => actif && setListe(j))
      .catch((e: Error) => actif && setMessage({ ok: false, texte: e.message }));
    return () => {
      actif = false;
    };
  }, [appel, version]);

  const agir = async (corps: object, ok: string) => {
    setMessage(null);
    try {
      const r = await appel(corps);
      setVersion((v) => v + 1);
      if (ok) setMessage({ ok: true, texte: ok });
      return r;
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message });
      return null;
    }
  };

  const modeles = (liste?.modeles ?? []).filter((m) => !filtre || `${m.nom} ${m.ref}`.toLowerCase().includes(filtre.toLowerCase()));
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/gestion/commandes" className="text-sm font-semibold text-aza hover:underline">
        ← Commandes
      </Link>
      <h1 className="mt-2 font-serif text-4xl font-semibold text-profond">👗 Collection</h1>
      <p className="text-sm text-doux">
        Les modèles Anna Zen Couture de la boutique. Ajoutez un modèle avec ses photos : il est en ligne aussitôt.{" "}
        <a href="/boutique/couture" target="_blank" rel="noopener" className="font-semibold text-aza underline">
          Voir la boutique
        </a>
      </p>

      {message && <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`}>{message.texte}</p>}

      {direction && ouvert !== "nouveau" && (
        <button onClick={() => setOuvert("nouveau")} className={`${bouton} mt-4 bg-aza text-white`}>
          + Nouveau modèle
        </button>
      )}
      {ouvert === "nouveau" && (
        <Fiche
          titre="Nouveau modèle"
          depart={{ nom: "", prix: "", description: "", tailles: TAILLES_DEFAUT, couleurs: "" }}
          prixModifiable
          annuler={() => setOuvert(null)}
          enregistrer={async (b) => {
            const r = await agir({ action: "creer", ...corps(b) }, "");
            if (r) {
              setOuvert(r.id);
              setMessage({ ok: true, texte: `Modèle ${r.ref} créé. Ajoutez maintenant ses photos.` });
            }
          }}
        />
      )}

      {liste && <GuideTailles texte={liste.guide} enregistrer={(texte) => agir({ action: "guide-tailles", texte }, "Tableau des tailles enregistré.")} />}

      <input type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Chercher un modèle…" className="mt-5 w-full rounded-xl border border-bordure px-4 py-3" />
      {!liste ? (
        <p className="mt-8 text-center text-doux">Chargement…</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {modeles.map((m) => (
            <li key={m.id} className={`rounded-2xl border ${ouvert === m.id ? "border-2 border-profond" : "border-bordure"}`}>
              <button onClick={() => setOuvert(ouvert === m.id ? null : m.id)} className="flex w-full items-center gap-3 p-3 text-left">
                {m.photos[0] ? (
                  <Image src={m.photos[0]} alt="" width={60} height={90} unoptimized className="h-16 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-creme">👗</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{m.nom}</span>
                  <span className="block text-sm text-doux">
                    {m.ref} · <span className="prix">{formatPrix(m.prix)}</span> · {m.photos.length} photo{m.photos.length > 1 ? "s" : ""}
                  </span>
                </span>
                {m.masque && <span className="rounded-full bg-bordure px-2 py-0.5 text-xs font-bold text-doux">Masqué</span>}
              </button>
              {ouvert === m.id && (
                <div className="border-t border-bordure p-3">
                  <Photos m={m} agir={agir} />
                  <Fiche
                    titre=""
                    depart={{ nom: m.nom, prix: String(m.prix), description: m.description, tailles: m.tailles, couleurs: m.couleurs.join(", ") }}
                    prixModifiable={direction}
                    annuler={() => setOuvert(null)}
                    enregistrer={(b) => agir({ action: "modifier", id: m.id, ...corps(b, direction) }, `${m.ref} enregistré.`).then(() => undefined)}
                  />
                  {direction && (
                    <button
                      onClick={() => agir({ action: "masquer", id: m.id, masque: !m.masque }, m.masque ? `${m.ref} est de nouveau en vente.` : `${m.ref} retiré de la boutique.`)}
                      className="mt-3 text-sm font-semibold text-doux underline"
                    >
                      {m.masque ? "Remettre en vente" : "Retirer de la boutique (masquer)"}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function corps(b: Brouillon, avecPrix = true) {
  return {
    nom: b.nom,
    ...(avecPrix ? { prix: Number(b.prix.replace(/\s/g, "")) } : {}),
    description: b.description,
    tailles: b.tailles,
    couleurs: b.couleurs.split(",").map((c) => c.trim()).filter(Boolean),
  };
}

function Fiche(props: { titre: string; depart: Brouillon; prixModifiable: boolean; annuler: () => void; enregistrer: (b: Brouillon) => Promise<void> }) {
  const [b, setB] = useState(props.depart);
  const [envoi, setEnvoi] = useState(false);
  const pret = b.nom.trim().length >= 2 && b.tailles.length > 0 && (!props.prixModifiable || Number(b.prix.replace(/\s/g, "")) > 0) && !envoi;
  return (
    <div className={props.titre ? "mt-4 rounded-2xl border-2 border-profond p-4" : "mt-4"}>
      {props.titre && <h2 className="font-serif text-2xl font-semibold text-profond">{props.titre}</h2>}
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <label className="text-sm font-semibold">
          Nom du modèle
          <input value={b.nom} onChange={(e) => setB({ ...b, nom: e.target.value })} placeholder="ex. Robe Dijah" className={champ} />
        </label>
        <label className="text-sm font-semibold">
          Prix (F)
          <input inputMode="numeric" value={b.prix} disabled={!props.prixModifiable} onChange={(e) => setB({ ...b, prix: e.target.value })} className={`${champ} text-right disabled:bg-creme`} />
        </label>
      </div>
      <fieldset className="mt-3">
        <legend className="text-sm font-semibold">Tailles proposées</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {TAILLES.map((t) => {
            const oui = b.tailles.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={oui}
                onClick={() => setB({ ...b, tailles: oui ? b.tailles.filter((x) => x !== t) : TAILLES.filter((x) => x === t || b.tailles.includes(x)) })}
                className={`min-h-11 rounded-full border-2 px-3 text-sm font-semibold ${oui ? "border-profond bg-profond text-white" : "border-bordure"}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="mt-3 block text-sm font-semibold">
        Couleurs <span className="font-normal text-doux">(facultatif, séparées par des virgules)</span>
        <input value={b.couleurs} onChange={(e) => setB({ ...b, couleurs: e.target.value })} placeholder="ex. Chartreuse, Noir, Bordeaux" className={champ} />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        Description <span className="font-normal text-doux">(tissu, coupe, entretien…)</span>
        <textarea value={b.description} onChange={(e) => setB({ ...b, description: e.target.value })} rows={4} className={champ} />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={!pret}
          onClick={async () => {
            setEnvoi(true);
            await props.enregistrer(b);
            setEnvoi(false);
          }}
          className={`${bouton} bg-profond text-white`}
        >
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </button>
        {props.titre && (
          <button onClick={props.annuler} className={`${bouton} border border-bordure text-profond`}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}

function Photos({ m, agir }: { m: Modele; agir: (corps: object, ok: string) => Promise<unknown> }) {
  const [envoi, setEnvoi] = useState("");
  return (
    <div>
      <p className="text-sm font-semibold">Photos</p>
      {m.photoIds.length === 0 && m.photos.length > 0 && <p className="text-xs text-doux">Photo d&apos;origine. Dès que vous ajoutez vos photos, elles la remplacent.</p>}
      <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {m.photoIds.map((id, i) => (
          <li key={id} className="relative">
            <Image src={`/api/boutique/photo/${id}`} alt="" width={120} height={180} unoptimized className="aspect-[2/3] w-full rounded-lg object-cover" />
            {i === 0 ? (
              <span className="absolute top-1 left-1 rounded-full bg-profond px-1.5 text-[10px] font-bold text-white">1re</span>
            ) : (
              <button onClick={() => agir({ action: "photo-premiere", id: m.id, photo: id }, "")} className="absolute top-1 left-1 rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-profond" aria-label="Mettre en premier">
                ⭐ 1re
              </button>
            )}
            <button
              onClick={() => window.confirm("Retirer cette photo ?") && agir({ action: "photo-retrait", id: m.id, photo: id }, "Photo retirée.")}
              className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm"
              aria-label="Retirer la photo"
            >
              ✕
            </button>
          </li>
        ))}
        {m.photoIds.length < 10 && (
          <li>
            <label className="flex aspect-[2/3] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-bordure text-center text-xs font-semibold text-profond">
              <span className="text-2xl">📷</span>
              {envoi || "Ajouter"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                disabled={Boolean(envoi)}
                onChange={async (e) => {
                  const fichiers = [...(e.target.files ?? [])].slice(0, 10 - m.photoIds.length);
                  e.target.value = "";
                  for (const [i, f] of fichiers.entries()) {
                    setEnvoi(`${i + 1}/${fichiers.length}…`);
                    try {
                      await agir({ action: "photo-ajout", id: m.id, image: await reduirePhoto(f, 1400) }, i === fichiers.length - 1 ? "Photos ajoutées." : "");
                    } catch {
                      // le message d'erreur est déjà affiché
                    }
                  }
                  setEnvoi("");
                }}
              />
            </label>
          </li>
        )}
      </ul>
      <p className="mt-1 text-xs text-doux">La 1re photo est celle de la vitrine ; la 2e apparaît au survol. 10 photos au maximum.</p>
    </div>
  );
}

function GuideTailles({ texte, enregistrer }: { texte: string; enregistrer: (t: string) => Promise<unknown> }) {
  const [t, setT] = useState(texte);
  return (
    <details className="mt-4 rounded-2xl border border-bordure p-4">
      <summary className="cursor-pointer font-semibold">📏 Tableau des tailles {texte ? "" : "(pas encore rempli)"}</summary>
      <p className="mt-2 text-sm text-doux">Affiché sur chaque modèle. Écrivez les mesures de l&apos;atelier, une taille par ligne (ex. « M : poitrine 92 cm, taille 74 cm, hanches 100 cm »).</p>
      <textarea value={t} onChange={(e) => setT(e.target.value)} rows={6} className={champ} />
      <button onClick={() => enregistrer(t)} className={`${bouton} mt-2 bg-profond text-white`}>
        Enregistrer le tableau
      </button>
    </details>
  );
}
