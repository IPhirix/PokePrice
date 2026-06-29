import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.4.52'],
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.tcgdex.net' },
      { protocol: 'https', hostname: '*.tcgdex.net' },
      { protocol: 'https', hostname: 'images.pokemontcg.io' },
    ],
  },
};

export default nextConfig;
