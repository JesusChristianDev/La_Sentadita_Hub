import 'server-only';

import { buildFrontendSessionView, type CurrentSession } from '@/modules/auth_users';
import { can } from '@/modules/authz';

import type { NotificationRecord, PushDeviceRecord } from '../domain/notificationTypes';
import { listMyNotifications, listMyPushDevices } from './notificationService';

export type NotificationsPageViewModel = {
  canRegisterPushDevice: boolean;
  mode: 'forbidden' | 'self_service';
  notifications: NotificationRecord[];
  pushDevices: PushDeviceRecord[];
  unreadCount: number;
};

export async function buildNotificationsPageViewModel(
  session: CurrentSession,
): Promise<NotificationsPageViewModel> {
  const frontendSession = buildFrontendSessionView(session);

  if (!can(session.requestContext, 'notifications.view')) {
    return {
      canRegisterPushDevice: false,
      mode: 'forbidden',
      notifications: [],
      pushDevices: [],
      unreadCount: 0,
    };
  }

  const [notifications, pushDevices] = await Promise.all([
    listMyNotifications(100),
    listMyPushDevices(),
  ]);

  return {
    canRegisterPushDevice: frontendSession.person.accessStatus === 'active',
    mode: 'self_service',
    notifications,
    pushDevices,
    unreadCount: notifications.filter((notification) => notification.read_at === null).length,
  };
}
