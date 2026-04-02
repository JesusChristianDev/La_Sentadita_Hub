import { jsonOk, resolveRouteParams } from '@/app/api/_routeUtils';
import { markNotificationRead } from '@/modules/notifications';

type RouteParams = {
  notificationId: string;
};

export async function PATCH(
  _request: Request,
  context: { params: RouteParams | Promise<RouteParams> },
) {
  const params = await resolveRouteParams(context.params);
  await markNotificationRead(params.notificationId);
  return jsonOk({ ok: true });
}
