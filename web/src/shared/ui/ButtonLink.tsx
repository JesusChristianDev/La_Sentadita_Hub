import Link, { type LinkProps } from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

type ButtonLinkVariant = 'primary' | 'secondary' | 'danger';
type ButtonLinkSize = 'default' | 'small';

type ButtonLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    children: ReactNode;
    size?: ButtonLinkSize;
    variant?: ButtonLinkVariant;
  };

export function ButtonLink({
  children,
  className,
  size = 'default',
  variant = 'primary',
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cx(
        'button',
        variant !== 'primary' && variant,
        size === 'small' && 'small',
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
