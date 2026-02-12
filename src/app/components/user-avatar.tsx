import Image from 'next/image';

import type { AppRole } from '@/modules/auth_users';

type Props = {
  fullName?: string | null;
  role?: AppRole | null;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  alt?: string;
};

const AVATAR_SIZE_PX: Record<NonNullable<Props['size']>, number> = {
  sm: 34,
  md: 44,
  lg: 68,
};

function getInitials(value?: string | null): string {
  const safe = value?.trim();
  if (!safe) return 'US';
  const parts = safe.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'US';
}

function roleBadge(role?: AppRole | null): string {
  if (!role) return 'US';
  if (role === 'admin') return 'AD';
  if (role === 'office') return 'OF';
  if (role === 'manager') return 'GE';
  if (role === 'sub_manager') return 'SG';
  return 'EM';
}

export function UserAvatar({
  fullName,
  role,
  avatarUrl = null,
  size = 'md',
  alt,
}: Props) {
  const initials = getInitials(fullName);
  const ariaLabel = alt ?? `Avatar de ${fullName?.trim() || 'usuario'}`;
  const avatarSizePx = AVATAR_SIZE_PX[size];

  return (
    <div className={`user-avatar user-avatar--${size}`} data-role={role ?? 'employee'} aria-label={ariaLabel}>
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={ariaLabel}
          className="user-avatar__image"
          width={avatarSizePx}
          height={avatarSizePx}
          sizes={`${avatarSizePx}px`}
          quality={70}
        />
      ) : (
        <>
          <span className="user-avatar__initials" aria-hidden="true">
            {initials}
          </span>
          <span className="user-avatar__role" aria-hidden="true">
            {roleBadge(role)}
          </span>
        </>
      )}
    </div>
  );
}
