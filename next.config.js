/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // OneDrive can lock `.next/trace` causing EPERM during `next build` on Windows.
  // Use an alternate dist dir locally, but keep the default `.next` on Vercel
  // (Vercel's Next builder expects the default output directory).
  ...(process.env.VERCEL ? {} : { distDir: '.next_local' }),
  // Keep root routing unchanged; canonical runtime page is /shellrunners.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
      },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};
