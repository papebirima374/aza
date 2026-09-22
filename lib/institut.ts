// Informations de l'institut, saisies à un seul endroit et reprises partout sur le site
// (en-tête, pied de page, contact, données Google).
// Source : plaquette V2 — la référence la plus récente. Le catalogue 2023 ne compte plus.

export const INSTITUT = {
  nom: "Anna Zen Attitude",
  slogan: "Institut de beauté · Coiffure & bien-être",
  site: "https://annazen-attitude.com",
  adresse: {
    rue: "Point-E Canal 4 – Villa N°7",
    repere: "En face complexe Hibiscus",
    ville: "Dakar",
    pays: "SN",
  },
  // Coordonnées approximatives du Point E : à remplacer par le point exact de la villa.
  gps: { lat: 14.6937, lng: -17.4589 },
  telephones: [
    { affiche: "+221 33 825 87 10", e164: "+221338258710" },
    { affiche: "+221 77 445 41 65", e164: "+221774454165" },
    { affiche: "+221 77 552 53 53", e164: "+221775525353" },
  ],
  whatsapp: "221774454165",
  instagram: "https://www.instagram.com/annazen_attitude/",
  instagramPseudo: "@annazen_attitude",
  horaires: [
    { jours: "Lundi au samedi", heures: "de 9h à 19h", schema: ["Mo", "Tu", "We", "Th", "Fr", "Sa"], ouvre: "09:00", ferme: "19:00" },
    { jours: "Dimanche", heures: "de 10h à 18h", schema: ["Su"], ouvre: "10:00", ferme: "18:00" },
  ],
  marques: ["Clarins", "Nuxe", "Yves Rocher", "Clinique", "Peggy Sage", "Kera Care", "Cantu", "Creme of Nature"],
} as const;

export const TELEPHONE_PRINCIPAL = INSTITUT.telephones[0];

export function lienWhatsApp(message?: string): string {
  const base = `https://wa.me/${INSTITUT.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export const LIEN_ITINERAIRE = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  "Anna Zen Attitude, Point E, Dakar",
)}`;
