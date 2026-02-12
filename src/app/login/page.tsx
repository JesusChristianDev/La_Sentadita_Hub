import {
  getLoginErrorMessage,
  type LoginErrorCode,
} from '@/shared/feedbackMessages';

import { login } from './actions';
import PasswordInput from './password-input';
import LoginSubmitButton from './submit-button';

type SearchParams = { e?: LoginErrorCode };

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const msg = getLoginErrorMessage(sp.e);
  const emailError =
    sp.e === 'missing' ? 'Escribe tu email.' : sp.e === 'bad' ? 'Revisa el email.' : null;
  const passwordError =
    sp.e === 'missing'
      ? 'Escribe tu contrasena.'
      : sp.e === 'bad'
        ? 'Email o contrasena incorrectos.'
        : null;

  return (
    <main id="main-content" tabIndex={-1} className="login-shell rise-in">
      <section className="login-card stack">
        <header>
          <p className="muted text-xs uppercase tracking-[0.16em]">Acceso interno</p>
          <h1 className="page-title mt-2">La Sentadita Hub</h1>
          <p className="subtitle">Ingresa para gestionar operacion, equipo y seguimiento.</p>
        </header>

        {msg ? (
          <p className="notice error" role="alert" aria-live="assertive">
            {msg}
          </p>
        ) : null}

        <form action={login} className="stack">
          <label className="field" htmlFor="email">
            <span>Email</span>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? 'email-error' : undefined}
            />
          </label>
          {emailError ? (
            <p id="email-error" className="field-error" role="status">
              {emailError}
            </p>
          ) : null}

          <label className="field" htmlFor="password">
            <span>Contrasena</span>
            <PasswordInput
              id="password"
              name="password"
              ariaInvalid={Boolean(passwordError)}
              ariaDescribedBy={passwordError ? 'password-error' : undefined}
            />
          </label>
          {passwordError ? (
            <p id="password-error" className="field-error" role="status">
              {passwordError}
            </p>
          ) : null}

          <label className="field-inline" htmlFor="remember">
            <input id="remember" name="remember" type="checkbox" value="on" />
            <span>Recordarme por 30 dias</span>
          </label>

          <LoginSubmitButton />
        </form>
      </section>
    </main>
  );
}
