/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",        // static HTML/JS export -> copied into cPanel public_html
  trailingSlash: true,     // /disclaimer -> /disclaimer/index.html (clean on LiteSpeed, no rewrites)
  images: { unoptimized: true },
};

export default nextConfig;
