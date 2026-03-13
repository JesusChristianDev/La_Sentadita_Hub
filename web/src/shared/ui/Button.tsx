import type { ButtonHTMLAttributes } from 'react';

import { cx } from './cx';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'default' | 'small';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({
  className,
  size = 'default',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        'button',
        variant !== 'primary' && variant,
        size === 'small' && 'small',
        className,
      )}
      type={type}
      {...props}
    />
  );
}
