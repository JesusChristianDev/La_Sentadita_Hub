import './globals.css';

import type { Metadata, Viewport } from 'next';

import { InstallPwaButton } from './components/install-pwa-button';
import { PwaRegister } from './components/pwa-register';

const MANIFEST_VERSION = '20260212-2';

export const metadata: Metadata = {
  title: 'La Sentadita Hub',
  description: 'Operacion diaria de restaurantes',
  manifest: `/manifest.webmanifest?v=${MANIFEST_VERSION}`,
  icons: {
    icon: [
      { url: '/icons/pwa-192-20260212.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/pwa-512-20260212.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/icons/pwa-192-20260212.png', type: 'image/png', sizes: '192x192' }],
  },
  appleWebApp: {
    capable: true,
    title: 'La Sentadita Hub',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#101820',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <PwaRegister />
        <InstallPwaButton />
        <a href="#main-content" className="skip-link">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
