"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { STATUTS_COMMANDE, type StatutCommande } from "@/lib/boutique";
import { MODES, type Mode } from "@/lib/caisse/modes";
import { formatPrix } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";
import { telephoneCanonique } from "@/lib/telephone";

// Commandes de la boutique en ligne (M-06) : confirmer, préparer (bon imprimable), livrer
// ou faire retirer, encaisser à la remise. À chaque étape, un message WhatsApp prêt.

type Commande = {
  id: string;
  reference: string;
  date: string;
  statut: StatutCommande;
  lignes: { article: string; nom: string; variante: string; prixUnitaire: number; quantite: number; montant: number }[];
  sousTotal: number;
  livraison: { mode: "retrait" | "livraison"; zone: string; prix: number; adresse: string };
  total: number;
  paiement: "sur-place" | "mobile";
  cliente: { nom: string; telephone: string };
  remarque: string;
  livreur?: string;
  ticket?: { reference: string };
  historique: { statut: StatutCommande; le: number; nom?: string; motif?: string }[];
  creeLe: number | null;
};

const COULEUR: Record<StatutCommande, string> = {
  nouvelle: "bg-aza text-white",
  confirmee: "bg-[#e5f8ff] text-[#0b6f93]",
  prete: "bg-[#fff1e5] text-[#a34d00]",
  "en-livraison": "bg-[#fff1e5] text-[#a34d00]",
  remise: "bg-[#e7f5ec] text-[#0d6b37]",
  annulee: "bg-bordure text-doux",
};

function messageCliente(c: Commande): string {
  const nom = c.cliente.nom;
  switch (c.statut) {
    case "nouvelle":
    case "confirmee":
      return `Bonjour ${nom} 🌸 Votre commande ${c.reference} (${formatPrix(c.total)}) est confirmée ✅.${
        c.paiement === "mobile" ? ` Pour payer par Wave ou Orange Money : ${INSTITUT.telephones[1].affiche}.` : ""
      } Nous vous prévenons dès qu'elle est prête. ${INSTITUT.nom}`;
    case "prete":
      return `Bonjour ${nom} 🎁 Votre commande ${c.reference} est prête ! Vous pouvez la retirer à l'institut : ${INSTITUT.adresse.rue}, ${INSTITUT.adresse.repere.toLowerCase()}. Total : ${formatPrix(c.total)}. À très vite !`;
    case "en-livraison":
      return `Bonjour ${nom} 🛵 Votre commande ${c.reference} est en route${c.livreur ? ` avec ${c.livreur}` : ""}. Total à régler : ${formatPrix(c.total)}. Merci !`;
    case "remise":
      return `Merci ${nom} pour votre achat 🌸 À bientôt chez ${INSTITUT.nom} !`;
    case "annulee":
      return `Bonjour ${nom}, votre commande ${c.reference} a été annulée${c.historique.at(-1)?.motif ? ` (${c.historique.at(-1)!.motif})` : ""}. N'hésitez pas à nous écrire.`;
  }
}

function lienWhatsApp(tel: string, texte: string) {
  const c = telephoneCanonique(tel);
  return `https://wa.me/${c.length === 9 ? `221${c}` : c}?text=${encodeURIComponent(texte)}`;
}

