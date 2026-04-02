import { redirect } from 'next/navigation';

import { getCurrentUserContext } from '@/modules/auth_users';
import { buildNotificationsPageViewModel } from '@/modules/notifications/application/buildNotificationsPageViewModel';
import { NotificationsPageClient } from '@/modules/notifications/ui/NotificationsPageClient';

export const metadata = {
  title: 'Notificaciones | La Sentadita Hub',
};

export default async function NotificationsPage() {
  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  const viewModel = await buildNotificationsPageViewModel(ctx);

  if (viewModel.mode === 'forbidden') {
    redirect('/app');
  }

  return (
    <main className="app-shell stack rise-in">
      <section className="page-intro">
        <div>
          <h1 className="page-title">Notificaciones</h1>
          <p className="subtitle">Bandeja personal de eventos, avisos y dispositivos push.</p>
        </div>
      </section>

      <section className="panel flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-background/50">
          <NotificationsPageClient
            canRegisterPushDevice={viewModel.canRegisterPushDevice}
            notifications={viewModel.notifications}
            pushDevices={viewModel.pushDevices}
            unreadCount={viewModel.unreadCount}
          />
        </div>
      </section>
    </main>
  );
}
