/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — the UI is served as static assets by Cloudflare Pages,
  // while the API lives in /functions (Pages Functions with the D1 binding).
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
