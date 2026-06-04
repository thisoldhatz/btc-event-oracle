import type { MetadataRoute } from "next";
import { getSeo, SIGNALS, SITE } from "@/lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const seo = getSeo();
  const lastModified = seo.as_of ? new Date(seo.as_of) : new Date();
  const paths = [
    "",
    "/guide",
    "/about",
    "/disclaimer",
    "/accuracy",
    "/methodology",
    "/who",
    ...Object.keys(SIGNALS).map((slug) => `/signals/${slug}`),
    ...seo.recaps.map((r) => `/recap/${r.week}`),
  ];
  return paths.map((p) => ({
    url: `${SITE}${p}/`,
    lastModified,
    changeFrequency: "daily",
    priority: p === "" || p === "/accuracy" ? 1 : 0.7,
  }));
}
