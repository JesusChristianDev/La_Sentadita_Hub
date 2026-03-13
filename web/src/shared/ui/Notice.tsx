import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

type NoticeTone = 'default' | 'error' | 'ok' | 'warning';

type NoticeProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
  tone?: NoticeTone;
};

export function Notice({
  children,
  className,
  tone = 'default',
  ...props
}: NoticeProps) {
  return (
    <p
      className={cx('notice', tone !== 'default' && tone, className)}
      {...props}
    >
      {children}
    </p>
  );
}
