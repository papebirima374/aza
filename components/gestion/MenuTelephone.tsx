"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import type { Compte } from "@/components/gestion/EspaceGestion";
import { PAGES_PILOTAGE, PastilleAvis, premierePagePilotage } from "@/components/gestion/OngletsPilotage";
import { PastilleCommandes } from "@/components/gestion/PastilleCommandes";
import { PastilleStock } from "@/components/gestion/PastilleStock";
import { PastilleCaisse } from "@/components/gestion/SuiviCaisse";
import { peut } from "@/lib/acces";
import { firebaseClient } from "@/lib/client/firebase";

// Téléphone : une barre fixée en bas avec les icônes des pages principales, et « Menu » qui
// ouvre toutes les pages en grille, rangées par thème (comme une application).

const TRAITS: Record<string, string> = {
  agenda: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  caisse: "M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 18h2M14 18h2",
  clientes: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  tableau: "M3 3v18h18M7 15l4-4 3 3 6-6",
  depenses: "M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4z",
  commandes: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
  stock: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  sessions: "M4 2v20l3-2 3 2 3-2 3 2 3-2 1 1V2l-1 1-3-2-3 2-3-2-3 2-3-2zM8 8h8M8 12h8M8 16h5",
  pointer: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2",
  pointages: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  borne: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10",
  catalogue: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01",
  collection: "M20.4 7.6 16 4l-2 2h-4L8 4 3.6 7.6 6 11l2-1v11h8V10l2 1z",
  cartes: "M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
  photos: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M21 15l-5-5L5 21",
  equipe: "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4M5 17c.5-1.5 1.7-2 3-2s2.5.5 3 2M14 9h5M14 13h4",
  reglages: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  compte: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  sortir: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  menu: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
};

function Icone({ nom, className = "h-6 w-6" }: { nom: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={TRAITS[nom]} />
    </svg>
  );
}

type Entree = { href: string; libelle: string; icone: string; groupe: string; visible: boolean; pastille?: React.ReactNode };

function entrees(compte: Compte): Entree[] {
  const role = compte.role;
  const perso = role === "praticienne" || role === "prestataire";
  const direction = role === "direction" || role === "manager";
  const pilotage = premierePagePilotage(compte);
  return [
    { href: "/gestion", libelle: perso ? "Ma journée" : "Agenda", icone: "agenda", groupe: "La journée", visible: true },
    { href: "/gestion/caisse", libelle: "Caisse", icone: "caisse", groupe: "La journée", visible: peut(compte, "caisse") || role === "comptable", pastille: <PastilleCaisse /> },
    { href: "/gestion/clientes", libelle: "Clientes", icone: "clientes", groupe: "La journée", visible: peut(compte, "clientes") },
    { href: pilotage ?? "/gestion", libelle: "Tableau de bord", icone: "tableau", groupe: "La journée", visible: Boolean(pilotage), pastille: <PastilleAvis /> },
    { href: "/gestion/depenses", libelle: "Dépenses", icone: "depenses", groupe: "Argent", visible: peut(compte, "depenses") || peut(compte, "rapports") },
    { href: "/gestion/caisse/sessions", libelle: "Sessions de caisse", icone: "sessions", groupe: "Argent", visible: ["direction", "manager", "comptable"].includes(role) || peut(compte, "jour") || peut(compte, "rapports") },
    { href: "/gestion/cartes", libelle: "Cartes cadeaux", icone: "cartes", groupe: "Argent", visible: direction || peut(compte, "caisse") },
    { href: "/gestion/commandes", libelle: "Commandes", icone: "commandes", groupe: "Boutique et stock", visible: peut(compte, "commandes"), pastille: <PastilleCommandes /> },
    { href: "/gestion/stock", libelle: "Stock", icone: "stock", groupe: "Boutique et stock", visible: ["accueil", "comptable"].includes(role) || peut(compte, "stock"), pastille: <PastilleStock /> },
    { href: "/gestion/catalogue", libelle: "Catalogue et prix", icone: "catalogue", groupe: "Boutique et stock", visible: peut(compte, "catalogue") },
    { href: "/gestion/collection", libelle: "Collection Couture", icone: "collection", groupe: "Boutique et stock", visible: direction },
    { href: "/gestion/photos", libelle: "Photos du site", icone: "photos", groupe: "Boutique et stock", visible: direction },
    { href: "/gestion/pointer", libelle: "Pointer", icone: "pointer", groupe: "L'équipe", visible: true },
    { href: "/gestion/pointage", libelle: "Pointages", icone: "pointages", groupe: "L'équipe", visible: peut(compte, "pointage") },
    { href: "/gestion/pointage/borne", libelle: "Borne QR", icone: "borne", groupe: "L'équipe", visible: peut(compte, "borne") },
    { href: "/gestion/equipe", libelle: "Équipe", icone: "equipe", groupe: "L'équipe", visible: direction },
    { href: "/gestion/mon-compte", libelle: "Mon compte", icone: "compte", groupe: "Compte", visible: true },
    { href: "/gestion/reglages", libelle: "Réglages", icone: "reglages", groupe: "Compte", visible: direction },
  ].filter((e) => e.visible);
}

