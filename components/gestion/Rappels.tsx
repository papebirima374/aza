"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompte } from "@/components/gestion/EspaceGestion";
import { INSTITUT } from "@/lib/institut";
import { telephoneCanonique } from "@/lib/telephone";

// « Rappels de demain » : un bouton par cliente, le message WhatsApp est déjà écrit.
// Quand la cliente répond OUI, on touche « Confirmé ».

type Rdv = {
  id: string;
  debut: number;
  statut: string;
  cliente: { nom: string; telephone: string };
  prestations: string[];
  acompteRequis: boolean;
  rappel: { par: string; le: number } | null;
};

const heure = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

function message(r: Rdv, date: string) {
  const jour = new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return [
    `Bonjour ${r.cliente.nom} 🌸`,
    `C'est ${INSTITUT.nom}. Nous vous attendons demain, ${jour}, à ${heure(r.debut)} pour : ${r.prestations.join(" + ")}.`,
    `📍 ${INSTITUT.adresse.rue}, ${INSTITUT.adresse.repere.toLowerCase()}.`,
    r.acompteRequis ? "Un acompte est demandé pour cette prestation (Wave ou Orange Money)." : "",
    "Merci de répondre OUI pour confirmer, ou de nous prévenir si vous ne pouvez pas venir.",
  ]
    .filter(Boolean)
    .join("\n");
}

function lien(r: Rdv, date: string) {
  const c = telephoneCanonique(r.cliente.telephone);
  return `https://wa.me/${c.length === 9 ? `221${c}` : c}?text=${encodeURIComponent(message(r, date))}`;
}

export function Rappels() {
  const compte = useCompte();
  const [ouvert, setOuvert] = useState(false);
  const [donnees, setDonnees] = useState<{ date: string; rendezVous: Rdv[] } | null>(null);
  const [version, setVersion] = useState(0);

  const appel = useCallback(
    async (chemin: string, corps?: object) => {
      const r = await fetch(chemin, {
        method: corps ? "POST" : "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await compte.user.getIdToken()}` },
        body: corps ? JSON.stringify(corps) : undefined,
      });
      return r.json();
    },
    [compte.user],
  );

  useEffect(() => {
    let actif = true;
    appel("/api/gestion/rappels")
      .then((d) => actif && d.rendezVous && setDonnees(d))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [appel, version]);

  if (!donnees) return null;
  const aEnvoyer = donnees.rendezVous.filter((r) => !r.rappel).length;

  return (
    <>
      <button
        onClick={() => setOuvert(!ouvert)}
        className={`rounded-full px-5 py-2.5 text-sm font-bold ${aEnvoyer ? "bg-[#128C4A] text-white" : "border border-bordure text-profond"}`}
      >
        📲 Rappels de demain {aEnvoyer ? `(${aEnvoyer} à envoyer)` : "✓"}
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-40 flex justify-end bg-encre/30" onClick={() => setOuvert(false)}>
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} aria-label="Rappels de demain">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-3xl font-semibold text-profond">Rappels de demain</h2>
              <button onClick={() => setOuvert(false)} className="px-2 text-2xl text-doux" aria-label="Fermer">
                ×
              </button>
            </div>
            <p className="mt-1 text-sm text-doux">
              Touchez « Envoyer » : WhatsApp s&apos;ouvre avec le message prêt. Quand la cliente répond OUI, touchez « Confirmé ».
            </p>
            {donnees.rendezVous.length === 0 && <p className="mt-6 text-center text-doux">Aucun rendez-vous demain.</p>}
            <ul className="mt-4 space-y-3">
              {donnees.rendezVous.map((r) => (
                <li key={r.id} className="rounded-2xl border border-bordure p-3">
                  <p className="font-semibold">
                    {heure(r.debut)} · {r.cliente.nom}
                  </p>
                  <p className="text-sm text-doux">{r.prestations.join(" + ")}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={lien(r, donnees.date)}
                      target="_blank"
                      rel="noopener"
                      onClick={() => appel("/api/gestion/rappels", { rdv: r.id }).then(() => setVersion((v) => v + 1))}
                      className={`flex min-h-11 items-center rounded-full px-4 text-sm font-bold ${r.rappel ? "border border-bordure text-profond" : "bg-[#128C4A] text-white"}`}
                    >
                      📲 {r.rappel ? "Renvoyer" : "Envoyer"}
                    </a>
                    {r.statut === "confirme" ? (
                      <span className="text-sm font-bold text-[#0d6b37]">✅ Confirmé</span>
                    ) : (
                      <button
                        onClick={() =>
                          appel(`/api/gestion/rendez-vous/${r.id}/statut`, { statut: "confirme" }).then(() => setVersion((v) => v + 1))
                        }
                        className="min-h-11 rounded-full border border-bordure px-4 text-sm font-semibold text-profond"
                      >
                        Confirmé
                      </button>
                    )}
                    {r.rappel && <span className="text-xs text-doux">✓ envoyé par {r.rappel.par}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}
