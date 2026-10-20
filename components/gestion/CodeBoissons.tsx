"use client";

import { useEffect, useState } from "react";
import { ICONES_RUBRIQUE, MAX_ARTICLES, MAX_RUBRIQUES, type Rubrique } from "@/lib/boissons";
import { Qr } from "@/components/gestion/BornePointage";
import { useCompte } from "@/components/gestion/EspaceGestion";

// Le code QR du menu des boissons, à imprimer et poser dans l'institut. S'il a circulé
// (photo partagée…), « Changer le code » rend l'ancien QR inutilisable.

export function CodeBoissons() {
  const compte = useCompte();
  const [code, setCode] = useState<string | null>(null);
  const [carte, setCarte] = useState<Rubrique[] | null>(null);
  const [erreur, setErreur] = useState("");

  async function appel(changer: boolean) {
    setErreur("");
    try {
      const r = await fetch("/api/gestion/boissons" + (changer ? "" : "?qr=1"), {
        method: changer ? "POST" : "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: changer ? JSON.stringify({ action: "nouveau-code" }) : undefined,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur ?? "Erreur");
      setCode(j.code);
      if (j.carte) setCarte(j.carte);
    } catch (e) {
      setErreur((e as Error).message);
    }
  }
  useEffect(() => {
    const t = setTimeout(() => appel(false), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lien = code ? `${window.location.origin}/boissons?c=${code}` : "";
  return (
    <section id="boissons" className="scroll-mt-20 rounded-2xl border border-bordure p-5">
      <style>{`@media print { body * { visibility: hidden } #affiche-boissons, #affiche-boissons * { visibility: visible } #affiche-boissons { position: fixed; inset: 0; padding: 2cm } }`}</style>
      <h2 className="font-serif text-2xl font-semibold text-profond">Menu offert aux clientes (code QR)</h2>
      <p className="mt-1 text-sm text-doux">
        Imprimez ce code et posez-le dans l&apos;institut. La cliente le scanne, choisit sa boisson offerte : la caisse, l&apos;accueil et sa prestataire sont prévenues jusqu&apos;à ce que
        quelqu&apos;un appuie sur « Servie ».
      </p>
      {erreur && <p className="mt-3 rounded-xl bg-aza/10 p-3 text-sm font-semibold text-profond">{erreur}</p>}
      {code && (
        <>
          <div id="affiche-boissons" className="mx-auto mt-4 max-w-xs text-center">
            <p className="font-serif text-2xl font-semibold text-profond">☕ Une boisson offerte</p>
            <p className="text-sm text-doux">Scannez avec l&apos;appareil photo de votre téléphone</p>
            <div className="mt-2">
              <Qr texte={lien} libelle="QR code du menu des boissons" />
            </div>
            <p className="font-serif text-lg text-profond">Anna Zen Attitude</p>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button onClick={() => window.print()} className="min-h-11 rounded-full bg-aza px-5 font-bold text-white">
              🖨️ Imprimer le code QR
            </button>
            <a href={lien} target="_blank" rel="noopener" className="flex min-h-11 items-center rounded-full border border-bordure px-5 font-semibold text-profond">
              Voir le menu
            </a>
            <button
              onClick={() => window.confirm("Changer le code ? L'ancien QR imprimé ne marchera plus : il faudra imprimer le nouveau.") && appel(true)}
              className="min-h-11 rounded-full border border-bordure px-5 text-sm font-semibold text-doux"
            >
              Changer le code
            </button>
          </div>
        </>
      )}
      {carte && <ModifierMenu initial={carte} />}
    </section>
  );
}

// Ajouter ou retirer une boisson, un repas, une rubrique. Rien n'est changé avant « Enregistrer ».
function ModifierMenu({ initial }: { initial: Rubrique[] }) {
  const compte = useCompte();
  const [carte, setCarte] = useState(initial);
  const [nouveaux, setNouveaux] = useState<Record<number, string>>({});
  const [rubrique, setRubrique] = useState("");
  const [icone, setIcone] = useState("🍽️");
  const [modifie, setModifie] = useState(false);
  const [message, setMessage] = useState("");
  const changer = (c: Rubrique[]) => {
    setCarte(c);
    setModifie(true);
    setMessage("");
  };

  function ajouter(i: number) {
    const nom = (nouveaux[i] ?? "").trim();
    if (!nom) return;
    changer(carte.map((g, j) => (j === i ? { ...g, boissons: [...g.boissons, { id: "", nom }] } : g)));
    setNouveaux({ ...nouveaux, [i]: "" });
  }

  async function enregistrer() {
    setMessage("");
    try {
      const r = await fetch("/api/gestion/boissons", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: JSON.stringify({ action: "menu", carte }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur ?? "Erreur");
      setCarte(j.carte);
      setModifie(false);
      setMessage("✅ Menu enregistré : les clientes le voient tout de suite.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  return (
    <div className="mt-6 border-t border-bordure pt-4">
      <h3 className="font-serif text-xl font-semibold text-profond">Ce que propose le menu</h3>
      <p className="text-sm text-doux">Ajoutez une boisson, un repas… ou retirez ce qui n&apos;est plus disponible. Le même code QR reste valable.</p>
      <div className="mt-3 space-y-4">
        {carte.map((g, i) => (
          <div key={i} className="rounded-xl bg-creme p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-profond">
                {g.icone} {g.groupe}
              </p>
              <button
                onClick={() => window.confirm(`Retirer la rubrique « ${g.groupe} » et tout ce qu'elle contient ?`) && changer(carte.filter((_, j) => j !== i))}
                className="min-h-9 rounded-full px-3 text-xs font-semibold text-doux underline"
              >
                Retirer la rubrique
              </button>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {g.boissons.map((b, k) => (
                <li key={k} className="flex items-center gap-1 rounded-full border border-bordure bg-white py-1 pl-3 pr-1 text-sm">
                  {b.nom}
                  <button
                    onClick={() => changer(carte.map((x, j) => (j === i ? { ...x, boissons: x.boissons.filter((_, n) => n !== k) } : x)))}
                    className="h-8 w-8 rounded-full text-doux hover:bg-creme"
                    aria-label={`Retirer ${b.nom}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            {g.boissons.length < MAX_ARTICLES && (
              <div className="mt-2 flex gap-2">
                <input
                  value={nouveaux[i] ?? ""}
                  onChange={(e) => setNouveaux({ ...nouveaux, [i]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && ajouter(i)}
                  maxLength={40}
                  placeholder="ex. Jus de bissap"
                  aria-label={`Ajouter dans ${g.groupe}`}
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-bordure bg-white px-3 text-sm"
                />
                <button onClick={() => ajouter(i)} className="min-h-10 shrink-0 rounded-full bg-profond px-4 text-sm font-bold text-white">
                  Ajouter
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {carte.length < MAX_RUBRIQUES && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select value={icone} onChange={(e) => setIcone(e.target.value)} className="min-h-10 rounded-lg border border-bordure bg-white px-2" aria-label="Icône de la rubrique">
            {ICONES_RUBRIQUE.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input value={rubrique} onChange={(e) => setRubrique(e.target.value)} maxLength={40} placeholder="Nouvelle rubrique (ex. Repas)" className="min-h-10 min-w-0 flex-1 rounded-lg border border-bordure px-3 text-sm" />
          <button
            onClick={() => {
              if (!rubrique.trim()) return;
              changer([...carte, { groupe: rubrique.trim(), icone, boissons: [] }]);
              setRubrique("");
            }}
            className="min-h-10 rounded-full border border-bordure px-4 text-sm font-bold text-profond"
          >
            + Rubrique
          </button>
        </div>
      )}
      {message && <p className={`mt-3 rounded-xl p-3 text-sm font-semibold ${message.startsWith("✅") ? "bg-[#e7f5ec] text-[#0d6b37]" : "bg-aza/10 text-profond"}`}>{message}</p>}
      <button disabled={!modifie} onClick={enregistrer} className="mt-4 min-h-12 w-full rounded-full bg-aza font-bold text-white disabled:opacity-40">
        Enregistrer le menu
      </button>
    </div>
  );
}
