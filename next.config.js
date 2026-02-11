/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  reactStrictMode: true,
  // OneDrive can lock `.next/trace` causing EPERM during `next build` on Windows.
  // Using a different dist dir avoids the stale locked file.
  distDir: '.next_local',
  // In production we host the game under https://moltstation.games/shellrunners.
  // In local dev, keep basePath empty so http://localhost:3000/ works.
  basePath: isProd ? '/shellrunners' : '',
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
