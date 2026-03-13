import Link, { type LinkProps } from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

type ChipLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    active?: boolean;
    children: ReactNode;
  };

export function ChipLink({
  active = false,
  children,
  className,
  ...props
}: ChipLinkProps) {
  return (
    <Link className={cx('chip', active && 'active', className)} {...props}>
      {children}
    </Link>
  );
}
