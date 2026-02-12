'use client';

import { useState } from 'react';

type PasswordInputProps = {
  id?: string;
  name: string;
  className?: string;
  autoComplete?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
};

export default function PasswordInput({
  id,
  name,
  className = 'input',
  autoComplete = 'current-password',
  ariaInvalid = false,
  ariaDescribedBy,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input-wrap">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        className={className}
        autoComplete={autoComplete}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-controls={id}
        aria-label={visible ? 'Ocultar contrasena' : 'Mostrar contrasena'}
        aria-pressed={visible}
      >
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  );
}
