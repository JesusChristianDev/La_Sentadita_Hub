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
        src: '/icons/pwa-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/pwa-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/pwa-maskable.png',
        sizes: '512x512',
        type: 'image/png',
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
