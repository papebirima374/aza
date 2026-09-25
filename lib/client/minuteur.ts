"use client";

// Minuteur des soins : sons produits par le navigateur (pas de fichier à télécharger) et
// écran maintenu allumé pendant un soin. Un navigateur ne joue un son qu'après un geste de
// la personne : « Je commence » (ou « Activer le son ») prépare le son.

let contexte: AudioContext | null = null;

/** À appeler dans un clic : autorise ensuite les bips. */
export function preparerSon() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!contexte) contexte = new AC();
    if (contexte.state === "suspended") void contexte.resume();
  } catch {
    // pas de son possible sur cet appareil : l'écran clignote quand même
  }
}

export const sonPret = () => contexte?.state === "running";

/** Une suite de bips : [fréquence Hz, durée ms] ; volume de 0 à 1. */
function jouer(notes: [number, number][], volume = 0.6) {
  if (!contexte) return;
  let t = contexte.currentTime + 0.02;
  for (const [freq, ms] of notes) {
    const osc = contexte.createOscillator();
    const gain = contexte.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(gain).connect(contexte.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.05);
    t += ms / 1000 + 0.12;
  }
}

function dire(texte: string) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = "fr-FR";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

/** 5 minutes avant la fin : deux bips doux et une phrase. */
export function avertir(minutes: number) {
  jouer([[880, 180], [880, 180]], 0.4);
  setTimeout(() => dire(`Plus que ${minutes} minutes.`), 700);
  navigator.vibrate?.([200, 100, 200]);
}

/** Fin du temps : alarme bien audible, phrase, vibration. */
export function alarme(nom: string) {
  jouer([[1175, 250], [880, 250], [1175, 250], [880, 250], [1175, 400]], 0.9);
  setTimeout(() => dire(`Le temps est terminé pour ${nom}.`), 1800);
  navigator.vibrate?.([400, 150, 400, 150, 400]);
}

/** Garde l'écran allumé tant que `actif` (sinon la tablette s'éteint et le minuteur s'arrête). */
export async function garderEcranAllume(): Promise<() => void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const verrou = await nav.wakeLock?.request("screen");
    return () => void verrou?.release().catch(() => {});
  } catch {
    return () => {};
  }
}
