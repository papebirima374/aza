"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { lienAttente, useRetards } from "@/components/gestion/AlerteHeure";
import type { Compte } from "@/components/gestion/EspaceGestion";
import { useAEncaisser } from "@/components/gestion/SuiviCaisse";
import { ROLES_AGENDA } from "@/lib/agenda/statuts";

// Le centre de notifications : une cloche en haut, avec le nombre de choses qui attendent
// une action. En direct : les clientes en retard et celles à encaisser. Du serveur (relu à
// chaque page et chaque minute) : rendez-vous pris en ligne, commandes, avis, stock,
// anniversaires, caisses oubliées. Chacun ne voit que ce que ses accès permettent.

type Notification = {
  id: string;
  icone: string;
  titre: string;
  detail?: string;
  lien: string;
  nombre: number;
  elements?: { id: string; texte: string; lien: string }[];
};

const CLE_VUS = "aza-notifications-vus";
const heure = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
function lireVus(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLE_VUS) ?? "[]");
  } catch {
    return [];
  }
}

export function CentreNotifications({ compte }: { compte: Compte }) {
  const chemin = usePathname();
  const retards = useRetards();
  const aEncaisser = useAEncaisser();
  const [serveur, setServeur] = useState<Notification[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [vus, setVus] = useState<string[]>([]);
  const [deplie, setDeplie] = useState(false);
  const gerante = ROLES_AGENDA.includes(compte.role);

  useEffect(() => {
    let actif = true;
    const lire = async () => {
      const r = await fetch("/api/gestion/notifications", { headers: { Authorization: `Bearer ${await compte.user.getIdToken()}` } });
      if (r.ok && actif) setServeur(await r.json());
    };
    const t0 = setTimeout(() => {
      setVus(lireVus());
      lire().catch(() => {});
    }, 0);
    const t = setInterval(() => lire().catch(() => {}), 60_000);
    const relire = () => lire().catch(() => {});
    for (const e of ["aza-commandes", "aza-avis"]) window.addEventListener(e, relire);
    return () => {
      actif = false;
      clearTimeout(t0);
      clearInterval(t);
      for (const e of ["aza-commandes", "aza-avis"]) window.removeEventListener(e, relire);
    };
  }, [compte.user, chemin]);

  // Fermer avec Échap ou en touchant ailleurs.
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: KeyboardEvent | PointerEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as Element).closest("[data-cloche]")) setOuvert(false);
    };
    document.addEventListener("keydown", fermer);
    document.addEventListener("pointerdown", fermer);
    return () => {
      document.removeEventListener("keydown", fermer);
      document.removeEventListener("pointerdown", fermer);
    };
  }, [ouvert]);

  // Rendez-vous en ligne déjà vus sur cet appareil : ils ne comptent plus.
  const notifs = serveur
    .map((n) => (n.elements ? { ...n, elements: n.elements.filter((e) => !vus.includes(e.id)) } : n))
    .map((n) => (n.elements ? { ...n, nombre: n.elements.length, titre: `${n.elements.length} rendez-vous pris en ligne` } : n))
    .filter((n) => n.nombre > 0);
  const total = retards.length + aEncaisser.length + notifs.reduce((s, n) => s + n.nombre, 0);
  const marquerVu = (ids: string[]) => {
    const n = [...new Set([...vus, ...ids])].slice(-300);
    setVus(n);
    try {
      localStorage.setItem(CLE_VUS, JSON.stringify(n));
    } catch {
      // navigation privée : vu pour cette page seulement
    }
  };
  const fermer = () => setOuvert(false);

  return (
    <div className="relative" data-cloche>
      <button
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-label={total ? `Notifications : ${total} à traiter` : "Notifications"}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-white/10"
      >
        <span aria-hidden>🔔</span>
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-aza px-1 text-xs font-bold text-white">{total > 99 ? "99+" : total}</span>
        )}
      </button>
      {ouvert && (
        <div className="fixed inset-x-3 top-14 z-50 max-h-[75vh] overflow-y-auto rounded-2xl border border-bordure bg-white text-encre shadow-2xl sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-[24rem]">
          <p className="sticky top-0 border-b border-bordure bg-white px-4 py-3 font-serif text-xl font-semibold text-profond">Notifications</p>
          {total === 0 && <p className="px-4 py-8 text-center text-doux">Rien à traiter pour le moment.</p>}

          {retards.length > 0 && (
            <section className="border-b border-bordure px-4 py-3">
              <p className="font-bold">
                ⏰ {retards.length} cliente{retards.length > 1 ? "s" : ""} en retard
              </p>
              <ul className="mt-1 space-y-1.5">
                {retards.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href="/gestion" onClick={fermer} className="min-w-0 truncate hover:underline">
                      <b>{heure(r.debut)}</b> · {r.cliente.nom}
                    </Link>
                    {gerante && (
                      <a href={lienAttente(r)} target="_blank" rel="noopener" className="shrink-0 rounded-full bg-[#128C4A] px-3 py-1 text-xs font-bold text-white">
                        WhatsApp
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {aEncaisser.length > 0 && (
            <section className="border-b border-bordure px-4 py-3">
              <p className="font-bold">
                💰 {aEncaisser.length} cliente{aEncaisser.length > 1 ? "s" : ""} à encaisser
              </p>
              <ul className="mt-1 space-y-1">
                {aEncaisser.map((r) => (
                  <li key={r.id} className="text-sm">
                    <Link href={`/gestion/caisse?rdv=${r.id}`} onClick={fermer} className="hover:underline">
                      {r.cliente.nom} · {r.prestations.map((p) => p.nom).join(" + ")}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {notifs.map((n) => (
            <section key={n.id} className="border-b border-bordure px-4 py-3 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <Link href={n.lien} onClick={fermer} className="min-w-0 hover:underline">
                  <p className="font-bold">
                    {n.icone} {n.titre}
                  </p>
                  {n.detail && <p className="text-sm text-doux">{n.detail}</p>}
                </Link>
                {n.elements && (
                  <button onClick={() => marquerVu(n.elements!.map((e) => e.id))} className="shrink-0 rounded-full border border-bordure px-3 py-1 text-xs font-semibold text-doux">
                    Tout vu
                  </button>
                )}
              </div>
              {n.elements && (
                <ul className="mt-1 space-y-1">
                  {n.elements.slice(0, deplie ? 30 : 3).map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={e.lien} onClick={() => (marquerVu([e.id]), fermer())} className="min-w-0 hover:underline">
                        {e.texte}
                      </Link>
                      <button onClick={() => marquerVu([e.id])} className="shrink-0 text-xs font-semibold text-doux underline">
                        Vu
                      </button>
                    </li>
                  ))}
                  {!deplie && n.elements.length > 3 && (
                    <li>
                      <button onClick={() => setDeplie(true)} className="text-sm font-semibold text-profond underline">
                        Voir les {n.elements.length - 3} autres
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
