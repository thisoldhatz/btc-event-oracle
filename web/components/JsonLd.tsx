/** Renders a JSON-LD <script> for SEO/GEO structured data. Server-rendered into
 *  the static HTML so crawlers and LLMs can read the structured claims. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** The sitewide Organization, used as the E-E-A-T anchor (brand persona, no
 *  personal name) — `sameAs` points to the public source repo. */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BTC Event Oracle",
    url: "https://vadym.online/btc",
    description:
      "An independent, non-commercial project publishing an honest, hourly Bitcoin forecast and scoring its own accuracy openly against a random-walk benchmark.",
    sameAs: ["https://github.com/thisoldhatz/btc-event-oracle"],
  };
}
