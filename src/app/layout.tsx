import './globals.css';

import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { PwaRegister } from './components/pwa-register';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const MANIFEST_VERSION = '20260212-1';

export const metadata: Metadata = {
  title: 'La Sentadita Hub',
  description: 'Operacion diaria de restaurantes',
  manifest: `/manifest.webmanifest?v=${MANIFEST_VERSION}`,
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <PwaRegister />
        <a href="#main-content" className="skip-link">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
