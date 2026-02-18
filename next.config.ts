import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    qualities: [70, 75],
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
};

export default nextConfig;
