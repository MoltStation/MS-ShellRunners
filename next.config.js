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
  async headers() {
    const frameAncestors = [
      "https://moltstation.games",
      "https://www.moltstation.games",
      "http://127.0.0.1:3000",
      "http://localhost:3000",
    ].join(" ");

    return [
      {
        source: "/shellrunners/spectate",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors};`,
          },
        ],
      },
      {
        source: "/shellrunners",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors};`,
          },
        ],
      },
    ];
  },
};
