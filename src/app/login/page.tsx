import {
  getLoginErrorMessage,
  type LoginErrorCode,
} from '@/shared/feedbackMessages';

import { login } from './actions';

type SearchParams = { e?: LoginErrorCode };

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const msg = getLoginErrorMessage(sp.e);

  return (
    <main id="main-content" tabIndex={-1} className="login-shell rise-in">
      <section className="login-card stack">
        <header>
          <p className="muted text-xs uppercase tracking-[0.16em]">Acceso interno</p>
          <h1 className="page-title mt-2">La Sentadita Hub</h1>
          <p className="subtitle">
            Accede a la operacion diaria, equipo y seguimiento interno.
          </p>
        </header>

        {msg ? (
          <p className="notice error" role="alert" aria-live="assertive">
            {msg}
          </p>
        ) : null}

        <form action={login} className="stack">
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" className="input" />
          </label>

          <label className="field">
            <span>Contrasena</span>
            <input name="password" type="password" className="input" />
          </label>

          <button type="submit" className="button">
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
