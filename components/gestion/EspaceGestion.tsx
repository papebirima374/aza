"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import type { Role } from "@/lib/agenda/statuts";
import { firebaseClient } from "@/lib/client/firebase";

export type Compte = { uid: string; nom: string; role: Role; praticienne?: string; user: User };

const ContexteCompte = createContext<Compte | null>(null);

export function useCompte(): Compte {
  const c = useContext(ContexteCompte);
  if (!c) throw new Error("useCompte hors de l'espace de gestion");
  return c;
}

const LIBELLE_ROLE: Record<Role, string> = {
  direction: "Direction",
  manager: "Manager",
  accueil: "Accueil",
  praticienne: "Praticienne",
  prestataire: "Prestataire",
  comptable: "Comptable",
};

// Déconnexion automatique après 20 minutes sans activité (cahier des charges §16) :
// le poste d'accueil reste rarement sous surveillance.
const INACTIVITE_MS = 20 * 60 * 1000;

export function EspaceGestion({ children }: { children: React.ReactNode }) {
  const chemin = usePathname();
  const [etat, setEtat] = useState<"chargement" | "deconnecte" | "refuse" | "connecte">("chargement");
  const [compte, setCompte] = useState<Compte | null>(null);
  const [raison, setRaison] = useState("");

  useEffect(() => {
    const { auth, db } = firebaseClient();
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCompte(null);
        setEtat("deconnecte");
        return;
      }
      let lectureRefusee = false;
      const lire = () =>
        getDoc(doc(db, "comptes", user.uid)).catch(() => {
          lectureRefusee = true;
          return null;
        });
      let snap = await lire();
      if (!snap?.exists()) {
        // Premier démarrage : la direction déclarée dans Vercel reçoit son rôle.
        const r = await fetch("/api/gestion/demarrer", {
          method: "POST",
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        }).catch(() => null);
        if (r?.ok) {
          lectureRefusee = false;
          snap = await lire();
          if (lectureRefusee) {
            setRaison(
              "Votre compte existe, mais la base refuse de le lire : les règles Firestore ne sont pas publiées (coller le fichier firestore.rules ENTIER dans Firestore → Règles → Publier).",
            );
          }
        }
        else if (r?.status === 503) setRaison("La clé du serveur (FIREBASE_SERVICE_ACCOUNT) n'est pas encore posée dans Vercel.");
        else if (r) setRaison((await r.json().catch(() => ({}))).erreur ?? "");
        else setRaison("Connexion au serveur impossible.");
      }
      if (!snap?.exists()) {
        setEtat("refuse");
        return;
      }
      const d = snap.data();
      if (d.actif === false) {
        setRaison("Ce compte a été désactivé par la direction.");
        setEtat("refuse");
        return;
      }
      setCompte({ uid: user.uid, nom: d.nom, role: d.role, praticienne: d.praticienne, user });
      setEtat("connecte");
    });
  }, []);

  useEffect(() => {
    if (etat !== "connecte") return;
    let minuteur = setTimeout(() => signOut(firebaseClient().auth), INACTIVITE_MS);
    const relancer = () => {
      clearTimeout(minuteur);
      minuteur = setTimeout(() => signOut(firebaseClient().auth), INACTIVITE_MS);
    };
    const evenements = ["pointerdown", "keydown", "scroll"] as const;
    evenements.forEach((e) => window.addEventListener(e, relancer, { passive: true }));
    return () => {
      clearTimeout(minuteur);
      evenements.forEach((e) => window.removeEventListener(e, relancer));
    };
  }, [etat]);

  if (etat === "chargement") return <Message titre="Chargement…" />;
  if (etat === "deconnecte") return <Connexion />;
  if (etat === "refuse") {
    return (
      <Message titre="Accès refusé" texte={raison || "Ce compte n'a pas d'accès à la gestion de l'institut."}>
        <Diagnostic />
        <button onClick={() => signOut(firebaseClient().auth)} className="mt-6 rounded-full border border-bordure px-5 py-2.5 font-semibold">
          Se déconnecter
        </button>
      </Message>
    );
  }

  return (
    <ContexteCompte.Provider value={compte}>
      {/* Téléphone : logo + Déconnexion en haut, onglets sur une 2e ligne. Écran large : une ligne. */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-bordure bg-bordeaux px-4 py-2 text-or-clair sm:h-14 sm:flex-nowrap sm:py-0">
        <Image src="/images/logo-or.png" alt="Anna Zen Attitude" width={790} height={257} className="h-8 w-auto" />
        <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto text-sm font-semibold sm:order-none sm:mx-0 sm:w-auto" aria-label="Gestion">
          {[
            { href: "/gestion", libelle: "Agenda", visible: true },
            { href: "/gestion/equipe", libelle: "Équipe", visible: compte?.role === "direction" || compte?.role === "manager" },
            { href: "/gestion/reglages", libelle: "Réglages", visible: compte?.role === "direction" || compte?.role === "manager" },
          ]
            .filter((l) => l.visible)
            .map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 ${chemin === l.href ? "bg-white/15 text-white" : "hover:text-white"}`}
              >
                {l.libelle}
              </Link>
            ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden md:inline">
            {compte?.nom} · <span className="text-or">{compte && LIBELLE_ROLE[compte.role]}</span>
          </span>
          <button
            onClick={() => signOut(firebaseClient().auth)}
            className="whitespace-nowrap rounded-full border border-or-clair/40 px-4 py-1.5 font-semibold hover:bg-white/10"
          >
            Déconnexion
          </button>
        </div>
      </header>
      {children}
    </ContexteCompte.Provider>
  );
}

function Message({ titre, texte, children }: { titre: string; texte?: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-creme px-4 text-center">
      <h1 className="font-serif text-4xl font-semibold text-profond">{titre}</h1>
      {texte && <p className="mt-3 text-doux">{texte}</p>}
      {children}
    </div>
  );
}

function Connexion() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [info, setInfo] = useState("");

  async function oubli() {
    setErreur("");
    if (!email.includes("@")) {
      setErreur("Écrivez d'abord votre email, puis touchez « Mot de passe oublié ».");
      return;
    }
    // Même réponse que l'email existe ou non : on ne révèle pas qui a un compte.
    await sendPasswordResetEmail(firebaseClient().auth, email.trim()).catch(() => {});
    setInfo("Si ce compte existe, un email vient d'être envoyé pour choisir un nouveau mot de passe.");
  }

  async function seConnecter(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur("");
    try {
      await signInWithEmailAndPassword(firebaseClient().auth, email.trim(), motDePasse);
    } catch {
      setErreur("Email ou mot de passe incorrect.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bordeaux px-4">
      <form onSubmit={seConnecter} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <Image src="/images/logo-rose.png" alt="Anna Zen Attitude" width={790} height={257} className="mx-auto h-12 w-auto" />
        <h1 className="mt-6 text-center font-serif text-3xl font-semibold text-profond">Espace de gestion</h1>
        <label className="mt-6 block">
          <span className="text-sm font-semibold">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="mt-1 block w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-semibold">Mot de passe</span>
          <input
            type="password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 block w-full rounded-xl border border-bordure px-4 py-3 outline-none focus:border-profond"
          />
        </label>
        {erreur && (
          <p className="mt-4 text-sm font-semibold text-aza-fonce" role="alert">
            {erreur}
          </p>
        )}
        <button
          type="submit"
          disabled={envoi}
          className="mt-6 w-full rounded-full bg-aza py-3 font-bold text-white hover:bg-aza-fonce disabled:opacity-50"
        >
          {envoi ? "Connexion…" : "Se connecter"}
        </button>
        <button type="button" onClick={oubli} className="mt-4 w-full text-center text-sm font-semibold text-profond underline underline-offset-4">
          Mot de passe oublié ?
        </button>
        {info && <p className="mt-3 text-center text-sm text-doux">{info}</p>}
      </form>
    </div>
  );
}

// Aide à la mise en service : ce que voient le navigateur et le serveur (aucun secret).
function Diagnostic() {
  const [lignes, setLignes] = useState<string[] | null>(null);
  useEffect(() => {
    const { app, auth } = firebaseClient();
    (async () => {
      const jeton = await auth.currentUser?.getIdToken().catch(() => undefined);
      const r = await fetch("/api/gestion/diagnostic", { headers: jeton ? { Authorization: `Bearer ${jeton}` } : {} })
        .then(async (x) => {
          const texte = await x.text();
          try {
            return JSON.parse(texte);
          } catch {
            return { http: x.status, reponse: texte.replace(/\s+/g, " ").slice(0, 200) };
          }
        })
        .catch((e) => ({ erreur: `serveur injoignable (${String(e).slice(0, 120)})` }));
      setLignes([
        `Projet du navigateur : ${app.options.projectId}`,
        ...Object.entries(r).map(([k, v]) => `${k} : ${typeof v === "object" ? JSON.stringify(v) : String(v)}`),
      ]);
    })();
  }, []);
  if (!lignes) return null;
  return (
    <div className="mt-8 w-full max-w-lg rounded-xl border border-bordure bg-white p-4 text-left">
      <p className="text-xs font-bold tracking-wide text-doux uppercase">Diagnostic (à envoyer à Birima)</p>
      <ul className="mt-2 space-y-0.5 font-mono text-xs break-all">
        {lignes.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
