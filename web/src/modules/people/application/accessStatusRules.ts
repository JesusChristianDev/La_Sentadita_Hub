// D-028: máquina de estados canónica para access_status de persona.
// Solo transiciones explícitamente permitidas son válidas.

export type AccessStatus =
  | 'pending_activation'
  | 'active'
  | 'suspended'
  | 'archived'
  | 'blocked';

export type AccessStatusTransitionError = 'already_in_state' | 'invalid_transition';

export type AccessStatusTransitionResult =
  | { ok: true }
  | { ok: false; errorCode: AccessStatusTransitionError };

type AllowedTransition = { from: AccessStatus; to: AccessStatus };

const ALLOWED_TRANSITIONS: AllowedTransition[] = [
  { from: 'pending_activation', to: 'active' },
  { from: 'active', to: 'suspended' },
  { from: 'active', to: 'archived' },
  { from: 'suspended', to: 'active' },
  { from: 'suspended', to: 'archived' },
];

export function validateAccessStatusTransition(
  current: AccessStatus,
  next: AccessStatus,
): AccessStatusTransitionResult {
  if (current === next) return { ok: false, errorCode: 'already_in_state' };

  const allowed = ALLOWED_TRANSITIONS.some((t) => t.from === current && t.to === next);
  if (!allowed) return { ok: false, errorCode: 'invalid_transition' };

  return { ok: true };
}

export function reachableFrom(current: AccessStatus): AccessStatus[] {
  return ALLOWED_TRANSITIONS.filter((t) => t.from === current).map((t) => t.to);
}
