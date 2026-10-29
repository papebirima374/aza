"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { ImporterListe } from "@/components/gestion/ImporterListe";
import { PhotoPrestation } from "@/components/gestion/PhotoPrestation";
import { urlPhotoSite } from "@/lib/photos-site";
import { formatPrix, UNIVERS, type Famille, type Prestation, type UniversId } from "@/lib/catalogue";
import { rafraichirCatalogue, useCatalogue } from "@/lib/client/catalogue";
import { correspond } from "@/lib/recherche";
import { peut } from "@/lib/acces";

// Écran « Catalogue » (direction) : changer un prix, masquer une ligne, ajouter une
// prestation ou un produit. La plaquette reste la base ; les changements s'appliquent
// partout (site, réservation, caisse) en moins d'une minute, et chacun est tracé.

type Ligne = Prestation & { masque?: boolean; ajoute?: boolean; horsSite?: boolean };

// Photos des prestations (direction, manager) : la vignette de chaque ligne, et l'écran pour la changer.
const Photos = createContext<{ photos: Record<string, string>; ouvrir: (p: Ligne) => void } | null>(null);

export function Catalogue() {
  const compte = useCompte();
  const cat = useCatalogue(true);
  const [requete, setRequete] = useState("");
  const [ouvertes, setOuvertes] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const gerePhotos = compte.role === "direction" || compte.role === "manager";
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [photoDe, setPhotoDe] = useState<Ligne | null>(null);

  const appelPhotos = useCallback(
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
  const lirePhotos = useCallback(async () => {
    const liste = (await appelPhotos()) as { id: string; emplacement: string; prestation?: string }[];
    setPhotos(Object.fromEntries(liste.filter((x) => x.emplacement === "prestation" && x.prestation).map((x) => [x.prestation!, x.id])));
  }, [appelPhotos]);
  useEffect(() => {
    if (!gerePhotos) return;
    const t = setTimeout(() => lirePhotos().catch(() => {}), 0);
    return () => clearTimeout(t);
  }, [gerePhotos, lirePhotos]);

  async function photo(corps: object, ok: string) {
    try {
      await appelPhotos(corps);
      await lirePhotos();
      setMessage({ ok: true, texte: ok });
      return true;
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message });
      return false;
    }
  }

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), message.ok ? 3000 : 8000);
    return () => clearTimeout(t);
  }, [message]);

  async function envoyer(corps: object, ok: string): Promise<boolean> {
    try {
      const r = await fetch("/api/gestion/catalogue", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: JSON.stringify(corps),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur ?? "Erreur");
      await rafraichirCatalogue();
      setMessage({ ok: true, texte: ok });
      return true;
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message });
      return false;
    }
  }

  if (!peut(compte, "catalogue")) return <p className="p-8 text-center text-doux">Réservé à la direction.</p>;
  const recherche = requete.trim().length >= 2;

  return (
    <Photos.Provider value={gerePhotos ? { photos, ouvrir: setPhotoDe } : null}>
      {photoDe && (
        <PhotoPrestation
          nom={photoDe.nom}
          actuelle={photos[photoDe.id] ? urlPhotoSite(photos[photoDe.id]) : undefined}
          fermer={() => setPhotoDe(null)}
          enregistrer={(image) =>
            photo({ action: "ajouter", emplacement: "prestation", prestation: photoDe.id, image, accord: true }, `Photo de « ${photoDe.nom} » enregistrée : elle sera sur le site dans moins d'une minute.`)
          }
          retirer={() => photo({ action: "retirer", id: photos[photoDe.id] }, `Photo de « ${photoDe.nom} » retirée.`)}
        />
      )}
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-4xl font-semibold text-profond">Catalogue et prix</h1>
          <Link href="/gestion/photos" className="min-h-11 rounded-full border border-bordure px-4 py-2.5 text-sm font-bold text-profond">
            🖼️ Photos du site
          </Link>
          <Link href="/gestion/collection" className="min-h-11 rounded-full border border-bordure px-4 py-2.5 text-sm font-bold text-profond">
            👗 Collection Couture
          </Link>
        </div>
        <p className="mt-1 text-doux">
          Changez un prix, masquez une ligne ou ajoutez une prestation ou un produit. C&apos;est appliqué partout (site, réservation, caisse) en
          moins d&apos;une minute. Décochez « Sur le site » pour qu&apos;une ligne reste en caisse sans paraître sur le site.
        </p>

        <div className="sticky top-[5.75rem] z-20 mt-3 min-h-0 sm:top-14">
          {message && (
            <p className={`rounded-xl p-3 text-sm font-semibold ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`} role="status">
              {message.texte}
            </p>
          )}
        </div>

        <input
          type="search"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Chercher une prestation ou un produit…"
          className="mt-4 w-full rounded-xl border border-bordure px-4 py-3"
        />

        <ImporterListe />

        <div className="mt-4 space-y-5">
          {[...UNIVERS.map((u) => ({ id: u.id, nom: u.nom, boutique: false })), { id: "boutique", nom: "Produits (vente en caisse et boutique)", boutique: true }].map((u) => {
            const familles = cat.familles
              .filter((f) => (u.boutique ? Boolean(f.boutique) : !f.boutique && f.univers === u.id))
              .map((f) => ({ ...f, prestations: f.prestations.filter((p) => !recherche || correspond(`${p.nom} ${f.nom}`, requete)) }))
              .filter((f) => !recherche || f.prestations.length > 0);
            if (familles.length === 0 && recherche) return null;
            return (
              <div key={u.id}>
                <p className="text-xs font-bold tracking-wide text-doux uppercase">{u.nom}</p>
                {familles.map((f) => (
                  <BlocFamille
                    key={f.id}
                    f={f}
                    ouverte={recherche || ouvertes.includes(f.id)}
                    basculer={() => setOuvertes((o) => (o.includes(f.id) ? o.filter((x) => x !== f.id) : [...o, f.id]))}
                    envoyer={envoyer}
                  />
                ))}
                {!recherche && <NouvelleFamille univers={u.boutique ? undefined : (u.id as UniversId)} nomGroupe={u.nom} envoyer={envoyer} />}
              </div>
            );
          })}
        </div>
      </div>
    </Photos.Provider>
  );
}

