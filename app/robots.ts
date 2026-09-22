import type { MetadataRoute } from "next";
import { INSTITUT } from "@/lib/institut";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${INSTITUT.site}/sitemap.xml`,
  };
}
