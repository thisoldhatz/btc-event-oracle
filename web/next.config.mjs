/** @type {import('next').NextConfig} */
const BASE_PATH = "/btc"; // the dashboard lives at vadym.online/btc

const nextConfig = {
  output: "export",        // static HTML/JS export -> copied into cPanel public_html/btc
  basePath: BASE_PATH,     // prefixes routes + assets (Link is basePath-aware)
  trailingSlash: true,     // /btc/disclaimer -> .../index.html (clean on LiteSpeed, no rewrites)
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH }, // exposed to client fetch() in lib/data.ts
};

export default nextConfig;
