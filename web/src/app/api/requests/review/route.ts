import { NextResponse } from 'next/server';

import { reviewRequest } from '@/modules/requests';
import {
  ReviewRequestSchema,
  type ReviewRequestSchemaType,
} from '@/modules/requests/domain/requestSchemas';

export async function POST(request: Request) {
  const payload = ReviewRequestSchema.safeParse((await request.json().catch(() => null)) as ReviewRequestSchemaType | null);
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST_REVIEW_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await reviewRequest(payload.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'REQUEST_REVIEW_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
