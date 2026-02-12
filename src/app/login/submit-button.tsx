'use client';

import { useFormStatus } from 'react-dom';

export default function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="button" aria-busy={pending} disabled={pending}>
      {pending ? 'Entrando...' : 'Entrar'}
    </button>
  );
}
