import type { ButtonHTMLAttributes } from 'react';

import { cx } from './cx';

type ChipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function ChipButton({
  active = false,
  className,
  type = 'button',
  ...props
}: ChipButtonProps) {
  return (
    <button
      className={cx('chip', active && 'active', className)}
      type={type}
      {...props}
    />
  );
}
