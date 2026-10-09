// Messages WhatsApp ouverts par un lien wa.me. WhatsApp sur ordinateur (Windows) abîme les
// émojis passés dans le lien : « 🌸 » devient « ? » ou « � » chez la cliente. On les retire
// donc tous, ainsi que les espaces laissés en trop ; le texte reste lisible partout.

const EMOJIS = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}︎️‍⃣]/gu;

export function sansEmoji(texte: string): string {
  return texte
    .replace(EMOJIS, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]{2,}/g, " ").trim())
    .join("\n");
}

/** Texte prêt pour un lien wa.me (?text=…). */
export const texteWhatsApp = (texte: string) => encodeURIComponent(sansEmoji(texte));
