import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PokePrice — Pokémon Card Tracker',
    short_name: 'PokePrice',
    description: 'Track and analyze your Pokémon card collection',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f1117',
    theme_color: '#f59e0b',
    categories: ['finance', 'utilities'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [],
  }
}
