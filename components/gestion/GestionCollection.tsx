"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { formatPrix } from "@/lib/catalogue";
import { reduirePhoto } from "@/lib/client/image";
import { TAILLES, TAILLES_DEFAUT, type ModeleCouture } from "@/lib/couture";

// Écran « Collection » : la direction ajoute ses modèles Anna Zen Couture (photos, nom,
// prix, tailles, couleurs, description) et ils apparaissent aussitôt dans la boutique.
// La liste est une grille de photos (filtres, recherche, tri) ; chaque modèle s'ouvre sur
// sa propre page (/gestion/collection/C-07), le nouveau modèle sur /gestion/collection/nouveau.

type Modele = ModeleCouture & { photoIds: string[] };
type Brouillon = { nom: string; prix: string; description: string; tailles: string[]; couleurs: string };
type Message = { ok: boolean; texte: string } | null;

const bouton = "min-h-12 rounded-full px-5 font-bold disabled:opacity-40";
const champ = "mt-1 block w-full rounded-xl border border-bordure px-4 py-2.5 font-normal";

/** Lecture de la collection et actions, partagées par la grille et la page d'un modèle. */
function useCollection() {
  const compte = useCompte();
  const [liste, setListe] = useState<{ modeles: Modele[]; guide: string } | null>(null);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<Message>(null);

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
  return { liste, agir, message, setMessage, direction: compte.role === "direction" };
}

function Bandeau({ message }: { message: Message }) {
  if (!message) return null;
  return <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`}>{message.texte}</p>;
}

const FILTRES = [
  ["tous", "Tous"],
  ["en-vente", "En vente"],
  ["sans-photo", "📷 Photos à ajouter"],
  ["masques", "Masqués"],
] as const;
const TRIS = [
  ["recents", "Nouveautés"],
  ["prix", "Prix"],
  ["nom", "Nom"],
] as const;

export function GestionCollection() {
  const { liste, agir, message, direction } = useCollection();
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number][0]>("tous");
  const [tri, setTri] = useState<(typeof TRIS)[number][0]>("recents");
  const [recherche, setRecherche] = useState("");
  const [guide, setGuide] = useState(false);

  const tous = useMemo(() => liste?.modeles ?? [], [liste]);
  const compte = (f: string) =>
    tous.filter((m) => (f === "en-vente" ? !m.masque : f === "masques" ? m.masque : f === "sans-photo" ? m.photoIds.length === 0 : true)).length;
  const visibles = tous
    .filter((m) => (filtre === "en-vente" ? !m.masque : filtre === "masques" ? m.masque : filtre === "sans-photo" ? m.photoIds.length === 0 : true))
    .filter((m) => !recherche.trim() || `${m.nom} ${m.ref}`.toLowerCase().includes(recherche.trim().toLowerCase()))
    .sort((a, b) => (tri === "prix" ? a.prix - b.prix : tri === "nom" ? a.nom.localeCompare(b.nom) : b.ordre - a.ordre));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-profond">👗 Collection</h1>
          <p className="text-sm text-doux">
            {tous.length} modèles Anna Zen Couture ·{" "}
            <a href="/boutique/couture" target="_blank" rel="noopener" className="font-semibold text-aza underline">
              voir la boutique
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setGuide(!guide)} className="min-h-12 rounded-full border border-bordure px-4 text-sm font-semibold text-profond">
            📏 Tableau des tailles
          </button>
          {direction && (
            <Link href="/gestion/collection/nouveau" className={`${bouton} flex items-center bg-aza text-white`}>
              + Nouveau modèle
            </Link>
          )}
        </div>
      </div>
      <Bandeau message={message} />
      {guide && liste && <GuideTailles texte={liste.guide} enregistrer={(texte) => agir({ action: "guide-tailles", texte }, "Tableau des tailles enregistré.")} />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher (nom ou C-07)…"
          className="min-w-0 flex-1 basis-56 rounded-full border border-bordure px-4 py-2.5"
        />
        <select value={tri} onChange={(e) => setTri(e.target.value as typeof tri)} aria-label="Trier" className="rounded-full border border-bordure bg-white px-4 py-2.5 text-sm">
          {TRIS.map(([id, nom]) => (
            <option key={id} value={id}>
              Trier : {nom}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrer">
        {FILTRES.map(([id, nom]) => (
          <button
            key={id}
            aria-pressed={filtre === id}
            onClick={() => setFiltre(id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${filtre === id ? "bg-profond text-white" : "bg-creme text-profond"}`}
          >
            {nom} ({compte(id)})
          </button>
        ))}
      </div>

      {!liste ? (
        <p className="mt-8 text-center text-doux">Chargement…</p>
      ) : visibles.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-bordure p-6 text-center text-doux">Aucun modèle ici.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {visibles.map((m) => (
            <li key={m.id}>
              <Link href={`/gestion/collection/${m.ref}`} className="group block">
                <span className="relative block overflow-hidden rounded-xl bg-creme">
                  {m.photos[0] ? (
                    <Image src={m.photos[0]} alt="" width={240} height={360} loading="lazy" className={`aspect-[2/3] w-full object-cover ${m.masque ? "opacity-40" : ""}`} />
                  ) : (
                    <span className="flex aspect-[2/3] items-center justify-center text-3xl">👗</span>
                  )}
                  {m.masque && <span className="absolute top-1 left-1 rounded-full bg-encre/80 px-2 py-0.5 text-[10px] font-bold text-white">Masqué</span>}
                  {!m.masque && m.photoIds.length === 0 && <span className="absolute top-1 left-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-profond">📷</span>}
                </span>
                <span className="mt-1 block truncate text-sm font-semibold group-hover:text-aza">{m.nom}</span>
                <span className="prix block text-xs text-doux">
                  {m.ref} · {formatPrix(m.prix)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-doux">📷 = encore la photo d&apos;origine : touchez le modèle pour ajouter vos photos.</p>
    </div>
  );
}

