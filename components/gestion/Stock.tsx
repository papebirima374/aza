"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { RAYONS } from "@/lib/boutique";
import { reduirePhoto } from "@/lib/client/image";
import { formatPrix } from "@/lib/catalogue";
import { useCatalogue } from "@/lib/client/catalogue";
import { correspond } from "@/lib/recherche";

// Écran « Stock » (M-09). Deux stocks : ce qu'on vend (boutique, caisse) et ce qu'on
// consomme en cabine pendant les soins. Les ventes et les soins encaissés sortent tout
// seuls du stock ; ici on reçoit la marchandise, on note les pertes, on fait l'inventaire.

type Mouvement = { type: string; quantite: number; stockApres: number; motif?: string; reference?: string; par: { nom: string }; le: number };
type Article = {
  id: string;
  nom: string;
  type: "revente" | "cabine";
  unite: string;
  quantite: number;
  seuil: number;
  coutMoyen: number;
  produit: string | null;
  produitNom: string | null;
  prixVente: number | null;
  peremption: string | null;
  boutique: { visible?: boolean; titre?: string; variante?: string; rayon?: string; description?: string; photos?: string[] } | null;
  joursCouverture: number | null;
  alerteSeuil: boolean;
  alertePeremption: "perime" | "bientot" | null;
  mouvements: Mouvement[];
};
type Donnees = {
  articles: Article[];
  valeur: { revente: number; cabine: number };
  consommations: Record<string, { article: string; quantite: number }[]>;
  produitsCatalogue: { id: string; nom: string; prix: number; famille: string }[];
};

