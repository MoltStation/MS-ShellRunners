/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // OneDrive can lock `.next/trace` causing EPERM during `next build` on Windows.
  // Using a different dist dir avoids the stale locked file.
  distDir: '.next_local',
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