/** Page d'un modèle : photos, fiche, retrait de la boutique. */
export function EditeurModele({ reference }: { reference: string }) {
  const { liste, agir, message, direction } = useCollection();
  const router = useRouter();
  const m = liste?.modeles.find((x) => x.ref === reference.toUpperCase());
  const i = liste && m ? liste.modeles.indexOf(m) : -1;
  const voisin = (d: number) => (liste && i >= 0 ? liste.modeles[i + d] : undefined);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/gestion/collection" className="text-sm font-semibold text-aza hover:underline inline-block py-2">
          ← Collection
        </Link>
        {m && (
          <span className="flex gap-2 text-sm">
            {voisin(-1) && (
              <Link href={`/gestion/collection/${voisin(-1)!.ref}`} className="rounded-full border border-bordure px-3 py-1.5 font-semibold text-profond">
                ‹ {voisin(-1)!.ref}
              </Link>
            )}
            {voisin(1) && (
              <Link href={`/gestion/collection/${voisin(1)!.ref}`} className="rounded-full border border-bordure px-3 py-1.5 font-semibold text-profond">
                {voisin(1)!.ref} ›
              </Link>
            )}
          </span>
        )}
      </div>
      {!liste ? (
        <p className="mt-8 text-center text-doux">Chargement…</p>
      ) : !m ? (
        <p className="mt-8 text-center text-doux">Modèle introuvable.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="font-serif text-3xl font-semibold text-profond">{m.nom}</h1>
            <span className="text-sm text-doux">
              {m.ref} · <span className="prix">{formatPrix(m.prix)}</span> {m.masque ? "· Masqué" : ""}
            </span>
          </div>
          <a href={`/boutique/couture/${m.ref}`} target="_blank" rel="noopener" className="inline-block py-2 text-sm font-semibold text-aza underline">
            Voir sur le site
          </a>
          <Bandeau message={message} />
          <div className="mt-4 rounded-2xl border border-bordure p-4">
            <Photos m={m} agir={agir} />
          </div>
          <Fiche
            key={m.id}
            titre=""
            depart={{ nom: m.nom, prix: String(m.prix), description: m.description, tailles: m.tailles, couleurs: m.couleurs.join(", ") }}
            prixModifiable={direction}
            annuler={() => router.push("/gestion/collection")}
            enregistrer={(b) => agir({ action: "modifier", id: m.id, ...corps(b, direction) }, `${m.ref} enregistré.`).then(() => undefined)}
          />
          {direction && (
            <button
              onClick={() => agir({ action: "masquer", id: m.id, masque: !m.masque }, m.masque ? `${m.ref} est de nouveau en vente.` : `${m.ref} retiré de la boutique.`)}
              className="mt-6 min-h-12 rounded-full border border-bordure px-5 text-sm font-semibold text-doux"
            >
              {m.masque ? "Remettre en vente" : "Retirer de la boutique (masquer)"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Nouveau modèle : la fiche, puis la page du modèle pour ajouter les photos. */
export function NouveauModele() {
  const { agir, message, setMessage, direction } = useCollection();
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/gestion/collection" className="text-sm font-semibold text-aza hover:underline inline-block py-2">
        ← Collection
      </Link>
      {!direction ? (
        <p className="mt-6 text-doux">Seule la direction crée un modèle (il a un prix).</p>
      ) : (
        <>
          <Bandeau message={message} />
          <Fiche
            titre="Nouveau modèle"
            depart={{ nom: "", prix: "", description: "", tailles: TAILLES_DEFAUT, couleurs: "" }}
            prixModifiable
            annuler={() => router.push("/gestion/collection")}
            enregistrer={async (b) => {
              const r = await agir({ action: "creer", ...corps(b) }, "");
              if (r) {
                setMessage({ ok: true, texte: `Modèle ${r.ref} créé. Ajoutez maintenant ses photos.` });
                router.push(`/gestion/collection/${r.ref}`);
              }
            }}
          />
          <p className="mt-3 text-sm text-doux">Après « Enregistrer », la page du modèle s&apos;ouvre : ajoutez-y ses photos.</p>
        </>
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
            <Image src={`/api/boutique/photo/${id}`} alt="" width={120} height={180} className="aspect-[2/3] w-full rounded-lg object-cover" />
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
    <div className="mt-4 rounded-2xl border border-bordure p-4">
      <p className="font-semibold">📏 Tableau des tailles {texte ? "" : "(pas encore rempli)"}</p>
      <p className="mt-2 text-sm text-doux">Affiché sur chaque modèle. Écrivez les mesures de l&apos;atelier, une taille par ligne (ex. « M : poitrine 92 cm, taille 74 cm, hanches 100 cm »).</p>
      <textarea value={t} onChange={(e) => setT(e.target.value)} rows={6} className={champ} />
      <button onClick={() => enregistrer(t)} className={`${bouton} mt-2 bg-profond text-white`}>
        Enregistrer le tableau
      </button>
    </div>
  );
}