const UNITES = ["pièce", "flacon", "tube", "pot", "boîte", "sachet", "ml", "g"];
const LIBELLE_MOUVEMENT: Record<string, string> = {
  reception: "📦 Réception",
  vente: "🛍️ Vente",
  consommation: "💆 Soin",
  perte: "➖ Perte",
  inventaire: "🔢 Inventaire",
  annulation: "↩️ Ticket annulé",
};
const nombre = (q: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(q);
const champ = "mt-1 block w-full rounded-xl border border-bordure px-3 py-2.5 font-normal";

export function Stock() {
  const compte = useCompte();
  const peutModifier = compte.role === "direction" || compte.role === "manager";
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [onglet, setOnglet] = useState<"revente" | "cabine" | "soins">("revente");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [version, setVersion] = useState(0);

  const appel = useCallback(
    async (corps?: object) => {
      const r = await fetch("/api/gestion/stock", {
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
      .then((d: Donnees) => actif && setDonnees(d))
      .catch((e: Error) => actif && setMessage({ ok: false, texte: e.message }));
    return () => {
      actif = false;
    };
  }, [appel, version]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), message.ok ? 3000 : 8000);
    return () => clearTimeout(t);
  }, [message]);

  const envoyer = useCallback(
    async (corps: object, ok: string) => {
      try {
        await appel(corps);
        setMessage({ ok: true, texte: ok });
        setVersion((v) => v + 1);
        return true;
      } catch (e) {
        setMessage({ ok: false, texte: (e as Error).message });
        return false;
      }
    },
    [appel],
  );

  if (!donnees) return <p className="p-8 text-center text-doux">{message?.texte ?? "Chargement du stock…"}</p>;
  const alertes = donnees.articles.filter((a) => a.alerteSeuil || a.alertePeremption);
  const liste = donnees.articles.filter((a) => a.type === onglet);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-serif text-4xl font-semibold text-profond">Stock</h1>
      <p className="mt-1 text-sm text-doux">
        Valeur au coût d&apos;achat : à vendre <strong className="prix">{formatPrix(donnees.valeur.revente)}</strong> · cabine{" "}
        <strong className="prix">{formatPrix(donnees.valeur.cabine)}</strong>
      </p>

      <div className="sticky top-[5.75rem] z-20 mt-3 min-h-0 sm:top-14">
        {message && (
          <p className={`rounded-xl p-3 text-sm font-semibold ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`} role="status">
            {message.texte}
          </p>
        )}
      </div>

      {alertes.length > 0 && (
        <section className="mt-4 space-y-2">
          {alertes.map((a) => (
            <p key={a.id} className="rounded-xl border border-aza/30 bg-aza/5 px-4 py-3 text-sm">
              {a.alerteSeuil && (
                <span className="block font-semibold text-profond">
                  ⚠️ À commander : {a.nom} — reste {nombre(a.quantite)} {a.unite}
                  {a.joursCouverture !== null ? ` (≈ ${a.joursCouverture} jour${a.joursCouverture > 1 ? "s" : ""})` : ""}
                </span>
              )}
              {a.alertePeremption && (
                <span className="block font-semibold text-[#a34d00]">
                  ⏳ {a.nom} : {a.alertePeremption === "perime" ? "périmé depuis le" : "périme le"} {new Date(`${a.peremption}T12:00:00Z`).toLocaleDateString("fr-FR")}
                </span>
              )}
            </p>
          ))}
        </section>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2">
        {(
          [
            ["revente", "🛍️", "À vendre"],
            ["cabine", "🧴", "Cabine"],
            ["soins", "💆", "Soins"],
          ] as const
        ).map(([id, icone, libelle]) => (
          <button
            key={id}
            onClick={() => setOnglet(id)}
            className={`flex min-h-16 flex-col items-center justify-center rounded-2xl text-sm font-bold ${onglet === id ? "bg-profond text-white" : "border-2 border-bordure text-profond"}`}
          >
            <span className="text-2xl" aria-hidden>
              {icone}
            </span>
            {libelle}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-doux">
        {onglet === "revente"
          ? "Produits vendus aux clientes : ils sortent du stock tout seuls à l'encaissement."
          : onglet === "cabine"
            ? "Produits utilisés pendant les soins (cire, vernis, coloration…). Ils sortent tout seuls quand le soin est encaissé, selon l'onglet « Soins »."
            : "Pour chaque soin, ce qu'il consomme dans le stock cabine. Exemple : une épilation jambes = 0,1 pot de cire."}
      </p>

      {onglet === "soins" ? (
        <Consommations donnees={donnees} peutModifier={peutModifier} envoyer={envoyer} />
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {liste.length === 0 && <li className="rounded-2xl border border-bordure p-5 text-center text-doux">Aucun article pour l&apos;instant.</li>}
            {liste.map((a) => (
              <CarteArticle key={a.id} a={a} peutModifier={peutModifier} produits={donnees.produitsCatalogue} liees={donnees.articles} envoyer={envoyer} />
            ))}
          </ul>
          {peutModifier && <NouvelArticle type={onglet} produits={donnees.produitsCatalogue} liees={donnees.articles} envoyer={envoyer} />}
        </>
      )}
    </div>
  );
}

type Envoyer = (corps: object, ok: string) => Promise<boolean>;

function CarteArticle({ a, peutModifier, produits, liees, envoyer }: { a: Article; peutModifier: boolean; produits: Donnees["produitsCatalogue"]; liees: Article[]; envoyer: Envoyer }) {
  const [action, setAction] = useState<"" | "reception" | "perte" | "inventaire" | "modifier" | "boutique" | "historique">("");
  const bas = a.quantite <= a.seuil;
  return (
    <li className={`rounded-2xl border-2 p-4 ${a.quantite < 0 ? "border-[#b3261e]" : bas ? "border-aza/50" : "border-bordure"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold">{a.nom}</p>
          <p className="text-xs text-doux">
            {a.type === "revente" ? (a.produitNom ? `Caisse : ${a.produitNom} · ${formatPrix(a.prixVente ?? 0)}` : "⚠️ Pas relié à une ligne de caisse") : "Cabine"}
            {a.coutMoyen ? ` · coût moyen ${formatPrix(Math.round(a.coutMoyen))}` : ""}
          </p>
        </div>
        <p className={`shrink-0 text-right ${a.quantite < 0 ? "text-[#b3261e]" : bas ? "text-aza-fonce" : "text-[#0d6b37]"}`}>
          <span className="block font-serif text-4xl font-semibold leading-none">{nombre(a.quantite)}</span>
          <span className="text-xs font-semibold">{a.unite}</span>
        </p>
      </div>
      <p className="mt-1 text-xs text-doux">
        Alerte sous {nombre(a.seuil)}
        {a.joursCouverture !== null ? ` · ≈ ${a.joursCouverture} jours de stock` : ""}
        {a.peremption ? ` · péremption ${new Date(`${a.peremption}T12:00:00Z`).toLocaleDateString("fr-FR")}` : ""}
        {a.quantite < 0 ? " · stock négatif : faites un inventaire" : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {peutModifier &&
          (
            [
              ["reception", "📦 Réception"],
              ["perte", "➖ Perte"],
              ["inventaire", "🔢 Inventaire"],
              ["modifier", "✏️ Modifier"],
              ...(a.type === "revente" ? ([["boutique", a.boutique?.visible ? "🛍️ En boutique ✓" : "🛍️ Boutique"]] as const) : []),
            ] as const
          ).map(([id, libelle]) => (
            <button
              key={id}
              onClick={() => setAction(action === id ? "" : id)}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold ${action === id ? "bg-profond text-white" : "border border-bordure text-profond"}`}
            >
              {libelle}
            </button>
          ))}
        <button onClick={() => setAction(action === "historique" ? "" : "historique")} className="min-h-11 px-2 text-sm font-semibold text-doux underline">
          Historique
        </button>
      </div>

      {action === "reception" && <FormReception a={a} envoyer={envoyer} fermer={() => setAction("")} />}
      {action === "perte" && <FormPerte a={a} envoyer={envoyer} fermer={() => setAction("")} />}
      {action === "inventaire" && <FormInventaire a={a} envoyer={envoyer} fermer={() => setAction("")} />}
      {action === "modifier" && <FormArticle article={a} type={a.type} produits={produits} liees={liees} envoyer={envoyer} fermer={() => setAction("")} />}
      {action === "boutique" && <FormBoutique a={a} envoyer={envoyer} fermer={() => setAction("")} />}
      {action === "historique" && (
        <ol className="mt-3 space-y-1 text-sm">
          {a.mouvements.length === 0 && <li className="text-doux">Aucun mouvement ces 30 derniers jours.</li>}
          {a.mouvements.map((m, i) => (
            <li key={i} className="flex justify-between gap-2 border-b border-bordure pb-1">
              <span>
                {new Date(m.le).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · {LIBELLE_MOUVEMENT[m.type] ?? m.type}
                {m.reference ? ` ${m.reference}` : ""}
                {m.motif ? ` — ${m.motif}` : ""} <span className="text-doux">({m.par.nom})</span>
              </span>
              <span className={`shrink-0 font-semibold ${m.quantite < 0 ? "text-aza-fonce" : "text-[#0d6b37]"}`}>
                {m.quantite > 0 ? "+" : ""}
                {nombre(m.quantite)} → {nombre(m.stockApres)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function Boutons({ pret, envoi, valider, fermer, libelle }: { pret: boolean; envoi: boolean; valider: () => void; fermer: () => void; libelle: string }) {
  return (
    <div className="mt-3 flex gap-2">
      <button disabled={!pret || envoi} onClick={valider} className="min-h-11 rounded-full bg-aza px-5 text-sm font-bold text-white disabled:opacity-40">
        {envoi ? "…" : libelle}
      </button>
      <button onClick={fermer} className="px-3 text-sm font-semibold text-doux underline">
        Annuler
      </button>
    </div>
  );
}

function useEnvoi(envoyer: Envoyer, fermer: () => void) {
  const [envoi, setEnvoi] = useState(false);
  return {
    envoi,
    go: async (corps: object, ok: string) => {
      setEnvoi(true);
      const r = await envoyer(corps, ok);
      setEnvoi(false);
      if (r) fermer();
    },
  };
}

function FormReception({ a, envoyer, fermer }: { a: Article; envoyer: Envoyer; fermer: () => void }) {
  const [quantite, setQuantite] = useState("");
  const [cout, setCout] = useState("");
  const [peremption, setPeremption] = useState("");
  const { envoi, go } = useEnvoi(envoyer, fermer);
  const q = Number(quantite.replace(",", "."));
  return (
    <div className="mt-3 rounded-xl bg-creme p-3">
      <p className="text-sm font-semibold">📦 Marchandise reçue</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="text-xs font-semibold">
          Quantité ({a.unite})
          <input inputMode="decimal" value={quantite} onChange={(e) => setQuantite(e.target.value)} className={champ} />
        </label>
        <label className="text-xs font-semibold">
          Prix d&apos;achat par {a.unite} (F)
          <input inputMode="numeric" value={cout} onChange={(e) => setCout(e.target.value)} placeholder="facultatif" className={champ} />
        </label>
        <label className="text-xs font-semibold">
          Péremption
          <input type="date" value={peremption} onChange={(e) => setPeremption(e.target.value)} className={champ} />
        </label>
      </div>
      <Boutons
        pret={q > 0}
        envoi={envoi}
        libelle="Ajouter au stock"
        fermer={fermer}
        valider={() => go({ action: "reception", id: a.id, quantite, cout: cout || 0, peremption }, `${a.nom} : +${nombre(q)} ${a.unite}.`)}
      />
    </div>
  );
}

function FormPerte({ a, envoyer, fermer }: { a: Article; envoyer: Envoyer; fermer: () => void }) {
  const [quantite, setQuantite] = useState("");
  const [motif, setMotif] = useState("");
  const { envoi, go } = useEnvoi(envoyer, fermer);
  const q = Number(quantite.replace(",", "."));
  return (
    <div className="mt-3 rounded-xl bg-creme p-3">
      <p className="text-sm font-semibold">➖ Perte, casse, périmé</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[8rem_1fr]">
        <label className="text-xs font-semibold">
          Quantité ({a.unite})
          <input inputMode="decimal" value={quantite} onChange={(e) => setQuantite(e.target.value)} className={champ} />
        </label>
        <label className="text-xs font-semibold">
          Motif (obligatoire)
          <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="ex. flacon cassé" className={champ} />
        </label>
      </div>
      <Boutons
        pret={q > 0 && motif.trim().length >= 3}
        envoi={envoi}
        libelle="Retirer du stock"
        fermer={fermer}
        valider={() => go({ action: "perte", id: a.id, quantite, motif }, `${a.nom} : −${nombre(q)} ${a.unite} (${motif.trim()}).`)}
      />
    </div>
  );
}

function FormInventaire({ a, envoyer, fermer }: { a: Article; envoyer: Envoyer; fermer: () => void }) {
  const [compte, setCompte] = useState("");
  const [motif, setMotif] = useState("");
  const { envoi, go } = useEnvoi(envoyer, fermer);
  const n = Number(compte.replace(",", "."));
  const ecart = compte.trim() === "" ? null : Math.round((n - a.quantite) * 100) / 100;
  return (
    <div className="mt-3 rounded-xl bg-creme p-3">
      <p className="text-sm font-semibold">🔢 Comptez ce qu&apos;il y a réellement sur l&apos;étagère</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[8rem_1fr]">
        <label className="text-xs font-semibold">
          Compté ({a.unite})
          <input inputMode="decimal" value={compte} onChange={(e) => setCompte(e.target.value)} className={champ} />
        </label>
        <label className="text-xs font-semibold">
          Remarque (facultatif)
          <input value={motif} onChange={(e) => setMotif(e.target.value)} className={champ} />
        </label>
      </div>
      {ecart !== null && (
        <p className={`mt-2 text-sm font-bold ${ecart === 0 ? "text-[#0d6b37]" : "text-aza-fonce"}`}>
          {ecart === 0 ? "Le compte est juste." : `Écart : ${ecart > 0 ? "+" : ""}${nombre(ecart)} ${a.unite}`}
        </p>
      )}
      <Boutons
        pret={ecart !== null && n >= 0}
        envoi={envoi}
        libelle="Valider l'inventaire"
        fermer={fermer}
        valider={() => go({ action: "inventaire", id: a.id, compte, motif }, `${a.nom} : inventaire enregistré (${nombre(n)} ${a.unite}).`)}
      />
    </div>
  );
}

function FormArticle(props: {
  article?: Article;
  type: "revente" | "cabine";
  produits: Donnees["produitsCatalogue"];
  liees: Article[];
  envoyer: Envoyer;
  fermer: () => void;
}) {
  const a = props.article;
  const [nom, setNom] = useState(a?.nom ?? "");
  const [unite, setUnite] = useState(a?.unite ?? "pièce");
  const [seuil, setSeuil] = useState(String(a?.seuil ?? ""));
  const [produit, setProduit] = useState(a?.produit ?? "");
  const { envoi, go } = useEnvoi(props.envoyer, props.fermer);
  const prises = new Set(props.liees.filter((x) => x.id !== a?.id && x.produit).map((x) => x.produit));
  return (
    <div className="mt-3 rounded-xl bg-creme p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold">
          Nom
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={props.type === "revente" ? "ex. Huile Cantu 200 ml" : "ex. Cire tiède"} className={champ} />
        </label>
        <label className="text-xs font-semibold">
          Compté en
          <select value={unite} onChange={(e) => setUnite(e.target.value)} className={`${champ} bg-white`}>
            {UNITES.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold">
          M&apos;alerter quand il en reste
          <input inputMode="decimal" value={seuil} onChange={(e) => setSeuil(e.target.value)} placeholder="ex. 3" className={champ} />
        </label>
        {props.type === "revente" && (
          <label className="text-xs font-semibold">
            Ligne de caisse (prix de vente)
            <select value={produit} onChange={(e) => setProduit(e.target.value)} className={`${champ} bg-white`}>
              <option value="">— À choisir —</option>
              {props.produits.map((p) => (
                <option key={p.id} value={p.id} disabled={prises.has(p.id)}>
                  {p.nom} · {formatPrix(p.prix)}
                  {prises.has(p.id) ? " (déjà relié)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {props.type === "revente" && (
        <p className="mt-2 text-xs text-doux">Le produit n&apos;est pas dans la liste ? Ajoutez-le d&apos;abord dans Catalogue (cochez « C&apos;est un produit »).</p>
      )}
      <Boutons
        pret={nom.trim().length >= 2}
        envoi={envoi}
        libelle={a ? "Enregistrer" : "Créer l'article"}
        fermer={props.fermer}
        valider={() =>
          go(
            { action: a ? "modifier" : "creer", id: a?.id, nom, type: props.type, unite, seuil: seuil || 0, produit: produit || undefined },
            a ? `${nom.trim()} modifié.` : `${nom.trim()} créé. Faites une « Réception » pour indiquer la quantité en stock.`,
          )
        }
      />
    </div>
  );
}

function NouvelArticle(props: { type: "revente" | "cabine"; produits: Donnees["produitsCatalogue"]; liees: Article[]; envoyer: Envoyer }) {
  const [ouvert, setOuvert] = useState(false);
  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="mt-4 min-h-12 w-full rounded-2xl border-2 border-dashed border-bordure font-bold text-aza">
        + Nouvel article {props.type === "revente" ? "à vendre" : "de cabine"}
      </button>
    );
  }
  return <FormArticle key={props.type} type={props.type} produits={props.produits} liees={props.liees} envoyer={props.envoyer} fermer={() => setOuvert(false)} />;
}

function Consommations({ donnees, peutModifier, envoyer }: { donnees: Donnees; peutModifier: boolean; envoyer: Envoyer }) {
  const cat = useCatalogue();
  const [requete, setRequete] = useState("");
  const [choisie, setChoisie] = useState<string | null>(null);
  const cabine = donnees.articles.filter((a) => a.type === "cabine");
  const nomArticle = new Map(donnees.articles.map((a) => [a.id, a]));
  const resultats = useMemo(
    () => (requete.trim().length < 2 ? [] : cat.prestations.filter((p) => p.note !== "Produit" && correspond(`${p.nom} ${p.famille}`, requete)).slice(0, 8)),
    [requete, cat],
  );
  const renseignees = Object.entries(donnees.consommations).filter(([, l]) => l.length > 0);

  if (cabine.length === 0) {
    return <p className="mt-4 rounded-2xl border border-bordure p-5 text-center text-doux">Créez d&apos;abord vos produits dans l&apos;onglet « Cabine ».</p>;
  }
  return (
    <div className="mt-4">
      {peutModifier && (
        <div className="relative">
          <input type="search" value={requete} onChange={(e) => setRequete(e.target.value)} placeholder="Chercher un soin (ex. épilation jambes)…" className="w-full rounded-xl border border-bordure px-4 py-3" />
          {resultats.length > 0 && (
            <ul className="absolute inset-x-0 z-10 mt-1 max-h-72 overflow-y-auto rounded-xl border border-bordure bg-white shadow-lg">
              {resultats.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      setChoisie(p.id);
                      setRequete("");
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-creme"
                  >
                    {p.nom} <span className="text-xs text-doux">· {p.famille}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {choisie && (
        <EditeurRecette
          key={choisie}
          id={choisie}
          nom={cat.parId(choisie)?.nom ?? choisie}
          initiales={donnees.consommations[choisie] ?? []}
          cabine={cabine}
          envoyer={envoyer}
          fermer={() => setChoisie(null)}
        />
      )}
      <ul className="mt-4 divide-y divide-bordure rounded-2xl border border-bordure">
        {renseignees.length === 0 && <li className="p-4 text-sm text-doux">Aucun soin renseigné pour l&apos;instant.</li>}
        {renseignees.map(([id, lignes]) => (
          <li key={id} className="flex items-start justify-between gap-3 p-3">
            <span>
              <span className="block font-semibold">{cat.parId(id)?.nom ?? id}</span>
              <span className="text-sm text-doux">
                {lignes.map((l) => `${nombre(l.quantite)} ${nomArticle.get(l.article)?.unite ?? ""} ${nomArticle.get(l.article)?.nom ?? "?"}`).join(" + ")}
              </span>
            </span>
            {peutModifier && (
              <button onClick={() => setChoisie(id)} className="shrink-0 text-sm font-semibold text-aza underline">
                Modifier
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditeurRecette(props: {
  id: string;
  nom: string;
  initiales: { article: string; quantite: number }[];
  cabine: Article[];
  envoyer: Envoyer;
  fermer: () => void;
}) {
  const [lignes, setLignes] = useState(props.initiales.map((l) => ({ article: l.article, quantite: String(l.quantite) })));
  const { envoi, go } = useEnvoi(props.envoyer, props.fermer);
  const valides = lignes.filter((l) => l.article && Number(l.quantite.replace(",", ".")) > 0);
  return (
    <div className="mt-3 rounded-2xl border-2 border-profond p-4">
      <p className="font-semibold text-profond">Chaque « {props.nom} » consomme :</p>
      {lignes.map((l, i) => {
        const a = props.cabine.find((x) => x.id === l.article);
        return (
          <div key={i} className="mt-2 flex items-center gap-2">
            <select
              value={l.article}
              onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, article: e.target.value } : x)))}
              className="min-w-0 flex-1 rounded-xl border border-bordure bg-white px-3 py-2.5"
            >
              <option value="">— Produit —</option>
              {props.cabine.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
            <input
              inputMode="decimal"
              value={l.quantite}
              onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, quantite: e.target.value } : x)))}
              placeholder="0,1"
              className="w-20 rounded-xl border border-bordure px-2 py-2.5 text-right"
            />
            <span className="w-10 text-xs text-doux">{a?.unite ?? ""}</span>
            <button onClick={() => setLignes(lignes.filter((_, j) => j !== i))} className="h-10 w-10 rounded-full text-xl text-doux" aria-label="Retirer">
              ×
            </button>
          </div>
        );
      })}
      <button onClick={() => setLignes([...lignes, { article: "", quantite: "" }])} className="mt-2 text-sm font-bold text-aza">
        + Ajouter un produit
      </button>
      <Boutons
        pret={valides.length === lignes.length}
        envoi={envoi}
        libelle="Enregistrer"
        fermer={props.fermer}
        valider={() => go({ action: "consommation", prestation: props.id, lignes: valides }, `« ${props.nom} » : consommation enregistrée.`)}
      />
    </div>
  );
}

function FormBoutique({ a, envoyer, fermer }: { a: Article; envoyer: Envoyer; fermer: () => void }) {
  const b = a.boutique ?? {};
  const [visible, setVisible] = useState(b.visible ?? false);
  const [titre, setTitre] = useState(b.titre ?? a.nom);
  const [variante, setVariante] = useState(b.variante ?? "");
  const [rayon, setRayon] = useState(b.rayon ?? "capillaire");
  const [description, setDescription] = useState(b.description ?? "");
  const [photo, setPhoto] = useState(false);
  const { envoi, go } = useEnvoi(envoyer, fermer);
  return (
    <div className="mt-3 rounded-xl bg-creme p-3">
      <p className="text-sm font-semibold">🛍️ Boutique en ligne</p>
      {!a.produit && <p className="mt-1 text-sm font-semibold text-aza-fonce">Reliez d&apos;abord l&apos;article à sa ligne de caisse (✏️ Modifier) : c&apos;est elle qui donne le prix.</p>}
      <label className="mt-2 flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-5 w-5 accent-[#7E0A4C]" />
        Visible sur le site
      </label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold">
          Nom affiché sur le site
          <input value={titre} onChange={(e) => setTitre(e.target.value)} className={champ} />
        </label>
        <label className="text-xs font-semibold">
          Déclinaison (taille, couleur, longueur…)
          <input value={variante} onChange={(e) => setVariante(e.target.value)} placeholder="facultatif, ex. 250 ml" className={champ} />
        </label>
        <label className="text-xs font-semibold">
          Rayon
          <select value={rayon} onChange={(e) => setRayon(e.target.value)} className={`${champ} bg-white`}>
            {RAYONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nom}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-1 text-xs text-doux">Deux articles avec le même nom affiché deviennent un seul produit sur le site, avec un choix de déclinaison.</p>
      <label className="mt-2 block text-xs font-semibold">
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={champ} />
      </label>
      <div className="mt-3">
        <p className="text-xs font-semibold">Photos ({b.photos?.length ?? 0}/6)</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {(b.photos ?? []).map((p) => (
            <div key={p} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/boutique/photo/${p}`} alt="" className="h-20 w-20 rounded-lg object-cover" />
              <button
                onClick={() => window.confirm("Retirer cette photo ?") && envoyer({ action: "photo-retrait", id: a.id, photo: p }, "Photo retirée.")}
                className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-white text-sm shadow"
                aria-label="Retirer la photo"
              >
                ×
              </button>
            </div>
          ))}
          {(b.photos?.length ?? 0) < 6 && (
            <label className={`flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-bordure text-2xl ${photo ? "opacity-50" : ""}`}>
              {photo ? "⏳" : "📷"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setPhoto(true);
                  try {
                    await envoyer({ action: "photo-ajout", id: a.id, image: await reduirePhoto(f) }, "Photo ajoutée.");
                  } finally {
                    setPhoto(false);
                  }
                }}
              />
            </label>
          )}
        </div>
        <p className="mt-1 text-xs text-doux">Une belle photo, sur fond clair, bien éclairée : une boutique se juge sur ses photos.</p>
      </div>
      <Boutons
        pret={titre.trim().length >= 2}
        envoi={envoi}
        libelle="Enregistrer"
        fermer={fermer}
        valider={() => go({ action: "boutique", id: a.id, visible, titre, variante, rayon, description }, visible ? `${titre.trim()} : visible sur le site.` : `${titre.trim()} : retiré du site.`)}
      />
    </div>
  );
}