export function Commandes() {
  const compte = useCompte();
  const [liste, setListe] = useState<Commande[] | null>(null);
  const [filtre, setFiltre] = useState<"a-traiter" | "toutes">("a-traiter");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [version, setVersion] = useState(0);
  const [bon, setBon] = useState<Commande | null>(null);

  const appel = useCallback(
    async (chemin: string, corps?: object) => {
      const r = await fetch(chemin, {
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
    const lire = () =>
      appel("/api/gestion/commandes")
        .then((l: Commande[]) => actif && setListe(l))
        .catch((e: Error) => actif && setMessage({ ok: false, texte: e.message }));
    lire();
    const t = setInterval(lire, 60_000);
    return () => {
      actif = false;
      clearInterval(t);
    };
  }, [appel, version]);

  const agir = async (chemin: string, corps: object, ok: string) => {
    try {
      await appel(chemin, corps);
      window.dispatchEvent(new Event("aza-commandes"));
      setMessage({ ok: true, texte: ok });
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message });
      return false;
    }
  };

  if (bon) return <BonPreparation c={bon} fermer={() => setBon(null)} />;
  const visibles = (liste ?? []).filter((c) => filtre === "toutes" || !["remise", "annulee"].includes(c.statut));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-serif text-4xl font-semibold text-profond">Commandes</h1>
      <p className="text-sm text-doux">Les commandes de la boutique en ligne. La liste se met à jour toute seule.</p>
      {(compte.role === "direction" || compte.role === "manager") && <ReglagesBoutique direction={compte.role === "direction"} appel={appel} />}

      {message && <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${message.ok ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`}>{message.texte}</p>}

      <div className="mt-5 grid grid-cols-2 gap-2">
        {(
          [
            ["a-traiter", "À traiter"],
            ["toutes", "Toutes"],
          ] as const
        ).map(([id, l]) => (
          <button key={id} onClick={() => setFiltre(id)} className={`min-h-12 rounded-2xl font-bold ${filtre === id ? "bg-profond text-white" : "border-2 border-bordure text-profond"}`}>
            {l} {id === "a-traiter" ? `(${(liste ?? []).filter((c) => !["remise", "annulee"].includes(c.statut)).length})` : ""}
          </button>
        ))}
      </div>

      {!liste ? (
        <p className="mt-8 text-center text-doux">Chargement…</p>
      ) : visibles.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-bordure p-6 text-center text-doux">Aucune commande à traiter.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visibles.map((c) => (
            <CarteCommande key={c.id} c={c} agir={agir} imprimer={() => setBon(c)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CarteCommande({ c, agir, imprimer }: { c: Commande; agir: (chemin: string, corps: object, ok: string) => Promise<boolean>; imprimer: () => void }) {
  const [payer, setPayer] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const etape = (statut: StatutCommande, extra: object, ok: string) => {
    setEnvoi(true);
    agir("/api/gestion/commandes", { id: c.id, statut, ...extra }, ok).finally(() => setEnvoi(false));
  };
  const bouton = "min-h-11 rounded-full px-4 text-sm font-bold disabled:opacity-40";
  const livree = c.livraison.mode === "livraison";

  return (
    <li className={`rounded-2xl border-2 p-4 ${c.statut === "nouvelle" ? "border-aza" : "border-bordure"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">
          {c.reference} · {c.cliente.nom}
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${COULEUR[c.statut]}`}>{STATUTS_COMMANDE[c.statut]}</span>
      </div>
      <p className="text-sm text-doux">
        {c.creeLe ? new Date(c.creeLe).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }) : c.date} ·{" "}
        <a href={`tel:${c.cliente.telephone}`} className="underline">
          {c.cliente.telephone}
        </a>
      </p>
      <ul className="mt-2 text-sm">
        {c.lignes.map((l, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>
              {l.quantite} × {l.nom}
              {l.variante ? ` — ${l.variante}` : ""}
            </span>
            <span className="prix">{formatPrix(l.montant)}</span>
          </li>
        ))}
        {livree && (
          <li className="flex justify-between gap-2 text-doux">
            <span>Livraison {c.livraison.zone}</span>
            <span className="prix">{formatPrix(c.livraison.prix)}</span>
          </li>
        )}
        <li className="mt-1 flex justify-between gap-2 border-t border-bordure pt-1 font-bold">
          <span>Total</span>
          <span className="prix">{formatPrix(c.total)}</span>
        </li>
      </ul>
      <p className="mt-2 text-sm">
        {livree ? `🛵 Livraison : ${c.livraison.adresse}` : "🏠 Retrait à l'institut"} · {c.paiement === "mobile" ? "paiera par Wave / Orange Money" : "paiera à la remise"}
        {c.livreur ? ` · livreur : ${c.livreur}` : ""}
      </p>
      {c.remarque && <p className="mt-1 text-sm italic text-doux">« {c.remarque} »</p>}
      {c.ticket && <p className="mt-1 text-sm font-semibold text-[#0d6b37]">Payée : ticket {c.ticket.reference}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {c.statut === "nouvelle" && (
          <button disabled={envoi} onClick={() => etape("confirmee", {}, `${c.reference} confirmée. Prévenez la cliente.`)} className={`${bouton} bg-aza text-white`}>
            ✅ Confirmer
          </button>
        )}
        {c.statut === "confirmee" && !livree && (
          <button disabled={envoi} onClick={() => etape("prete", {}, `${c.reference} prête. Prévenez la cliente.`)} className={`${bouton} bg-aza text-white`}>
            🎁 Prête à retirer
          </button>
        )}
        {(c.statut === "confirmee" || c.statut === "prete") && livree && (
          <button
            disabled={envoi}
            onClick={() => {
              const livreur = window.prompt("Nom du livreur ?") ?? "";
              if (livreur.trim()) etape("en-livraison", { livreur }, `${c.reference} partie en livraison avec ${livreur}.`);
            }}
            className={`${bouton} bg-aza text-white`}
          >
            🛵 Partie en livraison
          </button>
        )}
        {["confirmee", "prete", "en-livraison"].includes(c.statut) && (
          <button disabled={envoi} onClick={() => setPayer(!payer)} className={`${bouton} bg-[#0d6b37] text-white`}>
            💰 Remise et payée
          </button>
        )}
        {["nouvelle", "confirmee", "prete"].includes(c.statut) && (
          <button onClick={imprimer} className={`${bouton} border border-bordure text-profond`}>
            🖨️ Bon de préparation
          </button>
        )}
        <a href={lienWhatsApp(c.cliente.telephone, messageCliente(c))} target="_blank" rel="noopener" className={`${bouton} flex items-center bg-[#128C4A] text-white`}>
          📲 Prévenir la cliente
        </a>
        {!["remise", "annulee"].includes(c.statut) && (
          <button
            disabled={envoi}
            onClick={() => {
              const motif = window.prompt(`Annuler ${c.reference} ? Les produits reviennent en stock. Motif :`);
              if (motif) etape("annulee", { motif }, `${c.reference} annulée, produits remis en stock.`);
            }}
            className={`${bouton} border border-bordure text-doux`}
          >
            Annuler
          </button>
        )}
      </div>
      {payer && <Paiement c={c} agir={agir} fermer={() => setPayer(false)} />}
    </li>
  );
}

function Paiement({ c, agir, fermer }: { c: Commande; agir: (chemin: string, corps: object, ok: string) => Promise<boolean>; fermer: () => void }) {
  const [mode, setMode] = useState<Mode | "">("");
  const [envoi, setEnvoi] = useState(false);
  return (
    <div className="mt-3 rounded-xl bg-creme p-3">
      <p className="text-sm font-semibold">
        La cliente paie <span className="prix">{formatPrix(c.total)}</span> par :
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {MODES.filter((m) => m.id !== "credit" && m.id !== "virement").map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${mode === m.id ? "bg-profond text-white" : "border border-bordure bg-white"}`}>
            {m.libelle}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          disabled={!mode || envoi}
          onClick={async () => {
            setEnvoi(true);
            const ok = await agir("/api/gestion/caisse", { action: "commande", commande: c.id, paiements: [{ mode, montant: c.total }] }, `${c.reference} remise et encaissée.`);
            setEnvoi(false);
            if (ok) fermer();
          }}
          className="min-h-11 rounded-full bg-[#0d6b37] px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          Encaisser {formatPrix(c.total)}
        </button>
        <button onClick={fermer} className="px-3 text-sm font-semibold text-doux underline">
          Annuler
        </button>
      </div>
      <p className="mt-2 text-xs text-doux">La caisse du jour doit être ouverte. Le ticket apparaît dans la Caisse.</p>
    </div>
  );
}

function BonPreparation({ c, fermer }: { c: Commande; fermer: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-4 flex gap-2 print:hidden">
        <button onClick={fermer} className="min-h-12 rounded-full border border-bordure px-5 font-semibold text-profond">
          ← Commandes
        </button>
        <button onClick={() => window.print()} className="min-h-12 rounded-full bg-profond px-5 font-bold text-white">
          🖨️ Imprimer
        </button>
      </div>
      <article className="rounded-2xl border border-bordure p-5 print:border-0 print:p-0">
        <p className="text-center text-sm font-bold tracking-wide uppercase">{INSTITUT.nom} · Bon de préparation</p>
        <h1 className="mt-2 text-center font-serif text-3xl font-semibold">{c.reference}</h1>
        <p className="mt-1 text-center">
          {c.cliente.nom} · {c.cliente.telephone}
        </p>
        <p className="mt-1 text-center text-sm">{c.livraison.mode === "livraison" ? `🛵 À livrer : ${c.livraison.zone} — ${c.livraison.adresse}` : "🏠 Retrait à l'institut"}</p>
        <table className="mt-5 w-full text-left">
          <thead>
            <tr className="border-b-2 border-encre text-sm">
              <th className="py-1">✓</th>
              <th className="py-1">Qté</th>
              <th className="py-1">Produit</th>
            </tr>
          </thead>
          <tbody>
            {c.lignes.map((l, i) => (
              <tr key={i} className="border-b border-bordure">
                <td className="py-2 text-xl">☐</td>
                <td className="py-2 text-xl font-bold">{l.quantite}</td>
                <td className="py-2">
                  {l.nom}
                  {l.variante ? ` — ${l.variante}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-right font-bold">À encaisser : {formatPrix(c.total)}</p>
        {c.remarque && <p className="mt-2 text-sm italic">« {c.remarque} »</p>}
      </article>
    </div>
  );
}

function ReglagesBoutique({ direction, appel }: { direction: boolean; appel: (chemin: string, corps?: object) => Promise<unknown> }) {
  const [etat, setEtat] = useState<{ ouverte: boolean; zones: { id: string; nom: string; prix: number }[]; publies: number } | null>(null);
  const [zones, setZones] = useState<{ id: string; nom: string; prix: string }[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [info, setInfo] = useState("");

  useEffect(() => {
    let actif = true;
    (appel("/api/gestion/boutique") as Promise<{ ouverte: boolean; zones: { id: string; nom: string; prix: number }[]; publies: number }>)
      .then((e) => {
        if (!actif) return;
        setEtat(e);
        setZones(e.zones.map((z) => ({ ...z, prix: String(z.prix) })));
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [appel]);

  if (!etat) return null;
  return (
    <section className="mt-4 rounded-2xl border border-bordure">
      <button onClick={() => setOuvert(!ouvert)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="font-bold">
          {etat.ouverte ? "🟢 Boutique en ligne ouverte" : "⚪ Boutique en ligne fermée"} · {etat.publies} produit{etat.publies > 1 ? "s" : ""}
        </span>
        <span className="text-sm text-aza underline">{ouvert ? "Fermer" : "Réglages"}</span>
      </button>
      {ouvert && (
        <div className="border-t border-bordure p-4">
          <p className="text-sm text-doux">Pour mettre un produit en boutique : Stock → À vendre → l&apos;article → « 🛍️ Boutique » (photos, description).</p>
          {direction && (
            <button
              onClick={async () => {
                if (!etat.ouverte && !window.confirm("Ouvrir la boutique en ligne aux clientes ?")) return;
                try {
                  await appel("/api/gestion/boutique", { action: "ouverture", ouverte: !etat.ouverte });
                  setEtat({ ...etat, ouverte: !etat.ouverte });
                } catch (e) {
                  setInfo((e as Error).message);
                }
              }}
              className={`mt-3 min-h-12 rounded-full px-5 font-bold ${etat.ouverte ? "border border-bordure text-profond" : "bg-aza text-white"}`}
            >
              {etat.ouverte ? "Fermer la boutique" : "Ouvrir la boutique en ligne"}
            </button>
          )}
          <h3 className="mt-5 font-semibold">Zones et tarifs de livraison</h3>
          <div className="mt-2 space-y-2">
            {zones.map((z, i) => (
              <div key={z.id || i} className="flex gap-2">
                <input value={z.nom} onChange={(e) => setZones(zones.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)))} placeholder="Quartier (ex. Plateau)" className="min-w-0 flex-1 rounded-xl border border-bordure px-3 py-2.5" />
                <input inputMode="numeric" value={z.prix} onChange={(e) => setZones(zones.map((x, j) => (j === i ? { ...x, prix: e.target.value } : x)))} placeholder="Prix" className="w-24 rounded-xl border border-bordure px-3 py-2.5 text-right" />
                <button onClick={() => setZones(zones.filter((_, j) => j !== i))} className="px-2 text-xl text-doux" aria-label="Retirer">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => setZones([...zones, { id: "", nom: "", prix: "" }])} className="text-sm font-bold text-aza">
              + Ajouter une zone
            </button>
            <button
              onClick={async () => {
                try {
                  await appel("/api/gestion/boutique", { action: "zones", zones: zones.map((z) => ({ id: z.id, nom: z.nom, prix: Number(z.prix) })) });
                  setInfo("Zones enregistrées.");
                } catch (e) {
                  setInfo((e as Error).message);
                }
              }}
              className="ml-auto min-h-11 rounded-full bg-aza px-5 text-sm font-bold text-white"
            >
              Enregistrer les zones
            </button>
          </div>
          {info && <p className="mt-2 text-sm font-semibold text-profond">{info}</p>}
        </div>
      )}
    </section>
  );
}
