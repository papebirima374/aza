import type { MetadataRoute } from "next";
import { UNIVERS } from "@/lib/catalogue";
import { INSTITUT } from "@/lib/institut";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/prestations", "/forfaits", "/boutique", "/boutique/couture", "/boutique/perruques-sur-mesure", "/institut", "/contact", "/reservation"];
  return [
    ...pages.map((p) => ({ url: `${INSTITUT.site}${p}` })),
    ...UNIVERS.map((u) => ({ url: `${INSTITUT.site}/prestations/${u.id}` })),
  ];
}
