import Link from 'next/link';

type Props = {
  canSeeEmployees: boolean;
};

export function ScreenNav({ canSeeEmployees }: Props) {
  return (
    <nav className="header-nav" aria-label="Navegacion principal de pantallas">
      <Link href="/app" className="header-nav-link">
        Dashboard
      </Link>
      {canSeeEmployees ? (
        <Link href="/employees" className="header-nav-link">
          Personal
        </Link>
      ) : null}
    </nav>
  );
}