// Une nouvelle famille dans ce groupe (ex. « Maquillage » dans L'Institut) ; on y ajoute ensuite ses lignes.
function NouvelleFamille({ univers, nomGroupe, envoyer }: { univers?: UniversId; nomGroupe: string; envoyer: (c: object, ok: string) => Promise<boolean> }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [choix, setChoix] = useState<UniversId>(univers ?? "institut");
  const [envoi, setEnvoi] = useState(false);
  if (!ouvert)
    return (
      <button onClick={() => setOuvert(true)} className="mt-2 min-h-11 w-full rounded-xl border border-dashed border-bordure px-3 text-left text-sm font-bold text-profond">
        + Nouvelle famille {univers ? `dans ${nomGroupe}` : "de produits"}
      </button>
    );
  return (
    <div className="mt-2 rounded-xl border border-dashed border-bordure p-3">
      <p className="text-sm font-bold text-profond">Nouvelle famille {univers ? `dans ${nomGroupe}` : "de produits"}</p>
      <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} placeholder="ex. Maquillage" className="mt-2 min-h-11 w-full rounded-lg border border-bordure px-3" autoFocus />
      {!univers && (
        <select value={choix} onChange={(e) => setChoix(e.target.value as UniversId)} className="mt-2 min-h-11 w-full rounded-lg border border-bordure bg-white px-2" aria-label="Rayon">
          {UNIVERS.map((u) => (
            <option key={u.id} value={u.id}>
              Rayon : {u.nom}
            </option>
          ))}
        </select>
      )}
      <div className="mt-2 flex gap-2">
        <button
          disabled={nom.trim().length < 2 || envoi}
          onClick={async () => {
            setEnvoi(true);
            const ok = await envoyer({ action: "famille", nom, univers: univers ?? choix, boutique: !univers }, `Famille « ${nom.trim()} » créée : ouvrez-la pour y ajouter ses lignes.`);
            setEnvoi(false);
            if (ok) {
              setNom("");
              setOuvert(false);
            }
          }}
          className="min-h-11 rounded-full bg-profond px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          Créer la famille
        </button>
        <button onClick={() => setOuvert(false)} className="min-h-11 rounded-full border border-bordure px-4 text-sm font-semibold text-profond">
          Annuler
        </button>
      </div>
    </div>
  );
}

const PAGE = 25;
const initiale = (nom: string) => {
  const l = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(l) ? l : "#";
};

