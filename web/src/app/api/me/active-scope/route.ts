import { NextResponse } from 'next/server';
import { z } from 'zod';

import { loadBackendSession, persistActiveScope } from '@/modules/auth_users';

const activeScopeSchema = z.object({
  scopeId: z.string().uuid().nullable(),
  scopeType: z.enum(['organization', 'chain', 'company', 'restaurant', 'zone', 'self']),
});

export async function POST(request: Request) {
  const session = await loadBackendSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const payload = activeScopeSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: 'INVALID_SCOPE' }, { status: 400 });
  }

  const nextScope = payload.data;
  const allowed = session.availableScopes.some(
    (scope) =>
      scope.scopeType === nextScope.scopeType && scope.scopeId === nextScope.scopeId,
  );

  if (!allowed) {
    return NextResponse.json({ error: 'FORBIDDEN_SCOPE' }, { status: 403 });
  }

  const effectiveRestaurantId =
    nextScope.scopeType === 'restaurant'
      ? nextScope.scopeId
      : nextScope.scopeType === 'zone'
        ? session.currentEmployment?.zoneAssignments.find(
            (assignment) => assignment.isCurrent && assignment.zoneId === nextScope.scopeId,
          )?.restaurantId ?? null
        : null;

  await persistActiveScope(nextScope, effectiveRestaurantId);

  return NextResponse.json({
    activeScope: nextScope,
    effectiveRestaurantId,
    ok: true,
  });
}
