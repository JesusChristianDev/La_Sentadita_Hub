import { listMyNotifications } from '@/modules/notifications';

import { jsonOk, readIntSearchParam } from '../_routeUtils';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const limit = readIntSearchParam(searchParams, 'limit') ?? 50;
  const notifications = await listMyNotifications(limit);
  return jsonOk({ notifications });
}