function BlocFamille(props: { f: Famille; ouverte: boolean; basculer: () => void; envoyer: (c: object, ok: string) => Promise<boolean> }) {
  const { f } = props;
  const lignes = f.prestations as Ligne[];
  const visibles = lignes.filter((p) => !p.masque).length;
  // Raccourcis pour les grandes familles (Habillement, Parfums…) : une lettre, 25 lignes à la fois.
  const [lettre, setLettre] = useState("");
  const [nombre, setNombre] = useState(PAGE);
  const lettres = [...new Set(lignes.map((p) => initiale(p.nom)))].sort();
  const dansLettre = lettre ? lignes.filter((p) => initiale(p.nom) === lettre) : lignes;
  const montrees = dansLettre.slice(0, nombre);
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-bordure">
      <button onClick={props.basculer} aria-expanded={props.ouverte} className="flex w-full items-center justify-between gap-3 bg-creme px-3 py-3 text-left">
        <span className="font-bold text-profond">{f.nom}</span>
        <span className="flex items-center gap-2 text-xs font-semibold text-doux">
          {visibles} ligne{visibles > 1 ? "s" : ""}
          <span className="text-base text-profond" aria-hidden>
            {props.ouverte ? "▾" : "▸"}
          </span>
        </span>
      </button>
      {props.ouverte && (
        <>
          {lignes.length > PAGE && lettres.length > 1 && (
            <div className="flex flex-wrap gap-1 border-t border-bordure px-3 py-2" aria-label="Aller à une lettre">
              {["", ...lettres].map((l) => (
                <button
                  key={l || "tout"}
                  onClick={() => {
                    setLettre(l);
                    setNombre(PAGE);
                  }}
                  aria-pressed={lettre === l}
                  className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold ${lettre === l ? "bg-profond text-white" : "bg-creme text-profond"}`}
                >
                  {l || "Tout"}
                </button>
              ))}
            </div>
          )}
          <ul className="divide-y divide-bordure border-t border-bordure">
            {montrees.map((p) => (
              <LignePrix key={`${p.id}:${p.prix}:${p.masque}:${p.horsSite}`} p={p} envoyer={props.envoyer} />
            ))}
            {dansLettre.length > montrees.length && (
              <li>
                <button onClick={() => setNombre((n) => n + PAGE)} className="w-full px-3 py-2.5 text-sm font-bold text-profond hover:bg-creme/60">
                  Afficher {Math.min(PAGE, dansLettre.length - montrees.length)} de plus ({dansLettre.length - montrees.length} restantes)
                </button>
              </li>
            )}
          </ul>
          {f.ajoutee && (
            <button
              onClick={() => {
                const nom = window.prompt("Nouveau nom de la famille :", f.nom)?.trim();
                if (nom && nom !== f.nom) props.envoyer({ action: "renommer-famille", id: f.id, nom }, `Famille renommée : « ${nom} ».`);
              }}
              className="mx-3 mt-2 min-h-10 rounded-full border border-bordure px-3 text-xs font-semibold text-profond"
            >
              ✏️ Renommer la famille
            </button>
          )}
          <Ajouter key={f.id} familleId={f.id} nomFamille={f.nom} boutique={Boolean(f.boutique)} envoyer={props.envoyer} />
        </>
      )}
    </div>
  );
}

function LignePrix({ p, envoyer }: { p: Ligne; envoyer: (c: object, ok: string) => Promise<boolean> }) {
  const photos = useContext(Photos);
  const photo = photos?.photos[p.id];
  const [prix, setPrix] = useState(String(p.prix));
  const [envoi, setEnvoi] = useState(false);
  const nouveau = Math.round(Number(prix.replace(/\s/g, "")));
  const modifie = prix.trim() !== "" && nouveau !== p.prix;
  const valide = Number.isFinite(nouveau) && nouveau >= 0;

  async function faire(corps: object, ok: string) {
    setEnvoi(true);
    await envoyer(corps, ok);
    setEnvoi(false);
  }

  return (
    <li className={`px-3 py-2 ${p.masque ? "bg-creme/60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {photos && (
          <button
            onClick={() => photos.ouvrir(p)}
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-bordure bg-creme text-lg"
            aria-label={photo ? `Changer la photo de ${p.nom}` : `Ajouter une photo à ${p.nom}`}
            title={photo ? "Changer la photo" : "Ajouter une photo"}
          >
            {photo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={urlPhotoSite(photo)} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              "📷"
            )}
          </button>
        )}
        <span className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-40">
          <span className={`text-sm leading-tight font-semibold ${p.masque ? "text-doux line-through" : ""}`}>{p.nom}</span>
          {(p.note === "Produit" || p.masque || p.horsSite) && (
            <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle text-[11px]">
              {p.note === "Produit" && <span className="rounded-full bg-or/20 px-1.5 font-semibold">produit</span>}
              {p.masque && <span className="rounded-full bg-bordure px-1.5 font-semibold text-doux">masquée</span>}
              {p.horsSite && !p.masque && <span className="rounded-full bg-bordure px-1.5 font-semibold text-doux">pas sur le site</span>}
            </span>
          )}
        </span>
        <input
          inputMode="numeric"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          aria-label={`Prix de ${p.nom}`}
          className={`w-24 rounded-lg border px-2 py-1.5 text-right text-sm ${modifie ? "border-aza" : "border-bordure"}`}
        />
        {modifie ? (
          <button
            disabled={!valide || envoi}
            onClick={() => faire({ action: "prix", id: p.id, prix: nouveau }, `${p.nom} : ${formatPrix(nouveau)} (au lieu de ${formatPrix(p.prix)}).`)}
            className="min-h-9 rounded-full bg-aza px-3 text-xs font-bold text-white disabled:opacity-40"
          >
            Enregistrer
          </button>
        ) : (
          <>
            {!p.masque && (
              <label className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-bordure px-2.5 text-xs font-semibold text-profond" title="Visible sur le site">
                <input
                  type="checkbox"
                  checked={!p.horsSite}
                  disabled={envoi}
                  onChange={(e) =>
                    faire(
                      { action: "site", id: p.id, site: e.target.checked },
                      e.target.checked ? `« ${p.nom} » est de nouveau sur le site.` : `« ${p.nom} » n'est plus sur le site (elle reste en caisse).`,
                    )
                  }
                  className="h-4 w-4 accent-[#7E0A4C]"
                />
                Site
              </label>
            )}
            <button
              disabled={envoi}
              onClick={() => {
                if (!p.masque && !window.confirm(`Masquer « ${p.nom} » ? Elle n'apparaîtra plus sur le site ni en caisse. Vous pourrez la réafficher.`)) return;
                faire({ action: "masquer", id: p.id, masque: !p.masque }, p.masque ? `« ${p.nom} » est de nouveau proposée.` : `« ${p.nom} » est masquée.`);
              }}
              className="min-h-9 rounded-full border border-bordure px-2.5 text-xs font-semibold text-profond disabled:opacity-40"
            >
              {p.masque ? "Réafficher" : "Masquer"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function Ajouter(props: { familleId: string; nomFamille: string; boutique: boolean; envoyer: (c: object, ok: string) => Promise<boolean> }) {
  const { familleId, nomFamille, envoyer } = props;
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [prix, setPrix] = useState("");
  const [produit, setProduit] = useState(props.boutique);
  const [envoi, setEnvoi] = useState(false);
  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="w-full border-t border-bordure px-3 py-3 text-left text-sm font-bold text-aza">
        + Ajouter dans « {nomFamille} »
      </button>
    );
  }
  const n = Math.round(Number(prix.replace(/\s/g, "")));
  return (
    <div className="border-t border-bordure bg-[#fdf8fb] px-3 py-3">
      <p className="text-sm font-semibold text-profond">Nouvelle ligne dans « {nomFamille} »</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_9rem]">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom (ex. Massage aux pierres chaudes)" className="rounded-xl border border-bordure px-3 py-2.5" />
        <input inputMode="numeric" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="Prix (F)" className="rounded-xl border border-bordure px-3 py-2.5 text-right" />
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={produit} onChange={(e) => setProduit(e.target.checked)} className="h-5 w-5 accent-[#7E0A4C]" />
        C&apos;est un produit à vendre (pas un soin)
      </label>
      <div className="mt-3 flex gap-2">
        <button
          disabled={envoi || nom.trim().length < 2 || !Number.isFinite(n) || prix.trim() === ""}
          onClick={async () => {
            setEnvoi(true);
            const ok = await envoyer({ action: "ajouter", familleId, nom, prix: n, produit }, `« ${nom.trim()} » ajoutée à ${formatPrix(n)}.`);
            setEnvoi(false);
            if (ok) {
              setNom("");
              setPrix("");
              setProduit(props.boutique);
              setOuvert(false);
            }
          }}
          className="min-h-11 rounded-full bg-aza px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          Ajouter
        </button>
        <button onClick={() => setOuvert(false)} className="px-3 text-sm font-semibold text-doux underline">
          Annuler
        </button>
      </div>
      {!produit && <p className="mt-2 text-xs text-doux">Pensez ensuite à lui donner une durée dans Réglages → Durées pour qu&apos;elle se réserve en ligne.</p>}
    </div>
  );
}
