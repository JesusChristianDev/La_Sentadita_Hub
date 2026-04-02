import { NextResponse } from 'next/server';

import { createRequest, listMyRequests, listRestaurantRequests } from '@/modules/requests';
import {
  CreateRequestSchema,
  type CreateRequestSchemaType,
} from '@/modules/requests/domain/requestSchemas';

function parseRestaurantId(searchParams: URLSearchParams): string | null {
  const value = searchParams.get('restaurantId');
  return value && value.trim() ? value.trim() : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') ?? 'mine';

  try {
    if (scope === 'restaurant') {
      const restaurantId = parseRestaurantId(url.searchParams);
      if (!restaurantId) {
        return NextResponse.json({ error: 'MISSING_RESTAURANT_ID' }, { status: 400 });
      }

      return NextResponse.json(await listRestaurantRequests(restaurantId));
    }

    return NextResponse.json(await listMyRequests());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'REQUESTS_LIST_FAILED';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const payload = CreateRequestSchema.safeParse((await request.json().catch(() => null)) as CreateRequestSchemaType | null);
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await createRequest(payload.data), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'REQUEST_CREATE_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
