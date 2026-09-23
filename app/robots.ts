import type { MetadataRoute } from "next";
import { INSTITUT } from "@/lib/institut";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/gestion", "/api"] },
    sitemap: `${INSTITUT.site}/sitemap.xml`,
  };
}
