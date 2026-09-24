"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, sendPasswordResetEmail, signInWithCustomToken, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import type { Role } from "@/lib/agenda/statuts";
import { firebaseClient } from "@/lib/client/firebase";
import { PastilleCaisse, SuiviCaisse } from "@/components/gestion/SuiviCaisse";
import { PastilleStock } from "@/components/gestion/PastilleStock";
import { PastilleCommandes } from "@/components/gestion/PastilleCommandes";

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

  // Une praticienne utilise son propre téléphone et se connecte par un lien WhatsApp :
  // pas de déconnexion automatique pour elle (elle devrait redemander un lien).
  const telephonePerso = compte?.role === "praticienne" || compte?.role === "prestataire";
  useEffect(() => {
    if (etat !== "connecte" || telephonePerso) return;
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
  }, [etat, telephonePerso]);

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
      <SuiviCaisse compte={compte}>
      {/* Téléphone : logo + Déconnexion en haut, onglets sur une 2e ligne. Écran large : une ligne. */}
      <header className="sticky top-0 z-30 flex print:hidden flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-bordure bg-bordeaux px-4 py-2 text-or-clair sm:h-14 sm:flex-nowrap sm:py-0">
        <Image src="/images/logo-or.png" alt="Anna Zen Attitude" width={790} height={257} className="h-8 w-auto" />
        <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto text-sm font-semibold sm:order-none sm:mx-0 sm:w-auto" aria-label="Gestion">
          {[
            { href: "/gestion/jour", libelle: "Aujourd'hui", visible: compte?.role === "direction" || compte?.role === "manager" },
            { href: "/gestion", libelle: telephonePerso ? "Ma journée" : "Agenda", visible: true },
            { href: "/gestion/clientes", libelle: "Clientes", visible: ["direction", "manager", "accueil"].includes(compte?.role ?? "") },
            { href: "/gestion/caisse", libelle: "Caisse", visible: ["direction", "manager", "accueil", "comptable"].includes(compte?.role ?? "") },
            { href: "/gestion/commandes", libelle: "Commandes", visible: ["direction", "manager", "accueil"].includes(compte?.role ?? "") },
            { href: "/gestion/stock", libelle: "Stock", visible: ["direction", "manager", "accueil", "comptable"].includes(compte?.role ?? "") },
            { href: "/gestion/catalogue", libelle: "Catalogue", visible: compte?.role === "direction" },
            { href: "/gestion/equipe", libelle: "Équipe", visible: compte?.role === "direction" || compte?.role === "manager" },
            { href: "/gestion/reglages", libelle: "Réglages", visible: compte?.role === "direction" || compte?.role === "manager" },
          ]
            .filter((l) => l.visible)
            .map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 ${chemin === l.href || (l.href !== "/gestion" && chemin.startsWith(l.href)) ? "bg-white/15 text-white" : "hover:text-white"}`}
              >
                {l.libelle}
                {l.href === "/gestion/caisse" && <PastilleCaisse />}
                {l.href === "/gestion/stock" && <PastilleStock />}
                {l.href === "/gestion/commandes" && <PastilleCommandes />}
              </Link>
            ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <Link href="/gestion/mon-compte" className="flex min-h-10 max-w-[9rem] items-center gap-1 truncate rounded-full px-2 py-1 hover:bg-white/10 md:max-w-none" title="Mon compte">
            <span aria-hidden>👤</span>
            <span className="truncate font-semibold text-white">{compte?.nom?.split(" ")[0]}</span>
            <span className="hidden text-or md:inline">· {compte && LIBELLE_ROLE[compte.role]}</span>
          </Link>
          <button
            onClick={() => {
              if (telephonePerso && !window.confirm("Se déconnecter ? Pour revenir, il faudra votre numéro et votre mot de passe.")) return;
              signOut(firebaseClient().auth);
            }}
            className="hidden whitespace-nowrap rounded-full border border-or-clair/40 px-4 py-1.5 font-semibold hover:bg-white/10 sm:block"
          >
            Déconnexion
          </button>
        </div>
      </header>
      {children}
      </SuiviCaisse>
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
  // Par défaut : numéro de téléphone + mot de passe (le plus simple pour l'équipe).
  const [parEmail, setParEmail] = useState(false);
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [info, setInfo] = useState("");

  async function oubli() {
    setErreur("");
    if (!parEmail) {
      setInfo("Demandez à la direction : elle vous donne un nouveau mot de passe en un instant (Équipe → Modifier).");
      return;
    }
    if (!identifiant.includes("@")) {
      setErreur("Écrivez d'abord votre email, puis touchez « Mot de passe oublié ».");
      return;
    }
    // Même réponse que l'email existe ou non : on ne révèle pas qui a un compte.
    await sendPasswordResetEmail(firebaseClient().auth, identifiant.trim()).catch(() => {});
    setInfo("Si ce compte existe, un email vient d'être envoyé pour choisir un nouveau mot de passe.");
  }

  async function seConnecter(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur("");
    try {
      if (parEmail) {
        await signInWithEmailAndPassword(firebaseClient().auth, identifiant.trim(), motDePasse).catch(() => {
          throw new Error("Email ou mot de passe incorrect.");
        });
      } else {
        const r = await fetch("/api/connexion-equipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telephone: identifiant, motDePasse }),
        }).catch(() => {
          throw new Error("Pas de connexion internet.");
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.erreur ?? "Numéro ou mot de passe incorrect.");
        await signInWithCustomToken(firebaseClient().auth, j.jeton);
      }
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  const champ = "mt-1 block w-full rounded-xl border border-bordure px-4 py-3 text-lg outline-none focus:border-profond";
  return (
    <div className="flex min-h-screen items-center justify-center bg-bordeaux px-4">
      <form onSubmit={seConnecter} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <Image src="/images/logo-rose.png" alt="Anna Zen Attitude" width={790} height={257} className="mx-auto h-12 w-auto" />
        <h1 className="mt-6 text-center font-serif text-3xl font-semibold text-profond">Espace de gestion</h1>
        <label className="mt-6 block">
          <span className="text-sm font-semibold">{parEmail ? "✉️ Email" : "📱 Votre numéro de téléphone"}</span>
          <input
            key={parEmail ? "email" : "tel"}
            type={parEmail ? "email" : "tel"}
            inputMode={parEmail ? "email" : "tel"}
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            autoComplete="username"
            placeholder={parEmail ? "" : "77 123 45 67"}
            required
            className={champ}
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-semibold">🔑 Mot de passe</span>
          <span className="mt-1 flex gap-2">
            <input
              type={voir ? "text" : "password"}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete="current-password"
              required
              className={`${champ} mt-0 min-w-0 flex-1`}
            />
            <button type="button" onClick={() => setVoir(!voir)} className="rounded-xl border border-bordure px-3 text-xl" aria-label={voir ? "Cacher le mot de passe" : "Voir le mot de passe"}>
              {voir ? "🙈" : "👁️"}
            </button>
          </span>
        </label>
        {erreur && (
          <p className="mt-4 text-sm font-semibold text-aza-fonce" role="alert">
            {erreur}
          </p>
        )}
        <button type="submit" disabled={envoi} className="mt-6 min-h-12 w-full rounded-full bg-aza text-lg font-bold text-white hover:bg-aza-fonce disabled:opacity-50">
          {envoi ? "Connexion…" : "Se connecter"}
        </button>
        <button type="button" onClick={oubli} className="mt-4 w-full text-center text-sm font-semibold text-profond underline underline-offset-4">
          Mot de passe oublié ?
        </button>
        {info && <p className="mt-3 text-center text-sm text-doux">{info}</p>}
        <button
          type="button"
          onClick={() => {
            setParEmail(!parEmail);
            setIdentifiant("");
            setErreur("");
            setInfo("");
          }}
          className="mt-6 w-full text-center text-xs text-doux underline"
        >
          {parEmail ? "Se connecter avec mon numéro de téléphone" : "Se connecter avec un email"}
        </button>
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
