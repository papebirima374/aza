"use client";

import { useEffect, useState } from "react";

// Bouton « Installer l'application » : sur Android (Chrome), la fenêtre d'installation du
// téléphone ; sur iPhone, les deux gestes à faire dans Safari. Rien si elle est déjà installée.
type Invite = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function Installer({ nom, discret = false }: { nom: string; discret?: boolean }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [iphone, setIphone] = useState(false);
  const [installee, setInstallee] = useState(true);
  const [aide, setAide] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setInstallee(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
      setIphone(/iPhone|iPad|iPod/.test(navigator.userAgent));
    }, 0);
    const garder = (e: Event) => {
      e.preventDefault();
      setInvite(e as Invite);
    };
    const faite = () => {
      setInstallee(true);
      setInvite(null);
    };
    window.addEventListener("beforeinstallprompt", garder);
    window.addEventListener("appinstalled", faite);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", garder);
      window.removeEventListener("appinstalled", faite);
    };
  }, []);

  if (installee || (!invite && !iphone)) return null;
  const style = discret
    ? "inline-flex min-h-11 items-center gap-2 rounded-full border border-or/60 px-4 text-sm font-semibold text-or-clair hover:bg-white/10"
    : "inline-flex min-h-12 items-center gap-2 rounded-full bg-profond px-5 font-bold text-white";
  return (
    <div>
      <button
        type="button"
        className={style}
        onClick={async () => {
          if (invite) {
            await invite.prompt();
            await invite.userChoice.catch(() => null);
            setInvite(null);
          } else setAide(!aide);
        }}
      >
        📲 Installer l&apos;application {nom}
      </button>
      {aide && iphone && (
        <p className={`mt-2 max-w-sm text-sm ${discret ? "text-or-clair" : "text-doux"}`}>
          Dans Safari, touchez <b>Partager</b> (le carré avec une flèche vers le haut), puis <b>Sur l&apos;écran d&apos;accueil</b>.
        </p>
      )}
    </div>
  );
}
