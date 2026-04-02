import { NextResponse } from 'next/server';

import { loadBackendSession } from '@/modules/auth_users';

export async function GET() {
  const session = await loadBackendSession();

  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  return NextResponse.json({
    currentEmployment: session.currentEmployment,
    employments: session.employments,
    generatedAt: session.generatedAt,
  });
}
