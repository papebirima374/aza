"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { Repartition } from "@/components/gestion/Rapports";
import { LIBELLE_NOTE, type Avis } from "@/lib/avis";
import { telephoneCanonique } from "@/lib/telephone";

// Avis des clientes (direction, manager) : la note moyenne, ceux à regarder en premier
// (3 étoiles ou moins), et le choix de ceux qui vont sur le site.

type Filtre = "a-regarder" | "tous" | "publiables" | "publies";
const dateCourte = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

function lienWhatsApp(a: Avis) {
  if (!a.cliente?.telephone) return null;
  const c = telephoneCanonique(a.cliente.telephone);
  const texte = `Bonjour ${a.prenom}, ici Anna Zen Attitude. Merci pour votre avis sur votre visite du ${dateCourte(a.ticket.date)}. Nous sommes désolées que tout n'ait pas été parfait : pouvez-vous nous en dire un peu plus ?`;
  return `https://wa.me/${c.length === 9 ? `221${c}` : c}?text=${encodeURIComponent(texte)}`;
}

export function AvisClientes() {
  const compte = useCompte();
  const direction = compte.role === "direction";
  const [donnees, setDonnees] = useState<{ avis: Avis[]; lienGoogle: string } | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("a-regarder");
  const [erreur, setErreur] = useState("");
  const [lien, setLien] = useState("");
  const [info, setInfo] = useState("");

  const charger = useCallback(async () => {
    const r = await fetch("/api/gestion/avis", { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erreur ?? "Avis indisponibles.");
    return j as { avis: Avis[]; lienGoogle: string };
  }, [compte.user]);

  useEffect(() => {
    let actif = true;
    charger()
      .then((j) => {
        if (!actif) return;
        setDonnees(j);
        setLien(j.lienGoogle ?? "");
      })
      .catch((e: Error) => actif && setErreur(e.message));
    return () => {
      actif = false;
    };
  }, [charger]);

  async function agir(corps: Record<string, unknown>) {
    setErreur("");
    const r = await fetch("/api/gestion/avis", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
      body: JSON.stringify(corps),
    });
    const j = await r.json();
    if (!r.ok) return setErreur(j.erreur ?? "Action impossible.");
    setDonnees(await charger());
    window.dispatchEvent(new Event("aza-avis"));
    return true;
  }

  if (!donnees) return <p className="p-8 text-center text-doux">{erreur || "Chargement des avis…"}</p>;
  const avis = donnees.avis;
  const aRegarder = avis.filter((a) => !a.traite);
  const liste = {
    "a-regarder": aRegarder,
    tous: avis,
    publiables: avis.filter((a) => a.accordPublication && !a.publie),
    publies: avis.filter((a) => a.publie),
  }[filtre];
  const moyenne = avis.length ? avis.reduce((s, a) => s + a.note, 0) / avis.length : 0;
  const FILTRES: [Filtre, string, number][] = [
    ["a-regarder", "À regarder", aRegarder.length],
    ["tous", "Tous", avis.length],
    ["publiables", "Publiables", avis.filter((a) => a.accordPublication && !a.publie).length],
    ["publies", "Sur le site", avis.filter((a) => a.publie).length],
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="font-serif text-4xl font-semibold text-profond">Avis des clientes</h1>
      <p className="text-sm text-doux sm:text-base">12 derniers mois · lien du reçu WhatsApp ou QR code du ticket.</p>

      {avis.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-bordure p-6 text-center text-doux">
          Pas encore d&apos;avis. Ils arriveront avec les reçus envoyés par WhatsApp et les tickets imprimés.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border border-bordure p-4">
          <div className="text-center">
            <p className="font-serif text-5xl font-semibold text-profond">{moyenne.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</p>
            <p className="text-xl text-[#b7791f]" aria-hidden>
              {"★".repeat(Math.round(moyenne))}
              <span className="text-bordure">{"★".repeat(5 - Math.round(moyenne))}</span>
            </p>
            <p className="text-sm text-doux">
              sur 5 · {avis.length} avis
            </p>
          </div>
          <div className="min-w-0">
            <Repartition repartition={[1, 2, 3, 4, 5].map((n) => avis.filter((a) => a.note === n).length)} />
          </div>
        </div>
      )}

      {erreur && <p className="mt-4 rounded-xl bg-rose-50 p-3 font-semibold text-aza-fonce">{erreur}</p>}

      {avis.length > 0 && (
        <>
          <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
            {FILTRES.map(([f, l, n]) => (
              <button
                key={f}
                onClick={() => setFiltre(f)}
                aria-pressed={filtre === f}
                className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${filtre === f ? "bg-profond text-white" : "border border-bordure text-profond"}`}
              >
                {l} <span className={filtre === f ? "text-white/70" : "text-doux"}>{n}</span>
              </button>
            ))}
          </div>
          {liste.length === 0 && (
            <p className="mt-4 text-doux">{filtre === "a-regarder" ? "Rien à regarder : tous les avis sont traités. 🌸" : "Aucun avis ici."}</p>
          )}
          <ul className="mt-4 grid gap-3">
            {liste.map((a) => {
              const wa = lienWhatsApp(a);
              return (
                <li key={a.id} className={`rounded-2xl border p-4 ${!a.traite ? "border-aza bg-rose-50/40" : "border-bordure"}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p>
                      <span className="text-lg text-[#b7791f]" aria-label={`${a.note} étoiles sur 5`}>
                        {"★".repeat(a.note)}
                        <span className="text-bordure">{"★".repeat(5 - a.note)}</span>
                      </span>{" "}
                      <span className="font-semibold">{LIBELLE_NOTE[a.note]}</span>
                    </p>
                    <p className="text-sm text-doux">
                      {a.cliente?.nom ?? a.prenom} · {dateCourte(a.date)} · {a.ticket.reference}
                    </p>
                  </div>
                  {a.commentaire ? <p className="mt-2 whitespace-pre-line">« {a.commentaire} »</p> : <p className="mt-2 text-sm italic text-doux">Pas de commentaire.</p>}
                  <p className="mt-2 text-xs text-doux">
                    {a.prestations.join(" · ")}
                    {a.praticiennes.length > 0 && ` — avec ${a.praticiennes.map((p) => p.nom).join(" et ")}`}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {!a.traite && wa && (
                      <a href={wa} target="_blank" rel="noopener" className="flex min-h-10 items-center rounded-full bg-[#128C4A] px-4 text-sm font-bold text-white">
                        Répondre sur WhatsApp
                      </a>
                    )}
                    {!a.traite ? (
                      <button onClick={() => agir({ action: "traite", id: a.id })} className="min-h-10 rounded-full border border-bordure px-4 text-sm font-semibold">
                        ✓ Traité
                      </button>
                    ) : (
                      a.note <= 3 && <span className="text-xs text-doux">✓ Traité</span>
                    )}
                    {a.publie && <span className="rounded-full bg-creme px-3 py-1 text-xs font-bold text-profond">🌐 Sur le site</span>}
                    {direction && a.accordPublication && (
                      <button
                        onClick={() => agir({ action: a.publie ? "retirer" : "publier", id: a.id })}
                        className="min-h-10 rounded-full border border-bordure px-4 text-sm font-semibold text-profond"
                      >
                        {a.publie ? "Retirer du site" : "Mettre sur le site"}
                      </button>
                    )}
                    {!a.accordPublication && <span className="text-xs text-doux">La cliente préfère que son avis reste privé.</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {direction && (
        <details className="mt-8 rounded-2xl border border-bordure">
          <summary className="cursor-pointer p-4 font-semibold text-profond">⚙️ Avis Google (facultatif)</summary>
          <form
            className="border-t border-bordure p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setInfo("");
              if (await agir({ action: "lien-google", lien: lien.trim() })) setInfo("Enregistré.");
            }}
          >
            <p className="text-sm text-doux">
              Collez ici le lien « Demander des avis » de la fiche Google de l&apos;institut. Une cliente qui met 4 ou 5 étoiles se verra proposer de le
              copier sur Google, ce qui aide l&apos;institut à être trouvé.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={lien}
                onChange={(e) => setLien(e.target.value)}
                placeholder="https://g.page/r/…/review"
                className="min-w-0 flex-1 rounded-xl border border-bordure px-4 py-2.5"
              />
              <button className="min-h-11 rounded-full bg-profond px-5 font-bold text-white">Enregistrer</button>
            </div>
            {info && <p className="mt-2 text-sm font-semibold text-[#0d6b37]">{info}</p>}
          </form>
        </details>
      )}
    </div>
  );
}