const actif = (e: Entree, chemin: string) =>
  e.libelle === "Tableau de bord" ? PAGES_PILOTAGE.some((p) => chemin.startsWith(p)) : chemin === e.href || (e.href !== "/gestion" && chemin.startsWith(e.href) && !(e.href === "/gestion/caisse" && chemin.startsWith("/gestion/caisse/sessions")) && !(e.href === "/gestion/pointage" && chemin.startsWith("/gestion/pointage/borne")));

export function MenuTelephone({ compte, chemin }: { compte: Compte; chemin: string }) {
  const [ouvertSur, setOuvertSur] = useState<string | null>(null);
  const ouvert = ouvertSur === chemin;
  const toutes = entrees(compte);
  // En bas : les 4 premières pages, puis « Menu » pour tout le reste.
  const bas = toutes.filter((e) => e.groupe === "La journée" || e.href === "/gestion/stock").slice(0, 4);
  const groupes = [...new Set(toutes.map((e) => e.groupe))];

  useEffect(() => {
    if (!ouvert) return;
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setOuvertSur(null);
    window.addEventListener("keydown", echap);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", echap);
      document.body.style.overflow = "";
    };
  }, [ouvert]);

  return (
    <>
      {ouvert && (
        <div className="fixed inset-x-0 top-0 bottom-16 z-40 overflow-y-auto bg-bordeaux/95 px-4 pt-5 pb-6 text-or-clair backdrop-blur sm:hidden print:hidden" role="dialog" aria-label="Toutes les pages">
          <div className="flex items-center justify-between">
            <p className="font-serif text-2xl font-semibold text-white">Bonjour, {compte.nom.split(" ")[0]}</p>
            <button onClick={() => setOuvertSur(null)} className="h-10 w-10 rounded-full text-3xl leading-none" aria-label="Fermer le menu">
              ×
            </button>
          </div>
          {groupes.map((g) => (
            <section key={g} className="mt-5">
              <h2 className="text-xs font-bold tracking-[0.2em] text-or uppercase">{g}</h2>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {toutes
                  .filter((e) => e.groupe === g)
                  .map((e) => (
                    <Link
                      key={e.href + e.libelle}
                      href={e.href}
                      className={`relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl px-1 py-3 text-center text-xs font-semibold ${actif(e, chemin) ? "bg-aza text-white" : "bg-white/10 text-white"}`}
                    >
                      <Icone nom={e.icone} className="h-7 w-7" />
                      {e.libelle}
                      {e.pastille && <span className="absolute top-1.5 right-1.5">{e.pastille}</span>}
                    </Link>
                  ))}
                {g === "Compte" && (
                  <button
                    onClick={() => (compte.role !== "praticienne" && compte.role !== "prestataire") || window.confirm("Se déconnecter ? Pour revenir, il faudra votre numéro et votre mot de passe.") ? signOut(firebaseClient().auth) : undefined}
                    className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-white/10 px-1 py-3 text-center text-xs font-semibold text-white"
                  >
                    <Icone nom="sortir" className="h-7 w-7" />
                    Déconnexion
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-white/10 bg-bordeaux pb-[env(safe-area-inset-bottom)] text-or-clair sm:hidden print:hidden" aria-label="Pages principales">
        {bas.map((e) => {
          const ici = actif(e, chemin) && !ouvert;
          return (
            <Link key={e.href + e.libelle} href={e.href} className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${ici ? "text-white" : ""}`} aria-current={ici ? "page" : undefined}>
              {ici && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-aza" aria-hidden />}
              <Icone nom={e.icone} />
              <span className="max-w-full truncate px-1">{e.libelle === "Tableau de bord" ? "Bord" : e.libelle}</span>
              {e.pastille && <span className="absolute top-1 right-[calc(50%-1.6rem)]">{e.pastille}</span>}
            </Link>
          );
        })}
        <button onClick={() => setOuvertSur(ouvert ? null : chemin)} aria-expanded={ouvert} className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${ouvert ? "text-white" : ""}`}>
          {ouvert && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-aza" aria-hidden />}
          <Icone nom="menu" />
          Menu
        </button>
      </nav>
    </>
  );
}
