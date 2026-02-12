import Link from 'next/link';

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
      }}
    >
      <section
        style={{
          width: 'min(480px, 100%)',
          border: '1px solid #2e3a4b',
          borderRadius: '16px',
          padding: '20px',
          background: '#101820',
          color: '#f8fafc',
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>Sin conexion</h1>
        <p style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
          No hay red en este momento. Puedes volver a intentar cuando recuperes conexion.
        </p>
        <Link
          href="/app"
          style={{
            display: 'inline-block',
            padding: '10px 14px',
            borderRadius: '10px',
            background: '#f59e0b',
            color: '#101820',
            textDecoration: 'none',
            fontWeight: 700,
          }}
        >
          Reintentar
        </Link>
      </section>
    </main>
  );
}
