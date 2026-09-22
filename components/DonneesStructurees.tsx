import { INSTITUT } from "@/lib/institut";

// Données « BeautySalon » lues par Google (cahier des charges §8.1).
export function DonneesStructurees() {
  const donnees = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: INSTITUT.nom,
    url: INSTITUT.site,
    image: `${INSTITUT.site}/icon.png`,
    telephone: INSTITUT.telephones[0].e164,
    priceRange: "3 000 F – 75 000 F",
    address: {
      "@type": "PostalAddress",
      streetAddress: `${INSTITUT.adresse.rue}, ${INSTITUT.adresse.repere}`,
      addressLocality: INSTITUT.adresse.ville,
      addressCountry: INSTITUT.adresse.pays,
    },
    geo: { "@type": "GeoCoordinates", latitude: INSTITUT.gps.lat, longitude: INSTITUT.gps.lng },
    openingHoursSpecification: INSTITUT.horaires.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.schema.map((j) => `https://schema.org/${JOURS[j]}`),
      opens: h.ouvre,
      closes: h.ferme,
    })),
    sameAs: [INSTITUT.instagram],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees).replace(/</g, "\\u003c") }}
    />
  );
}

const JOURS: Record<string, string> = {
  Mo: "Monday",
  Tu: "Tuesday",
  We: "Wednesday",
  Th: "Thursday",
  Fr: "Friday",
  Sa: "Saturday",
  Su: "Sunday",
};
