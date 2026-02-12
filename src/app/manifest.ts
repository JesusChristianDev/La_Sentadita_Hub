import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'La Sentadita Hub',
    short_name: 'Sentadita Hub',
    description: 'Operacion diaria de restaurantes',
    start_url: '/app',
    display: 'standalone',
    background_color: '#101820',
    theme_color: '#101820',
    lang: 'es',
    scope: '/',
    icons: [
      {
        src: '/icons/pwa-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/pwa-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/pwa-maskable.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        url: '/app',
      },
      {
        name: 'Personal',
        short_name: 'Personal',
        url: '/employees',
      },
      {
        name: 'Mi perfil',
        short_name: 'Perfil',
        url: '/me',
      },
    ],
  };
}
