"use client";

// Ventes en attente d'envoi, gardées SUR L'APPAREIL (cahier des charges C-11 : aucune vente
// perdue après une coupure de courant ou de connexion). Elles survivent à une page fermée
// ou à un téléphone éteint, et partent dès que la connexion revient.

export type VenteEnAttente = {
  idLocal: string;
  faitLe: number;
  corps: Record<string, unknown>;
  total: number;
  resume: string;
  /** Refus du serveur (règle métier) : la vente attend une décision, elle n'est pas perdue. */
  refus?: string;
};

const CLE = "aza-caisse-attente";

export function lireAttente(): VenteEnAttente[] {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as VenteEnAttente[]) : [];
  } catch {
    return [];
  }
}

function ecrire(liste: VenteEnAttente[]) {
  try {
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    // stockage impossible (navigation privée) : la vente reste dans la page ouverte
  }
}

export function ajouterAttente(v: VenteEnAttente) {
  ecrire([...lireAttente().filter((x) => x.idLocal !== v.idLocal), v]);
}

export function retirerAttente(idLocal: string) {
  ecrire(lireAttente().filter((x) => x.idLocal !== idLocal));
}

export function marquerRefus(idLocal: string, refus: string) {
  ecrire(lireAttente().map((x) => (x.idLocal === idLocal ? { ...x, refus } : x)));
}

export function nouvelIdLocal(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Une panne de réseau (et pas un refus du serveur) ? */
export function erreurReseau(e: unknown): boolean {
  return e instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);
}
