import { ImageResponse } from 'next/og';
import { createElement as h } from 'react';

export const runtime = 'edge';
export const contentType = 'image/png';

export function GET() {
  return new ImageResponse(
    h(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px',
          background: 'linear-gradient(180deg, #050B17 0%, #0A1F3A 100%)',
          color: '#F5F7FF',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
        },
      },
      h('div', { style: { fontSize: 54, fontWeight: 700, letterSpacing: 6 } }, 'LA SENTADITA'),
      h('div', { style: { marginTop: 16, fontSize: 48, fontWeight: 600, opacity: 0.95 } }, 'Hub'),
    ),
    {
      width: 512,
      height: 512,
    },
  );
}
